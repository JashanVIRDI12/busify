"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircleQuestion, Route, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  acceptTripRequestAction,
  declineTripRequestAction,
  requestInformationAction,
  setTripRequestStatusAction,
} from "@/app/(dashboard)/trip-requests/actions";
import { FormMessage } from "@/components/auth/form-message";
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
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { TripRequestStatus } from "@/types/database";

type RequestActionsProps = {
  requestId: string;
  status: TripRequestStatus;
  canAct: boolean;
  /** False when the fleet cannot seat the party — accepting is still allowed,
   *  but the operator gets told first. */
  meetsDemand: boolean;
  /** Set once the request has been accepted and its trip exists. */
  tripId?: string | null;
};

export function RequestActions({
  requestId,
  status,
  canAct,
  meetsDemand,
  tripId = null,
}: RequestActionsProps) {
  const router = useRouter();
  const [askOpen, setAskOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const accept = useActionForm(acceptTripRequestAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Request accepted.");
      router.refresh();
    },
    onError: (result) => toast.error(result.message ?? "That did not work."),
  });

  const review = useActionForm(setTripRequestStatusAction, {
    onSuccess: () => {
      toast.success("Moved to reviewing.");
      router.refresh();
    },
    onError: (result) => toast.error(result.message ?? "That did not work."),
  });

  const ask = useActionForm(requestInformationAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Customer asked.");
      setAskOpen(false);
      router.refresh();
    },
  });

  const decline = useActionForm(declineTripRequestAction, {
    onSuccess: (result) => {
      toast.success(result.message ?? "Request declined.");
      setDeclineOpen(false);
      router.refresh();
    },
  });

  if (!canAct) {
    return (
      <p className="text-sm text-muted-foreground">
        Your role is read-only for trip requests.
      </p>
    );
  }

  const settled = status === "ACCEPTED" || status === "DECLINED";

  return (
    <div className="space-y-3">
      {settled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {status === "ACCEPTED"
              ? "Accepted. From here the work lives on the trip — assign a coach and driver there."
              : "This request was declined. Reopen it to act on it again."}
          </p>
          {status === "ACCEPTED" && tripId && (
            <Button asChild className="w-full" size="lg">
              <Link href={`/reservations/${tripId}`}>
                <Route />
                Open the trip
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          {!meetsDemand && (
            <p className="text-sm text-warning">
              Your available fleet cannot seat this party on these dates. You can
              still accept and sort out capacity, but check first.
            </p>
          )}

          <form action={accept.formAction}>
            <input type="hidden" name="id" value={requestId} />
            <SubmitButton className="w-full" size="lg">
              <CheckCircle2 />
              Accept and schedule trip
            </SubmitButton>
          </form>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => setAskOpen(true)}
              className="w-full"
            >
              <MessageCircleQuestion />
              Ask customer
            </Button>
            <Button
              variant="outline"
              onClick={() => setDeclineOpen(true)}
              className="w-full text-destructive hover:text-destructive"
            >
              <XCircle />
              Decline
            </Button>
          </div>

          {status === "NEW" && (
            <form action={review.formAction}>
              <input type="hidden" name="id" value={requestId} />
              <input type="hidden" name="status" value="REVIEWING" />
              <SubmitButton variant="ghost" size="sm" className="w-full">
                Mark as reviewing
              </SubmitButton>
            </form>
          )}
        </>
      )}

      {settled && (
        <form action={review.formAction}>
          <input type="hidden" name="id" value={requestId} />
          <input type="hidden" name="status" value="REVIEWING" />
          <SubmitButton variant="outline" size="sm" className="w-full">
            Reopen for review
          </SubmitButton>
        </form>
      )}

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask the customer</DialogTitle>
            <DialogDescription>
              The question is recorded on the request and its status becomes
              &ldquo;needs info&rdquo;. Sending the email arrives in a later phase.
            </DialogDescription>
          </DialogHeader>
          <form action={ask.formAction} className="space-y-4" noValidate>
            <FormMessage state={ask.state} />
            <input type="hidden" name="id" value={requestId} />
            <Field
              label="What do you need to know?"
              htmlFor="question"
              required
              errors={ask.state.fieldErrors?.question}
            >
              <Textarea
                id="question"
                name="question"
                rows={3}
                placeholder="What is the exact pickup address, and will there be luggage?"
                required
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAskOpen(false)}>
                Cancel
              </Button>
              <SubmitButton>Record question</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this request</DialogTitle>
            <DialogDescription>
              The reason is kept on the record so the decision still makes sense
              months from now.
            </DialogDescription>
          </DialogHeader>
          <form action={decline.formAction} className="space-y-4" noValidate>
            <FormMessage state={decline.state} />
            <input type="hidden" name="id" value={requestId} />
            <Field
              label="Reason"
              htmlFor="reason"
              required
              errors={decline.state.fieldErrors?.reason}
            >
              <Textarea
                id="reason"
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
    </div>
  );
}
