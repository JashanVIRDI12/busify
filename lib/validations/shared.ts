import { z } from "zod";

/**
 * HTML forms submit "" for an untouched field. Everywhere the database stores
 * null for "not provided", normalise on the way in so we never persist empty
 * strings that then have to be special-cased on the way out.
 */
export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const optionalEmail = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.email().safeParse(value).success,
    "Enter a valid email address",
  );

export const optionalPhone = z
  .string()
  .trim()
  .max(32, "Phone number is too long")
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || !Number.isNaN(Date.parse(value)),
    "Enter a valid date",
  );

export const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : Number(value)))
    .nullable()
    .default(null)
    .refine(
      (value) =>
        value === null ||
        (Number.isInteger(value) && value >= min && value <= max),
      `${label} must be a whole number between ${min} and ${max}`,
    );

export const uuid = z.uuid("Expected a valid id");

/**
 * A `<Select>` that may be left unset.
 *
 * Radix Select cannot hold "" as a value, so "nothing chosen" arrives either as
 * a missing field or as the `__none__` sentinel; both normalise to null.
 */
export const NONE = "__none__";

export const optionalUuid = z
  .string()
  .trim()
  .transform((value) => (value === "" || value === NONE ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || z.uuid().safeParse(value).success,
    "Choose an option from the list",
  );

/** An unchecked HTML checkbox submits nothing at all, hence the missing case. */
export const checkboxValue = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal("")])
  .optional()
  .transform((value) => value === "on" || value === "true");

export type FieldErrors = Record<string, string[]>;

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

/** Turn a ZodError into the shape our forms render. */
export function toFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}
