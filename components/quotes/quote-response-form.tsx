"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquare, XCircle } from "lucide-react";

import { respondToQuoteAction } from "@/app/quote/[token]/actions";
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

export function QuoteResponseForm({
  token,
  companyName,
  depositLabel,
}: {
  token: string;
  companyName: string;
  depositLabel: string;
}) {
  const [declineOpen, setDeclineOpen] = useState(false);
  const [outcome, setOutcome] = useState<"ACCEPTED" | "DECLINED" | null>(null);

  const accept = useActionForm(respondToQuoteAction, {
    onSuccess: () => setOutcome("ACCEPTED"),
  });

  const decline = useActionForm(respondToQuoteAction, {
    onSuccess: () => {
      setDeclineOpen(false);
      setOutcome("DECLINED");
    },
  });

  if (outcome === "ACCEPTED") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-success/12 text-success">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Quote accepted</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            {companyName} has been notified and your trip is on their schedule.
            They will be in touch about the {depositLabel} deposit.
          </p>
        </div>
      </div>
    );
  }

  if (outcome === "DECLINED") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <XCircle className="size-6" aria-hidden />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Quote declined</h2>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground text-pretty">
            Thanks for letting {companyName} know. Get in touch if anything
            changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <FormMessage state={accept.state} />

      <form action={accept.formAction}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="decision" value="ACCEPTED" />
        <SubmitButton size="lg" className="w-full">
          <CheckCircle2 />
          Accept quote
        </SubmitButton>
      </form>

      <Button
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => setDeclineOpen(true)}
      >
        <MessageSquare />
        Decline or ask a question
      </Button>

      <p className="pt-1 text-center text-xs text-muted-foreground text-pretty">
        Accepting confirms your booking with {companyName}. The {depositLabel}{" "}
        deposit is arranged separately.
      </p>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this quote</DialogTitle>
            <DialogDescription>
              Add a note if there is something {companyName} could change — dates,
              vehicle size, or price.
            </DialogDescription>
          </DialogHeader>
          <form action={decline.formAction} className="space-y-4" noValidate>
            <FormMessage state={decline.state} />
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="decision" value="DECLINED" />

            <Field
              label="Your message"
              htmlFor="message"
              hint="Optional."
              errors={decline.state.fieldErrors?.message}
            >
              <Textarea
                id="message"
                name="message"
                rows={3}
                placeholder="Could you quote for 40 passengers instead?"
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
              <SubmitButton variant="destructive">Send response</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
