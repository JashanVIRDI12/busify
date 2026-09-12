/** The recurrence rule stored on `quote_trips.recurrence` (jsonb). */
export type RecurrenceRule = {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  /** Every N days/weeks/months. */
  interval: number;
  /** 0 = Sunday … 6 = Saturday. Only meaningful for WEEKLY. */
  weekdays: number[];
  /** How it ends: a count of occurrences, or an end date, or neither. */
  ends: "NEVER" | "AFTER" | "ON";
  count: number;
  until: string | null;
};

export const DEFAULT_RECURRENCE: RecurrenceRule = {
  enabled: false,
  frequency: "WEEKLY",
  interval: 1,
  weekdays: [],
  ends: "AFTER",
  count: 4,
  until: null,
};

export function asRecurrence(value: unknown): RecurrenceRule {
  if (!value || typeof value !== "object") return DEFAULT_RECURRENCE;
  const raw = value as Partial<RecurrenceRule>;
  return {
    enabled: Boolean(raw.enabled),
    frequency:
      raw.frequency === "DAILY" || raw.frequency === "MONTHLY"
        ? raw.frequency
        : "WEEKLY",
    interval:
      typeof raw.interval === "number" && raw.interval >= 1
        ? Math.min(Math.round(raw.interval), 52)
        : 1,
    weekdays: Array.isArray(raw.weekdays)
      ? raw.weekdays.filter((d) => typeof d === "number" && d >= 0 && d <= 6)
      : [],
    ends: raw.ends === "NEVER" || raw.ends === "ON" ? raw.ends : "AFTER",
    count:
      typeof raw.count === "number" && raw.count >= 1
        ? Math.min(Math.round(raw.count), 260)
        : 4,
    until: typeof raw.until === "string" ? raw.until : null,
  };
}

const FREQ_NOUN: Record<RecurrenceRule["frequency"], string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export { WEEKDAY_LABELS };

export function summarizeRecurrence(rule: RecurrenceRule): string {
  if (!rule.enabled) return "Does not repeat";

  const every =
    rule.interval === 1
      ? `Every ${FREQ_NOUN[rule.frequency]}`
      : `Every ${rule.interval} ${FREQ_NOUN[rule.frequency]}s`;

  const days =
    rule.frequency === "WEEKLY" && rule.weekdays.length > 0
      ? ` on ${rule.weekdays
          .slice()
          .sort((a, b) => a - b)
          .map((d) => WEEKDAY_LABELS[d])
          .join(", ")}`
      : "";

  const ends =
    rule.ends === "AFTER"
      ? `, ${rule.count} times`
      : rule.ends === "ON" && rule.until
        ? `, until ${rule.until}`
        : "";

  return `${every}${days}${ends}`;
}
