import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * A page left open across a deploy still calls the Server Actions of the build
 * it was loaded from. The new build has different action IDs, so every save
 * from that page answers 404 "Server Action not found" until it is reloaded —
 * Next's own guidance is to turn this into a refresh rather than a failure.
 */
export function isStaleBuildError(error: unknown): boolean {
  if (unstable_isUnrecognizedActionError(error)) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "UnrecognizedActionError" ||
    /Server Action .* was not found on the server/i.test(error.message)
  );
}

const RELOADED_AT = "busify:stale-build-reload";

/**
 * Loads the page again from the current build. Once per minute at most, so a
 * build that is genuinely missing an action shows its error instead of looping.
 * Returns false when it declined to reload.
 */
export function reloadOntoCurrentBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // Storage blocked: reload anyway, the loop guard is a nicety.
  }
  window.location.reload();
  return true;
}
