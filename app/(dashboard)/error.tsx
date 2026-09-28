"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Loader2, RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isStaleBuildError, reloadOntoCurrentBuild } from "@/lib/stale-build";

/**
 * Console-scoped error boundary.
 *
 * Nested inside the layout on purpose, so a failed query on one screen keeps
 * the top nav and the operator can simply go somewhere else. The root boundary
 * would replace the whole application shell, which turns a bad page into a
 * dead end.
 */
export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleBuildError(error);

  useEffect(() => {
    // A save from a page loaded before the last deploy: nothing is wrong except
    // the page's age, so load the current build instead of asking to retry an
    // action that no longer exists.
    if (stale) reloadOntoCurrentBuild();
    else console.error("Console route failed", error);
  }, [error, stale]);

  if (stale) {
    return (
      <div className="panel mx-auto mt-10 max-w-lg p-8 text-center">
        <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <Loader2 className="size-5 animate-spin" />
        </span>
        <h1 className="text-subheading font-semibold text-ink">Busify was just updated</h1>
        <p className="mx-auto mt-2 max-w-sm text-body-sm text-pretty text-slate">
          This page was opened on the previous version, so that last change did not
          go through. Reloading onto the new one — if it does not, press Reload —
          then make the change again.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => window.location.reload()}>
            <RotateCw />
            Reload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full bg-orange-50 text-orange-600">
        <TriangleAlert className="size-5" />
      </span>

      <h1 className="text-subheading font-semibold text-ink">
        This screen could not be loaded
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-body-sm text-pretty text-slate">
        The data behind it did not come back. Nothing has been changed — try
        again, and if it keeps happening the details are in the server log.
      </p>

      {error.digest && (
        <p className="mt-3 text-[11.5px] text-ash">
          Reference <code className="font-mono">{error.digest}</code>
        </p>
      )}

      <div className="mt-6 flex justify-center gap-2.5">
        <Button onClick={reset}>
          <RotateCw />
          Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/quotes">Back to Quotes</Link>
        </Button>
      </div>
    </div>
  );
}
