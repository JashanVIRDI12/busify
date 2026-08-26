import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * OpenRouter chat completions.
 *
 * The API key is read through `serverEnv()`, which imports `server-only` — so
 * pulling this module into a Client Component is a build error rather than a
 * leaked key. Nothing here is ever imported by the browser bundle.
 *
 * Plain fetch rather than an SDK: OpenRouter speaks the OpenAI wire format and
 * we use one endpoint, so a dependency would buy nothing.
 */
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/** Verified against the live model list. Override with OPENROUTER_MODEL. */
export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type CompletionResult = {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string | null;
};

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

export function aiConfigured(): boolean {
  try {
    return Boolean(serverEnv().OPENROUTER_API_KEY);
  } catch {
    return false;
  }
}

export function aiModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
}

export async function chatCompletion({
  messages,
  tools,
  temperature = 0,
  maxTokens = 1200,
  signal,
}: {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<CompletionResult> {
  const env = serverEnv();

  if (!env.OPENROUTER_API_KEY) {
    throw new AiUnavailableError(
      "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the server.",
    );
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // OpenRouter uses these for attribution on their dashboard.
      "HTTP-Referer": env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "Busify AI",
    },
    body: JSON.stringify({
      model: aiModel(),
      messages,
      ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      // Deterministic by default: this assistant reports facts from the
      // database, and creativity is the failure mode we are guarding against.
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // Surface the provider's own message — "model not found" and "insufficient
    // credits" are things the operator can actually fix.
    throw new AiUnavailableError(
      `OpenRouter returned ${response.status}. ${body.slice(0, 300)}`,
    );
  }

  const payload = (await response.json()) as {
    choices?: {
      message?: { content?: string | null; tool_calls?: ToolCall[] };
      finish_reason?: string;
    }[];
    error?: { message?: string };
  };

  if (payload.error) {
    throw new AiUnavailableError(payload.error.message ?? "OpenRouter rejected the request.");
  }

  const choice = payload.choices?.[0];

  return {
    content: choice?.message?.content ?? null,
    toolCalls: choice?.message?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? null,
  };
}
