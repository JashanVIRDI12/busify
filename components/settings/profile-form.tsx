"use client";

import { toast } from "sonner";

import { updateProfileAction } from "@/app/(dashboard)/settings/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { useActionForm } from "@/lib/hooks/use-action-form";

export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const { state, formAction } = useActionForm(updateProfileAction, {
    onSuccess: (result) => toast.success(result.message ?? "Profile updated."),
  });

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.status === "error" && <FormMessage state={state} />}

      <Field
        label="Full name"
        htmlFor="full_name"
        required
        errors={state.fieldErrors?.full_name}
      >
        <Input
          id="full_name"
          name="full_name"
          defaultValue={fullName}
          autoComplete="name"
          aria-invalid={Boolean(state.fieldErrors?.full_name)}
          required
        />
      </Field>

      <Field
        label="Email"
        htmlFor="profile_email"
        hint="Changing your sign-in email is coming in a later phase."
      >
        <Input id="profile_email" value={email} disabled readOnly />
      </Field>

      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
