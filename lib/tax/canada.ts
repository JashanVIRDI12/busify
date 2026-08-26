// Type-only, deliberately: this module stays free of runtime imports so that
// `npm run test:tax` can execute it directly under Node, with no bundler alias.
import type { ProvinceCode } from "@/lib/constants";

/**
 * Canadian sales tax on charter passenger transportation.
 *
 * Two things make this worth encoding rather than leaving to a free-text
 * percentage box:
 *
 * 1. The rate depends on the province, and gets it wrong quietly. A Toronto
 *    operator who types 5 instead of 13 under-collects 8% of every fare and
 *    still owes the CRA the difference at filing time.
 *
 * 2. For passenger transportation the place-of-supply rule is not the
 *    operator's head office — it is where the journey *originates*. A Halifax
 *    company picking up in Ottawa charges Ontario HST at 13%, not Nova Scotia
 *    HST at 14%. `taxForOrigin` is named after that rule so the calling code
 *    cannot forget it.
 *
 * Domestic charter service is taxable, not zero-rated. (Zero-rating applies to
 * international passenger transport, which this table deliberately does not
 * try to model — flag it and let the operator override.)
 *
 * Rates are percentages of the pre-tax amount. Since 2013 QST is charged on
 * the same base as GST rather than compounded on top of it, so Quebec's
 * combined figure is a straight 5 + 9.975.
 *
 * Provincial retail taxes in BC, Manitoba and Saskatchewan are omitted on
 * purpose: PST and RST apply to goods and a listed set of services, and
 * passenger transportation is not among them. Those provinces charge GST only.
 */
export type SalesTax = {
  province: ProvinceCode;
  /** Federal GST, or the federal component inside an HST rate. */
  gst: number;
  /** HST provincial component, or Quebec's QST. Zero in GST-only provinces. */
  provincial: number;
  /** What the quote actually charges: one percentage, applied once. */
  combined: number;
  /** How it must be described on the invoice. */
  label: string;
  /** Shown under the tax field so the operator can sanity-check the number. */
  note: string;
};

const HST = (province: ProvinceCode, provincial: number): SalesTax => ({
  province,
  gst: 5,
  provincial,
  combined: 5 + provincial,
  label: "HST",
  note: `HST ${5 + provincial}% — a single harmonised rate, remitted to the CRA.`,
});

const GST_ONLY = (province: ProvinceCode): SalesTax => ({
  province,
  gst: 5,
  provincial: 0,
  combined: 5,
  label: "GST",
  note: "GST 5% — no provincial sales tax applies to passenger transportation here.",
});

export const SALES_TAX: Record<ProvinceCode, SalesTax> = {
  AB: GST_ONLY("AB"),
  BC: GST_ONLY("BC"),
  MB: GST_ONLY("MB"),
  NB: HST("NB", 10),
  NL: HST("NL", 10),
  // Nova Scotia dropped its provincial component from 10 to 9 on 1 April 2025.
  NS: HST("NS", 9),
  NT: GST_ONLY("NT"),
  NU: GST_ONLY("NU"),
  ON: HST("ON", 8),
  PE: HST("PE", 10),
  QC: {
    province: "QC",
    gst: 5,
    provincial: 9.975,
    combined: 14.975,
    label: "GST + QST",
    note: "GST 5% + QST 9.975%. Two separate registrations — the CRA and Revenu Québec.",
  },
  SK: GST_ONLY("SK"),
  YT: GST_ONLY("YT"),
};

/**
 * Tax for a charter, by the province the trip *starts* in.
 *
 * Returns null rather than guessing when the origin is unknown or outside
 * Canada — a wrong rate that looks confident is worse than an empty field the
 * operator has to fill in.
 */
export function taxForOrigin(province: string | null | undefined): SalesTax | null {
  if (!province) return null;
  const code = province.trim().toUpperCase();
  return Object.hasOwn(SALES_TAX, code) ? SALES_TAX[code as ProvinceCode] : null;
}

/** The combined percentage to prefill a quote with, or 0 when unknown. */
export function defaultTaxRate(province: string | null | undefined): number {
  return taxForOrigin(province)?.combined ?? 0;
}

/**
 * Match a typed rate back to a province, so the quote builder can label a
 * hand-entered 13 as "HST" instead of a bare "Tax". Ambiguous rates (5% is
 * seven provinces and three territories) resolve to the generic federal label.
 */
export function describeTaxRate(rate: number, province?: string | null): string {
  const preferred = taxForOrigin(province);
  if (preferred && preferred.combined === rate) return preferred.label;
  if (rate === 0) return "No tax";
  if (rate === 5) return "GST";
  const match = Object.values(SALES_TAX).find((entry) => entry.combined === rate);
  return match?.label ?? "Tax";
}

/**
 * CRA rule: an invoice of $30 or more must show the supplier's GST/HST
 * registration number, or the customer cannot claim an input tax credit.
 * Business customers do notice.
 */
export const GST_NUMBER_THRESHOLD_CAD = 30;

/** `123456789RT0001` — nine digits, the RT program identifier, four more. */
export const GST_NUMBER_PATTERN = /^\d{9}\s?RT\s?\d{4}$/i;

export function isValidGstNumber(value: string): boolean {
  return GST_NUMBER_PATTERN.test(value.trim());
}

export function formatGstNumber(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return GST_NUMBER_PATTERN.test(compact)
    ? `${compact.slice(0, 9)} ${compact.slice(9, 11)} ${compact.slice(11)}`
    : compact;
}
