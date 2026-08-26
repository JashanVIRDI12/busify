"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusFront, Plus, Trash2, UserSquare } from "lucide-react";
import { toast } from "sonner";

import {
  assignToTripAction,
  removeAssignmentAction,
} from "@/app/(dashboard)/trips/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { idleFormState } from "@/lib/forms";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { AssignmentDetail } from "@/lib/queries/trips";
import { ASSIGNMENT_ROLES, NONE } from "@/lib/validations/trip";
import { cn, formatNumber } from "@/lib/utils";

type Option = { id: string; label: string; detail: string };

type AssignmentPanelProps = {
  tripId: string;
  assignments: AssignmentDetail[];
  seatsAssigned: number;
  passengerCount: number;
  hasDriver: boolean;
  availableVehicles: Option[];
  availableDrivers: Option[];
  canEdit: boolean;
  locked: boolean;
};

export function AssignmentPanel({
  tripId,
  assignments,
  seatsAssigned,
  passengerCount,
  hasDriver,
  availableVehicles,
  availableDrivers,
  canEdit,
  locked,
}: AssignmentPanelProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const add = useActionForm(assignToTripAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Assignment added.");
      setAddOpen(false);
      router.refresh();
    },
  });

  function remove(assignmentId: string) {
    setPendingId(assignmentId);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", assignmentId);
      const result = await removeAssignmentAction(idleFormState, formData);
      setPendingId(null);

      if (result.status === "error") {
        toast.error(result.message ?? "That did not work.");
      } else {
        toast.success("Assignment removed.");
        router.refresh();
      }
    });
  }

  const seatShortfall = Math.max(passengerCount - seatsAssigned, 0);
  const nothingLeftToAssign =
    availableVehicles.length === 0 && availableDrivers.length === 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Which coach and which driver actually run this trip.
          </CardDescription>
        </div>
        {canEdit && !locked && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus />
            Assign
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border px-4 py-3 text-sm",
            hasDriver && seatShortfall === 0
              ? "border-success/25 bg-success/8"
              : "border-warning/30 bg-warning/10",
          )}
        >
          <span className="tabular">
            <span className="font-medium">{formatNumber(seatsAssigned)}</span> of{" "}
            {formatNumber(passengerCount)} seats assigned
          </span>
          <span className={hasDriver ? "text-muted-foreground" : "font-medium"}>
            {hasDriver ? "Driver assigned" : "No driver yet"}
          </span>
          {seatShortfall > 0 && (
            <span className="tabular font-medium">
              Short {formatNumber(seatShortfall)} seats
            </span>
          )}
        </div>

        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing assigned yet. This trip cannot be dispatched until it has at
            least one vehicle and one driver.
          </p>
        ) : (
          <ul className="space-y-2">
            {assignments.map(({ assignment, vehicle, driver }) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3.5 py-3"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {vehicle ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <BusFront
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        {vehicle.name}
                        <span className="tabular text-xs font-normal text-muted-foreground">
                          {vehicle.capacity} seats
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No vehicle</span>
                    )}

                    {driver ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                        <UserSquare
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        {[driver.first_name, driver.last_name]
                          .filter(Boolean)
                          .join(" ")}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No driver</span>
                    )}

                    {assignment.role === "RELIEF" && (
                      <Badge variant="secondary">Relief</Badge>
                    )}
                  </div>

                  {assignment.notes && (
                    <p className="text-xs text-muted-foreground text-pretty">
                      {assignment.notes}
                    </p>
                  )}
                </div>

                {canEdit && !locked && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(assignment.id)}
                    loading={pendingId === assignment.id}
                    aria-label="Remove assignment"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to this trip</DialogTitle>
            <DialogDescription>
              Only resources genuinely free across these dates are listed —
              anything in maintenance, on leave, or already booked is excluded.
            </DialogDescription>
          </DialogHeader>

          {nothingLeftToAssign ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nothing is available for these dates. Free up a coach or a driver,
                or check that your fleet is not all marked inactive.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form action={add.formAction} className="space-y-5" noValidate>
              <FormMessage state={add.state} />
              <input type="hidden" name="trip_id" value={tripId} />

              <Field
                label="Vehicle"
                htmlFor="vehicle_id"
                hint={
                  availableVehicles.length === 0
                    ? "No vehicles free on these dates."
                    : undefined
                }
                errors={add.state.fieldErrors?.vehicle_id}
              >
                <Select name="vehicle_id" defaultValue={NONE}>
                  <SelectTrigger id="vehicle_id">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {availableVehicles.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} · {option.detail}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                label="Driver"
                htmlFor="driver_id"
                hint={
                  availableDrivers.length === 0
                    ? "No drivers free on these dates."
                    : undefined
                }
                errors={add.state.fieldErrors?.driver_id}
              >
                <Select name="driver_id" defaultValue={NONE}>
                  <SelectTrigger id="driver_id">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {availableDrivers.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                        {option.detail ? ` · ${option.detail}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Role" htmlFor="role" errors={add.state.fieldErrors?.role}>
                <Select name="role" defaultValue="PRIMARY">
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNMENT_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role === "PRIMARY" ? "Primary" : "Relief"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Notes" htmlFor="notes" errors={add.state.fieldErrors?.notes}>
                <Textarea
                  id="notes"
                  name="notes"
                  rows={2}
                  placeholder="Meets the group at the school gate at 05:45."
                />
              </Field>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                >
                  Cancel
                </Button>
                <SubmitButton>Add assignment</SubmitButton>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
