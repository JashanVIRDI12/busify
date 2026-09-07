"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext, databaseError } from "@/lib/auth/guard";
import { canWriteFinance } from "@/lib/permissions";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/**
 * Driver pay is the one module where the ACCOUNTANT role has more access than
 * a dispatcher, so every action here gates on `canWriteFinance` rather than the
 * general write permission.
 */

/**
 * Materialise a draft pay entry for every driver assignment that does not have
 * one yet.
 *
 * Pay rows are not created when a driver is assigned, because assignment
 * changes right up to the morning of the trip and each change would leave a
 * stale row behind. Instead this runs on demand, is idempotent, and only ever
 * adds — an entry an operator has already priced is never touched.
 */
export async function generatePayDraftsAction(): Promise<
  ActionResult<{ created: number }>
> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow editing driver pay." };
  }

  const { data: assignments, error } = await supabase
    .from("trip_assignments")
    .select("driver_id, trip_id, trips(id, departure_at, return_at, dropoff_at)")
    .not("driver_id", "is", null)
    .limit(2000);

  if (error) {
    return { ok: false, message: "Assignments could not be read." };
  }

  const { data: existing } = await supabase
    .from("driver_pay_entries")
    .select("trip_id, driver_id")
    .limit(5000);

  const seen = new Set(
    (existing ?? []).map((entry) => `${entry.trip_id}:${entry.driver_id}`),
  );

  const rows = (assignments ?? [])
    .filter(
      (assignment) =>
        assignment.driver_id &&
        !seen.has(`${assignment.trip_id}:${assignment.driver_id}`),
    )
    .map((assignment) => ({
      organization_id: session.organization.id,
      trip_id: assignment.trip_id,
      driver_id: assignment.driver_id!,
      status: "DRAFT" as const,
      starts_at: assignment.trips?.departure_at ?? null,
      ends_at: assignment.trips?.return_at ?? assignment.trips?.dropoff_at ?? null,
    }));

  if (rows.length === 0) {
    return { ok: true, data: { created: 0 } };
  }

  const { error: insertError } = await supabase
    .from("driver_pay_entries")
    .insert(rows);

  if (insertError) {
    return {
      ok: false,
      message: databaseError(insertError).message ?? "Drafts could not be created.",
    };
  }

  revalidatePath("/driver-pay");
  return { ok: true, data: { created: rows.length } };
}

const entryUpdate = z.object({
  id: z.uuid(),
  rate_basis: z.enum(["FLAT", "HOURLY", "DAILY", "MILEAGE"]),
  rate: z.coerce.number<number>().min(0),
  quantity: z.coerce.number<number>().min(0),
});

/** Edit one row's pay. The total is derived here, never sent by the client. */
export async function updatePayEntryAction(
  input: unknown,
): Promise<ActionResult<{ total: number }>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow editing driver pay." };
  }

  const parsed = entryUpdate.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]!.message };
  }

  // FLAT means the rate *is* the pay, so quantity does not multiply it.
  const total =
    parsed.data.rate_basis === "FLAT"
      ? parsed.data.rate
      : parsed.data.rate * parsed.data.quantity;

  const { error } = await supabase
    .from("driver_pay_entries")
    .update({
      rate_basis: parsed.data.rate_basis,
      rate: parsed.data.rate,
      quantity: parsed.data.quantity,
      total_pay: Number(total.toFixed(2)),
    })
    .eq("id", parsed.data.id)
    // A row already rolled into a stub is settled; changing it would put the
    // stub's total out of step with its own entries.
    .is("pay_stub_id", null);

  if (error) {
    return { ok: false, message: "That pay entry could not be updated." };
  }

  revalidatePath("/driver-pay");
  return { ok: true, data: { total: Number(total.toFixed(2)) } };
}

/**
 * Roll the selected entries into one pay stub per driver.
 *
 * The stub's total is summed from the entries here rather than trusted from
 * the browser, and entries already attached to a stub are skipped so a
 * double-click cannot pay someone twice.
 */
export async function issuePayStubsAction(
  entryIds: string[],
): Promise<ActionResult<{ stubs: number }>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow issuing pay stubs." };
  }

  const parsed = uuid.array().min(1).max(500).safeParse(entryIds);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { data: entries, error } = await supabase
    .from("driver_pay_entries")
    .select("id, driver_id, total_pay, starts_at, ends_at, drivers(first_name)")
    .in("id", parsed.data)
    .is("pay_stub_id", null);

  if (error) return { ok: false, message: "Those entries could not be read." };
  if (!entries?.length) {
    return { ok: false, message: "Those entries are already on a pay stub." };
  }

  const byDriver = new Map<string, typeof entries>();
  for (const entry of entries) {
    const bucket = byDriver.get(entry.driver_id) ?? [];
    bucket.push(entry);
    byDriver.set(entry.driver_id, bucket);
  }

  let created = 0;

  for (const [driverId, group] of byDriver) {
    const total = group.reduce((sum, entry) => sum + Number(entry.total_pay), 0);
    const dates = group
      .flatMap((entry) => [entry.starts_at, entry.ends_at])
      .filter((value): value is string => Boolean(value))
      .sort();

    const firstName = group[0]?.drivers?.first_name ?? "Driver";

    const { data: stub, error: stubError } = await supabase
      .from("driver_pay_stubs")
      .insert({
        organization_id: session.organization.id,
        reference: payStubReference(firstName),
        driver_id: driverId,
        status: "PENDING",
        total_pay: Number(total.toFixed(2)),
        period_start: dates[0]?.slice(0, 10) ?? null,
        period_end: dates.at(-1)?.slice(0, 10) ?? null,
      })
      .select("id")
      .single();

    if (stubError || !stub) continue;

    await supabase
      .from("driver_pay_entries")
      .update({ pay_stub_id: stub.id, status: "PENDING" })
      .in(
        "id",
        group.map((entry) => entry.id),
      );

    created += 1;
  }

  revalidatePath("/driver-pay");
  return { ok: true, data: { stubs: created } };
}

export async function setPayStubStatusAction(
  stubIds: string[],
  status: "PENDING" | "APPROVED" | "PAID" | "VOID",
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow changing pay stubs." };
  }

  const parsed = uuid.array().min(1).max(500).safeParse(stubIds);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase
    .from("driver_pay_stubs")
    .update({
      status,
      payment_date: status === "PAID" ? new Date().toISOString().slice(0, 10) : null,
    })
    .in("id", parsed.data);

  if (error) {
    return { ok: false, message: "Those pay stubs could not be updated." };
  }

  revalidatePath("/driver-pay");
  return { ok: true, data: undefined };
}

/**
 * `7DBSQ_Jasnoor` — a short random code plus the driver's first name.
 *
 * The name is in the reference because these get printed, handed over and
 * talked about out loud; a bare code would mean looking every one of them up.
 */
function payStubReference(firstName: string): string {
  const alphabet = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let index = 0; index < 5; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${code}_${firstName.replace(/[^\w-]/g, "").slice(0, 16)}`;
}
