"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Clock, Info, Layers, Loader2, Percent, SquareCheck } from "lucide-react";
import { toast } from "sonner";

import { updateDriverPaySettingsAction } from "@/app/(dashboard)/settings/company-actions";
import { FormAlert, TagsField } from "@/components/data/form-fields";
import { Segmented, SettingRow } from "@/components/data/segmented";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { OrganizationSettings } from "@/lib/queries/settings";
import { cn } from "@/lib/utils";

/**
 * Default driver pay.
 *
 * These are starting points, not rules: every reservation can override its own
 * pay. That is why nothing here is validated against the rate card — an
 * operator setting up on Monday has neither yet.
 */
export function DriverPayForm({
  settings,
  canEdit,
}: {
  settings: OrganizationSettings;
  canEdit: boolean;
}) {
  const { state, formAction } = useActionForm(updateDriverPaySettingsAction, {
    onSuccess: (result) => toast.success(result.message ?? "Saved"),
  });

  const [longDay, setLongDay] = useState(settings.long_day_enabled);
  const [overnight, setOvernight] = useState(settings.overnight_enabled);
  const [perTripMin, setPerTripMin] = useState(settings.per_trip_minimum_enabled);
  const [perDiem, setPerDiem] = useState(settings.per_diem_enabled);
  const [editingRateTypes, setEditingRateTypes] = useState(false);

  return (
    <form action={formAction} className="panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-subheading font-semibold text-ink">
          Default Base Pay Settings
        </h2>
        {canEdit && <SaveButton />}
      </div>

      <div className="mt-3">
        <FormAlert message={state.status === "error" ? state.message : undefined} />
      </div>

      <fieldset disabled={!canEdit} className="mt-2">
        <SettingRow
          icon={<SquareCheck className="size-4 text-teal-500" />}
          title="Choose default method"
          description="The selected method is the starting point for calculating driver pay."
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-carbon">
              Calculate default driver pay based on
            </span>
            <Segmented
              name="driver_pay_method"
              defaultValue={settings.driver_pay_method}
              options={[
                { value: "HOURLY", label: "Hourly" },
                { value: "PERCENTAGE", label: "Percentage" },
              ]}
            />
          </div>
          <p className="flex items-start gap-1.5 text-[12.5px] text-slate">
            <Info className="mt-px size-3.5 shrink-0 text-ash" />
            You can still change the calculation on each reservation.
          </p>
        </SettingRow>

        <SettingRow
          icon={<Clock className="size-4 text-teal-500" />}
          title="Hourly based payments"
          description="Pay by the hour for local trips, switching to a daily rate or a set number of hours for longer days and overnights."
        >
          <Toggle
            name="long_day_enabled"
            checked={longDay}
            onChange={setLongDay}
            label="Pay set rates for long day trips"
          />

          {longDay && (
            <div className="ml-12 space-y-3 border-l border-bone pl-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-body-sm text-carbon">
                  If a trip is longer than
                </span>
                <input
                  name="long_day_hours"
                  defaultValue={settings.long_day_hours}
                  inputMode="numeric"
                  aria-label="Long day threshold in hours"
                  className="h-9 w-16 rounded-md border border-cloud px-2.5 text-center text-body-sm text-ink outline-none focus-visible:border-orange-400"
                />
                <span className="text-body-sm text-carbon">hours</span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-body-sm text-carbon">Then, switch to</span>
                <Segmented
                  name="long_day_switch_to"
                  defaultValue={settings.long_day_switch_to}
                  options={[
                    { value: "DAILY_RATE", label: "Daily rate" },
                    { value: "HOURS", label: "Hours per trip" },
                  ]}
                />
              </div>
            </div>
          )}

          <Toggle
            name="overnight_enabled"
            checked={overnight}
            onChange={setOvernight}
            label="Pay set rates for overnight trips"
          />

          {overnight && (
            <div className="ml-12 flex flex-wrap items-center gap-2.5 border-l border-bone pl-4">
              <span className="text-body-sm text-carbon">
                For trips longer than 1 day, switch to
              </span>
              <Segmented
                name="overnight_switch_to"
                defaultValue={settings.overnight_switch_to}
                options={[
                  { value: "DAILY_RATE", label: "Daily rate" },
                  { value: "HOURS", label: "Hours per day" },
                ]}
              />
            </div>
          )}
        </SettingRow>

        <SettingRow
          icon={<Percent className="size-4 text-teal-500" />}
          title="Percentage based payments"
          description="Pay drivers a percentage of trip revenue."
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body-sm text-carbon">
              The drivers receive a % of the
            </span>
            {/* Stored as a boolean because there are only ever two bases, and a
                second enum for "base fare or total" would be one more thing to
                keep in step with the pricing engine. */}
            <Segmented
              name="percentage_of_total"
              defaultValue={settings.percentage_of_total ? "on" : ""}
              options={[
                { value: "", label: "Base Fare" },
                { value: "on", label: "Total Charges" },
              ]}
            />
          </div>
        </SettingRow>

        <SettingRow
          icon={<Layers className="size-4 text-teal-500" />}
          title="Rate Types"
          description="The rate options available on Driver Pay inside a reservation."
        >
          {editingRateTypes ? (
            <TagsField
              name="pay_rate_types"
              label="Rate types"
              defaultValue={settings.pay_rate_types}
              placeholder="Mileage, Per diem…"
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {settings.pay_rate_types.map((type) => (
                  <span
                    key={type}
                    className="rounded-full border border-cloud px-3 py-1 text-[12.5px] text-carbon"
                  >
                    {type}
                  </span>
                ))}
                {settings.pay_rate_types.map((type) => (
                  <input key={type} type="hidden" name="pay_rate_types" value={type} />
                ))}
              </div>
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => setEditingRateTypes(true)}
                >
                  Edit Rate Types
                </Button>
              )}
            </>
          )}
        </SettingRow>
      </fieldset>

      <h2 className="mt-8 mb-1 text-subheading font-semibold text-ink">
        Additional Payment Options
      </h2>

      <fieldset disabled={!canEdit}>
        <SettingRow
          title="Per trip minimum"
          description="Apply a minimum payment per trip, for short trips."
        >
          <Toggle
            name="per_trip_minimum_enabled"
            checked={perTripMin}
            onChange={setPerTripMin}
            label="Enabled"
          />
          {perTripMin && (
            <div className="ml-12 flex flex-wrap items-center gap-2.5 border-l border-bone pl-4">
              <span className="text-body-sm text-carbon">Use a minimum</span>
              <Segmented
                name="per_trip_minimum_by_hours"
                defaultValue={settings.per_trip_minimum_by_hours ? "on" : ""}
                options={[
                  { value: "", label: "Per trip rate" },
                  { value: "on", label: "Hours per trip" },
                ]}
              />
            </div>
          )}
        </SettingRow>

        <SettingRow
          title="Per diem"
          description="Apply a daily driver reimbursement by default."
        >
          <Toggle
            name="per_diem_enabled"
            checked={perDiem}
            onChange={setPerDiem}
            label="Enabled"
          />
          {perDiem && (
            <div className="ml-12 flex flex-wrap items-center gap-2.5 border-l border-bone pl-4">
              <span className="text-body-sm text-carbon">
                For trips longer than or equal to
              </span>
              <input
                name="per_diem_min_days"
                defaultValue={settings.per_diem_min_days}
                inputMode="numeric"
                aria-label="Per diem minimum days"
                className="h-9 w-16 rounded-md border border-cloud px-2.5 text-center text-body-sm text-ink outline-none focus-visible:border-orange-400"
              />
              <span className="text-body-sm text-carbon">day(s)</span>
            </div>
          )}
        </SettingRow>
      </fieldset>
    </form>
  );
}

/**
 * A switch that also submits. The hidden input carries the value because a
 * Radix switch is a button, not a form control.
 */
function Toggle({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3">
      <input type="hidden" name={name} value={checked ? "on" : ""} />
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label={label}
        className="data-[state=checked]:bg-teal-500"
      />
      <span className={cn("text-body-sm", checked ? "text-ink" : "text-slate")}>
        {label}
      </span>
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      Save Changes
    </Button>
  );
}
