import { QUOTE_ITEM_KIND_LABELS } from "@/lib/pricing";
import { describeTaxRate } from "@/lib/tax/canada";
import { cn, formatMoney } from "@/lib/utils";
import type { Tables } from "@/types/database";

type Line = Pick<
  Tables<"quote_items">,
  "id" | "kind" | "description" | "quantity" | "unit_price" | "amount"
>;

type Totals = {
  subtotal: number | string;
  discount: number | string;
  tax: number | string;
  tax_rate_percent?: number | string | null;
  tax_province?: string | null;
  total: number | string;
  deposit_amount: number | string;
  currency: string;
};

/**
 * The priced breakdown, shared by the operator's quote page and the customer's.
 * One component so the two can never disagree about what was charged.
 */
export function QuoteSummary({
  items,
  totals,
  gstNumber = null,
  className,
}: {
  items: Line[];
  totals: Totals;
  /** The operator GST/HST registration number, printed under the total. */
  gstNumber?: string | null;
  className?: string;
}) {
  const currency = totals.currency;
  const money = (value: number | string) =>
    formatMoney(Number(value), currency, { precise: true });

  const balance = Math.max(Number(totals.total) - Number(totals.deposit_amount), 0);

  // Name the tax rather than calling it "Tax". A Canadian customer expects to
  // see HST or GST + QST and the rate, and a business customer needs both to
  // claim the input tax credit.
  const taxRate = Number(totals.tax_rate_percent ?? 0);
  const taxName = describeTaxRate(taxRate, totals.tax_province);
  const taxHeading = taxRate > 0 ? taxName + " (" + taxRate + "%)" : taxName;

  return (
    <div className={cn("space-y-4", className)}>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-pretty">{item.description}</p>
              <p className="tabular text-xs text-muted-foreground">
                {QUOTE_ITEM_KIND_LABELS[item.kind]} · {Number(item.quantity)} ×{" "}
                {money(item.unit_price)}
              </p>
            </div>
            <p className="tabular shrink-0 text-sm font-medium">
              {money(item.amount)}
            </p>
          </li>
        ))}
      </ul>

      <dl className="space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular">{money(totals.subtotal)}</dd>
        </div>

        {Number(totals.discount) > 0 && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="tabular">−{money(totals.discount)}</dd>
          </div>
        )}

        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{taxHeading}</dt>
          <dd className="tabular">{money(totals.tax)}</dd>
        </div>

        <div className="flex justify-between gap-4 border-t border-border pt-2.5 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{money(totals.total)}</dd>
        </div>

        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Deposit due</dt>
          <dd className="tabular">{money(totals.deposit_amount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="tabular">{money(balance)}</dd>
        </div>
      </dl>

      {gstNumber && (
        <p className="text-xs text-muted-foreground">
          GST/HST registration number {gstNumber}
        </p>
      )}
    </div>
  );
}
