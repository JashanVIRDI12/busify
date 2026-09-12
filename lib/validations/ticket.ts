import { z } from "zod";

import { optionalText, optionalUuid } from "./shared";

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;

export const TICKET_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const TICKET_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const TICKET_SEVERITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const ticketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the ticket a title")
    .max(160, "That title is too long"),
  trip_id: optionalUuid,
  ticket_type: optionalText,
  status: z.enum(TICKET_STATUSES).default("OPEN"),
  severity: z.enum(TICKET_SEVERITIES).default("MEDIUM"),
  assignee_id: optionalUuid,
  body: optionalText,
});

export type TicketInput = z.infer<typeof ticketSchema>;

export const ticketCommentSchema = z.object({
  ticket_id: z.uuid("That ticket could not be found"),
  body: z
    .string()
    .trim()
    .min(1, "Write a comment first")
    .max(4000, "That comment is too long"),
});
