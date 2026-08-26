import "server-only";

import type { Session } from "@/lib/auth/session";
import {
  AiUnavailableError,
  chatCompletion,
  type ChatMessage,
} from "./client";
import { executeTool, isMutatingTool, toolDefinitions } from "./tools";
import { describeAction, type ProposedAction, isActionName } from "./actions";

export type ConversationTurn = { role: "user" | "assistant"; content: string };

export type AssistantResult = {
  reply: string;
  /** Which tools ran, so the interface can show its working. */
  steps: { tool: string; summary: string }[];
  /** Set when the model wants to change something. Nothing has happened yet. */
  pendingAction?: ProposedAction;
};

/**
 * Cap on tool rounds.
 *
 * The model asks for a tool, we run it, it sees the result and may ask for
 * another. Without a ceiling a confused model can loop indefinitely on the
 * operator's budget.
 */
const MAX_ROUNDS = 4;

/** Keep the payload bounded — a huge tool result costs tokens and adds nothing. */
function summariseForModel(value: unknown): string {
  const json = JSON.stringify(value);
  return json.length > 6000 ? `${json.slice(0, 6000)}… (truncated)` : json;
}

function describeCall(tool: string, args: string): string {
  try {
    const parsed = JSON.parse(args || "{}") as Record<string, unknown>;
    const parts = Object.entries(parsed)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v)}`);
    return parts.length ? `${tool} — ${parts.join(", ")}` : tool;
  } catch {
    return tool;
  }
}

/**
 * Run one operator question to completion.
 *
 * The tool-calling loop is deliberately server-side end to end: the model never
 * touches the database, it only names a tool. We execute it under the
 * operator's own RLS session and hand back the result.
 */
export async function runAssistant({
  session,
  systemPrompt,
  history,
  question,
  signal,
}: {
  session: Session;
  systemPrompt: string;
  history: ConversationTurn[];
  question: string;
  signal?: AbortSignal;
}): Promise<AssistantResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    // Trim history so a long session cannot grow the request without bound.
    ...history.slice(-8).map((turn) =>
      turn.role === "user"
        ? ({ role: "user", content: turn.content } as const)
        : ({ role: "assistant", content: turn.content } as const),
    ),
    { role: "user", content: question },
  ];

  const steps: AssistantResult["steps"] = [];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const result = await chatCompletion({
      messages,
      tools: toolDefinitions,
      signal,
    });

    if (result.toolCalls.length === 0) {
      return {
        reply:
          result.content?.trim() ||
          "I could not put an answer together. Try rephrasing the question.",
        steps,
      };
    }

    messages.push({
      role: "assistant",
      content: result.content,
      tool_calls: result.toolCalls,
    });

    // A mutating call ends the turn: describe it and hand it to the operator.
    const mutating = result.toolCalls.find((call) => isMutatingTool(call.function.name));
    if (mutating && isActionName(mutating.function.name)) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(mutating.function.arguments || '{}');
      } catch {
        return { reply: 'I could not read the details of that change. Try rephrasing.', steps };
      }

      const proposed = await describeAction(mutating.function.name, args);

      return {
        reply:
          result.content?.trim() ||
          'I can make that change. Confirm below and I will apply it.',
        steps,
        pendingAction: proposed,
      };
    }

    for (const call of result.toolCalls) {
      const output = await executeTool(
        call.function.name,
        call.function.arguments,
        { session },
      );

      steps.push({
        tool: call.function.name,
        summary: describeCall(call.function.name, call.function.arguments),
      });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: summariseForModel(output),
      });
    }
  }

  // Out of rounds. Ask for a close-out rather than returning nothing, but stop
  // offering tools so it has to answer from what it already has.
  const final = await chatCompletion({
    messages: [
      ...messages,
      {
        role: "user",
        content:
          "Answer now from what you have already looked up. If it is not enough, say what is still missing.",
      },
    ],
    signal,
  });

  return {
    reply:
      final.content?.trim() ||
      "I ran out of steps before reaching an answer. Try a narrower question.",
    steps,
  };
}

export { AiUnavailableError };
