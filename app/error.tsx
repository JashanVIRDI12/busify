"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isStaleBuildError, reloadOntoCurrentBuild } from "@/lib/stale-build";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleBuildError(error);

  useEffect(() => {
    // Opened before the last deploy (the sign-in form, most often): reload onto
    // the current build rather than retrying an action that no longer exists.
    if (stale) reloadOntoCurrentBuild();
    else console.error(error);
  }, [error, stale]);

  if (stale) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Busify was just updated</h1>
          <p className="text-sm text-pretty text-muted-foreground">
            Reloading onto the new version — then try that again.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RotateCcw />
            Reload
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md space-y-5 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-destructive/12 text-destructive">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground text-pretty">
            The page failed to load. Try again — if it keeps happening, check that
            your Supabase environment variables are set.
          </p>
          {error.digest && (
            <p className="tabular pt-1 text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>
        <Button onClick={reset}>
          <RotateCcw />
          Try again
        </Button>
      </div>
    </div>
  );
}
