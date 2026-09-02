import { NextResponse, type NextRequest } from "next/server";

import { zonedTimeToUtc } from "@/lib/datetime";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireViabusOrganization } from "@/lib/viabus/org";
import {
  ASSUMED_DEPARTURE_TIME,
  ASSUMED_RETURN_TIME,
  intakeNotes,
  viabusQuoteSchema,
} from "@/lib/validations/viabus-quote";
import { toFieldErrors } from "@/lib/validations/shared";

/**
 * Public quote intake for the VIABUS marketing site.
 *
 * Busify's own public form is a Server Action, which a static HTML page cannot
 * call — hence a plain JSON endpoint. The security posture is the same as
 * `app/book/[slug]/actions.ts`: the caller is anonymous, `trip_requests` has no
 * anon INSERT policy, so this runs through the service-role client with every
 * written field either validated by Zod or derived on the server.
 *
 * Nothing the browser sends decides which organization the row lands in. With
 * one tenant there is no slug to spoof in the first place — the organization
 * comes from `VIABUS_ORG_SLUG`.
 */

export const dynamic = "force-dynamic";

/**
 * Coarse in-process throttle.
 *
 * A speed bump, not rate limiting: it lives in one server instance's memory,
 * so it resets on deploy and does nothing across instances. Real protection
 * needs a shared store (Upstash, Redis) or a WAF rule — noted rather than
 * pretended.
 */
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);

  if (RECENT.size > 5000) {
    for (const [entry, times] of RECENT) {
      if (times.every((at) => now - at >= WINDOW_MS)) RECENT.delete(entry);
    }
  }

  return hits.length > MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Expected a JSON body." },
      { status: 400 },
    );
  }

  const parsed = viabusQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Some details need another look.",
        fieldErrors: toFieldErrors(parsed.error),
      },
      { status: 422 },
    );
  }

  const input = parsed.data;

  // Honeypot: a filled hidden field means a bot. Report success so it learns
  // nothing, but write nothing.
  if (input.company_website) {
    return NextResponse.json({ ok: true, reference: null });
  }

  const organization = await requireViabusOrganization();

  if (throttled(`${organization.id}:${input.contact_email.toLowerCase()}`)) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "We have already received several requests from you. Please give us a moment, or call instead.",
      },
      { status: 429 },
    );
  }

  // The form collects a date; the database stores an instant. Wall-clock in the
  // operator's timezone, matching how the dashboard reads times back.
  const departureAt = zonedTimeToUtc(
    `${input.departure_date}T${ASSUMED_DEPARTURE_TIME}`,
    organization.timezone,
  );
  const returnAt = input.return_date
    ? zonedTimeToUtc(
        `${input.return_date}T${ASSUMED_RETURN_TIME}`,
        organization.timezone,
      )
    : null;

  if (!departureAt) {
    return NextResponse.json(
      {
        ok: false,
        message: "That departure date could not be read.",
        fieldErrors: { departure_date: ["Pick a valid date"] },
      },
      { status: 422 },
    );
  }

  // A same-day return would otherwise land before departure and trip the
  // table's own check constraint, which is a 500 rather than a sentence.
  if (returnAt && returnAt <= departureAt) {
    return NextResponse.json(
      {
        ok: false,
        message: "The return has to be after departure.",
        fieldErrors: { return_date: ["Pick a later return date"] },
      },
      { status: 422 },
    );
  }

  const supabase = createAdminClient();

  // The generated database types predate this function; regenerate with
  // `npm run db:types` after the migration is applied and the cast can go.
  const { data: reference, error: referenceError } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: string | null; error: unknown }>
  )("next_trip_request_reference", { org: organization.id });

  if (referenceError) {
    console.error("Reference allocation failed", referenceError);
    return NextResponse.json(
      { ok: false, message: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("trip_requests").insert({
    organization_id: organization.id,
    // No customer record yet — that is why trip_requests carries contact
    // fields of its own. The operator links or creates the customer later.
    customer_id: null,
    reference,
    pickup_location: input.pickup_location,
    destination: input.destination,
    departure_at: departureAt,
    return_at: returnAt,
    passenger_count: input.passenger_count,
    special_requirements: input.special_requirements,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    notes: intakeNotes(input),
    source: "HOSTED_PAGE",
    status: "NEW",
  });

  if (error) {
    console.error("VIABUS quote request failed", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong sending your request. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reference });
}
