"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Client-side counterpart to `parseListParams`: reads the current list state
 * out of the URL and writes changes back to it.
 *
 * Changing any filter resets to page 1 — staying on page 7 of a result set that
 * just shrank to two pages is the classic way these tables show "no data found"
 * when there is plenty.
 */
export function useListParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? "",
    [searchParams],
  );

  const getList = useCallback(
    (key: string): string[] => {
      const raw = searchParams.get(key);
      if (!raw) return [];
      return raw.split(",").map((part) => part.trim()).filter(Boolean);
    },
    [searchParams],
  );

  const setParams = useCallback(
    (
      updates: Record<string, string | string[] | null>,
      { keepPage = false }: { keepPage?: boolean } = {},
    ) => {
      const next = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        const encoded = Array.isArray(value) ? value.join(",") : value;
        if (encoded === null || encoded === "") next.delete(key);
        else next.set(key, encoded);
      }

      if (!keepPage && !("page" in updates)) next.delete("page");

      const query = next.toString();
      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router, searchParams],
  );

  /** Drops filters and search but keeps page size, which is a preference. */
  const clearFilters = useCallback(() => {
    const next = new URLSearchParams();
    const per = searchParams.get("per");
    if (per) next.set("per", per);

    const query = next.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  const activeFilterCount = Array.from(searchParams.keys()).filter(
    (key) => !["page", "per", "sort", "dir"].includes(key),
  ).length;

  return {
    searchParams,
    get,
    getList,
    setParams,
    clearFilters,
    activeFilterCount,
    pending,
  };
}
