"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Loader2, Lock, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import {
  createSavedViewAction,
  deleteSavedViewAction,
} from "@/app/(dashboard)/saved-views-actions";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SavedView = {
  id: string;
  name: string;
  query: string;
  is_shared: boolean;
};

/** Views the product ships with, which cannot be renamed or deleted. */
export type SystemView = { name: string; query: string; locked?: boolean };

/**
 * The chip row beside a list's title.
 *
 * A chip is active when its stored query matches the current one on the
 * parameters the view actually pins — not on strict equality. Otherwise
 * paginating to page 2 would visually deselect the view you are still inside.
 */
export function SavedViews({
  systemViews = [],
  views,
}: {
  systemViews?: SystemView[];
  views: SavedView[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [editing, setEditing] = React.useState(false);

  const matches = React.useCallback(
    (query: string) => {
      const target = new URLSearchParams(query);
      const keys = [...target.keys()];
      if (keys.length === 0) return searchParams.toString().length === 0;
      return keys.every((key) => searchParams.get(key) === target.get(key));
    },
    [searchParams],
  );

  const hasAny = systemViews.length > 0 || views.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {systemViews.map((view) => (
        <Chip
          key={view.name}
          href={view.query ? `${pathname}?${view.query}` : pathname}
          label={view.name}
          active={matches(view.query)}
          icon={view.locked ? <Lock className="size-3" /> : undefined}
        />
      ))}

      {views.map((view) => (
        <Chip
          key={view.id}
          href={view.query ? `${pathname}?${view.query}` : pathname}
          label={view.name}
          active={matches(view.query)}
          onRemove={editing ? () => void removeView(view.id) : undefined}
        />
      ))}

      {hasAny && views.length > 0 && (
        <button
          type="button"
          onClick={() => setEditing((current) => !current)}
          aria-label={editing ? "Done editing views" : "Edit saved views"}
          title={editing ? "Done editing views" : "Edit saved views"}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-colors",
            editing
              ? "bg-orange-50 text-orange-600"
              : "text-ash hover:bg-mist hover:text-carbon",
          )}
        >
          {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
        </button>
      )}
    </div>
  );

  async function removeView(id: string) {
    const result = await deleteSavedViewAction(id);
    if (result.ok) toast.success("View removed");
    else toast.error(result.message);
  }
}

function Chip({
  href,
  label,
  active,
  icon,
  onRemove,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors",
        active
          ? "border-orange-500 bg-orange-500 text-signal-white"
          : "border-orange-300 bg-signal-white text-orange-600 hover:bg-orange-50",
      )}
    >
      {icon}
      <Link href={href} className="outline-none">
        {label}
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove the ${label} view`}
          className="-mr-1 flex size-4 items-center justify-center rounded-full transition-colors hover:bg-ink/10"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/**
 * "Save View" — captures the current query string under a name. Disabled when
 * nothing is filtered, because an unfiltered view is just the list itself.
 */
export function SaveViewButton({ resource }: { resource: string }) {
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const query = searchParams.toString();
  const meaningful = [...searchParams.keys()].some(
    (key) => !["page", "per"].includes(key),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-3.5">
          Save View
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-3">
        {meaningful ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await createSavedViewAction(resource, name, query);
                if (result.ok) {
                  toast.success(`Saved "${name}"`);
                  setName("");
                  setOpen(false);
                } else {
                  toast.error(result.message);
                }
              });
            }}
          >
            <label
              htmlFor="saved-view-name"
              className="mb-1.5 block text-[12px] font-medium text-carbon"
            >
              Name this view
            </label>
            <input
              id="saved-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Unpaid, next 3 days"
              maxLength={60}
              className="h-10 w-full rounded-md border border-cloud px-3 text-body-sm text-ink outline-none focus-visible:border-orange-400"
            />
            <p className="mt-2 text-[11.5px] leading-snug text-ash">
              Stores the filters currently applied, so this chip brings them all
              back in one click.
            </p>
            <Button
              type="submit"
              size="sm"
              disabled={pending || name.trim().length === 0}
              className="mt-3 w-full"
            >
              {pending && <Loader2 className="size-3.5 animate-spin" />}
              Save view
            </Button>
          </form>
        ) : (
          <p className="text-body-sm text-slate">
            Apply a filter or a search first — then this saves it as a chip you
            can come back to.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
