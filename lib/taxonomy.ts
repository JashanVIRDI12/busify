/**
 * Option lists that are shared across the console but are not database enums.
 *
 * These are deliberately plain data rather than tables: an operator never adds
 * an industry, and making them rows would mean seeding them into every new
 * organization and keeping the copies in step.
 */

export const INDUSTRIES = [
  "School / School Board",
  "College / University",
  "Sports Team",
  "Corporate",
  "Government",
  "Religious Organization",
  "Tour Operator",
  "Travel Agency",
  "Event / Entertainment",
  "Wedding",
  "Non-profit",
  "Healthcare",
  "Construction",
  "Other",
] as const;

export const EVENT_TYPES = [
  "Field Trip",
  "Sports Event",
  "Corporate Shuttle",
  "Conference",
  "Wedding",
  "Concert / Festival",
  "Airport Transfer",
  "Casino Trip",
  "City Tour",
  "Multi-day Tour",
  "Other",
] as const;

export const VEHICLE_AMENITIES = [
  "Bathroom",
  "Luggage",
  "Outlets",
  "ADA Compliant",
  "Wifi",
  "TV Screens",
  "Leather Seats",
  "Seat Belts",
] as const;

export const TICKET_TYPES = [
  "Mechanical",
  "Driver",
  "Customer Service",
  "Billing",
  "Accident / Incident",
  "Late Arrival",
  "Cancellation",
  "Other",
] as const;

export const TRIP_TYPE_LABELS: Record<string, string> = {
  ONE_WAY: "One Way",
  ROUND_TRIP: "Round Trip",
  HOURLY: "Hourly",
  DAILY: "Daily",
  SHUTTLE: "Shuttle",
  OTHER: "Other",
};

export const QUOTE_PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Turn a string list into the `{ value, label }` shape the filters take. */
export function toOptions(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

/** Enum values render as options with a friendlier label. */
export function enumOptions(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}
