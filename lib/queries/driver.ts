import "server-only";

import { getDriverContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

type VehicleLite = Pick<
  Tables<"vehicles">,
  "id" | "name" | "registration_number" | "capacity" | "make" | "model"
>;
type CoDriver = Pick<Tables<"drivers">, "id" | "first_name" | "last_name" | "phone">;

export type DriverTrip = Tables<"trips"> & {
  vehicle: VehicleLite | null;
  coDrivers: CoDriver[];
  /** The signed-in driver's role on this trip. */
  myRole: string;
};

export type DriverTripDetail = DriverTrip & {
  customer: Pick<
    Tables<"customers">,
    "first_name" | "last_name" | "phone" | "email"
  > | null;
  passengers: Pick<
    Tables<"trip_passengers">,
    "id" | "full_name" | "seat_label" | "phone"
  >[];
};

/**
 * Resolve the signed-in driver's assigned trips (optionally just one), each
 * with its vehicle and co-drivers. RLS already limits every table here to the
 * driver's own trips, so the queries do not re-filter for safety.
 */
async function loadAssignments(tripId?: string): Promise<DriverTrip[]> {
  const context = await getDriverContext();
  if (!context) return [];

  const supabase = await createClient();
  const myDriverId = context.driver.id;

  let query = supabase
    .from("trip_assignments")
    .select("trip_id, vehicle_id, driver_id, role");
  if (tripId) query = query.eq("trip_id", tripId);
  const { data: assignments } = await query;
  const rows = assignments ?? [];

  const myTripIds = [
    ...new Set(rows.filter((r) => r.driver_id === myDriverId).map((r) => r.trip_id)),
  ];
  if (myTripIds.length === 0) return [];

  const relevant = rows.filter((r) => myTripIds.includes(r.trip_id));
  const vehicleIds = relevant
    .map((r) => r.vehicle_id)
    .filter((v): v is string => v !== null);
  const coDriverIds = relevant
    .map((r) => r.driver_id)
    .filter((d): d is string => d !== null && d !== myDriverId);

  const [tripsResult, vehiclesResult, coDriversResult] = await Promise.all([
    supabase.from("trips").select("*").in("id", myTripIds),
    supabase
      .from("vehicles")
      .select("id, name, registration_number, capacity, make, model")
      .in("id", vehicleIds),
    supabase
      .from("drivers")
      .select("id, first_name, last_name, phone")
      .in("id", coDriverIds),
  ]);

  const vehicleById = new Map(
    (vehiclesResult.data ?? []).map((v) => [v.id, v as VehicleLite]),
  );
  const coDriverById = new Map(
    (coDriversResult.data ?? []).map((d) => [d.id, d as CoDriver]),
  );

  const trips: DriverTrip[] = (tripsResult.data ?? []).map((trip) => {
    const forTrip = relevant.filter((r) => r.trip_id === trip.id);
    const mine = forTrip.find((r) => r.driver_id === myDriverId);
    const vehicleId = forTrip.find((r) => r.vehicle_id)?.vehicle_id ?? null;

    return {
      ...trip,
      myRole: mine?.role ?? "PRIMARY",
      vehicle: vehicleId ? (vehicleById.get(vehicleId) ?? null) : null,
      coDrivers: forTrip
        .map((r) => r.driver_id)
        .filter((d): d is string => d !== null && d !== myDriverId)
        .map((d) => coDriverById.get(d))
        .filter((d): d is CoDriver => d !== undefined),
    };
  });

  trips.sort(
    (a, b) =>
      new Date(a.departure_at).getTime() - new Date(b.departure_at).getTime(),
  );
  return trips;
}

export async function getAssignedTrips(): Promise<DriverTrip[]> {
  return loadAssignments();
}

export async function getAssignedTrip(
  id: string,
): Promise<DriverTripDetail | null> {
  const trip = (await loadAssignments(id))[0];
  if (!trip) return null;

  const supabase = await createClient();
  const [customerResult, passengersResult] = await Promise.all([
    trip.customer_id
      ? supabase
          .from("customers")
          .select("first_name, last_name, phone, email")
          .eq("id", trip.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("trip_passengers")
      .select("id, full_name, seat_label, phone")
      .eq("trip_id", trip.id)
      .order("full_name"),
  ]);

  return {
    ...trip,
    customer: customerResult.data ?? null,
    passengers: passengersResult.data ?? [],
  };
}

export async function getOwnDocuments(): Promise<Tables<"driver_documents">[]> {
  if (!(await getDriverContext())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("driver_documents")
    .select("*")
    .order("expires_on", { ascending: true, nullsFirst: false });
  return data ?? [];
}

export async function getOwnAvailability(): Promise<
  Tables<"driver_availability">[]
> {
  if (!(await getDriverContext())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("driver_availability")
    .select("*")
    .order("starts_at", { ascending: true });
  return data ?? [];
}
