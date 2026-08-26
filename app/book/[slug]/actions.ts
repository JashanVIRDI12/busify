"use server";

import { zonedTimeToUtc } from "@/lib/datetime";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { getPublicOrganization } from "@/lib/queries/public-org";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicRequestSchema } from "@/lib/validations/public-request";

/**
 * Coarse in-process throttle.
 *
 * This is a speed bump, not rate limiting: it lives in one server instance's
 * memory, so it resets on deploy and does nothing across multiple instances.
 * Real protection needs a shared store (Upstash, Redis) or a WAF rule — noted
 * rather than pretended.
 */
const RECENT = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function throttled(key: string): boolean {
  const now = Date.now();
  const hits = (RECENT.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  hits.push(now);
  RECENT.set(key, hits);

  // Keep the map from growing without bound on a long-running instance.
  if (RECENT.size > 5000) {
    for (const [entry, times] of RECENT) {
      if (times.every((at) => now - at >= WINDOW_MS)) RECENT.delete(entry);
    }
  }

  return hits.length > MAX_PER_WINDOW;
}

/**
 * Accept a quote request from the public booking page.
 *
 * The caller is anonymous, and `trip_requests` has no anon INSERT policy — so
 * rather than opening RLS to the world, this runs through the service-role
 * client with the organization resolved from the URL slug on the server.
 *
 * Because that client bypasses RLS, every field written here is either
 * validated by Zod or derived server-side. Nothing the browser sends decides
 * which organization the row lands in.
 */
export async function submitPublicRequestAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const slug = String(formData.get("slug") ?? "");
  const organization = await getPublicOrganization(slug);

  if (!organization) {
    return formError("This booking page is no longer available.");
  }

  const parsed = publicRequestSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const input = parsed.data;

  // Honeypot: a filled hidden field means a bot. Report success so it learns
  // nothing, but write nothing.
  if (input.company_website) {
    return formSuccess("Thanks — we have your request.");
  }

  if (throttled(`${organization.id}:${input.contact_email.toLowerCase()}`)) {
    return formError(
      "We have already received several requests from you. Please give us a moment, or call instead.",
    );
  }

  // Times are entered as wall-clock in the operator's timezone, matching how
  // the dashboard displays them.
  const departureAt = zonedTimeToUtc(input.departure_at, organization.timezone);
  const returnAt = input.return_at
    ? zonedTimeToUtc(input.return_at, organization.timezone)
    : null;

  if (!departureAt) {
    return formError("That departure date could not be read.", {
      departure_at: ["Pick a valid date and time"],
    });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("trip_requests").insert({
    organization_id: organization.id,
    // No customer record yet — that is why trip_requests carries contact
    // fields of its own. The operator links or creates the customer later.
    customer_id: null,
    pickup_location: input.pickup_location,
    pickup_address: input.pickup_address,
    destination: input.destination,
    destination_address: input.destination_address,
    departure_at: departureAt,
    return_at: returnAt,
    passenger_count: input.passenger_count,
    special_requirements: input.special_requirements,
    contact_name: input.contact_name,
    contact_email: input.contact_email,
    contact_phone: input.contact_phone,
    source: "HOSTED_PAGE",
    status: "NEW",
  });

  if (error) {
    console.error("Public trip request failed", error);
    return formError("Something went wrong sending your request. Please try again.");
  }

  return formSuccess("Thanks — we have your request.");
}
