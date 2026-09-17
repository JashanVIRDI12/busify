import "server-only";

import type { BuilderLookups } from "@/components/quotes/builder/builder-context";
import type { Organization } from "@/lib/auth/session";
import { getOrganizationSettings } from "@/lib/queries/settings";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything the builder's pickers need: garages, terms, vehicle types and the
 * rate card, teammates, charges, event types.
 *
 * Shared by /quotes/[id] and /quotes/new. It was inline in the former until the
 * latter existed — a new quote has to offer exactly the same choices as a saved
 * one, and two copies of this would drift the first time a picker was added.
 */
export async function getBuilderLookups(
  organization: Organization,
): Promise<{
  lookups: BuilderLookups;
  settings: Awaited<ReturnType<typeof getOrganizationSettings>>;
}> {
  const supabase = await createClient();

  const [
    { data: garages },
    { data: contractTerms },
    { data: vehicleTypes },
    { data: vehicles },
    { data: members },
    { data: profiles },
    settings,
    { data: charges },
    { data: rateCard },
  ] = await Promise.all([
    supabase.from("garages").select("id, name, address").order("name"),
    supabase
      .from("contract_terms")
      .select("id, name, body, is_default")
      .order("name"),
    supabase
      .from("vehicle_types")
      .select(
        "id, name, default_capacity, base_rate, per_km_rate, per_hour_rate, per_day_rate",
      )
      .order("name"),
    supabase
      .from("vehicles")
      .select("id, name, capacity, vehicle_type_id")
      .order("name"),
    supabase.from("organization_members").select("user_id, role"),
    // Profiles are RLS-limited to the current user's teammates. Fetching them
    // alongside memberships avoids a second database round trip; the member
    // id intersection below still decides which organization appears here.
    supabase.from("profiles").select("id, full_name, email").limit(200),
    getOrganizationSettings(organization, supabase),
    supabase
      .from("custom_charges")
      .select("id, name, rate_type, rate, tax_exempt")
      .eq("category", "CHARGE")
      .order("position")
      .limit(100),
    // The per-type default rows. A vehicle-specific override is a different
    // row and is applied per vehicle, not at the type level.
    supabase
      .from("vehicle_rates")
      .select("vehicle_type_id, hourly_rate, daily_rate, live_mile_rate")
      .is("vehicle_id", null)
      .limit(200),
  ]);

  /**
   * The rate card wins over the legacy columns on `vehicle_types`.
   *
   * Both exist because rates used to live on the type itself; Settings →
   * Vehicle Rates is now where an operator maintains them. Overlaying here
   * means every part of the builder reads the rate card without knowing it.
   */
  const ratesByType = new Map(
    (rateCard ?? []).map((rate) => [rate.vehicle_type_id, rate]),
  );

  const memberIds = new Set((members ?? []).map((member) => member.user_id));

  const lookups: BuilderLookups = {
    salesReps: (profiles ?? [])
      .filter((profile) => memberIds.has(profile.id))
      .map((profile) => ({
        id: profile.id,
        name: profile.full_name?.trim() || profile.email || "Teammate",
      })),
    garages: (garages ?? []).map((garage) => ({
      id: garage.id,
      name: garage.name,
      address: garage.address,
    })),
    contractTerms: contractTerms ?? [],
    vehicleTypes: (vehicleTypes ?? []).map((type) => {
      const rate = ratesByType.get(type.id);
      return {
        id: type.id,
        name: type.name,
        default_capacity: type.default_capacity,
        base_rate: Number(type.base_rate),
        per_km_rate: Number(rate?.live_mile_rate ?? type.per_km_rate),
        per_hour_rate: Number(rate?.hourly_rate ?? type.per_hour_rate),
        per_day_rate: Number(rate?.daily_rate ?? type.per_day_rate),
      };
    }),
    vehicles: (vehicles ?? []).map((vehicle) => ({
      id: vehicle.id,
      name: vehicle.name,
      capacity: vehicle.capacity,
      vehicle_type_id: vehicle.vehicle_type_id,
    })),
    province: organization.state,
    eventTypes: settings.event_types,
    customCharges: charges ?? [],
    gstNumber: organization.gst_hst_number,
  };

  return { lookups, settings };
}
