"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Info, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { updateDefaultsAction } from "@/app/(dashboard)/settings/company-actions";
import { FormAlert, TagsField } from "@/components/data/form-fields";
import { Segmented } from "@/components/data/segmented";
import { CopyBlock } from "@/components/settings/copy-block";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { OrganizationSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

const ARRIVAL_OPTIONS = [0, 15, 30, 45, 60, 90, 120];

const VISIBILITY = [
  { value: "LINE_ITEM_TOTALS", label: "Line item totals" },
  { value: "LINE_ITEM_CALCS", label: "Line item calculations and totals" },
  { value: "TOTAL_ONLY", label: "Total charges only" },
];

/** The four bases a base fare can be built from. */
const BASES = [
  { value: "DAILY", label: "Daily" },
  { value: "HOURLY", label: "Hourly" },
  { value: "MILEAGE", label: "Mileage" },
  { value: "BASE", label: "Flat base" },
];

export function DefaultsForm({
  settings,
  garages,
  vehicleTypes,
  widgetUrl,
  canEdit,
}: {
  settings: OrganizationSettings;
  garages: { id: string; name: string }[];
  vehicleTypes: string[];
  widgetUrl: string;
  canEdit: boolean;
}) {
  const { state, formAction } = useActionForm(updateDefaultsAction, {
    onSuccess: (result) => toast.success(result.message ?? "Saved"),
  });

  const [pricingMode, setPricingMode] = useState(settings.pricing_mode);
  const [bases, setBases] = useState<string[]>(settings.pricing_bases);
  const [salesTax, setSalesTax] = useState(settings.enable_sales_tax);
  const [tracking, setTracking] = useState(settings.enable_tracking_link);
  const [editingEvents, setEditingEvents] = useState(false);
  const [widgetTypes, setWidgetTypes] = useState<string[]>(
    settings.widget_vehicle_types,
  );

  const allTypesSelected =
    vehicleTypes.length > 0 && widgetTypes.length === vehicleTypes.length;

  return (
    <form action={formAction} className="panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <FormAlert
            message={state.status === "error" ? state.message : undefined}
          />
        </div>
        {canEdit && <SaveButton />}
      </div>

      <fieldset disabled={!canEdit} className="max-w-3xl space-y-7">
        <section>
          <h3 className="mb-2.5 text-body font-semibold text-ink">Garage</h3>

          <div className="flex min-h-[46px] w-full max-w-xs flex-col justify-center rounded-md border border-cloud bg-signal-white px-3 py-1">
            <label htmlFor="default_garage_id" className="field-stack-label">
              Default garage
            </label>
            <select
              id="default_garage_id"
              name="default_garage_id"
              defaultValue={settings.default_garage_id ?? ""}
              className="w-full cursor-pointer bg-transparent text-body-sm font-medium text-ink outline-none"
            >
              <option value="">No default</option>
              {garages.map((garage) => (
                <option key={garage.id} value={garage.id}>
                  {garage.name}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[12.5px] text-slate">
            Selected automatically on every new quote.
          </p>

          <MinutesField
            name="pre_trip_arrival_minutes"
            label="Default Pre-Trip Arrival"
            defaultValue={settings.pre_trip_arrival_minutes}
            hint="How long before departure the driver should reach the yard. Changeable per trip."
          />
        </section>

        <section>
          <h3 className="mb-2.5 text-body font-semibold text-ink">Pickup</h3>
          <MinutesField
            name="spot_time_minutes"
            label="Default Spot Time"
            defaultValue={settings.spot_time_minutes}
            hint="How long before the depart time the driver should reach the pickup. Changeable per pickup."
          />
        </section>

        <section>
          <h3 className="mb-2.5 text-body font-semibold text-ink">Pricing</h3>

          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              name="pricing_mode"
              defaultValue={settings.pricing_mode}
              onChange={(value) => setPricingMode(value as typeof pricingMode)}
              options={[
                { value: "HIGHEST", label: "Highest" },
                { value: "CHOOSE", label: "Choose" },
              ]}
            />

            {pricingMode === "CHOOSE" &&
              BASES.map((basis, index) => {
                const on = bases.includes(basis.value);
                return (
                  <span key={basis.value} className="flex items-center gap-2">
                    {index > 0 && <span className="text-ash">+</span>}
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setBases(
                          on
                            ? bases.filter((item) => item !== basis.value)
                            : [...bases, basis.value],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                        on
                          ? "border-teal-400 bg-teal-50 font-medium text-teal-700"
                          : "border-cloud text-slate hover:border-fog",
                      )}
                    >
                      {basis.label}
                    </button>
                  </span>
                );
              })}
          </div>

          {bases.map((basis) => (
            <input key={basis} type="hidden" name="pricing_bases" value={basis} />
          ))}

          <p className="mt-1.5 text-[12.5px] text-slate">
            {pricingMode === "HIGHEST"
              ? "The single largest of the calculated rates wins."
              : "The selected rates are summed. Pick at least one."}
          </p>
        </section>

        <section>
          <h3 className="mb-2.5 text-body font-semibold text-ink">
            Choose What Customers Will See
          </h3>

          <div className="space-y-2">
            {VISIBILITY.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-2.5 text-body-sm text-carbon"
              >
                <input
                  type="radio"
                  name="customer_visibility"
                  value={option.value}
                  defaultChecked={settings.customer_visibility === option.value}
                  className="size-4 accent-[var(--orange-500)]"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[12.5px] text-slate">
            How much detail a customer sees on their copy of the quote. Charge
            notes are always shown.
          </p>
        </section>

        <section className="space-y-3">
          <ToggleRow
            name="enable_sales_tax"
            checked={salesTax}
            onChange={setSalesTax}
            label="Enable Sales Tax Charges"
            hint="Adds the GST/HST line to new quotes, at the rate for the place of supply."
          />
          <ToggleRow
            name="enable_tracking_link"
            checked={tracking}
            onChange={setTracking}
            label="Enable tracking link for all reservations"
            hint="Customers get a link showing where their coach is on the day."
          />
        </section>

        <section>
          <div className="mb-2.5 flex items-center gap-2">
            <h3 className="text-body font-semibold text-ink">Event Types</h3>
            {canEdit && (
              <button
                type="button"
                onClick={() => setEditingEvents((open) => !open)}
                aria-label={editingEvents ? "Done editing" : "Edit event types"}
                className="text-ash transition-colors hover:text-carbon"
              >
                {editingEvents ? (
                  <Check className="size-3.5" />
                ) : (
                  <Pencil className="size-3.5" />
                )}
              </button>
            )}
          </div>

          {editingEvents ? (
            <TagsField
              name="event_types"
              label="Event types"
              defaultValue={settings.event_types}
              placeholder="Field Trip, Casino…"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {settings.event_types.map((type) => (
                <span
                  key={type}
                  className="rounded-full border border-cloud px-3 py-1 text-[12.5px] text-carbon"
                >
                  {type}
                  <input type="hidden" name="event_types" value={type} />
                </span>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2.5 text-body font-semibold text-ink">Quote Widget</h3>
          <CopyBlock code={widgetUrl} label="Quote widget link" language="url" />

          <div className="mt-4 mb-2.5 flex items-center gap-3">
            <h4 className="text-body-sm font-semibold text-ink">
              Vehicle Types in Quote Widget
            </h4>
            <button
              type="button"
              onClick={() =>
                setWidgetTypes(allTypesSelected ? [] : [...vehicleTypes])
              }
              className="inline-flex items-center gap-1 text-[12.5px] font-medium text-teal-600 hover:text-teal-700"
            >
              <Check className="size-3.5" />
              {allTypesSelected ? "Clear All" : "Select All"}
            </button>
          </div>

          {vehicleTypes.length === 0 ? (
            <p className="text-body-sm text-slate">
              Add vehicle types first and they will be offered here.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {vehicleTypes.map((type) => {
                const on = widgetTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setWidgetTypes(
                        on
                          ? widgetTypes.filter((item) => item !== type)
                          : [...widgetTypes, type],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                      on
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-cloud bg-signal-white text-carbon hover:border-fog",
                    )}
                  >
                    {type}
                    {on ? <X className="size-3" /> : <Plus className="size-3" />}
                  </button>
                );
              })}
            </div>
          )}

          {widgetTypes.map((type) => (
            <input key={type} type="hidden" name="widget_vehicle_types" value={type} />
          ))}
        </section>
      </fieldset>
    </form>
  );
}

function MinutesField({
  name,
  label,
  defaultValue,
  hint,
}: {
  name: string;
  label: string;
  defaultValue: number;
  hint: string;
}) {
  return (
    <div className="mt-4">
      <div className="flex min-h-[46px] w-full max-w-xs flex-col justify-center rounded-md border border-cloud bg-signal-white px-3 py-1">
        <label htmlFor={name} className="field-stack-label">
          {label}
        </label>
        <select
          id={name}
          name={name}
          defaultValue={String(defaultValue)}
          className="w-full cursor-pointer bg-transparent text-body-sm font-medium text-ink outline-none"
        >
          {ARRIVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1.5 text-[12.5px] text-slate">{hint}</p>
    </div>
  );
}

function ToggleRow({
  name,
  checked,
  onChange,
  label,
  hint,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="data-[state=checked]:bg-teal-500"
      />
      <span className="text-body-sm text-carbon">{label}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label={`About ${label}`}>
            <Info className="size-3.5 text-ash" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{hint}</TooltipContent>
      </Tooltip>
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save
    </Button>
  );
}
