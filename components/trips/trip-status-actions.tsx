"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Flag, PlayCircle, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { setTripStatusAction } from "@/app/(dashboard)/reservations/actions";
import { Button } from "@/components/ui/button";
import { idleFormState } from "@/lib/forms";
import type { TripStatus } from "@/types/database";

/**
 * The forward path through a trip's life, plus cancel.
 *
 * Only the next legitimate step is offered rather than every status — a
 * dispatcher should not be able to jump a SCHEDULED trip straight to completed.
 */
const NEXT_STEP: Partial<
  Record<TripStatus, { status: TripStatus; label: string; icon: LucideIcon }>
> = {
  SCHEDULED: { status: "CONFIRMED", label: "Confirm trip", icon: CheckCircle2 },
  CONFIRMED: { status: "DISPATCHED", label: "Dispatch", icon: Send },
  DISPATCHED: { status: "IN_PROGRESS", label: "Mark under way", icon: PlayCircle },
  IN_PROGRESS: { status: "COMPLETED", label: "Mark complete", icon: Flag },
};

export function TripStatusActions({
  tripId,
  status,
  canEdit,
  hasVehicle,
  hasDriver,
}: {
  tripId: string;
  status: TripStatus;
  canEdit: boolean;
  hasVehicle: boolean;
  hasDriver: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<TripStatus | null>(null);

  function move(next: TripStatus, successMessage: string) {
    setTarget(next);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", tripId);
      formData.set("status", next);
      const result = await setTripStatusAction(idleFormState, formData);
      setTarget(null);

      if (result.status === "error") {
        toast.error(result.message ?? "That did not work.");
      } else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  }

  if (!canEdit) {
    return (
      <p className="text-sm text-muted-foreground">
        Your role is read-only for trips.
      </p>
    );
  }

  const closed = status === "COMPLETED" || status === "CANCELLED";
  const step = NEXT_STEP[status];

  // The server refuses to put an unstaffed trip on the road. Saying so on the
  // button, and naming what is missing, beats letting the click fail.
  const missing =
    !hasVehicle && !hasDriver
      ? "a vehicle and a driver"
      : !hasVehicle
        ? "a vehicle"
        : !hasDriver
          ? "a driver"
          : null;
  const blocked =
    missing !== null &&
    (step?.status === "DISPATCHED" || step?.status === "IN_PROGRESS");

  if (closed) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {status === "COMPLETED"
            ? "This trip is complete. Its coaches are back in the available pool."
            : "This trip was cancelled. Its coaches are back in the available pool."}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          loading={pending && target === "SCHEDULED"}
          onClick={() => move("SCHEDULED", "Trip reopened.")}
        >
          Reopen as scheduled
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {step && (
        <Button
          className="w-full"
          size="lg"
          loading={pending && target === step.status}
          disabled={blocked}
          onClick={() => move(step.status, `${step.label} done.`)}
        >
          <step.icon />
          {step.label}
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full text-destructive hover:text-destructive"
        loading={pending && target === "CANCELLED"}
        onClick={() => move("CANCELLED", "Trip cancelled.")}
      >
        <Ban />
        Cancel trip
      </Button>

      {blocked && (
        <p className="pt-1 text-xs text-muted-foreground text-pretty">
          Assign {missing} to {step?.status === "DISPATCHED" ? "dispatch" : "start"}{" "}
          this trip.
        </p>
      )}
    </div>
  );
}
