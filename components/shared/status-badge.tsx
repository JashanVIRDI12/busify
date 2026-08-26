import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  DriverStatus,
  TripRequestStatus,
  TripStatus,
  VehicleStatus,
} from "@/types/database";

/**
 * In-product status pills: full radius, tight padding, coloured fill with dark
 * text. Green reads "good to go", blue "in flight", amber "needs a look", grey
 * "dormant" — and every pill carries its label, so colour is never the only
 * channel carrying meaning.
 */
type Tone = "go" | "active" | "attention" | "dormant" | "stopped";

const TONE_STYLE: Record<Tone, string> = {
  go: "bg-mint text-[#065f46]",
  active: "bg-interactive/12 text-interactive",
  attention: "bg-amber/18 text-[#8a4b12]",
  dormant: "bg-plaster text-slate",
  stopped: "bg-destructive/10 text-destructive",
};

const DOT_STYLE: Record<Tone, string> = {
  go: "bg-emerald",
  active: "bg-interactive",
  attention: "bg-amber",
  dormant: "bg-ash",
  stopped: "bg-destructive",
};

const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Available", tone: "go" },
  ASSIGNED: { label: "Assigned", tone: "active" },
  IN_TRIP: { label: "In trip", tone: "active" },
  MAINTENANCE: { label: "Maintenance", tone: "attention" },
  INACTIVE: { label: "Inactive", tone: "dormant" },
};

const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Active", tone: "go" },
  ON_TRIP: { label: "On trip", tone: "active" },
  OFF_DUTY: { label: "Off duty", tone: "dormant" },
  ON_LEAVE: { label: "On leave", tone: "attention" },
  INACTIVE: { label: "Inactive", tone: "dormant" },
};

const TRIP_REQUEST_STATUS: Record<TripRequestStatus, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "active" },
  REVIEWING: { label: "Reviewing", tone: "dormant" },
  NEEDS_INFORMATION: { label: "Needs info", tone: "attention" },
  QUOTED: { label: "Quoted", tone: "active" },
  ACCEPTED: { label: "Accepted", tone: "go" },
  DECLINED: { label: "Declined", tone: "stopped" },
  EXPIRED: { label: "Expired", tone: "dormant" },
};

const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  SCHEDULED: { label: "Scheduled", tone: "dormant" },
  CONFIRMED: { label: "Confirmed", tone: "active" },
  DISPATCHED: { label: "Dispatched", tone: "active" },
  IN_PROGRESS: { label: "In progress", tone: "attention" },
  COMPLETED: { label: "Completed", tone: "go" },
  CANCELLED: { label: "Cancelled", tone: "stopped" },
};

function StatusPill({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-semibold whitespace-nowrap",
        TONE_STYLE[tone],
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT_STYLE[tone])} />
      {label}
    </span>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  return <StatusPill {...VEHICLE_STATUS[status]} />;
}

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  return <StatusPill {...DRIVER_STATUS[status]} />;
}

export function TripRequestStatusBadge({ status }: { status: TripRequestStatus }) {
  return <StatusPill {...TRIP_REQUEST_STATUS[status]} />;
}

export function TripStatusBadge({ status }: { status: TripStatus }) {
  return <StatusPill {...TRIP_STATUS[status]} />;
}

export { Badge };

export const VEHICLE_STATUS_LABELS = Object.fromEntries(
  Object.entries(VEHICLE_STATUS).map(([k, v]) => [k, v.label]),
) as Record<VehicleStatus, string>;

export const DRIVER_STATUS_LABELS = Object.fromEntries(
  Object.entries(DRIVER_STATUS).map(([k, v]) => [k, v.label]),
) as Record<DriverStatus, string>;

export const TRIP_REQUEST_STATUS_LABELS = Object.fromEntries(
  Object.entries(TRIP_REQUEST_STATUS).map(([k, v]) => [k, v.label]),
) as Record<TripRequestStatus, string>;

export const TRIP_STATUS_LABELS = Object.fromEntries(
  Object.entries(TRIP_STATUS).map(([k, v]) => [k, v.label]),
) as Record<TripStatus, string>;
