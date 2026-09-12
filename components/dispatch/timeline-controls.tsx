"use client";

import { BusFront, ChevronLeft, ChevronRight, UserRound } from "lucide-react";

import { SCALES, type TimelineScale } from "@/components/dispatch/timeline";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useListParams } from "@/lib/hooks/use-list-params";
import { cn } from "@/lib/utils";

const SCALE_KEYS = Object.keys(SCALES) as TimelineScale[];

/** Date stepper, start-date picker and scale, above the timeline. */
export function TimelineControls({
  startDate,
  scale,
  onDaysToShift,
}: {
  startDate: string;
  scale: TimelineScale;
  onDaysToShift?: number;
}) {
  const { setParams } = useListParams();
  const step = onDaysToShift ?? SCALES[scale].days;

  function shift(delta: number) {
    const [year, month, day] = startDate.split("-").map(Number);
    const moved = new Date(
      Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + delta * step),
    );
    setParams({ date: moved.toISOString().slice(0, 10) });
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="flex items-center gap-1.5">
        <StepButton label="Earlier" onClick={() => shift(-1)}>
          <ChevronLeft className="size-4" />
        </StepButton>
        <StepButton label="Later" onClick={() => shift(1)}>
          <ChevronRight className="size-4" />
        </StepButton>
      </span>

      <label className="field-stack w-[152px] cursor-pointer">
        <span className="field-stack-label">Start Date</span>
        <input
          type="date"
          value={startDate}
          onChange={(event) => setParams({ date: event.target.value || null })}
          className="field-stack-value w-full cursor-pointer bg-transparent outline-none"
        />
      </label>

      <Popover>
        <PopoverTrigger className="field-stack w-[132px]">
          <span className="field-stack-label">Scale</span>
          <span className="field-stack-value">{SCALES[scale].label}</span>
        </PopoverTrigger>
        <PopoverContent className="w-40 p-1.5">
          {SCALE_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setParams({ scale: key })}
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left text-body-sm transition-colors hover:bg-mist",
                key === scale
                  ? "bg-orange-50 font-medium text-orange-700"
                  : "text-carbon",
              )}
            >
              {SCALES[key].label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full border border-cloud bg-signal-white text-carbon transition-colors hover:border-fog hover:bg-mist"
    >
      {children}
    </button>
  );
}

/** Switches the timeline's rows between coaches and drivers. */
export function ResourceToggle({ resource }: { resource: "vehicle" | "driver" }) {
  const { setParams } = useListParams();

  return (
    <div className="inline-flex rounded-full border border-cloud bg-signal-white p-0.5">
      {(
        [
          { key: "vehicle", icon: BusFront, label: "By vehicle" },
          { key: "driver", icon: UserRound, label: "By driver" },
        ] as const
      ).map((option) => (
        <button
          key={option.key}
          type="button"
          aria-label={option.label}
          aria-pressed={resource === option.key}
          onClick={() =>
            setParams({ resource: option.key === "vehicle" ? null : option.key })
          }
          className={cn(
            "flex h-7 w-11 items-center justify-center rounded-full transition-colors",
            resource === option.key
              ? "bg-teal-500 text-signal-white"
              : "text-slate hover:text-ink",
          )}
        >
          <option.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
