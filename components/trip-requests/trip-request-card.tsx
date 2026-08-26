"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  acceptTripRequestAction,
  declineTripRequestAction,
  deleteTripRequestAction,
  setTripRequestStatusAction,
} from "@/app/(dashboard)/trip-requests/actions";
import { FormMessage } from "@/components/auth/form-message";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { TripRequestStatusBadge } from "@/components/shared/status-badge";
import { TripRequestDialog } from "@/components/trip-requests/trip-request-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, relativeDays } from "@/lib/datetime";
import { idleFormState } from "@/lib/forms";
import { useActionForm } from "@/lib/hooks/use-action-form";
import { formatNumber } from "@/lib/utils";
import type { Tables } from "@/types/database";

type CustomerOption = Pick<
  Tables<"customers">,
  "id" | "first_name" | "last_name" | "company"
>;

type TripRequestCardProps = {
  request: Tables<"trip_requests">;
  customers: CustomerOption[];
  timeZone: string;
  canEdit: boolean;
  canDelete: boolean;
};

export function TripRequestCard({
  request,
  customers,
  timeZone,
  canEdit,
  canDelete,
}: TripRequestCardProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const settled = request.status === "ACCEPTED" || request.status === "DECLINED";

  const decline = useActionForm(declineTripRequestAction, {
    onSuccess: () => {
      toast.success("Request declined.");
      setDeclineOpen(false);
      router.refresh();
    },
  });

  function runAccept() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", request.id);
      const result = await acceptTripRequestAction(idleFormState, formData);

      if (result.status === "error") toast.error(result.message ?? "That did not work.");
      else {
        toast.success(result.message ?? "Accepted.");
        router.refresh();
      }
    });
  }

  function runStatus(status: string, message: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", request.id);
      formData.set("status", status);
      const result = await setTripRequestStatusAction(idleFormState, formData);

      if (result.status === "error") toast.error(result.message ?? "That did not work.");
      else {
        toast.success(message);
        router.refresh();
      }
    });
  }

  const contact = request.contact_name ?? request.contact_email;

  return (
    <article className="px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link
            href={`/trip-requests/${request.id}`}
            className="tabular text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            {request.reference ?? "—"}
          </Link>

          <h3 className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold tracking-tight">
            {request.pickup_location}
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {request.destination}
          </h3>
        </div>

        <TripRequestStatusBadge status={request.status} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="tabular inline-flex items-center gap-1.5">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden />
          {formatDateTime(request.departure_at, timeZone)}
          <span className="text-muted-foreground/70">
            · {relativeDays(request.departure_at)}
          </span>
        </span>
        <span className="tabular inline-flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0" aria-hidden />
          {formatNumber(request.passenger_count)} passengers
        </span>
        {contact && <span className="truncate">{contact}</span>}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        {canEdit && !settled && (
          <>
            <Button size="sm" onClick={runAccept} disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <CheckCircle2 aria-hidden />
              )}
              Accept &amp; schedule
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeclineOpen(true)}
              disabled={pending}
              className="text-destructive hover:text-destructive"
            >
              <XCircle aria-hidden />
              Decline
            </Button>

            {request.status === "NEW" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => runStatus("REVIEWING", "Moved to reviewing.")}
                disabled={pending}
              >
                Mark as reviewing
              </Button>
            )}
          </>
        )}

        {canEdit && settled && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => runStatus("REVIEWING", "Reopened for review.")}
            disabled={pending}
          >
            <RotateCcw aria-hidden />
            Reopen
          </Button>
        )}

        <Button size="sm" variant="ghost" asChild>
          <Link href={`/trip-requests/${request.id}`}>
            <Eye aria-hidden />
            Open
          </Link>
        </Button>

        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditOpen(true)}
            disabled={pending}
          >
            <Pencil aria-hidden />
            Edit
          </Button>
        )}

        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteOpen(true)}
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 aria-hidden />
            Delete
          </Button>
        )}
      </div>

      {/* Mounted only while open — a long list would otherwise carry three
          dialogs per row. */}
      {declineOpen && (
        <Dialog open onOpenChange={setDeclineOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Decline {request.reference ?? "this request"}?
              </DialogTitle>
              <DialogDescription>
                The reason is kept on the record so the decision still makes sense
                months from now.
              </DialogDescription>
            </DialogHeader>
            <form action={decline.formAction} className="space-y-4" noValidate>
              <FormMessage state={decline.state} />
              <input type="hidden" name="id" value={request.id} />
              <Field
                label="Reason"
                htmlFor={`reason-${request.id}`}
                required
                errors={decline.state.fieldErrors?.reason}
              >
                <Textarea
                  id={`reason-${request.id}`}
                  name="reason"
                  rows={3}
                  placeholder="No coaches available on those dates."
                  required
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeclineOpen(false)}
                >
                  Cancel
                </Button>
                <SubmitButton variant="destructive">Decline request</SubmitButton>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {editOpen && (
        <TripRequestDialog
          request={request}
          customers={customers}
          timeZone={timeZone}
          open
          onOpenChange={setEditOpen}
        />
      )}

      {deleteOpen && (
        <DeleteDialog
          open
          onOpenChange={setDeleteOpen}
          id={request.id}
          action={deleteTripRequestAction}
          title={`Delete request ${request.reference ?? ""}?`}
          description="Quotes and trips already created from this request keep their history, but lose the link back. This cannot be undone."
          successMessage="Trip request deleted."
        />
      )}
    </article>
  );
}
