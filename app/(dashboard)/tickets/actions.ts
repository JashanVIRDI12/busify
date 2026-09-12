"use server";

import { revalidatePath } from "next/cache";

import { actionContext, databaseError } from "@/lib/auth/guard";
import {
  formDataToObject,
  formError,
  formSuccess,
  validationError,
  type FormState,
} from "@/lib/forms";
import { canManage, canWrite } from "@/lib/permissions";
import { ticketCommentSchema, ticketSchema } from "@/lib/validations/ticket";
import { uuid, type ActionResult } from "@/lib/validations/shared";

export async function createTicketAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow raising tickets.");
  }

  const parsed = ticketSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const { data, error } = await supabase
    .from("tickets")
    .insert({
      organization_id: session.organization.id,
      created_by: session.user.id,
      ...parsed.data,
    })
    .select("id")
    .single();

  if (error) return databaseError(error);

  // The create drawer collects an opening comment alongside the ticket, so it
  // is written here rather than making the operator save and then comment.
  const comment = formData.get("comment");
  if (typeof comment === "string" && comment.trim()) {
    await supabase.from("ticket_comments").insert({
      organization_id: session.organization.id,
      ticket_id: data.id,
      author_id: session.user.id,
      body: comment.trim(),
    });
  }

  revalidatePath("/tickets");
  return formSuccess();
}

export async function updateTicketAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return formError("Your role does not allow editing tickets.");
  }

  const id = uuid.safeParse(formData.get("id"));
  if (!id.success) return formError("That ticket could not be found.");

  const parsed = ticketSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return validationError(parsed.error);

  const resolved =
    parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED";

  const { error } = await supabase
    .from("tickets")
    .update({
      ...parsed.data,
      // Stamped here rather than by a trigger so re-opening a ticket clears it.
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", id.data);

  if (error) return databaseError(error);

  revalidatePath("/tickets");
  return formSuccess();
}

export async function addTicketCommentAction(
  ticketId: string,
  body: string,
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canWrite(session.role)) {
    return { ok: false, message: "Your role does not allow commenting." };
  }

  const parsed = ticketCommentSchema.safeParse({ ticket_id: ticketId, body });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]!.message };
  }

  const { error } = await supabase.from("ticket_comments").insert({
    organization_id: session.organization.id,
    ticket_id: parsed.data.ticket_id,
    author_id: session.user.id,
    body: parsed.data.body,
  });

  if (error) {
    return { ok: false, message: "That comment could not be saved." };
  }

  revalidatePath("/tickets");
  return { ok: true, data: undefined };
}

export async function deleteTicketsAction(
  ids: string[],
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canManage(session.role)) {
    return { ok: false, message: "Only owners and admins can delete tickets." };
  }

  const parsed = uuid.array().max(500).safeParse(ids);
  if (!parsed.success) {
    return { ok: false, message: "That selection could not be read." };
  }

  const { error } = await supabase.from("tickets").delete().in("id", parsed.data);

  if (error) {
    return { ok: false, message: databaseError(error).message ?? "Delete failed." };
  }

  revalidatePath("/tickets");
  return { ok: true, data: undefined };
}
