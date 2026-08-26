"use client";

import { useActionState } from "react";

import { signUpAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState } from "@/lib/forms";

export function SignupForm() {
  const [state, formAction] = useActionState(signUpAction, idleFormState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      <Field
        label="Full name"
        htmlFor="fullName"
        required
        errors={state.fieldErrors?.fullName}
      >
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Priya Raman"
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
          required
        />
      </Field>

      <Field
        label="Work email"
        htmlFor="email"
        required
        errors={state.fieldErrors?.email}
      >
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          aria-invalid={Boolean(state.fieldErrors?.email)}
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        hint="At least 8 characters."
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

      <SubmitButton className="w-full" size="lg">
        Create account
      </SubmitButton>
    </form>
  );
}
