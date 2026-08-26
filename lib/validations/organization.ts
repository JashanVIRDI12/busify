import { z } from "zod";

import {
  DEFAULT_COUNTRY,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  POSTAL_CODE_PATTERN,
  PROVINCES,
  formatPostalCode,
} from "@/lib/constants";
import { GST_NUMBER_PATTERN, formatGstNumber } from "@/lib/tax/canada";
import { optionalEmail, optionalPhone, optionalText } from "./shared";

const PROVINCE_CODES = PROVINCES.map((province) => province.code);

/**
 * Province, stored in `organizations.state`.
 *
 * It is not merely an address line: it sets the GST/HST rate a quote defaults
 * to, so a free-text box that accepts "Ont." would silently cost the operator
 * the difference at filing time. Validated against the real list, normalised
 * to the two-letter code.
 */
const province = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value.toUpperCase()))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || PROVINCE_CODES.includes(value as (typeof PROVINCE_CODES)[number]),
    "Choose a province or territory",
  );

const postalCode = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : formatPostalCode(value)))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || POSTAL_CODE_PATTERN.test(value),
    "Enter a Canadian postal code, for example K1A 0B1",
  );

/**
 * GST/HST registration number, in the CRA's `123456789 RT 0001` form.
 *
 * Optional because a new operator under the $30,000 small-supplier threshold
 * is not required to register. Once entered it is printed on every quote —
 * without it a business customer cannot claim an input tax credit, and they
 * will ask.
 */
const gstNumber = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : formatGstNumber(value)))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || GST_NUMBER_PATTERN.test(value.replace(/\s+/g, "")),
    "Enter a GST/HST number in the form 123456789 RT 0001",
  );

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Company name is too short")
    .max(120, "Company name is too long"),
  phone: optionalPhone,
  email: optionalEmail,
  city: optionalText,
  state: province,
  postal_code: postalCode,
  country: z
    .string()
    .trim()
    .length(2, "Use a two-letter country code")
    .default(DEFAULT_COUNTRY),
  timezone: z.string().trim().min(1).default(DEFAULT_TIMEZONE),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Use a three-letter currency code")
    .default(DEFAULT_CURRENCY),
});

export const updateOrganizationSchema = createOrganizationSchema.extend({
  address: optionalText,
  gst_hst_number: gstNumber,
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
