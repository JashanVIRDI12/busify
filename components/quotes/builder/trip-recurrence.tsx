"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  asRecurrence,
  summarizeRecurrence,
  WEEKDAY_LABELS,
  type RecurrenceRule,
} from "@/lib/quotes/recurrence";
import { cn } from "@/lib/utils";
import type { QuoteTripInput } from "@/lib/validations/quote-builder";

import { useBuilder } from "./builder-context";
import { NumericInput } from "./numeric-input";

export function TripRecurrence({ trip }: { trip: QuoteTripInput }) {
  const { setTrip, canEdit } = useBuilder();
  const rule = asRecurrence(trip.recurrence);

  const update = (patch: Partial<RecurrenceRule>) =>
    setTrip(trip.id, { recurrence: { ...rule, ...patch } });

  return (
    <div className="max-w-2xl space-y-5">
      <label className="flex items-center gap-3">
        <Switch
          checked={rule.enabled}
          disabled={!canEdit}
          onCheckedChange={(checked) => update({ enabled: checked })}
        />
        <span className="text-body-sm font-semibold text-ink">
          This trip repeats
        </span>
      </label>

      {rule.enabled && (
        <div className="space-y-4 rounded-xl border border-bone p-4">
          <div className="flex flex-wrap items-center gap-2 text-body-sm">
            <span className="text-slate">Every</span>
            <NumericInput
              className="h-9 w-16 text-center"
              value={rule.interval}
              onValueChange={(value) =>
                update({ interval: Math.max(1, Math.round(value ?? 1)) })
              }
            />
            <Select
              value={rule.frequency}
              onValueChange={(value) =>
                update({ frequency: value as RecurrenceRule["frequency"] })
              }
              disabled={!canEdit}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">day(s)</SelectItem>
                <SelectItem value="WEEKLY">week(s)</SelectItem>
                <SelectItem value="MONTHLY">month(s)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rule.frequency === "WEEKLY" && (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, index) => {
                const on = rule.weekdays.includes(index);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      update({
                        weekdays: on
                          ? rule.weekdays.filter((d) => d !== index)
                          : [...rule.weekdays, index],
                      })
                    }
                    className={cn(
                      "size-9 rounded-full text-[12px] font-semibold",
                      on
                        ? "bg-ink text-signal-white"
                        : "border border-bone text-slate hover:bg-mist",
                    )}
                  >
                    {label[0]}
                  </button>
                );
              })}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[12px] font-semibold tracking-wide text-ash uppercase">
              Ends
            </p>
            {(
              [
                ["NEVER", "Never"],
                ["AFTER", "After"],
                ["ON", "On date"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-body-sm">
                <input
                  type="radio"
                  name={`ends-${trip.id}`}
                  checked={rule.ends === value}
                  disabled={!canEdit}
                  onChange={() => update({ ends: value })}
                />
                <span className="text-slate">{label}</span>
                {value === "AFTER" && rule.ends === "AFTER" && (
                  <>
                    <NumericInput
                      className="h-8 w-16 text-center"
                      value={rule.count}
                      onValueChange={(v) =>
                        update({ count: Math.max(1, Math.round(v ?? 1)) })
                      }
                    />
                    <span className="text-slate">occurrences</span>
                  </>
                )}
                {value === "ON" && rule.ends === "ON" && (
                  <Input
                    type="date"
                    className="h-8 w-40"
                    value={rule.until ?? ""}
                    onChange={(e) => update({ until: e.target.value || null })}
                  />
                )}
              </label>
            ))}
          </div>

          <p className="rounded-lg bg-mist px-3 py-2 text-[12px] text-slate">
            {summarizeRecurrence(rule)}. Each occurrence becomes its own trip when
            the quote is booked.
          </p>
        </div>
      )}
    </div>
  );
}
