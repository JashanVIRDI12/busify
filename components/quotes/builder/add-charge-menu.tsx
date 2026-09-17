"use client";

import { ChevronDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ChargePreset } from "@/lib/quotes/builder-model";
import { formatMoney } from "@/lib/utils";
import type { QuoteChargeInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";

type CatalogueCharge = {
  id: string;
  name: string;
  rate_type: "FLAT" | "PER_QUANTITY" | "PERCENTAGE";
  rate: number;
  tax_exempt: boolean;
};

/**
 * Settings stores a charge as a rate *type*; a quote line stores a rate *kind*.
 *
 * They are not the same vocabulary. A quote line can be priced per kilometre or
 * per hour, which the catalogue has no way to express, and the catalogue's
 * PER_QUANTITY is simply a flat price multiplied by a count — which is what the
 * quantity column on the line already does.
 */
function kindOf(rateType: CatalogueCharge["rate_type"]): QuoteChargeInput["kind"] {
  return rateType === "PERCENTAGE" ? "PERCENT" : "FLAT";
}

function toPreset(charge: CatalogueCharge): ChargePreset {
  return {
    label: charge.name,
    kind: kindOf(charge.rate_type),
    rate: Number(charge.rate) || 0,
    // The catalogue asks whether a charge is exempt; a line asks whether it is
    // taxable. Same fact, opposite polarity — a straight copy inverts the tax
    // treatment of every charge dropped onto a quote.
    taxable: !charge.tax_exempt,
  };
}

function describe(charge: CatalogueCharge, currency: string): string {
  return charge.rate_type === "PERCENTAGE"
    ? `${Number(charge.rate)}%`
    : formatMoney(Number(charge.rate), currency);
}

/**
 * Adds a charge to a trip, from the operator's saved list or from nothing.
 *
 * The saved list was already being loaded for the builder and then never shown,
 * so an operator who had carefully set up a fuel surcharge in Settings still
 * had to retype its name and rate onto every quote — and got it wrong often
 * enough that the rate in Settings stopped meaning anything.
 *
 * "Manual charge" stays at the bottom for the one-off that no list will ever
 * hold: a ferry crossing, a stadium permit, a discount agreed on the phone.
 */
export function AddChargeMenu({
  tripId,
  section,
  label = "Add charge",
}: {
  tripId: string;
  section: QuoteChargeInput["section"];
  label?: string;
}) {
  const { addCharge, lookups, canEdit, currency } = useBuilder();
  const catalogue = lookups.customCharges;

  const trigger = (
    <button
      type="button"
      disabled={!canEdit}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-body-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 disabled:opacity-50"
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {label}
      {catalogue.length > 0 && (
        <ChevronDown className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );

  // With nothing saved there is no choice to offer, so the control does the
  // only thing it could have done rather than opening an empty menu.
  if (catalogue.length === 0) {
    return (
      <button
        type="button"
        disabled={!canEdit}
        onClick={() => addCharge(tripId, section)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-body-sm font-semibold text-teal-600 transition-colors hover:bg-teal-50 hover:text-teal-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-teal-500 disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {catalogue.map((charge) => (
          <DropdownMenuItem
            key={charge.id}
            onSelect={() => addCharge(tripId, section, toPreset(charge))}
            className="gap-3"
          >
            <span className="truncate">{charge.name}</span>
            <span className="tabular ml-auto shrink-0 text-[12px] text-ash">
              {describe(charge, currency)}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => addCharge(tripId, section)}>
          Manual charge…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
