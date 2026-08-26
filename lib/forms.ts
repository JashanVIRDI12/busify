import type { z } from "zod";

import { toFieldErrors, type FieldErrors } from "@/lib/validations/shared";

/**
 * Shape every Server Action returns to `useActionState`. Must stay
 * serialisable — no Error instances, no class instances.
 */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
};

export const idleFormState: FormState = { status: "idle" };

export function formError(message: string, fieldErrors?: FieldErrors): FormState {
  return { status: "error", message, fieldErrors };
}

export function formSuccess(message?: string): FormState {
  return { status: "success", message };
}

export function validationError(error: z.ZodError): FormState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors: toFieldErrors(error),
  };
}

/** FormData → plain object, so Zod does the coercion rather than each action. */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") result[key] = value;
  }
  return result;
}
