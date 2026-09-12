import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TripStatus } from "@/types/database";

export type DispatchAssignment = {
  id: string;
  vehicleId: string | null;
  vehicleName: string | null;
  vehicleTypeId: string | null;
  vehicleTypeName: string | null;
  driverId: string | null;
  driverName: string | null;
};

export type DispatchTrip = {
  id: string;
  reference: string | null;
  status: string;
  assignmentStatus: "UNASSIGNED" | "PARTIAL" | "ASSIGNED";
  departureAt: string;
  returnAt: string | null;
  dropoffAt: string | null;
  garageArrivalAt: string | null;
  spotAt: string | null;
  pickupLocation: string;
  destination: string;
  groupName: string | null;
  passengerCount: number;
  company: string | null;
  contact: string | null;
  garageId: string | null;
  garageName: string | null;
  assignments: DispatchAssignment[];
};

export type DispatchFilters = {
  status?: readonly TripStatus[];
  assignment?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  vehicleTypeId?: string | null;
  garageId?: string | null;
};

const ASSIGNMENT_STATES = ["UNASSIGNED", "PARTIAL", "ASSIGNED"] as const;
type AssignmentState = (typeof ASSIGNMENT_STATES)[number];

/** Filters arrive off the URL, so an unknown value is dropped, not passed on. */
function asAssignmentState(value: string | null | undefined): AssignmentState | null {
  return ASSIGNMENT_STATES.find((state) => state === value) ?? null;
}

/**
 * Every reservation overlapping a window, with its vehicles and drivers.
 *
 * Overlap, not containment: a three-day charter that started yesterday still
 * occupies today's board, and a query on `departure_at` alone would drop it.
 * The lower bound uses the trip's end, so the window is
 * `end >= from AND start < to`.
 *
 * `return_at` is nullable, and Postgres will not compare null usefully here, so
 * the effective end is coalesced to the dropoff and then to the departure.
 */
export async function getDispatchTrips(
  from: Date,
  to: Date,
  filters: DispatchFilters = {},
  limit = 800,
): Promise<DispatchTrip[]> {
  const supabase = await createClient();

  let query = supabase
    .from("trips")
    .select(
      `id, reference, status, assignment_status, departure_at, return_at, dropoff_at,
       garage_arrival_at, spot_at, pickup_location, destination, group_name,
       passenger_count, garage_id,
       companies(name),
       customers(first_name, last_name),
       garages(id, name),
       trip_assignments(
         id, vehicle_id, driver_id,
         vehicles(id, name, vehicle_type_id, vehicle_types(id, name)),
         drivers(id, first_name, last_name)
       )`,
    )
    .lt("departure_at", to.toISOString())
    .order("departure_at", { ascending: true })
    .limit(limit);

  if (filters.status?.length) {
    query = query.in("status", [...filters.status]);
  }

  const assignment = asAssignmentState(filters.assignment);
  if (assignment) query = query.eq("assignment_status", assignment);

  if (filters.garageId) query = query.eq("garage_id", filters.garageId);

  const { data, error } = await query;

  if (error) {
    console.error("Failed to load dispatch trips", error);
    return [];
  }

  const fromMs = from.getTime();

  return (data ?? [])
    .map((trip): DispatchTrip => {
      const assignments = (trip.trip_assignments ?? []).map(
        (row): DispatchAssignment => ({
          id: row.id,
          vehicleId: row.vehicles?.id ?? null,
          vehicleName: row.vehicles?.name ?? null,
          vehicleTypeId: row.vehicles?.vehicle_types?.id ?? null,
          vehicleTypeName: row.vehicles?.vehicle_types?.name ?? null,
          driverId: row.drivers?.id ?? null,
          driverName: row.drivers
            ? [row.drivers.first_name, row.drivers.last_name]
                .filter(Boolean)
                .join(" ")
            : null,
        }),
      );

      return {
        id: trip.id,
        reference: trip.reference,
        status: trip.status,
        assignmentStatus: trip.assignment_status,
        departureAt: trip.departure_at,
        returnAt: trip.return_at,
        dropoffAt: trip.dropoff_at,
        garageArrivalAt: trip.garage_arrival_at,
        spotAt: trip.spot_at,
        pickupLocation: trip.pickup_location,
        destination: trip.destination,
        groupName: trip.group_name,
        passengerCount: trip.passenger_count,
        company: trip.companies?.name ?? null,
        contact: trip.customers
          ? [trip.customers.first_name, trip.customers.last_name]
              .filter(Boolean)
              .join(" ")
          : null,
        garageId: trip.garages?.id ?? null,
        garageName: trip.garages?.name ?? null,
        assignments,
      };
    })
    .filter((trip) => tripEnd(trip).getTime() >= fromMs)
    .filter((trip) => {
      // Vehicle, type and driver live on the assignment rows, so these are
      // applied here rather than as embedded filters — which would drop the
      // trip's *other* assignments from the result and misdraw the board.
      if (
        filters.vehicleId &&
        !trip.assignments.some((a) => a.vehicleId === filters.vehicleId)
      ) {
        return false;
      }
      if (
        filters.vehicleTypeId &&
        !trip.assignments.some((a) => a.vehicleTypeId === filters.vehicleTypeId)
      ) {
        return false;
      }
      if (
        filters.driverId &&
        !trip.assignments.some((a) => a.driverId === filters.driverId)
      ) {
        return false;
      }
      return true;
    });
}

/** A trip with no return still occupies the day it departs. */
export function tripEnd(trip: {
  departureAt: string;
  returnAt: string | null;
  dropoffAt: string | null;
}): Date {
  const raw = trip.returnAt ?? trip.dropoffAt ?? trip.departureAt;
  const end = new Date(raw);
  const start = new Date(trip.departureAt);
  return end.getTime() > start.getTime() ? end : start;
}

export type FleetRow = {
  id: string;
  name: string;
  capacity: number;
  typeId: string | null;
  typeName: string;
};

/** Vehicles grouped the way the assignment timeline lists them. */
export async function getFleetRows(): Promise<FleetRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vehicles")
    .select("id, name, capacity, vehicle_type_id, vehicle_types(id, name)")
    .eq("is_mock", false)
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    console.error("Failed to load fleet rows", error);
    return [];
  }

  return (data ?? []).map((vehicle) => ({
    id: vehicle.id,
    name: vehicle.name,
    capacity: vehicle.capacity,
    typeId: vehicle.vehicle_types?.id ?? null,
    typeName: vehicle.vehicle_types?.name ?? "Unassigned type",
  }));
}
