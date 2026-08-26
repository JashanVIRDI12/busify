"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Pushes the query into the URL (debounced) so the list stays server-rendered
 * and shareable, rather than filtering a client-side copy of the table.
 */
export function SearchInput({
  placeholder,
  paramName = "q",
}: {
  placeholder: string;
  paramName?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const current = searchParams.get(paramName) ?? "";
  const [value, setValue] = useState(current);
  const [lastCurrent, setLastCurrent] = useState(current);

  // Reconcile during render when the URL changes from elsewhere (back button,
  // reset link) rather than in an effect, which would cost an extra pass.
  if (current !== lastCurrent) {
    setLastCurrent(current);
    setValue(current);
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounce.current) clearTimeout(debounce.current);
    },
    [],
  );

  function commit(next: string) {
    setValue(next);

    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) params.set(paramName, next);
      else params.delete(paramName);

      const query = params.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      });
    }, 300);
  }

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ash"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => commit(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {pending ? (
        <Loader2
          className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ash"
          aria-hidden
        />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => commit("")}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full p-0.5 text-ash transition-colors hover:text-ink"
            aria-label="Clear search"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )
      )}
    </div>
  );
}
