import type {
  TimelineBar,
  TimelineGroup,
} from "@/components/dispatch/timeline";
import type { DispatchTrip, FleetRow } from "@/lib/queries/dispatch";
import { tripEnd } from "@/lib/queries/dispatch";

/**
 * Turns reservations into timeline rows and bars.
 *
 * Turnaround is drawn rather than assumed: a coach that drops off at 19:00 is
 * not available at 19:01, and the board's whole job is to stop someone booking
 * it as if it were.
 */
export const BUFFER_MINUTES = 45;

function toneFor(trip: DispatchTrip): TimelineBar["tone"] {
  if (trip.status === "CANCELLED") return "blocked";
  if (trip.status === "SCHEDULED") return "draft";
  return "confirmed";
}

/**
 * Marks every bar that overlaps another on the same row.
 *
 * Run after the bars are built rather than during: a conflict is a property of
 * the pair, and both sides need to turn amber, not just the later one.
 */
function markConflicts(bars: TimelineBar[]): TimelineBar[] {
  const byRow = new Map<string, TimelineBar[]>();
  for (const bar of bars) {
    const bucket = byRow.get(bar.rowId) ?? [];
    bucket.push(bar);
    byRow.set(bar.rowId, bucket);
  }

  const conflicted = new Set<string>();

  for (const row of byRow.values()) {
    const sorted = [...row].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
    );

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]!;
      const current = sorted[index]!;
      // The buffer counts: a booking inside the turnaround is a conflict even
      // though the trips themselves do not overlap.
      const previousEnd =
        new Date(previous.end).getTime() +
        (previous.bufferMinutes ?? 0) * 60_000;

      if (new Date(current.start).getTime() < previousEnd) {
        conflicted.add(previous.id);
        conflicted.add(current.id);
      }
    }
  }

  return bars.map((bar) =>
    conflicted.has(bar.id) && bar.tone !== "blocked"
      ? { ...bar, tone: "conflict" }
      : bar,
  );
}

export function buildVehicleTimeline(
  trips: DispatchTrip[],
  fleet: FleetRow[],
): { groups: TimelineGroup[]; bars: TimelineBar[]; unassigned: number } {
  const groups = new Map<string, TimelineGroup>();

  for (const vehicle of fleet) {
    const key = vehicle.typeId ?? "none";
    const group = groups.get(key) ?? {
      id: key,
      label: vehicle.typeName,
      rows: [],
    };
    group.rows.push({
      id: vehicle.id,
      label: vehicle.name,
      meta: String(vehicle.capacity),
    });
    groups.set(key, group);
  }

  const bars: TimelineBar[] = [];
  let unassigned = 0;

  for (const trip of trips) {
    const vehicleIds = trip.assignments
      .map((assignment) => assignment.vehicleId)
      .filter((id): id is string => Boolean(id));

    if (vehicleIds.length === 0) {
      unassigned += 1;
      continue;
    }

    for (const vehicleId of vehicleIds) {
      bars.push({
        id: `${trip.id}:${vehicleId}`,
        rowId: vehicleId,
        label: trip.reference ?? trip.pickupLocation,
        href: `/reservations/${trip.id}`,
        start: trip.departureAt,
        end: tripEnd(trip).toISOString(),
        bufferMinutes: BUFFER_MINUTES,
        tone: toneFor(trip),
        badge: vehicleIds.length,
      });
    }
  }

  return {
    groups: [...groups.values()],
    bars: markConflicts(bars),
    unassigned,
  };
}

export function buildDriverTimeline(
  trips: DispatchTrip[],
  drivers: { id: string; name: string }[],
): { groups: TimelineGroup[]; bars: TimelineBar[]; unassigned: number } {
  const groups: TimelineGroup[] = [
    {
      id: "drivers",
      label: "Drivers",
      rows: drivers.map((driver) => ({ id: driver.id, label: driver.name })),
    },
  ];

  const bars: TimelineBar[] = [];
  let unassigned = 0;

  for (const trip of trips) {
    const driverIds = trip.assignments
      .map((assignment) => assignment.driverId)
      .filter((id): id is string => Boolean(id));

    if (driverIds.length === 0) {
      unassigned += 1;
      continue;
    }

    for (const driverId of driverIds) {
      bars.push({
        id: `${trip.id}:${driverId}`,
        rowId: driverId,
        label: trip.reference ?? trip.pickupLocation,
        href: `/reservations/${trip.id}`,
        start: trip.departureAt,
        end: tripEnd(trip).toISOString(),
        bufferMinutes: BUFFER_MINUTES,
        tone: toneFor(trip),
      });
    }
  }

  return { groups, bars: markConflicts(bars), unassigned };
}
