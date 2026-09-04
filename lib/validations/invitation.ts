import { z } from "zod";

import { ASSIGNABLE_ROLES } from "@/lib/permissions";
import { uuid } from "./shared";

/** Radix Select cannot hold "", so "invite a brand-new driver record" travels as this. */
export const NEW_DRIVER = "__new__";

export const inviteSchema = z
  .object({
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    role: z.enum(ASSIGNABLE_ROLES),
    // For DRIVER invitations: an existing unlinked driver id, or NEW_DRIVER to
    // create one, or "" when the role is not DRIVER.
    driver_id: z
      .string()
      .trim()
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
    // Only used when driver_id === NEW_DRIVER.
    driver_first_name: z
      .string()
      .trim()
      .max(80)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
    driver_last_name: z
      .string()
      .trim()
      .max(80)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "DRIVER") return;
    if (!data.driver_id) {
      ctx.addIssue({
        code: "custom",
        path: ["driver_id"],
        message: "Pick a driver record to attach this login to.",
      });
      return;
    }
    if (data.driver_id === NEW_DRIVER) {
      if (!data.driver_first_name) {
        ctx.addIssue({
          code: "custom",
          path: ["driver_first_name"],
          message: "Give the new driver a first name.",
        });
      }
      return;
    }
    if (!uuid.safeParse(data.driver_id).success) {
      ctx.addIssue({
        code: "custom",
        path: ["driver_id"],
        message: "That driver record could not be found.",
      });
    }
  });

export type InviteInput = z.infer<typeof inviteSchema>;
