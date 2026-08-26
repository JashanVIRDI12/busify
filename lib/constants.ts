/**
 * Locale data for the product.
 *
 * Busify is built for Canadian charter and motorcoach operators, so Canada is
 * the default everywhere and its options are listed first. The other entries
 * exist because cross-border work is normal — a Toronto operator running to
 * Buffalo still invoices in CAD, but may want USD on the odd charter.
 */

export const DEFAULT_COUNTRY = "CA";
export const DEFAULT_CURRENCY = "CAD";
export const DEFAULT_TIMEZONE = "America/Toronto";
export const DEFAULT_PROVINCE = "ON";
/** Canadian English: metric, DD/MM-free `2026-08-26`-ish dates, $1,234.56. */
export const DEFAULT_LOCALE = "en-CA";

export const COUNTRIES = [
  { code: "CA", name: "Canada" },
  { code: "US", name: "United States" },
] as const;

export const CURRENCIES = [
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "USD", label: "USD — US Dollar" },
] as const;

/**
 * Provinces and territories.
 *
 * `timezone` is the one used by the province's main population centre and is
 * offered as a suggestion when the operator picks a province — Nunavut and BC
 * both straddle zones, so it is a default, never a lock.
 */
export const PROVINCES = [
  { code: "AB", name: "Alberta", timezone: "America/Edmonton" },
  { code: "BC", name: "British Columbia", timezone: "America/Vancouver" },
  { code: "MB", name: "Manitoba", timezone: "America/Winnipeg" },
  { code: "NB", name: "New Brunswick", timezone: "America/Halifax" },
  { code: "NL", name: "Newfoundland and Labrador", timezone: "America/St_Johns" },
  { code: "NS", name: "Nova Scotia", timezone: "America/Halifax" },
  { code: "NT", name: "Northwest Territories", timezone: "America/Edmonton" },
  { code: "NU", name: "Nunavut", timezone: "America/Iqaluit" },
  { code: "ON", name: "Ontario", timezone: "America/Toronto" },
  { code: "PE", name: "Prince Edward Island", timezone: "America/Halifax" },
  { code: "QC", name: "Quebec", timezone: "America/Toronto" },
  { code: "SK", name: "Saskatchewan", timezone: "America/Regina" },
  { code: "YT", name: "Yukon", timezone: "America/Whitehorse" },
] as const;

export type ProvinceCode = (typeof PROVINCES)[number]["code"];

const PROVINCE_CODES = new Set<string>(PROVINCES.map((p) => p.code));

/** Narrow a stored `organizations.state` to a province we have tax data for. */
export function asProvinceCode(value: string | null | undefined): ProvinceCode | null {
  if (!value) return null;
  const code = value.trim().toUpperCase();
  return PROVINCE_CODES.has(code) ? (code as ProvinceCode) : null;
}

export function provinceName(code: string | null | undefined): string | null {
  const found = PROVINCES.find((p) => p.code === asProvinceCode(code));
  return found?.name ?? null;
}

/**
 * Canada's six time zones, plus the two that do not observe DST.
 *
 * Saskatchewan and Yukon are listed separately because their fixed offsets are
 * a genuine dispatch hazard: a Regina departure does not shift in March, and a
 * crew booked off a Winnipeg clock will be an hour out for half the year.
 */
export const TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland — St. John's" },
  { value: "America/Halifax", label: "Atlantic — Halifax" },
  { value: "America/Toronto", label: "Eastern — Toronto, Ottawa, Montreal" },
  { value: "America/Iqaluit", label: "Eastern — Iqaluit" },
  { value: "America/Winnipeg", label: "Central — Winnipeg" },
  { value: "America/Regina", label: "Central — Regina (no DST)" },
  { value: "America/Edmonton", label: "Mountain — Edmonton, Calgary, Yellowknife" },
  { value: "America/Whitehorse", label: "Yukon — Whitehorse (no DST)" },
  { value: "America/Vancouver", label: "Pacific — Vancouver, Victoria" },
] as const;

/**
 * Commercial licence classes that let someone drive a coach, by province.
 *
 * Most of Canada follows the numbered scheme: Class 1 is any tractor-trailer,
 * Class 2 is a bus with more than 24 passengers, Class 4 covers small buses and
 * taxis. Ontario and Quebec use their own letters. `Z` (air brake) is an
 * endorsement rather than a class and is tracked separately, because almost
 * every highway coach has air brakes and driving one without it is a violation.
 */
export const DRIVER_LICENCE_CLASSES = [
  { value: "1", label: "Class 1 — semi-trailer and all lighter (most provinces)" },
  { value: "2", label: "Class 2 — bus, over 24 passengers (most provinces)" },
  { value: "4", label: "Class 4 — small bus, ambulance, taxi (most provinces)" },
  { value: "ON-B", label: "Ontario B — school purposes bus, any size" },
  { value: "ON-C", label: "Ontario C — bus, any size, non-school" },
  { value: "ON-E", label: "Ontario E — school bus, up to 24 passengers" },
  { value: "ON-F", label: "Ontario F — bus, up to 24 passengers" },
  { value: "QC-2", label: "Quebec 2 — bus, more than 24 passengers" },
  { value: "QC-4B", label: "Quebec 4B — minibus" },
] as const;

/** Canadian postal codes: A1A 1A1, with D, F, I, O, Q and U never used. */
export const POSTAL_CODE_PATTERN =
  /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ ]?\d[ABCEGHJ-NPRSTV-Z]\d$/i;

/** Normalise `k1a0b1` → `K1A 0B1` so postal codes sort and compare cleanly. */
export function formatPostalCode(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return compact.length === 6 ? `${compact.slice(0, 3)} ${compact.slice(3)}` : compact;
}
