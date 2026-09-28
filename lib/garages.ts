import "server-only";

import { geoProvider } from "@/lib/services/geo";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

type AddressParts = {
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
};

/**
 * A garage's address as one line, the way a geocoder and a person both read it.
 *
 * The street on its own is not an address — "2550 Markham Rd" exists in more
 * than one town — and a dead-mile leg measured to the wrong one is worse than
 * no leg at all.
 */
export function garageAddressLine(garage: AddressParts): string {
  return [garage.address, garage.city, garage.province, garage.postal_code]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Where a garage actually is, looked up once when it is saved.
 *
 * Every quote measures its dead legs from this point, so pinning it here means
 * the itinerary never re-geocodes the yard — and never lands it somewhere else
 * because the provider read a bare street differently the second time.
 */
export async function locateGarage(
  garage: AddressParts,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const line = garageAddressLine(garage);
  const hit = line ? await geoProvider().geocode(line) : null;
  return { latitude: hit?.lat ?? null, longitude: hit?.lng ?? null };
}

/**
 * Makes one garage the organization's default, or none.
 *
 * Two places record it: the flag the Garages list shows, and the setting a new
 * quote reads. They used to be written separately, so ticking "default" on a
 * garage changed its badge and not the quotes. The setting is manager-only
 * under RLS, so it is only written for a caller who may.
 */
export async function setDefaultGarage(
  supabase: Client,
  organizationId: string,
  garageId: string | null,
  { syncSetting }: { syncSetting: boolean },
) {
  let clear = supabase
    .from("garages")
    .update({ is_default: false })
    .eq("is_default", true);
  if (garageId) clear = clear.neq("id", garageId);
  await clear;

  if (garageId) {
    await supabase.from("garages").update({ is_default: true }).eq("id", garageId);
  }

  if (syncSetting) {
    await supabase
      .from("organization_settings")
      .upsert(
        { organization_id: organizationId, default_garage_id: garageId },
        { onConflict: "organization_id" },
      );
  }
}

/**
 * The garage a new quote starts from: the setting, else the flagged garage.
 *
 * The fallback covers organizations whose default was only ever set on the
 * garage itself — seeded data, or a dispatcher who may flag a garage but not
 * change settings.
 */
export async function resolveDefaultGarageId(
  supabase: Client,
  fromSettings: string | null | undefined,
): Promise<string | null> {
  if (fromSettings) return fromSettings;

  const { data } = await supabase
    .from("garages")
    .select("id")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
