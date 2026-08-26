"use client";

import { useState } from "react";

import { idleFormState, type FormState } from "@/lib/forms";

type ServerAction = (prev: FormState, formData: FormData) => Promise<FormState>;

type Options = {
  onSuccess?: (state: FormState) => void;
  onError?: (state: FormState) => void;
};

/**
 * Runs a Server Action from a `<form action={…}>` and hands back its result.
 *
 * React wraps form actions in a transition, so reacting to the result here —
 * closing a dialog, firing a toast — happens in the action itself rather than
 * in an effect watching the state afterwards.
 *
 * `useFormStatus` still works inside the form, so SubmitButton needs nothing.
 */
export function useActionForm(action: ServerAction, options: Options = {}) {
  const [state, setState] = useState<FormState>(idleFormState);

  async function formAction(formData: FormData) {
    const result = await action(state, formData);
    setState(result);

    if (result.status === "success") options.onSuccess?.(result);
    else if (result.status === "error") options.onError?.(result);
  }

  return { state, formAction, reset: () => setState(idleFormState) };
}
