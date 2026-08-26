import { z } from "zod";

import { optionalEmail, optionalPhone, optionalText } from "./shared";

export const customerSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(80, "First name is too long"),
  last_name: optionalText,
  email: optionalEmail,
  phone: optionalPhone,
  company: optionalText,
  notes: optionalText,
});

export type CustomerInput = z.infer<typeof customerSchema>;
