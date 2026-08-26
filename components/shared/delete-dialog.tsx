"use client";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/lib/hooks/use-action-form";
import type { FormState } from "@/lib/forms";

type DeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  id: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  successMessage: string;
};

export function DeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  id,
  action,
  successMessage,
}: DeleteDialogProps) {
  const { formAction } = useActionForm(action, {
    onSuccess: () => {
      toast.success(successMessage);
      onOpenChange(false);
    },
    onError: (state) => toast.error(state.message ?? "That did not work."),
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="destructive">Delete</SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
