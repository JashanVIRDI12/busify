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

type CompletionRequest = {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
};

/** Extra attempts after the model garbles a function call. */
const MALFORMED_CALL_RETRIES = 2;

/**
 * One chat turn, with a retry for garbled tool calls.
 *
 * Small Gemini models sometimes emit a function call that does not parse, and
 * the provider reports MALFORMED_FUNCTION_CALL with no content at all. At
 * temperature 0 the same prompt garbles the same way every time, so a retry
 * samples a little warmer; the arguments are still validated by Zod before any
 * tool runs, so a warmer sample cannot do anything a cold one could not.
 */
export async function chatCompletion(
  request: CompletionRequest,
): Promise<CompletionResult> {
  let result = await completeOnce(request);

  for (
    let attempt = 1;
    attempt <= MALFORMED_CALL_RETRIES && result.malformedCall;
    attempt += 1
  ) {
    result = await completeOnce({ ...request, temperature: 0.4 * attempt });
  }

  return {
    content: result.content,
    toolCalls: result.toolCalls,
    finishReason: result.finishReason,
  };
}

async function completeOnce({
  messages,
  tools,
  temperature = 0,
  maxTokens = 1200,
  signal,
}: CompletionRequest): Promise<CompletionResult & { malformedCall: boolean }> {
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
      native_finish_reason?: string;
    }[];
    error?: { message?: string };
  };

  if (payload.error) {
    throw new AiUnavailableError(payload.error.message ?? "OpenRouter rejected the request.");
  }

  const choice = payload.choices?.[0];
  const malformedCall = choice?.native_finish_reason === "MALFORMED_FUNCTION_CALL";

  if (choice?.finish_reason === "error") {
    console.warn("OpenRouter finished with an error", {
      model: aiModel(),
      temperature,
      reason: choice.native_finish_reason ?? null,
    });
  }

  return {
    malformedCall,
    content: choice?.message?.content ?? null,
    // Gemini sometimes namespaces a call as "default_api.searchTrips". The tool
    // is ours either way; an unrecognised name would read as "no results".
    toolCalls: (choice?.message?.tool_calls ?? []).map((call) => ({
      ...call,
      function: {
        ...call.function,
        name: call.function.name.replace(/^default_api\./, ""),
      },
    })),
    finishReason: choice?.finish_reason ?? null,
  };
}
