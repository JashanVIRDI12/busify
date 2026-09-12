"use server";

import { revalidatePath } from "next/cache";

import { actionContext } from "@/lib/auth/guard";
import { canWriteFinance } from "@/lib/permissions";
import { convertQuoteToReservations } from "@/lib/quotes/convert";
import { uuid, type ActionResult } from "@/lib/validations/shared";

/**
 * Turn a won quote into reservations, from the builder's Actions menu.
 *
 * The same conversion also runs when a customer accepts online. Doing it by
 * hand exists because plenty of charter work is agreed on the phone, and the
 * operator should not have to fake a customer acceptance to get the job onto
 * the board.
 */
export async function convertQuoteAction(
  quoteId: string,
): Promise<ActionResult<{ created: number; alreadyExisted: boolean }>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow converting quotes." };
  }

  const id = uuid.safeParse(quoteId);
  if (!id.success) return { ok: false, message: "That quote could not be found." };

  const result = await convertQuoteToReservations(
    supabase,
    id.data,
    session.organization.timezone,
  );

  if (!result.ok) return { ok: false, message: result.message };

  // Won, not merely accepted: an operator converting by hand has closed the
  // sale, and the pipeline should say so without a second click.
  if (!result.alreadyExisted) {
    await supabase
      .from("quotes")
      .update({ pipeline_status: "WON", status: "ACCEPTED" })
      .eq("id", id.data);
  }

  revalidatePath("/quotes");
  revalidatePath(`/quotes/${id.data}`);
  revalidatePath("/reservations");
  revalidatePath("/board");
  revalidatePath("/assignments");

  return {
    ok: true,
    data: { created: result.created, alreadyExisted: result.alreadyExisted },
  };
}
