import { z } from "zod";

import { optionalEmail, optionalPhone, optionalText } from "./shared";

/**
 * A contact is a person. Only a first name is required — half of these arrive
 * from a web form as "Roya" with a phone number, and refusing to store that
 * would push the operator into a spreadsheet the console cannot see.
 */
export const contactSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "First name is too long"),
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  phone_extension: optionalText,
  job_title: optionalText,
  company_id: z
    .string()
    .trim()
    .transform((value) => (value === "" || value === "none" ? null : value))
    .nullable()
    .default(null)
    .refine(
      (value) => value === null || z.uuid().safeParse(value).success,
      "Pick a company from the list",
    ),
  industry: optionalText,
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  province: optionalText,
  postal_code: optionalText,
  notes: optionalText,
});

export type ContactInput = z.infer<typeof contactSchema>;

/**
 * A company is an account. Nothing beyond a name is required for the same
 * reason: the name is what an operator searches by, and everything else gets
 * filled in on the second call.
 */
export const companySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Company name is required")
    .max(160, "That name is too long"),
  website: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  fax: optionalPhone,
  address_line1: optionalText,
  address_line2: optionalText,
  city: optionalText,
  province: optionalText,
  postal_code: optionalText,
  industry: optionalText,
  notes: optionalText,
});

export type CompanyInput = z.infer<typeof companySchema>;
