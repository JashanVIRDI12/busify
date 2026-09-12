"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import {
  suggestAddressesAction,
  type AddressSuggestion,
} from "@/app/(dashboard)/quotes/geo-actions";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * An address input that offers real places as you type.
 *
 * Typing stays authoritative: the operator can ignore every suggestion and
 * write "back gate, loading dock 3" if that is where the coach actually goes.
 * Picking one only adds coordinates, which is what lets the itinerary measure
 * itself without geocoding the same string again on every recalculation.
 */
export function AddressField({
  value,
  placeholder = "Address",
  disabled,
  className,
  onChange,
}: {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Coordinates are null when the text was typed rather than chosen. */
  onChange: (address: string, point: { lat: number; lng: number } | null) => void;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  // Set while applying a suggestion, so the effect below does not immediately
  // fetch suggestions for the text it just wrote.
  const justPicked = useRef(false);

  // Keep in step when the trip is reloaded or another field rewrites the stop.
  // Adjusted during render rather than in an effect: React re-renders before
  // touching the DOM, so there is no flash of the stale value and no extra pass.
  const [lastExternal, setLastExternal] = useState(value);
  if (value !== lastExternal) {
    setLastExternal(value);
    setQuery(value);
  }

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    // Debounced, because the provider is rate-limited and a keystroke-per-
    // request would get the whole install blocked rather than throttled.
    let cancelled = false;
    const timer = setTimeout(async () => {
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setSuggestions([]);
        return;
      }

      setLoading(true);
      try {
        const hits = await suggestAddressesAction(trimmed);
        if (cancelled) return;
        setSuggestions(hits);
        setActive(-1);
        if (hits.length > 0) setOpen(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function pick(hit: AddressSuggestion) {
    justPicked.current = true;
    setQuery(hit.label);
    onChange(hit.label, { lat: hit.lat, lng: hit.lng });
    setOpen(false);
    setSuggestions([]);
  }

  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ash" />
      <Input
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        className="pl-9"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          // Typing invalidates the coordinates: they belonged to the old text.
          onChange(event.target.value, null);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            const hit = suggestions[active];
            if (hit) pick(hit);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {loading && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ash" />
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-cloud bg-signal-white py-1 shadow-lg"
        >
          {suggestions.map((hit, index) => (
            <li key={`${hit.lat},${hit.lng},${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(hit)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-body-sm leading-snug text-ink",
                  index === active ? "bg-mist" : "hover:bg-mist",
                )}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
