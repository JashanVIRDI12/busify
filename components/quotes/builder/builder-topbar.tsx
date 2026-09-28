"use client";

import { useState, type ReactNode } from "react";
import { AlertCircle, Check, Loader2, Pencil, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { BuilderActionsMenu } from "./builder-actions-menu";
import { useBuilder } from "./builder-context";

function savedLabel(
  saving: boolean,
  dirty: boolean,
  lastSavedAt: string | null,
  timezone: string,
): string {
  if (saving) return "Saving…";
  if (dirty) return lastSavedAt ? "Unsaved changes" : "Not saved yet";
  if (!lastSavedAt) return "Not saved yet";
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(lastSavedAt));
  return `Saved ${when}`;
}

/**
 * The quote's name, where it is saved, and what to do with it.
 *
 * Saving is automatic once a quote exists, so on a saved quote the filled
 * button is the thing an operator does next — send it — and Save is only a
 * quiet way to force the write. A quote still on /quotes/new is the exception:
 * nothing exists until the first save, so that is the one filled button until
 * it has happened.
 */
export function BuilderTopbar({ leading }: { leading?: ReactNode }) {
  const {
    state,
    setHeader,
    save,
    saving,
    dirty,
    lastSavedAt,
    timezone,
    canEdit,
    error,
    quoteNumber,
  } = useBuilder();
  const [editingTitle, setEditingTitle] = useState(false);
  const neverSaved = !lastSavedAt;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 basis-full items-center gap-2 lg:flex-1 lg:basis-0">
        {leading}

        {editingTitle ? (
          <Input
            autoFocus
            aria-label="Quote name"
            defaultValue={state.header.title}
            className="h-10 max-w-md text-heading-sm font-semibold"
            onBlur={(event) => {
              const next = event.target.value.trim() || "New Quote";
              setHeader({ title: next });
              setEditingTitle(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setEditingTitle(false);
            }}
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditingTitle(true)}
            title={canEdit ? "Rename this quote" : undefined}
            className="group -mx-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors enabled:hover:bg-signal-white disabled:cursor-default"
          >
            <span className="line-clamp-2 text-heading-sm font-semibold text-balance text-ink">
              {state.header.title}
            </span>
            {canEdit && (
              <Pencil
                aria-hidden
                className="size-4 shrink-0 text-ash opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            )}
          </button>
        )}

        {quoteNumber && (
          <span className="tabular shrink-0 rounded-full border border-cloud bg-signal-white px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap text-slate">
            {quoteNumber}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-2 lg:flex-none">
        <p
          role="status"
          className={cn(
            "mr-1 flex items-center gap-1.5 text-[12.5px] whitespace-nowrap",
            error ? "text-destructive" : dirty ? "text-orange-600" : "text-slate",
          )}
        >
          {error ? (
            <AlertCircle className="size-3.5" aria-hidden />
          ) : saving ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : !dirty && lastSavedAt ? (
            <Check className="size-3.5 text-teal-500" aria-hidden />
          ) : null}
          {error ? "Not saved" : savedLabel(saving, dirty, lastSavedAt, timezone)}
        </p>

        {canEdit && (
          <Button
            variant={neverSaved ? "default" : "quiet"}
            onClick={() => void save()}
            loading={saving}
            disabled={!dirty && !neverSaved}
          >
            <Save className={neverSaved ? undefined : "text-ash"} />
            {neverSaved ? "Save quote" : "Save"}
          </Button>
        )}

        <BuilderActionsMenu saved={!neverSaved} />
      </div>
    </div>
  );
}
