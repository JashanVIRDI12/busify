import { cn } from "@/lib/utils";

/**
 * Status is always an outlined pill, never a filled one. Filled colour in this
 * product means "you can click this"; a status is a fact about the row, so it
 * borrows the hue without the weight.
 */
const TONES = {
  neutral: "border-cloud text-slate",
  teal: "border-teal-200 text-teal-600",
  orange: "border-orange-200 text-orange-600",
  violet: "border-violet-100 text-violet-500",
  red: "border-destructive/30 text-destructive",
} as const;

export type PillTone = keyof typeof TONES;

export function StatusPill({
  label,
  tone = "neutral",
  uppercase = false,
  className,
}: {
  label: string;
  tone?: PillTone;
  uppercase?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border bg-signal-white px-2.5 py-[3px] text-[11px] font-medium whitespace-nowrap",
        TONES[tone],
        uppercase && "tracking-wide uppercase",
        className,
      )}
    >
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-enum presentation                                                      */
/* -------------------------------------------------------------------------- */

type Presentation = { label: string; tone: PillTone };

export const TRIP_STATUS: Record<string, Presentation> = {
  SCHEDULED: { label: "New", tone: "neutral" },
  CONFIRMED: { label: "Confirmed", tone: "teal" },
  DISPATCHED: { label: "Dispatched", tone: "violet" },
  IN_PROGRESS: { label: "In Progress", tone: "teal" },
  COMPLETED: { label: "Completed", tone: "teal" },
  CANCELLED: { label: "Cancelled", tone: "red" },
};

export const QUOTE_PIPELINE_STATUS: Record<string, Presentation> = {
  LEAD: { label: "Lead", tone: "orange" },
  QUOTED: { label: "Sent", tone: "teal" },
  FOLLOW_UP: { label: "Follow Up", tone: "violet" },
  WON: { label: "Won", tone: "teal" },
  LOST: { label: "Lost", tone: "red" },
};

export const TICKET_STATUS: Record<string, Presentation> = {
  OPEN: { label: "Open", tone: "orange" },
  IN_PROGRESS: { label: "In Progress", tone: "violet" },
  RESOLVED: { label: "Resolved", tone: "teal" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const PAY_STATUS: Record<string, Presentation> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PENDING: { label: "Pending", tone: "orange" },
  APPROVED: { label: "Approved", tone: "violet" },
  PAID: { label: "Paid", tone: "teal" },
  VOID: { label: "Void", tone: "red" },
};

export const DRIVER_STATUS: Record<string, Presentation> = {
  ACTIVE: { label: "Active", tone: "teal" },
  OFF_DUTY: { label: "Off Duty", tone: "neutral" },
  ON_TRIP: { label: "On Trip", tone: "violet" },
  ON_LEAVE: { label: "On Leave", tone: "orange" },
  INACTIVE: { label: "Not Active", tone: "neutral" },
};

/** Falls back to a title-cased version of the raw value rather than throwing. */
export function pillFor(
  map: Record<string, Presentation>,
  value: string | null | undefined,
): Presentation {
  if (!value) return { label: "--", tone: "neutral" };
  return (
    map[value] ?? {
      label: value
        .toLowerCase()
        .split("_")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
      tone: "neutral",
    }
  );
}
