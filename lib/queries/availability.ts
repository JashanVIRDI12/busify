import "server-only";

import { tripWindow } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types/database";

export type Vehicle = Tables<"vehicles">;
export type Driver = Tables<"drivers">;

export type VehicleAvailability = {
  vehicle: Vehicle;
  typeName: string | null;
  available: boolean;
  /** Why it cannot be used, when it cannot. */
  reason: string | null;
};

export type DriverAvailability = {
  driver: Driver;
  available: boolean;
  reason: string | null;
};

export type FleetAvailability = {
  vehicles: VehicleAvailability[];
  drivers: DriverAvailability[];
  seatsAvailable: number;
  vehiclesNeeded: number;
  meetsDemand: boolean;
};

export type AvailabilityWindow = {
  departure_at: string;
  return_at: string | null;
  passenger_count: number;
};

/** Statuses that actually hold a vehicle or driver for a window. */
const BLOCKING_TRIP_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
] as const;

/**
 * Which vehicles and drivers can actually run a job in this window.
 *
 * "Available" means three things at once: the resource is in service, it is
 * not already committed to an overlapping trip, and — for drivers — it has no
 * unavailability window covering the dates and a licence valid at departure.
 * Anything less would let a dispatcher promise a coach that is already out.
 *
 * `excludeTripId` drops one trip from the conflict set. Without it, editing a
 * trip's own assignments would report its own vehicle as busy with itself.
 *
 * RLS scopes every query here to the caller's organization.
 */
export async function getFleetAvailability(
  window: AvailabilityWindow,
  { excludeTripId }: { excludeTripId?: string } = {},
): Promise<FleetAvailability> {
  const supabase = await createClient();
  const { start, end } = tripWindow(window.departure_at, window.return_at);

  const [vehiclesResult, driversResult, typesResult, tripsResult, unavailabilityResult] =
    await Promise.all([
      supabase.from("vehicles").select("*").order("capacity", { ascending: false }),
      supabase.from("drivers").select("*").order("first_name"),
      supabase.from("vehicle_types").select("id, name"),
      supabase
        .from("trips")
        .select("id, departure_at, return_at")
        .in("status", [...BLOCKING_TRIP_STATUSES])
        // Cheap pre-filter; exact overlap is resolved below because return_at
        // may be null and needs the same one-day assumption as the request.
        .lt("departure_at", end.toISOString()),
      supabase
        .from("driver_availability")
        .select("driver_id, starts_at, ends_at, is_available, reason")
        .eq("is_available", false)
        .lt("starts_at", end.toISOString())
        .gt("ends_at", start.toISOString()),
    ]);

  const overlappingTripIds = (tripsResult.data ?? [])
    .filter((trip) => {
      if (excludeTripId && trip.id === excludeTripId) return false;
      const w = tripWindow(trip.departure_at, trip.return_at);
      return w.end > start && w.start < end;
    })
    .map((trip) => trip.id);

  const busyVehicles = new Set<string>();
  const busyDrivers = new Set<string>();

  if (overlappingTripIds.length > 0) {
    const { data: assignments } = await supabase
      .from("trip_assignments")
      .select("vehicle_id, driver_id")
      .in("trip_id", overlappingTripIds);

    for (const assignment of assignments ?? []) {
      if (assignment.vehicle_id) busyVehicles.add(assignment.vehicle_id);
      if (assignment.driver_id) busyDrivers.add(assignment.driver_id);
    }
  }

  const driverTimeOff = new Map<string, string>();
  for (const row of unavailabilityResult.data ?? []) {
    driverTimeOff.set(row.driver_id, row.reason ?? "Unavailable on these dates");
  }

  const typeNames = new Map(
    (typesResult.data ?? []).map((type) => [type.id, type.name]),
  );

  const vehicles: VehicleAvailability[] = (vehiclesResult.data ?? []).map((vehicle) => {
    let reason: string | null = null;

    if (vehicle.status === "INACTIVE") reason = "Retired from service";
    else if (vehicle.status === "MAINTENANCE") reason = "In maintenance";
    else if (busyVehicles.has(vehicle.id)) reason = "On another trip these dates";

    return {
      vehicle,
      typeName: vehicle.vehicle_type_id
        ? (typeNames.get(vehicle.vehicle_type_id) ?? null)
        : null,
      available: reason === null,
      reason,
    };
  });

  const drivers: DriverAvailability[] = (driversResult.data ?? []).map((driver) => {
    let reason: string | null = null;

    if (driver.status === "INACTIVE") reason = "No longer driving for you";
    else if (driver.status === "ON_LEAVE") reason = "On leave";
    else if (busyDrivers.has(driver.id)) reason = "On another trip these dates";
    else if (driverTimeOff.has(driver.id)) reason = driverTimeOff.get(driver.id)!;
    else if (
      driver.license_expires_on &&
      new Date(`${driver.license_expires_on}T23:59:59Z`) < start
    ) {
      reason = "Licence expires before departure";
    }

    return { driver, available: reason === null, reason };
  });

  // Greedy largest-first: how many coaches it takes to seat everyone.
  const availableCapacities = vehicles
    .filter((entry) => entry.available)
    .map((entry) => entry.vehicle.capacity)
    .sort((a, b) => b - a);

  const seatsAvailable = availableCapacities.reduce((sum, seats) => sum + seats, 0);

  let seated = 0;
  let vehiclesNeeded = 0;
  for (const capacity of availableCapacities) {
    if (seated >= window.passenger_count) break;
    seated += capacity;
    vehiclesNeeded += 1;
  }

  return {
    vehicles,
    drivers,
    seatsAvailable,
    vehiclesNeeded,
    meetsDemand: seated >= window.passenger_count,
  };
}
