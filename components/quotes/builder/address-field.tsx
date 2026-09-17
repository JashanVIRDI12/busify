"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AddressSuggestion = {
  label: string;
  primary?: string;
  secondary?: string;
  point: { lat: number; lng: number } | null;
  placeId?: string;
};

type SuggestResponse = {
  suggestions: AddressSuggestion[];
  provider: string | null;
  available?: boolean;
};

type ResolveResponse = {
  result: { lat: number; lng: number; label: string } | null;
};

/**
 * Predictions already fetched, shared by every itinerary row.
 *
 * Keyed by billing session as well as by text: Google ties a burst of
 * keystrokes and the selection that ends it into one charged lookup, so a
 * prediction may be reused while that session is open and must not outlive it.
 * Within a session this covers the case that would otherwise be pure waste —
 * an operator backspacing a house number and typing it again.
 */
const suggestionCache = new Map<string, AddressSuggestion[]>();

function remember(key: string, suggestions: AddressSuggestion[]) {
  suggestionCache.set(key, suggestions);
  if (suggestionCache.size <= 80) return;
  const oldest = suggestionCache.keys().next().value;
  if (oldest) suggestionCache.delete(oldest);
}

function newSessionToken(): string {
  // Available in every secure context, which includes localhost.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * An address input that offers real places as you type.
 *
 * Typing stays authoritative: the operator can ignore every suggestion and
 * write "back gate, loading dock 3" if that is where the coach actually goes.
 * Picking one only adds coordinates, which is what lets the itinerary measure
 * itself without geocoding the same string again on every recalculation.
 *
 * Those coordinates may arrive a moment after the text does. Google charges for
 * turning a prediction into a location, so it happens once, for the row that
 * was chosen — the address lands in the field immediately and the point follows.
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
  const [unavailable, setUnavailable] = useState(false);

  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  // Set while applying a suggestion, so the effect below does not immediately
  // fetch suggestions for the text it just wrote.
  const justPicked = useRef(false);
  // One token spans the keystrokes leading to a selection. Created lazily so a
  // field that is never typed into never opens a billable session.
  const sessionToken = useRef<string | null>(null);

  const session = useCallback(() => {
    sessionToken.current ??= newSessionToken();
    return sessionToken.current;
  }, []);

  // Keep in step when the trip is reloaded or another field rewrites the stop.
  // Adjusted during render rather than in an effect: React re-renders before
  // touching the DOM, so there is no flash of the stale value and no extra pass.
  const [lastExternal, setLastExternal] = useState(value);
  if (value !== lastExternal) {
    setLastExternal(value);
    setQuery(value);
    setSuggestions([]);
    setOpen(false);
    setLoading(false);
    setUnavailable(false);
  }

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    const token = session();
    const cacheKey = `${token}|${trimmed.toLocaleLowerCase()}`;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      setSuggestions(cached);
      setActive(-1);
      setOpen(cached.length > 0);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/geo/suggest?q=${encodeURIComponent(trimmed)}` +
            `&session=${encodeURIComponent(token)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Address lookup failed");

        const body = (await response.json()) as SuggestResponse;
        const hits = body.suggestions ?? [];
        setUnavailable(body.available === false);
        if (body.available !== false) remember(cacheKey, hits);
        setSuggestions(hits);
        setActive(-1);
        setOpen(hits.length > 0);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, session]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  async function pick(hit: AddressSuggestion) {
    justPicked.current = true;
    setQuery(hit.label);
    setOpen(false);
    setSuggestions([]);

    // Providers that send coordinates with the prediction are done here.
    if (hit.point || !hit.placeId) {
      onChange(hit.label, hit.point);
      sessionToken.current = null;
      return;
    }

    // The address is already in the field; only the point is still missing, so
    // the operator can carry on typing dates while this finishes.
    onChange(hit.label, null);
    const token = session();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/geo/resolve?placeId=${encodeURIComponent(hit.placeId)}` +
          `&session=${encodeURIComponent(token)}`,
      );
      const body = (await response.json()) as ResolveResponse;
      if (body.result) {
        onChange(body.result.label || hit.label, {
          lat: body.result.lat,
          lng: body.result.lng,
        });
      }
    } catch {
      // Leaving the text without a point is survivable: the itinerary geocodes
      // unplaced stops when it measures, and distance can still be typed in.
    } finally {
      setLoading(false);
      // The selection closed this billing session; the next edit opens a new one.
      sessionToken.current = null;
    }
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
        aria-busy={loading}
        autoComplete="off"
        onChange={(event) => {
          const nextQuery = event.target.value;
          setQuery(nextQuery);
          setUnavailable(false);
          if (nextQuery.trim().length < 3) {
            setSuggestions([]);
            setOpen(false);
            setLoading(false);
          }
          // Typing invalidates the coordinates: they belonged to the old text.
          onChange(nextQuery, null);
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
            if (hit) void pick(hit);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {loading && (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ash" />
      )}

      {unavailable && query.trim().length >= 3 && (
        <p className="mt-1 text-[11px] text-ash">
          Address suggestions are not configured. You can still type the full address.
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-cloud bg-signal-white py-1 shadow-lg"
        >
          {suggestions.map((hit, index) => (
            <li key={hit.placeId ?? `${hit.label}-${index}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === active}
                onMouseEnter={() => setActive(index)}
                onClick={() => void pick(hit)}
                className={cn(
                  "block w-full px-3 py-2 text-left text-body-sm leading-snug text-ink",
                  index === active ? "bg-mist" : "hover:bg-mist",
                )}
              >
                {hit.primary ? (
                  <>
                    <span className="block font-medium">{hit.primary}</span>
                    {hit.secondary && (
                      <span className="block text-[12px] text-ash">
                        {hit.secondary}
                      </span>
                    )}
                  </>
                ) : (
                  hit.label
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
