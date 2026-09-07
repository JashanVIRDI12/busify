import { z } from "zod";

import { checkboxValue, optionalText } from "./shared";

/**
 * A garage is where coaches start and end their day, which is what makes dead
 * mileage computable. Only the name is required — an operator with one depot
 * types "Main" and never opens this form again.
 */
export const garageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the garage a name")
    .max(80, "That name is too long"),
  address: optionalText,
  city: optionalText,
  province: optionalText,
  postal_code: optionalText,
  is_default: checkboxValue,
  notes: optionalText,
});

export type GarageInput = z.infer<typeof garageSchema>;
