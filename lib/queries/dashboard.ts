import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  DriverStatus,
  TripRequestStatus,
  VehicleStatus,
} from "@/types/database";

export type DashboardMetrics = {
  revenueThisMonth: number;
  currency: string;
  confirmedBookings: number;
  pendingRequests: number;
  upcomingTrips: number;
  customers: number;
  fleet: {
    total: number;
    byStatus: Record<VehicleStatus, number>;
    utilization: number;
  };
  drivers: {
    total: number;
    byStatus: Record<DriverStatus, number>;
  };
  attention: AttentionItem[];
  setup: SetupState;
};

/**
 * How far through first-run setup the organization is. A brand-new operator
 * sees zeros everywhere, which reads as a broken dashboard rather than an
 * empty one — this turns that into a next step.
 */
export type SetupState = {
  steps: { id: string; label: string; description: string; href: string; done: boolean }[];
  completed: number;
  total: number;
  isComplete: boolean;
};

export type AttentionItem = {
  id: string;
  count: number;
  label: string;
  detail: string;
  href: string | null;
  tone: "primary" | "warning" | "destructive";
};

const EMPTY_VEHICLE_STATUS: Record<VehicleStatus, number> = {
  AVAILABLE: 0,
  ASSIGNED: 0,
  IN_TRIP: 0,
  MAINTENANCE: 0,
  INACTIVE: 0,
};

const EMPTY_DRIVER_STATUS: Record<DriverStatus, number> = {
  ACTIVE: 0,
  OFF_DUTY: 0,
  ON_TRIP: 0,
  ON_LEAVE: 0,
  INACTIVE: 0,
};

