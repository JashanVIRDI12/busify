"use client";

import { toast } from "sonner";
import { CheckCircle2, PlayCircle } from "lucide-react";

import { setAssignedTripStatusAction } from "@/app/driver/actions";
import { TripStatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { TripStatus } from "@/types/database";

const NEXT: Partial<
  Record<TripStatus, { to: TripStatus; label: string; icon: typeof PlayCircle }>
> = {
  CONFIRMED: { to: "IN_PROGRESS", label: "Start trip", icon: PlayCircle },
  DISPATCHED: { to: "IN_PROGRESS", label: "Start trip", icon: PlayCircle },
  IN_PROGRESS: { to: "COMPLETED", label: "Complete trip", icon: CheckCircle2 },
};

const WAITING: Partial<Record<TripStatus, string>> = {
  SCHEDULED: "Dispatch hasn't confirmed this trip yet.",
  COMPLETED: "This trip is done.",
  CANCELLED: "This trip was cancelled.",
};

export function TripStatusControl({
  tripId,
  status,
}: {
  tripId: string;
  status: TripStatus;
}) {
  const { formAction } = useActionForm(setAssignedTripStatusAction, {
    onSuccess: (r) => toast.success(r.message ?? "Trip updated."),
    onError: (r) => toast.error(r.message ?? "That didn't work."),
  });

  const next = NEXT[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-bone bg-signal-white p-4">
      <div className="flex items-center gap-2.5">
        <span className="text-body-sm text-ash">Status</span>
        <TripStatusBadge status={status} />
      </div>

      {next ? (
        <form action={formAction}>
          <input type="hidden" name="id" value={tripId} />
          <input type="hidden" name="status" value={next.to} />
          <SubmitButton size="sm">
            <next.icon className="size-4" aria-hidden />
            {next.label}
          </SubmitButton>
        </form>
      ) : (
        <span className="text-body-sm text-ash">{WAITING[status]}</span>
      )}
    </div>
  );
}
