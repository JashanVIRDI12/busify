/**
 * Template substitution for the operator-authored emails.
 *
 * The placeholders are the ones listed in Settings → Templates. Anything the
 * operator types that is not in the map is left exactly as written rather than
 * blanked — a stray `{{ TOTAL }}` in the body should look like the mistake it
 * is, not silently vanish from a customer's email.
 */

export type MailTokens = {
  CONTACT_FIRST_NAME?: string | null;
  SENDER_FULL_NAME?: string | null;
  COMPANY_NAME?: string | null;
  QUOTE_LINK?: string | null;
  RESERVATION_ID?: string | null;
};

const PLACEHOLDER = /\{\{\s*([A-Z_]+)\s*\}\}/g;

export function renderTemplate(template: string, tokens: MailTokens): string {
  return template.replace(PLACEHOLDER, (whole, name: string) => {
    const value = tokens[name as keyof MailTokens];
    return value === undefined || value === null ? whole : value;
  });
}

/** "Sarah Johnson" → "Sarah". Falls back to something addressable. */
export function firstNameOf(
  first: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = first?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0]!;
  const local = email?.split("@")[0];
  return local && local.length > 0 ? local : "there";
}
