import "server-only";

/**
 * "Now", for a Server Component render.
 *
 * Reading the clock inside a component body is normally a purity bug: a client
 * component can re-render at any time and would silently produce a different
 * answer each time. A Server Component renders exactly once per request, so the
 * value is stable for the whole tree — and comparisons like "is this quote
 * expired" have to be made against the request's instant somewhere.
 *
 * This function is that somewhere. Keeping it in one named place makes the
 * distinction explicit rather than leaving bare `Date.now()` calls scattered
 * through pages, where the next reader cannot tell which are deliberate.
 */
export function requestNow(): number {
  return Date.now();
}