function startOfMonthISO(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function plusDaysISO(days: number, now = new Date()) {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}

/**
 * Everything the overview page needs, in one place.
 *
 * No organization_id filters: RLS scopes each of these to the caller's
 * organization already, and adding a redundant filter here would suggest the
 * filter is what makes it safe.
 */
export async function getDashboardMetrics(
  currency: string,
): Promise<DashboardMetrics> {
  const supabase = await createClient();
  const now = new Date();
  const monthStart = startOfMonthISO(now);
  const nowISO = now.toISOString();
  const in30Days = plusDaysISO(30, now);

  const [
    vehiclesResult,
    driversResult,
    customersResult,
    requestsResult,
    tripsResult,
    quotesResult,
    bookingsResult,
    expiringLicensesResult,
    vehicleTypesResult,
  ] = await Promise.all([
    supabase.from("vehicles").select("status"),
    supabase.from("drivers").select("status"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("trip_requests").select("status"),
    supabase
      .from("trips")
      .select("id, status")
      .gte("departure_at", nowISO)
      .in("status", ["SCHEDULED", "CONFIRMED", "DISPATCHED"]),
    supabase.from("quotes").select("status"),
    supabase
      .from("bookings")
      .select("total_amount, status, created_at")
      .gte("created_at", monthStart),
    supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .not("license_expires_on", "is", null)
      .lte("license_expires_on", in30Days.slice(0, 10)),
    supabase.from("vehicle_types").select("id", { count: "exact", head: true }),
  ]);

  const byStatus = <T extends string>(
    rows: { status: T }[] | null,
    empty: Record<T, number>,
  ) => {
    const counts = { ...empty };
    for (const row of rows ?? []) counts[row.status] += 1;
    return counts;
  };

  const vehiclesByStatus = byStatus<VehicleStatus>(
    vehiclesResult.data,
    EMPTY_VEHICLE_STATUS,
  );
  const driversByStatus = byStatus<DriverStatus>(
    driversResult.data,
    EMPTY_DRIVER_STATUS,
  );

  const totalVehicles = vehiclesResult.data?.length ?? 0;
  const inService = totalVehicles - vehiclesByStatus.INACTIVE;
  const working = vehiclesByStatus.ASSIGNED + vehiclesByStatus.IN_TRIP;
  const utilization = inService > 0 ? Math.round((working / inService) * 100) : 0;

  const requestCounts: Partial<Record<TripRequestStatus, number>> = {};
  for (const row of requestsResult.data ?? []) {
    requestCounts[row.status] = (requestCounts[row.status] ?? 0) + 1;
  }

  const quotesAwaiting = (quotesResult.data ?? []).filter(
    (q) => q.status === "SENT" || q.status === "VIEWED",
  ).length;

  const bookings = bookingsResult.data ?? [];
  const revenueThisMonth = bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + Number(b.total_amount ?? 0), 0);

  const upcomingTripIds = (tripsResult.data ?? []).map((t) => t.id);

  // Upcoming trips with no driver on the assignment sheet — the single most
  // expensive thing for a dispatcher to discover late.
  let tripsMissingDriver = 0;
  if (upcomingTripIds.length > 0) {
    const { data: assignments } = await supabase
      .from("trip_assignments")
      .select("trip_id, driver_id")
      .in("trip_id", upcomingTripIds);

    const covered = new Set(
      (assignments ?? [])
        .filter((a) => a.driver_id !== null)
        .map((a) => a.trip_id),
    );
    tripsMissingDriver = upcomingTripIds.filter((id) => !covered.has(id)).length;
  }

  const attentionCandidates: AttentionItem[] = [
    {
      id: "new-requests",
      count: requestCounts.NEW ?? 0,
      label: "new trip requests",
      detail: "Waiting for a first response.",
      href: "/trip-requests?status=NEW",
      tone: "primary",
    },
    {
      id: "needs-info",
      count: requestCounts.NEEDS_INFORMATION ?? 0,
      label: "requests need information",
      detail: "You asked the customer a question.",
      href: "/trip-requests?status=NEEDS_INFORMATION",
      tone: "warning",
    },
    {
      id: "quotes-awaiting",
      count: quotesAwaiting,
      label: "quotes awaiting a response",
      detail: "Sent but not yet accepted or declined.",
      href: null,
      tone: "primary",
    },
    {
      id: "trips-missing-driver",
      count: tripsMissingDriver,
      label: "upcoming trips have no driver",
      detail: "Assign a driver before dispatch.",
      href: "/reservations?assignment=PARTIAL",
      tone: "destructive",
    },
    {
      id: "vehicles-maintenance",
      count: vehiclesByStatus.MAINTENANCE,
      label: "vehicles in maintenance",
      detail: "Unavailable for quoting until they return.",
      href: "/vehicles?status=MAINTENANCE",
      tone: "warning",
    },
    {
      id: "licenses-expiring",
      count: expiringLicensesResult.count ?? 0,
      label: "driver licences expire within 30 days",
      detail: "Collect renewed documents to stay compliant.",
      href: "/drivers",
      tone: "warning",
    },
  ];

  const attention = attentionCandidates.filter((item) => item.count > 0);

  const setupSteps = [
    {
      id: "vehicle-types",
      label: "Define a vehicle type",
      description: "Classes like Luxury Coach carry the rates quoting uses.",
      href: "/vehicles/types",
      done: (vehicleTypesResult.count ?? 0) > 0,
    },
    {
      id: "vehicles",
      label: "Add your fleet",
      description: "Availability is checked against real coaches and seats.",
      href: "/vehicles",
      done: totalVehicles > 0,
    },
    {
      id: "drivers",
      label: "Add your drivers",
      description: "Needed before a trip can be dispatched.",
      href: "/drivers",
      done: (driversResult.data?.length ?? 0) > 0,
    },
    {
      id: "customers",
      label: "Add a customer",
      description: "Who you quote, book and invoice.",
      href: "/customers",
      done: (customersResult.count ?? 0) > 0,
    },
    {
      id: "requests",
      label: "Log a trip request",
      description: "The start of every job you run.",
      href: "/trip-requests",
      done: (requestsResult.data?.length ?? 0) > 0,
    },
  ];

  const completed = setupSteps.filter((step) => step.done).length;

  return {
    revenueThisMonth,
    currency,
    confirmedBookings: bookings.filter((b) => b.status === "CONFIRMED").length,
    pendingRequests:
      (requestCounts.NEW ?? 0) +
      (requestCounts.REVIEWING ?? 0) +
      (requestCounts.NEEDS_INFORMATION ?? 0),
    upcomingTrips: upcomingTripIds.length,
    customers: customersResult.count ?? 0,
    fleet: {
      total: totalVehicles,
      byStatus: vehiclesByStatus,
      utilization,
    },
    drivers: {
      total: driversResult.data?.length ?? 0,
      byStatus: driversByStatus,
    },
    attention,
    setup: {
      steps: setupSteps,
      completed,
      total: setupSteps.length,
      isComplete: completed === setupSteps.length,
    },
  };
}
