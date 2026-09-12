"use client";

import * as React from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * Row selection for server-rendered tables.
 *
 * The table itself stays a Server Component — it is the thing rendering 250
 * rows of live data, and shipping that to the client to get checkboxes would be
 * a bad trade. Instead the provider is a thin client wrapper and only the
 * checkbox cells hydrate, with the page's row ids handed down from the server.
 */

type SelectionContextValue = {
  ids: string[];
  selected: Set<string>;
  toggle: (id: string) => void;
  toggleAll: () => void;
  clear: () => void;
};

const SelectionContext = React.createContext<SelectionContextValue | null>(null);

function useSelection(): SelectionContextValue {
  const context = React.useContext(SelectionContext);
  if (!context) {
    throw new Error("Selection components must be used inside <SelectionProvider>");
  }
  return context;
}

export function SelectionProvider({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  const key = ids.join(",");

  /**
   * A new page of results invalidates the selection: acting on rows that are no
   * longer visible is the fastest way to delete the wrong thing.
   *
   * Reset during render rather than in an effect. An effect would let one frame
   * paint with the stale selection still applied, which on a fast filter change
   * means checkboxes visibly tick on rows the operator never chose.
   */
  const [state, setState] = React.useState({ key, selected: new Set<string>() });

  // Setting state while rendering makes React discard this pass and re-run the
  // component immediately with the new state, before anything is committed — so
  // the stale selection below is never shown, and no extra frame is painted.
  if (state.key !== key) {
    setState({ key, selected: new Set() });
  }

  const { selected } = state;

  const value = React.useMemo<SelectionContextValue>(
    () => ({
      ids,
      selected,
      toggle: (id) =>
        setState((current) => {
          const next = new Set(current.selected);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { key: current.key, selected: next };
        }),
      toggleAll: () =>
        setState((current) => ({
          key: current.key,
          selected:
            current.selected.size === ids.length ? new Set() : new Set(ids),
        })),
      clear: () =>
        setState((current) => ({ key: current.key, selected: new Set() })),
    }),
    [ids, selected],
  );

  return (
    <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
  );
}

export function SelectAllCheckbox() {
  const { ids, selected, toggleAll } = useSelection();
  const state =
    selected.size === 0
      ? false
      : selected.size === ids.length
        ? true
        : "indeterminate";

  return (
    <Checkbox
      checked={state}
      onCheckedChange={toggleAll}
      disabled={ids.length === 0}
      aria-label="Select all rows on this page"
    />
  );
}

export function RowCheckbox({ id }: { id: string }) {
  const { selected, toggle } = useSelection();

  return (
    <Checkbox
      checked={selected.has(id)}
      onCheckedChange={() => toggle(id)}
      aria-label="Select row"
    />
  );
}

/**
 * Floating bar that appears once something is selected. Deliberately anchored
 * to the viewport rather than the table: on a 250-row page the selection is
 * usually made near the top and acted on after scrolling.
 */
export type BulkAction = {
  label: string;
  /** Resolves to a message shown on success, or nothing. */
  run: (ids: string[]) => Promise<{ ok: boolean; message?: string }>;
  icon?: React.ReactNode;
};

export function BulkActionBar({
  noun,
  onDelete,
  canDelete = true,
  actions = [],
}: {
  noun: string;
  onDelete?: (ids: string[]) => Promise<{ ok: boolean; message?: string }>;
  canDelete?: boolean;
  actions?: BulkAction[];
}) {
  const { selected, clear } = useSelection();
  const [pending, startTransition] = React.useTransition();

  if (selected.size === 0) return null;

  const count = selected.size;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3",
        "rounded-full bg-ink py-2 pr-2 pl-5 text-signal-white shadow-(--shadow-layered)",
      )}
      role="status"
    >
      <span className="text-body-sm font-medium">
        {count} {count === 1 ? noun : `${noun}s`} selected
      </span>

      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={pending}
          onClick={() => {
            const ids = [...selected];
            startTransition(async () => {
              const result = await action.run(ids);
              if (result.ok) {
                toast.success(result.message ?? "Done");
                clear();
              } else {
                toast.error(result.message ?? "That did not work.");
              }
            });
          }}
          className="flex items-center gap-1.5 rounded-full bg-signal-white/12 px-3.5 py-1.5 text-body-sm font-medium transition-colors hover:bg-signal-white/20 disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : action.icon}
          {action.label}
        </button>
      ))}

      {onDelete && canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const ids = [...selected];
            startTransition(async () => {
              const result = await onDelete(ids);
              if (result.ok) {
                toast.success(
                  `Deleted ${ids.length} ${ids.length === 1 ? noun : `${noun}s`}`,
                );
                clear();
              } else {
                toast.error(result.message ?? "That could not be deleted.");
              }
            });
          }}
          className="flex items-center gap-1.5 rounded-full bg-destructive px-3.5 py-1.5 text-body-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          Delete
        </button>
      )}

      <button
        type="button"
        onClick={clear}
        aria-label="Clear selection"
        className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-signal-white/15"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
