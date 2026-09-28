/**
 * `fetch` for the server Supabase client, retrying the one 401 that is not the
 * caller's fault.
 *
 * PostgREST checks a token's `iat` with 30 seconds' leeway, and it can still
 * reject a token issued moments ago as "JWT issued at future" (PGRST303). That
 * is exactly the token the proxy has just refreshed, so after the session sits
 * idle past its hour, the first query of the next request fails while the one
 * straight after it passes. Left alone, that failure empties the membership
 * lookup and bounces a signed-in operator to onboarding. One retry, a moment
 * later, turns it into the success it should have been.
 *
 * Every other response, 401s included, is returned untouched.
 */
export async function fetchWithJwtRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  // A Request's body can be read once; keep a copy in case it is needed again.
  const retry = input instanceof Request ? input.clone() : input;
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const body = await response.clone().text();
  if (!body.includes("JWT issued at future")) return response;

  await new Promise((resolve) => setTimeout(resolve, 250));
  // Next memoizes GET fetches with the same URL and options for the length of
  // a render, so an identical retry would be handed back the 401 above without
  // leaving the server. A signal is the documented way out of that; the
  // caller's own is kept when it has one, so an abort still aborts.
  return fetch(retry, { ...init, signal: init?.signal ?? new AbortController().signal });
}
