/**
 * Limits the quote builder enforces on both sides.
 *
 * Lives outside the Server Action module because a `"use server"` file may only
 * export async functions — exporting a constant from one silently invalidates
 * every export in it.
 */

/** Attachments per quote. Matched in the UI so the panel can say why. */
export const MAX_QUOTE_FILES = 5;

/** Per-file upload cap, matching the `quote-files` bucket's own limit. */
export const MAX_QUOTE_FILE_BYTES = 10 * 1024 * 1024;
