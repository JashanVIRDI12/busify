import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { AiUnavailableError, runAssistant } from "@/lib/ai/assistant";
import { aiConfigured } from "@/lib/ai/client";
import { assistantSystemPrompt, copilotSystemPrompt } from "@/lib/ai/prompts";
import { getSession } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  question: z.string().trim().min(1, "Ask something").max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional()
    .default([]),
  /** Pins the conversation to one trip request (§23 Trip Copilot). */
  tripRequestId: z.uuid().optional(),
  /** Where the operator is looking, so deictic questions resolve. */
  pageContext: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  // Authenticated operators only. Every tool below runs under this session, so
  // RLS scopes the assistant to their organization automatically.
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (!aiConfigured()) {
    return NextResponse.json(
      {
        error:
          "The assistant is not configured. Add OPENROUTER_API_KEY to .env.local and restart the server.",
      },
      { status: 503 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { question, history, tripRequestId, pageContext } = parsed.data;

  let systemPrompt = assistantSystemPrompt(session);

  if (tripRequestId) {
    const supabase = await createClient();
    // RLS means a request from another organization simply is not found.
    const { data: tripRequest } = await supabase
      .from("trip_requests")
      .select("*")
      .eq("id", tripRequestId)
      .maybeSingle();

    if (!tripRequest) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const timeZone = session.organization.timezone;
    systemPrompt = copilotSystemPrompt(session, {
      reference: tripRequest.reference,
      pickup: tripRequest.pickup_location,
      destination: tripRequest.destination,
      departureAt: formatDateTime(tripRequest.departure_at, timeZone),
      returnAt: tripRequest.return_at
        ? formatDateTime(tripRequest.return_at, timeZone)
        : null,
      passengers: tripRequest.passenger_count,
      status: tripRequest.status,
      requirements: tripRequest.special_requirements,
    });
  }

  if (pageContext) {
    systemPrompt += `

The operator is currently looking at ${pageContext}.`;
  }

  try {
    const result = await runAssistant({
      session,
      systemPrompt,
      history,
      question,
      signal: request.signal,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      // The provider's own message is usually actionable — bad model slug,
      // no credit, rate limited — so pass it through rather than flattening it.
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    console.error("Assistant failed", error);
    return NextResponse.json(
      { error: "The assistant could not answer. Please try again." },
      { status: 500 },
    );
  }
}
