/**
 * The URL is the only source of truth for list state.
 *
 * Every console list encodes its search, filters, sort, page and page size as
 * query parameters. That makes a filtered view shareable and back-button-safe,
 * and it means the server component can render the correct page on first paint
 * without a client round trip.
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100, 250] as const;

export type ListParams = {
  q: string;
  page: number;
  per: number;
  sort: string | null;
  dir: "asc" | "desc";
  /** Every non-reserved parameter, split on commas into a value list. */
  filters: Record<string, string[]>;
  /** Zero-based range for a Supabase `.range()` call. */
  from: number;
  to: number;
};

const RESERVED = new Set(["q", "page", "per", "sort", "dir"]);

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function parseListParams(
  searchParams: SearchParamsInput,
  { defaultPer = 25, defaultSort = null as string | null, defaultDir = "desc" as "asc" | "desc" } = {},
): ListParams {
  const rawPer = Number.parseInt(first(searchParams.per), 10);
  const per = ROWS_PER_PAGE_OPTIONS.includes(rawPer as (typeof ROWS_PER_PAGE_OPTIONS)[number])
    ? rawPer
    : defaultPer;

  const rawPage = Number.parseInt(first(searchParams.page), 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const filters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (RESERVED.has(key)) continue;
    const raw = first(value).trim();
    if (!raw) continue;
    filters[key] = raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const dirRaw = first(searchParams.dir);

  return {
    q: first(searchParams.q).trim(),
    page,
    per,
    sort: first(searchParams.sort) || defaultSort,
    dir: dirRaw === "asc" || dirRaw === "desc" ? dirRaw : defaultDir,
    filters,
    from: (page - 1) * per,
    to: page * per - 1,
  };
}

/** Single-value read for filters that are never multi-select (a date, a mode). */
export function filterValue(params: ListParams, key: string): string | null {
  return params.filters[key]?.[0] ?? null;
}

export function pageCount(total: number, per: number): number {
  return Math.max(1, Math.ceil(total / per));
}

/**
 * Narrow raw query-string values to a known set.
 *
 * Filters come off the URL, so anything can be in them. Passing an unchecked
 * string straight into a Postgres enum comparison turns a typo in a bookmark
 * into a 400 from the database; dropping unknown values instead just ignores
 * that part of the filter.
 */
export function only<const T extends readonly string[]>(
  values: string[] | undefined,
  allowed: T,
): T[number][] {
  if (!values?.length) return [];
  const permitted = new Set<string>(allowed);
  return values.filter((value): value is T[number] => permitted.has(value));
}

/**
 * Postgrest `.or()` needs a comma-joined list of `column.op.value`, and any
 * literal comma inside the value would be read as a separator. Escaping is not
 * supported there, so the safe move is to strip the characters that break the
 * grammar rather than to quote them.
 */
export function ilikeAcross(columns: string[], term: string): string {
  const safe = term.replace(/[,()]/g, " ").trim();
  return columns.map((column) => `${column}.ilike.%${safe}%`).join(",");
}
