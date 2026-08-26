"use client";

import { useMemo, useState, type ReactNode } from "react";

import { createQuoteAction } from "@/app/(dashboard)/quotes/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_PROVINCE, PROVINCES } from "@/lib/constants";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { defaultTaxRate, describeTaxRate, taxForOrigin } from "@/lib/tax/canada";
import { priceQuote, suggestLines, toMajor, toMinor } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import { NO_SELECTION } from "@/lib/validations/quote";
import type { Tables } from "@/types/database";

type VehicleTypeOption = Pick<
  Tables<"vehicle_types">,
  "id" | "name" | "base_rate" | "per_km_rate" | "per_hour_rate" | "default_capacity"
>;

type CustomerOption = Pick<
  Tables<"customers">,
  "id" | "first_name" | "last_name" | "company"
>;

type QuoteBuilderDialogProps = {
  vehicleTypes: VehicleTypeOption[];
  customers: CustomerOption[];
  currency: string;
  /** The organization's province, used as the opening place of supply. */
  province?: string | null;
  tripRequestId?: string | null;
  defaultCustomerId?: string | null;
  defaultVehicleCount?: number;
  trigger: ReactNode;
};

export function QuoteBuilderDialog({
  vehicleTypes,
  customers,
  currency,
  province = null,
  tripRequestId = null,
  defaultCustomerId = null,
  defaultVehicleCount = 1,
  trigger,
}: QuoteBuilderDialogProps) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useActionForm(createQuoteAction);

  // Live preview mirrors the server's engine exactly — same module, same
  // inputs. It is a preview only; the persisted totals are recomputed server
  // side so a tampered form cannot change what is charged.
  const [typeId, setTypeId] = useState(vehicleTypes[0]?.id ?? NO_SELECTION);
  const [vehicleCount, setVehicleCount] = useState(String(defaultVehicleCount));
  const [distanceKm, setDistanceKm] = useState("0");
  const [durationHours, setDurationHours] = useState("0");
  const [fuel, setFuel] = useState("0");
  const [tolls, setTolls] = useState("0");
  const [services, setServices] = useState("0");
  const [discount, setDiscount] = useState("0");

  // GST/HST follows the place of supply, which for passenger transportation is
  // where the journey *starts* - not where the operator is based. A Halifax
  // company picking up in Ottawa charges Ontario's 13%, not Nova Scotia's 14%.
  // The organization's own province is only the opening guess.
  const [taxProvince, setTaxProvince] = useState<string>(
    () => taxForOrigin(province)?.province ?? DEFAULT_PROVINCE,
  );
  const [taxRate, setTaxRate] = useState(() =>
    String(defaultTaxRate(province) || defaultTaxRate(DEFAULT_PROVINCE)),
  );
  const [depositPercent, setDepositPercent] = useState("50");

  const preview = useMemo(() => {
    const type = vehicleTypes.find((entry) => entry.id === typeId);
    const number = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const lines = type
      ? suggestLines({
          vehicleType: type,
          vehicleCount: Math.max(Math.trunc(number(vehicleCount)) || 1, 1),
          distanceKm: number(distanceKm),
          durationHours: number(durationHours),
        })
      : [];

    if (number(fuel) > 0) {
      lines.push({
        kind: "FUEL",
        description: "Fuel surcharge",
        quantity: 1,
        unitPrice: toMinor(number(fuel)),
      });
    }
    if (number(tolls) > 0) {
      lines.push({
        kind: "TOLLS",
        description: "Tolls and permits",
        quantity: 1,
        unitPrice: toMinor(number(tolls)),
      });
    }
    if (number(services) > 0) {
      lines.push({
        kind: "ADDITIONAL_SERVICE",
        description: "Additional services",
        quantity: 1,
        unitPrice: toMinor(number(services)),
      });
    }

    return priceQuote({
      lines,
      discount: toMinor(number(discount)),
      taxRatePercent: number(taxRate),
      depositPercent: Number(depositPercent) || 0,
    });
  }, [
    vehicleTypes,
    typeId,
    vehicleCount,
    distanceKm,
    durationHours,
    fuel,
    tolls,
    services,
    discount,
    taxRate,
    depositPercent,
  ]);

  // The selected province's official rate, and whether the operator has typed
  // over it. A hand-entered figure is respected - the odd charter really is
  // zero-rated - but it stops being labelled as that province's HST.
  const officialTax = taxForOrigin(taxProvince);
  const rateIsOfficial = Number(taxRate) === officialTax?.combined;
  const taxLabel = rateIsOfficial
    ? officialTax.label
    : describeTaxRate(Number(taxRate), taxProvince);
  const taxHint = rateIsOfficial
    ? officialTax.note
    : "Overridden. Check this is right before you send it.";

  function chooseTaxProvince(code: string) {
    setTaxProvince(code);
    setTaxRate(String(defaultTaxRate(code)));
  }

  const noRates =
    vehicleTypes.length === 0 ||
    vehicleTypes.every(
      (type) =>
        Number(type.base_rate) === 0 &&
        Number(type.per_km_rate) === 0 &&
        Number(type.per_hour_rate) === 0,
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Build a quote</DialogTitle>
          <DialogDescription>
            Rates come from the vehicle type. Every figure below is calculated
            here and again on the server — nothing is estimated.
          </DialogDescription>
        </DialogHeader>

        {noRates ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              None of your vehicle types have rates set, so there is nothing to
              price from. Add a base rate, per-km rate or hourly rate under Fleet
              › Vehicle types first.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-5" noValidate>
            <FormMessage state={state} />

            {tripRequestId && (
              <input type="hidden" name="trip_request_id" value={tripRequestId} />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Customer"
                htmlFor="customer_id"
                errors={state.fieldErrors?.customer_id}
              >
                <Select
                  name="customer_id"
                  defaultValue={defaultCustomerId ?? NO_SELECTION}
                >
                  <SelectTrigger id="customer_id">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>Unassigned</SelectItem>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {[customer.first_name, customer.last_name]
                          .filter(Boolean)
                          .join(" ")}
                        {customer.company ? ` · ${customer.company}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Vehicle type"
                htmlFor="vehicle_type_id"
                errors={state.fieldErrors?.vehicle_type_id}
              >
                <Select
                  name="vehicle_type_id"
                  value={typeId}
                  onValueChange={setTypeId}
                >
                  <SelectTrigger id="vehicle_type_id">
                    <SelectValue placeholder="Choose a type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>None</SelectItem>
                    {vehicleTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                        {type.default_capacity ? ` · ${type.default_capacity} seats` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Vehicles"
                htmlFor="vehicle_count"
                required
                errors={state.fieldErrors?.vehicle_count}
              >
                <Input
                  id="vehicle_count"
                  name="vehicle_count"
                  type="number"
                  min={1}
                  max={50}
                  value={vehicleCount}
                  onChange={(event) => setVehicleCount(event.target.value)}
                  required
                />
              </Field>

              <Field
                label="Distance (km)"
                htmlFor="distance_km"
                hint="Total one-way plus return."
                errors={state.fieldErrors?.distance_km}
              >
                <Input
                  id="distance_km"
                  name="distance_km"
                  type="number"
                  min={0}
                  step="0.01"
                  value={distanceKm}
                  onChange={(event) => setDistanceKm(event.target.value)}
                />
              </Field>

              <Field
                label="Driver hours"
                htmlFor="duration_hours"
                errors={state.fieldErrors?.duration_hours}
              >
                <Input
                  id="duration_hours"
                  name="duration_hours"
                  type="number"
                  min={0}
                  step="0.01"
                  value={durationHours}
                  onChange={(event) => setDurationHours(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Fuel" htmlFor="extra_fuel" errors={state.fieldErrors?.extra_fuel}>
                <Input
                  id="extra_fuel"
                  name="extra_fuel"
                  type="number"
                  min={0}
                  step="0.01"
                  value={fuel}
                  onChange={(event) => setFuel(event.target.value)}
                />
              </Field>
              <Field label="Tolls" htmlFor="extra_tolls" errors={state.fieldErrors?.extra_tolls}>
                <Input
                  id="extra_tolls"
                  name="extra_tolls"
                  type="number"
                  min={0}
                  step="0.01"
                  value={tolls}
                  onChange={(event) => setTolls(event.target.value)}
                />
              </Field>
              <Field
                label="Other services"
                htmlFor="extra_services"
                errors={state.fieldErrors?.extra_services}
              >
                <Input
                  id="extra_services"
                  name="extra_services"
                  type="number"
                  min={0}
                  step="0.01"
                  value={services}
                  onChange={(event) => setServices(event.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Services description"
              htmlFor="extra_services_label"
              errors={state.fieldErrors?.extra_services_label}
            >
              <Input
                id="extra_services_label"
                name="extra_services_label"
                placeholder="Onboard refreshments and decorations"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Discount" htmlFor="discount" errors={state.fieldErrors?.discount}>
                <Input
                  id="discount"
                  name="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                />
              </Field>
              <Field
                label="Trip starts in"
                htmlFor="tax_province"
                hint="Sets the GST/HST rate."
              >
                <Select
                  name="tax_province"
                  value={taxProvince}
                  onValueChange={chooseTaxProvince}
                >
                  <SelectTrigger id="tax_province">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((entry) => (
                      <SelectItem key={entry.code} value={entry.code}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                label={taxLabel + " %"}
                htmlFor="tax_rate_percent"
                hint={taxHint}
                errors={state.fieldErrors?.tax_rate_percent}
              >
                <Input
                  id="tax_rate_percent"
                  name="tax_rate_percent"
                  type="number"
                  min={0}
                  max={100}
                  step="0.001"
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Deposit %"
                htmlFor="deposit_percent"
                errors={state.fieldErrors?.deposit_percent}
              >
                <Input
                  id="deposit_percent"
                  name="deposit_percent"
                  type="number"
                  min={0}
                  max={100}
                  value={depositPercent}
                  onChange={(event) => setDepositPercent(event.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Valid until"
                htmlFor="valid_until"
                hint="After this date the customer can no longer accept."
                errors={state.fieldErrors?.valid_until}
              >
                <Input id="valid_until" name="valid_until" type="date" />
              </Field>
              <Field label="Notes for the customer" htmlFor="notes" errors={state.fieldErrors?.notes}>
                <Textarea id="notes" name="notes" rows={2} />
              </Field>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Preview
              </p>
              <dl className="space-y-1.5 text-sm">
                {preview.lines.map((line, index) => (
                  <div key={index} className="flex justify-between gap-4">
                    <dt className="min-w-0 truncate text-muted-foreground">
                      {line.description}
                    </dt>
                    <dd className="tabular shrink-0">
                      {formatMoney(toMajor(line.amount), currency, { precise: true })}
                    </dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t border-border pt-1.5">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular">
                    {formatMoney(toMajor(preview.subtotal), currency, { precise: true })}
                  </dd>
                </div>
                {preview.discount > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Discount</dt>
                    <dd className="tabular">
                      −{formatMoney(toMajor(preview.discount), currency, { precise: true })}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {taxLabel} {Number(taxRate) || 0}%
                  </dt>
                  <dd className="tabular">
                    {formatMoney(toMajor(preview.tax), currency, { precise: true })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular">
                    {formatMoney(toMajor(preview.total), currency, { precise: true })}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 text-muted-foreground">
                  <dt>Deposit</dt>
                  <dd className="tabular">
                    {formatMoney(toMajor(preview.deposit), currency, { precise: true })}
                  </dd>
                </div>
              </dl>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Create quote</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
