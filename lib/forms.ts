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
  /**
   * Anything the form needs to render after a successful write — currently an
   * invitation link the operator may have to pass on by hand. Kept as flat
   * strings so the whole state stays serialisable across the action boundary.
   */
  data?: Record<string, string>;
};

export const idleFormState: FormState = { status: "idle" };

export function formError(message: string, fieldErrors?: FieldErrors): FormState {
  return { status: "error", message, fieldErrors };
}

export function formSuccess(
  message?: string,
  data?: Record<string, string>,
): FormState {
  return { status: "success", message, data };
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
