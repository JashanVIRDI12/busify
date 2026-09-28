"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { setTripStatusAction } from "@/app/(dashboard)/reservations/actions";
import { TripStatusBadge } from "@/components/shared/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { idleFormState } from "@/lib/forms";
import type { TripStatus } from "@/types/database";

/** In lifecycle order. Cancelled sits apart, below a rule. */
const LIFECYCLE: TripStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "DISPATCHED",
  "IN_PROGRESS",
  "COMPLETED",
];

/**
 * The status pill, pickable where it is read.
 *
 * The Dispatch card only walks a trip forward one step at a time. This is for
 * everything that path cannot do — undoing a confirm made by mistake, or
 * closing a job the office already knows is finished — without leaving the
 * top of the page. Each option is drawn as the pill it will become.
 *
 * The server refuses to put an unstaffed trip on the road, so Dispatched and
 * In progress are disabled with the reason instead of offered and then failed.
 */
export function ReservationStatusMenu({
  tripId,
  status,
  hasVehicle,
  hasDriver,
}: {
  tripId: string;
  status: TripStatus;
  hasVehicle: boolean;
  hasDriver: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const missing =
    !hasVehicle && !hasDriver
      ? "a vehicle and a driver"
      : !hasVehicle
        ? "a vehicle"
        : !hasDriver
          ? "a driver"
          : null;

  function choose(next: TripStatus) {
    if (next === status) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", tripId);
      formData.set("status", next);
      const result = await setTripStatusAction(idleFormState, formData);

      if (result.status === "error") {
        toast.error(result.message ?? "That did not work.");
        return;
      }
      toast.success("Reservation status updated.");
      router.refresh();
    });
  }

  function option(value: TripStatus) {
    const needsCrew = value === "DISPATCHED" || value === "IN_PROGRESS";

    return (
      <DropdownMenuItem
        key={value}
        disabled={needsCrew && missing !== null && value !== status}
        onSelect={() => choose(value)}
        className="justify-between"
      >
        <TripStatusBadge status={value} />
        {value === status && <Check aria-hidden="true" />}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        aria-label="Change reservation status"
        className="group inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 transition-colors outline-none hover:bg-mist focus-visible:ring-2 focus-visible:ring-teal-500/40 disabled:opacity-70 data-[state=open]:bg-mist"
      >
        <TripStatusBadge status={status} />
        {pending ? (
          <Loader2 className="size-3.5 animate-spin text-ash" aria-hidden="true" />
        ) : (
          <ChevronDown
            className="size-3.5 text-ash transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[11px] font-medium text-ash">
          Reservation status
        </DropdownMenuLabel>
        {LIFECYCLE.map(option)}
        <DropdownMenuSeparator />
        {option("CANCELLED")}
        {missing && (
          <p className="px-3 pt-1.5 pb-1 text-[11px] text-pretty text-ash">
            Assign {missing} to dispatch or start this trip.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
