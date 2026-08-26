"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signInAction } from "@/app/(auth)/actions";
import { FormMessage } from "@/components/auth/form-message";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleFormState, type FormState } from "@/lib/forms";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const initialState: FormState = initialError
    ? { status: "error", message: initialError }
    : idleFormState;

  const [state, formAction] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />

      {next && <input type="hidden" name="next" value={next} />}

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
        required
        errors={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={Boolean(state.fieldErrors?.password)}
          required
        />
      </Field>

      <div className="flex justify-end -mt-1">
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton className="w-full" size="lg">
        Sign in
      </SubmitButton>
    </form>
  );
}
