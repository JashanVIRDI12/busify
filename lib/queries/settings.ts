import "server-only";

import { requireSession, type Organization } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type OrganizationSettings = Tables<"organization_settings">;

/**
 * The organization's operating defaults.
 *
 * A row is created by a trigger when the organization is, so this normally
 * finds one. The fallback covers an organization created before that trigger
 * existed — returning defaults rather than null keeps every settings page free
 * of a "not configured yet" branch.
 */
export async function getOrganizationSettings(
  organizationOverride?: Organization,
  clientOverride?: Awaited<ReturnType<typeof createClient>>,
): Promise<OrganizationSettings> {
  const organization =
    organizationOverride ?? (await requireSession()).organization;
  const supabase = clientOverride ?? (await createClient());

  const { data } = await supabase
    .from("organization_settings")
    .select("*")
    .eq("organization_id", organization.id)
    .maybeSingle();

  if (data) return data;

  return {
    organization_id: organization.id,
    default_garage_id: null,
    pre_trip_arrival_minutes: 15,
    spot_time_minutes: 30,
    pricing_mode: "HIGHEST",
    pricing_bases: ["DAILY"],
    customer_visibility: "LINE_ITEM_CALCS",
    enable_sales_tax: true,
    enable_tracking_link: true,
    event_types: [
      "K-12",
      "Athletics",
      "University",
      "Military",
      "Airlines",
      "Airport Transfer",
      "Wedding",
      "Corporate",
      "Personal",
      "Other",
    ],
    widget_vehicle_types: [],
    driver_pay_method: "HOURLY",
    long_day_enabled: false,
    long_day_hours: 10,
    long_day_switch_to: "DAILY_RATE",
    overnight_enabled: false,
    overnight_switch_to: "DAILY_RATE",
    percentage_of_total: false,
    pay_rate_types: [
      "Hourly",
      "Daily",
      "Percentage",
      "Per Trip",
      "Mileage",
      "Per diem",
      "Gratuity",
    ],
    per_trip_minimum_enabled: false,
    per_trip_minimum_by_hours: false,
    per_diem_enabled: false,
    per_diem_min_days: 1,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

/** Industry names for the contact and company pickers. */
export async function getIndustryNames(): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("industries")
    .select("name")
    .order("name", { ascending: true })
    .limit(200);

  return (data ?? []).map((row) => row.name);
}
