import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from "@/lib/constants";

/**
 * tailwind-merge has to be told about our custom font sizes.
 *
 * Out of the box it only knows Tailwind's stock scale, so `text-body-sm` and
 * friends fall through to its text-COLOUR group. That made them collide with
 * real colours: `cn("bg-ink text-signal-white", "text-body-sm")` silently
 * dropped `text-signal-white`, and every filled button rendered black text on
 * a black fill.
 *
 * Registering them as font sizes keeps size and colour in separate groups.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "meta",
            "body-sm",
            "body",
            "subheading",
            "heading-sm",
            "heading",
            "heading-lg",
            "display",
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored as numeric(12,2) in major units, so no scaling here.
 * `maximumFractionDigits: 0` keeps dashboard figures scannable; use `precise`
 * for documents where the cents matter.
 *
 * en-CA earns its place over a generic English locale: it renders CAD as
 * `$1,234.56` but USD as `US$1,234.56`. An operator quoting a Windsor to
 * Detroit charter cannot then mistake one for the other on the same screen,
 * which a bare `$` on both would invite.
 */
export function formatMoney(
  amount: number,
  currency = DEFAULT_CURRENCY,
  { locale = DEFAULT_LOCALE, precise = false }: { locale?: string; precise?: boolean } = {},
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: precise ? 2 : 0,
    maximumFractionDigits: precise ? 2 : 0,
  }).format(amount);
}

export function formatNumber(value: number, locale: string = DEFAULT_LOCALE) {
  return new Intl.NumberFormat(locale).format(value);
}

/** Canada is metric. Rates, distances and quotes are kilometres throughout. */
export function formatDistance(km: number, locale: string = DEFAULT_LOCALE) {
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km);
  return value + " km";
}

export function initialsOf(...parts: (string | null | undefined)[]) {
  const letters = parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .map((p) => p.trim()[0]!.toUpperCase());
  return letters.slice(0, 2).join("") || "?";
}
