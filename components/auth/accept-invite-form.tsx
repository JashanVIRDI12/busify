"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "@/app/(auth)/invite/accept/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";

export function AcceptInviteForm() {
  const [state, formAction] = useActionState(acceptInviteAction, idleFormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters. This is what you'll sign in with."
        required
        errors={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          required
        />
      </Field>

      <Field
        label="Confirm password"
        htmlFor="confirmPassword"
        required
        errors={state.fieldErrors?.confirmPassword}
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword)}
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg">
        Accept invitation
      </SubmitButton>
    </form>
  );
}
