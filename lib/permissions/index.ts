import type { OrgRole } from "@/types/database";

/**
 * Role capabilities, mirroring the RLS policy matrix in
 * supabase/migrations/*_rls.sql.
 *
 * This exists so the UI can hide actions a user cannot perform. It is NOT the
 * authorization boundary — the database is. Every server action re-checks.
 */
export const ROLE_LABELS: Record<OrgRole, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  DISPATCHER: "Dispatcher",
  DRIVER: "Driver",
  ACCOUNTANT: "Accountant",
  STAFF: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  OWNER: "Full access, including billing and deleting the organization.",
  ADMIN: "Manages the team, fleet, and every operational record.",
  DISPATCHER: "Runs day-to-day trips, assignments, and requests.",
  DRIVER: "Read-only access to their own trips and documents.",
  ACCOUNTANT: "Read-only operations, with write access to quotes and bookings.",
  STAFF: "Creates and edits operational records.",
};

const WRITE_ROLES: readonly OrgRole[] = ["OWNER", "ADMIN", "DISPATCHER", "STAFF"];
const MANAGE_ROLES: readonly OrgRole[] = ["OWNER", "ADMIN"];
const FINANCE_ROLES: readonly OrgRole[] = [
  "OWNER",
  "ADMIN",
  "DISPATCHER",
  "STAFF",
  "ACCOUNTANT",
];

/** Create and edit operational records (fleet, drivers, customers, trips). */
export function canWrite(role: OrgRole | null | undefined): boolean {
  return !!role && WRITE_ROLES.includes(role);
}

/** Delete records, manage members, edit organization settings. */
export function canManage(role: OrgRole | null | undefined): boolean {
  return !!role && MANAGE_ROLES.includes(role);
}

/** Create and edit quotes and bookings. */
export function canWriteFinance(role: OrgRole | null | undefined): boolean {
  return !!role && FINANCE_ROLES.includes(role);
}

export function isOwner(role: OrgRole | null | undefined): boolean {
  return role === "OWNER";
}

export const ASSIGNABLE_ROLES: readonly OrgRole[] = [
  "ADMIN",
  "DISPATCHER",
  "STAFF",
  "ACCOUNTANT",
  "DRIVER",
];
