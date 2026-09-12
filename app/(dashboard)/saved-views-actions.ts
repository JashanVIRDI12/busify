"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext } from "@/lib/auth/guard";
import type { ActionResult } from "@/lib/validations/shared";

const RESOURCE = z
  .string()
  .trim()
  .regex(/^[a-z-]{2,32}$/, "Unknown list");

const NAME = z
  .string()
  .trim()
  .min(1, "Give the view a name")
  .max(60, "That name is too long");

/**
 * A saved view stores the list's query string verbatim. Parsing it into a
 * structured filter object would mean migrating every stored view whenever a
 * list gains a filter — and the query string is already the canonical
 * representation of list state everywhere else in the app.
 */
export async function createSavedViewAction(
  resource: string,
  name: string,
  query: string,
): Promise<ActionResult<{ id: string }>> {
  const { session, supabase } = await actionContext();

  const parsedResource = RESOURCE.safeParse(resource);
  if (!parsedResource.success) {
    return { ok: false, message: "Unknown list." };
  }

  const parsedName = NAME.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, message: parsedName.error.issues[0]!.message };
  }

  const { count } = await supabase
    .from("saved_views")
    .select("id", { count: "exact", head: true })
    .eq("resource", parsedResource.data)
    .eq("user_id", session.user.id);

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      organization_id: session.organization.id,
      user_id: session.user.id,
      resource: parsedResource.data,
      name: parsedName.data,
      // Strip the leading "?" so the stored value round-trips through
      // URLSearchParams without accumulating them.
      query: query.replace(/^\?/, ""),
      position: count ?? 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "You already have a view with that name." };
    }
    console.error("Failed to save view", error);
    return { ok: false, message: "That view could not be saved." };
  }

  revalidatePath(`/${parsedResource.data}`);
  return { ok: true, data: { id: data.id } };
}

export async function renameSavedViewAction(
  id: string,
  name: string,
): Promise<ActionResult<void>> {
  const { supabase } = await actionContext();

  const parsedName = NAME.safeParse(name);
  if (!parsedName.success) {
    return { ok: false, message: parsedName.error.issues[0]!.message };
  }

  // RLS restricts this to the caller's own views.
  const { data, error } = await supabase
    .from("saved_views")
    .update({ name: parsedName.data })
    .eq("id", id)
    .select("resource")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "You already have a view with that name." };
    }
    return { ok: false, message: "That view could not be renamed." };
  }

  revalidatePath(`/${data.resource}`);
  return { ok: true, data: undefined };
}

export async function deleteSavedViewAction(
  id: string,
): Promise<ActionResult<void>> {
  const { supabase } = await actionContext();

  const { data, error } = await supabase
    .from("saved_views")
    .delete()
    .eq("id", id)
    .select("resource")
    .single();

  if (error) {
    return { ok: false, message: "That view could not be deleted." };
  }

  revalidatePath(`/${data.resource}`);
  return { ok: true, data: undefined };
}
