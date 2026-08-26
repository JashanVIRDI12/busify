"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
