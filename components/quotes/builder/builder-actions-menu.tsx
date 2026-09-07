"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Mail,
  Link2,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  duplicateQuoteAction,
  sendQuoteFromBuilder,
} from "@/app/(dashboard)/quotes/builder-actions";
import { deleteQuoteAction } from "@/app/(dashboard)/quotes/actions";
import { convertQuoteAction } from "@/app/(dashboard)/quotes/convert-actions";
import { emailQuoteAction } from "@/app/(dashboard)/quotes/send-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useBuilder } from "./builder-context";

export function BuilderActionsMenu() {
  const { quoteId, canEdit, save, dirty, publicUrl } = useBuilder();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function send() {
    if (dirty) await save();
    const form = new FormData();
    form.set("quote_id", quoteId);
    const result = await sendQuoteFromBuilder(form);
    if (result.status === "success") {
      toast.success(result.message ?? "Quote sent.");
      router.refresh();
    } else {
      toast.error(result.message ?? "Could not send the quote.");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            Actions
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={() => {
              navigator.clipboard.writeText(publicUrl).then(
                () => toast.success("Customer link copied."),
                () => toast.error("Could not copy the link."),
              );
            }}
          >
            <Link2 />
            Copy customer link
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink />
              Preview as customer
            </a>
          </DropdownMenuItem>

          {canEdit && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  startTransition(async () => {
                    if (dirty) await save();
                    const result = await emailQuoteAction(quoteId);

                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    toast.success(
                      result.data.delivered
                        ? `Emailed to ${result.data.to}`
                        : `Marked as sent. No mail provider is configured, so nothing was delivered to ${result.data.to}.`,
                    );
                    router.refresh();
                  })
                }
              >
                <Mail />
                Email to customer
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/quotes/${quoteId}/pdf`} target="_blank" rel="noreferrer">
                  <FileText />
                  Download PDF
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void send()}>
                <Send />
                Mark as sent
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={pending}
                onSelect={() =>
                  startTransition(async () => {
                    // Convert what is saved, not what is on screen.
                    if (dirty) await save();
                    const result = await convertQuoteAction(quoteId);

                    if (!result.ok) {
                      toast.error(result.message);
                      return;
                    }
                    if (result.data.alreadyExisted) {
                      toast.info("This quote is already on the schedule.");
                    } else {
                      toast.success(
                        `Created ${result.data.created} reservation${
                          result.data.created === 1 ? "" : "s"
                        }`,
                      );
                    }
                    router.push("/reservations");
                  })
                }
              >
                <CalendarCheck />
                Convert to reservations
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  startTransition(async () => {
                    const form = new FormData();
                    form.set("quote_id", quoteId);
                    await duplicateQuoteAction(form);
                  })
                }
                disabled={pending}
              >
                <Copy />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Delete quote
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the quote and every trip on it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  const form = new FormData();
                  form.set("id", quoteId);
                  await deleteQuoteAction({ status: "idle" }, form);
                  router.push("/quotes");
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
