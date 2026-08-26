import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Trip = Tables<"trips">;
export type TripAssignment = Tables<"trip_assignments">;

export type AssignmentDetail = {
  assignment: TripAssignment;
  vehicle: Tables<"vehicles"> | null;
  driver: Tables<"drivers"> | null;
};

export type TripDetail = {
  trip: Trip;
  customer: Tables<"customers"> | null;
  request: Pick<Tables<"trip_requests">, "id" | "reference"> | null;
  assignments: AssignmentDetail[];
  /** Seats across assigned vehicles, against what the trip needs. */
  seatsAssigned: number;
  hasDriver: boolean;
};

/**
 * A trip plus everything the dispatch view needs.
 *
 * Assignments are resolved in a second pass rather than through PostgREST
 * embedding: trip_assignments carries two nullable FKs into vehicles and
 * drivers, and naming both in one select makes the response shape harder to
 * type than it is worth here.
 */
export async function getTrip(id: string): Promise<TripDetail | null> {
  const supabase = await createClient();

  const { data: trip, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !trip) return null;

  const [assignmentsResult, customerResult, requestResult] = await Promise.all([
    supabase
      .from("trip_assignments")
      .select("*")
      .eq("trip_id", trip.id)
      .order("role")
      .order("created_at"),
    trip.customer_id
      ? supabase.from("customers").select("*").eq("id", trip.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    trip.trip_request_id
      ? supabase
          .from("trip_requests")
          .select("id, reference")
          .eq("id", trip.trip_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rows = assignmentsResult.data ?? [];

  const vehicleIds = rows
    .map((row) => row.vehicle_id)
    .filter((value): value is string => value !== null);
  const driverIds = rows
    .map((row) => row.driver_id)
    .filter((value): value is string => value !== null);

  const [vehiclesResult, driversResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("*").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    driverIds.length
      ? supabase.from("drivers").select("*").in("id", driverIds)
      : Promise.resolve({ data: [] }),
  ]);

  const vehicleById = new Map(
    (vehiclesResult.data ?? []).map((vehicle) => [vehicle.id, vehicle]),
  );
  const driverById = new Map(
    (driversResult.data ?? []).map((driver) => [driver.id, driver]),
  );

  const assignments: AssignmentDetail[] = rows.map((assignment) => ({
    assignment,
    vehicle: assignment.vehicle_id
      ? (vehicleById.get(assignment.vehicle_id) ?? null)
      : null,
    driver: assignment.driver_id ? (driverById.get(assignment.driver_id) ?? null) : null,
  }));

  const seatsAssigned = assignments.reduce(
    (sum, entry) => sum + (entry.vehicle?.capacity ?? 0),
    0,
  );

  return {
    trip,
    customer: customerResult.data,
    request: requestResult.data,
    assignments,
    seatsAssigned,
    hasDriver: assignments.some((entry) => entry.driver !== null),
  };
}

/**
 * Upcoming trips that have no driver on the sheet. Powers both the dashboard
 * alert and the ?missing=driver filter on the trips list, so the two can never
 * disagree about what counts.
 */
export async function getTripIdsMissingDriver(): Promise<string[]> {
  const supabase = await createClient();

  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_at", new Date().toISOString())
    .in("status", ["SCHEDULED", "CONFIRMED", "DISPATCHED"]);

  const ids = (trips ?? []).map((trip) => trip.id);
  if (ids.length === 0) return [];

  const { data: assignments } = await supabase
    .from("trip_assignments")
    .select("trip_id, driver_id")
    .in("trip_id", ids);

  const covered = new Set(
    (assignments ?? [])
      .filter((row) => row.driver_id !== null)
      .map((row) => row.trip_id),
  );

  return ids.filter((id) => !covered.has(id));
}
