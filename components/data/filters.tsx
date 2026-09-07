"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useListParams } from "@/lib/hooks/use-list-params";
import { DATE_PRESETS, type DatePresetKey } from "@/lib/date-filters";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** The row of controls above every table. */
export function FilterBar({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      {children}
      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Search                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Typing rewrites the URL, so the debounce is not a nicety — without it every
 * keystroke would be a server render of a 1,600-row table.
 */
export function SearchField({
  placeholder = "Search",
  paramKey = "q",
  className,
}: {
  placeholder?: string;
  paramKey?: string;
  className?: string;
}) {
  const { get, setParams } = useListParams();
  const urlValue = get(paramKey);
  const [value, setValue] = useState(urlValue);
  const dirty = useRef(false);

  // Follow the URL when it changes from anywhere but this input — a cleared
  // filter set, the back button, a saved view.
  useEffect(() => {
    if (!dirty.current) setValue(urlValue);
  }, [urlValue]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => {
      dirty.current = false;
      setParams({ [paramKey]: value.trim() || null });
    }, 320);
    return () => clearTimeout(timer);
  }, [value, paramKey, setParams]);

  return (
    <div
      className={cn(
        "relative flex h-[46px] w-full max-w-[248px] items-center rounded-md border border-cloud bg-signal-white transition-colors focus-within:border-orange-400 hover:border-fog",
        className,
      )}
    >
      <Search className="pointer-events-none absolute left-3 size-[15px] text-ash" />
      <input
        value={value}
        onChange={(event) => {
          dirty.current = true;
          setValue(event.target.value);
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full w-full bg-transparent pr-3 pl-9 text-body-sm text-ink outline-none placeholder:text-ash"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stacked select trigger, shared by every filter                             */
/* -------------------------------------------------------------------------- */

function StackTrigger({
  label,
  children,
  active,
  icon,
  width = "w-[172px]",
}: {
  label: string;
  children: ReactNode;
  active: boolean;
  icon?: ReactNode;
  width?: string;
}) {
  return (
    <PopoverTrigger
      className={cn(
        "field-stack flex-row items-center gap-2",
        width,
        active && "border-teal-400",
      )}
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="field-stack-label">{label}</span>
        <span className="field-stack-value truncate">{children}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-ash" />
    </PopoverTrigger>
  );
}

/* -------------------------------------------------------------------------- */
/* Multi-select                                                               */
/* -------------------------------------------------------------------------- */

export function MultiFilter({
  paramKey,
  label,
  options,
  emptyLabel = "All",
  width,
}: {
  paramKey: string;
  label: string;
  options: FilterOption[];
  emptyLabel?: string;
  width?: string;
}) {
  const { getList, setParams } = useListParams();
  const selected = getList(paramKey);

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    setParams({ [paramKey]: next.length ? next : null });
  }

  const firstLabel =
    options.find((option) => option.value === selected[0])?.label ?? selected[0];

  return (
    <Popover>
      <StackTrigger label={label} active={selected.length > 0} width={width}>
        {selected.length === 0 ? (
          <span className="font-normal text-ash">{emptyLabel}</span>
        ) : (
          <>
            {firstLabel}
            {selected.length > 1 && (
              <span className="ml-1 font-medium text-orange-500">
                +{selected.length - 1}
              </span>
            )}
          </>
        )}
      </StackTrigger>

      <PopoverContent className="w-64 p-1.5">
        <div className="scrollbar-slim max-h-[19rem] overflow-y-auto">
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-sm text-carbon transition-colors hover:bg-mist"
              >
                <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                {option.label}
              </button>
            );
          })}
        </div>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => setParams({ [paramKey]: null })}
            className="mt-1 w-full border-t border-bone px-2.5 pt-2 pb-1 text-left text-[12px] font-medium text-orange-600"
          >
            Clear {label.toLowerCase()}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/* Single-select                                                              */
/* -------------------------------------------------------------------------- */

export function SingleFilter({
  paramKey,
  label,
  options,
  emptyLabel = "All",
  width,
}: {
  paramKey: string;
  label: string;
  options: FilterOption[];
  emptyLabel?: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const { get, setParams } = useListParams();
  const value = get(paramKey);
  const current = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <StackTrigger label={label} active={Boolean(value)} width={width}>
        {current ? (
          current.label
        ) : (
          <span className="font-normal text-ash">{emptyLabel}</span>
        )}
      </StackTrigger>

      <PopoverContent className="w-60 p-1.5">
        <div className="scrollbar-slim max-h-[19rem] overflow-y-auto">
          <OptionRow
            label={emptyLabel}
            active={!value}
            onSelect={() => {
              setParams({ [paramKey]: null });
              setOpen(false);
            }}
          />
          {options.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              active={option.value === value}
              onSelect={() => {
                setParams({ [paramKey]: option.value });
                setOpen(false);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function OptionRow({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg px-2.5 py-2 text-left text-body-sm transition-colors hover:bg-mist",
        active ? "bg-orange-50 font-medium text-orange-700" : "text-carbon",
      )}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Date                                                                       */
/* -------------------------------------------------------------------------- */

export function DateFilter({
  paramKey,
  label,
  width = "w-[186px]",
}: {
  paramKey: string;
  label: string;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const { get, setParams } = useListParams();
  const value = get(paramKey);
  const preset = DATE_PRESETS.find((item) => item.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <StackTrigger
        label={label}
        active={Boolean(value)}
        width={width}
        icon={<CalendarDays className="size-4 shrink-0 text-ash" />}
      >
        {preset ? (
          preset.label
        ) : value ? (
          value
        ) : (
          <span className="font-normal text-ash">MM/DD/YY</span>
        )}
      </StackTrigger>

      <PopoverContent className="w-64 p-1.5">
        <OptionRow
          label="Any date"
          active={!value}
          onSelect={() => {
            setParams({ [paramKey]: null });
            setOpen(false);
          }}
        />
        {DATE_PRESETS.map((item) => (
          <OptionRow
            key={item.key}
            label={item.label}
            active={item.key === value}
            onSelect={() => {
              setParams({ [paramKey]: item.key });
              setOpen(false);
            }}
          />
        ))}

        <div className="mt-1 border-t border-bone px-2.5 pt-2.5 pb-1">
          <label className="field-stack-label mb-1 block">On a specific day</label>
          <input
            type="date"
            value={preset ? "" : value}
            onChange={(event) => {
              setParams({ [paramKey]: event.target.value || null });
              setOpen(false);
            }}
            className="h-9 w-full rounded-md border border-cloud px-2.5 text-body-sm text-ink outline-none focus-visible:border-orange-400"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export type { DatePresetKey };

/* -------------------------------------------------------------------------- */
/* Clear + column settings                                                    */
/* -------------------------------------------------------------------------- */

export function ClearFiltersButton() {
  const { activeFilterCount, clearFilters } = useListParams();
  if (activeFilterCount === 0) return null;

  return (
    <button
      type="button"
      onClick={clearFilters}
      aria-label="Clear all filters"
      title="Clear all filters"
      className="flex size-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink"
    >
      <X className="size-[18px]" />
    </button>
  );
}

/** Opens the column visibility menu for the table below. */
export function ColumnSettingsButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Table settings"
      title="Table settings"
      className="flex size-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-mist hover:text-ink"
    >
      <SlidersHorizontal className="size-[18px]" />
    </button>
  );
}
