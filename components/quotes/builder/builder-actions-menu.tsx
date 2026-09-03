"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, ExternalLink, Link2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  duplicateQuoteAction,
  sendQuoteFromBuilder,
} from "@/app/(dashboard)/quotes/builder-actions";
import { deleteQuoteAction } from "@/app/(dashboard)/quotes/actions";
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
              <DropdownMenuItem onSelect={() => void send()}>
                <Send />
                Mark as sent
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
