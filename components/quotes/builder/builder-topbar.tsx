"use client";

import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";

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
  if (dirty) return "Unsaved changes";
  if (!lastSavedAt) return "Last saved: never";
  const when = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(lastSavedAt));
  return `Last saved: ${when}`;
}

export function BuilderTopbar() {
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
  } = useBuilder();
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        {editingTitle ? (
          <Input
            autoFocus
            defaultValue={state.header.title}
            className="h-9 max-w-md font-display text-heading-sm font-extrabold"
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
            className="max-w-full truncate rounded font-display text-heading-sm font-extrabold text-onyx outline-none hover:text-ink disabled:cursor-default"
          >
            {state.header.title}
          </button>
        )}
      </div>

      <p
        className={cn(
          "flex items-center gap-1.5 text-[12px] font-medium",
          error
            ? "text-destructive"
            : dirty
              ? "text-amber"
              : "text-ash",
        )}
      >
        {saving ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : !dirty && lastSavedAt ? (
          <Check className="size-3.5 text-emerald" aria-hidden />
        ) : null}
        {error ?? savedLabel(saving, dirty, lastSavedAt, timezone)}
      </p>

      {canEdit && (
        <Button
          variant="outline"
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty && Boolean(lastSavedAt)}
        >
          <Save />
          Save
        </Button>
      )}

      <BuilderActionsMenu />
    </div>
  );
}
