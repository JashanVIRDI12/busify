"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionContext } from "@/lib/auth/guard";
import { canWriteFinance } from "@/lib/permissions";
import { MAX_QUOTE_FILES } from "@/lib/quotes/limits";
import { uuid, type ActionResult } from "@/lib/validations/shared";


const registerInput = z.object({
  quote_id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  storage_path: z.string().trim().min(1).max(400),
  size_bytes: z.number().int().min(0),
  content_type: z.string().trim().max(120).nullable().default(null),
});

/**
 * Records a file the browser has already uploaded to storage.
 *
 * The upload itself goes browser-to-storage rather than through this server:
 * a 10MB contract would otherwise be base64-encoded into a Server Action
 * payload and buffered in the Node process for no benefit. Storage policies
 * enforce the tenant prefix on the way in, and this action re-checks that the
 * path belongs to the caller's organization before indexing it.
 */
export async function registerQuoteFileAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow attaching files." };
  }

  const parsed = registerInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "That file could not be attached." };
  }

  // The path is generated in the browser, so it is not trusted: a caller who
  // wrote to their own tenant prefix must not be able to index the row under
  // someone else's quote.
  if (!parsed.data.storage_path.startsWith(`${session.organization.id}/`)) {
    return { ok: false, message: "That file could not be attached." };
  }

  const { count } = await supabase
    .from("quote_files")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", parsed.data.quote_id);

  if ((count ?? 0) >= MAX_QUOTE_FILES) {
    return {
      ok: false,
      message: `A quote can hold ${MAX_QUOTE_FILES} files. Remove one first.`,
    };
  }

  const { data, error } = await supabase
    .from("quote_files")
    .insert({
      organization_id: session.organization.id,
      quote_id: parsed.data.quote_id,
      name: parsed.data.name,
      storage_path: parsed.data.storage_path,
      size_bytes: parsed.data.size_bytes,
      content_type: parsed.data.content_type,
      uploaded_by: session.user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to record quote file", error);
    return { ok: false, message: "That file could not be attached." };
  }

  revalidatePath(`/quotes/${parsed.data.quote_id}`);
  return { ok: true, data: { id: data.id } };
}

export async function deleteQuoteFileAction(
  id: string,
): Promise<ActionResult<void>> {
  const { session, supabase } = await actionContext();

  if (!canWriteFinance(session.role)) {
    return { ok: false, message: "Your role does not allow removing files." };
  }

  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That file was not found." };

  const { data, error } = await supabase
    .from("quote_files")
    .delete()
    .eq("id", parsed.data)
    .select("quote_id, storage_path")
    .single();

  if (error || !data) {
    return { ok: false, message: "That file could not be removed." };
  }

  // Best effort: the row is what the UI reads, so an orphaned object is a
  // storage-cleanup problem rather than a broken quote.
  await supabase.storage.from("quote-files").remove([data.storage_path]);

  revalidatePath(`/quotes/${data.quote_id}`);
  return { ok: true, data: undefined };
}

/** Short-lived URL for downloading a private attachment. */
export async function quoteFileUrlAction(
  id: string,
): Promise<ActionResult<{ url: string }>> {
  const { supabase } = await actionContext();

  const parsed = uuid.safeParse(id);
  if (!parsed.success) return { ok: false, message: "That file was not found." };

  const { data: file } = await supabase
    .from("quote_files")
    .select("storage_path")
    .eq("id", parsed.data)
    .maybeSingle();

  if (!file) return { ok: false, message: "That file was not found." };

  const { data, error } = await supabase.storage
    .from("quote-files")
    .createSignedUrl(file.storage_path, 60);

  if (error || !data) {
    return { ok: false, message: "That file could not be opened." };
  }

  return { ok: true, data: { url: data.signedUrl } };
}
