import { z } from "zod";
import { emailField, fullNameField } from "./auth";

export const updateProfileSchema = z.object({
  fullName: fullNameField.optional(),
  email: emailField.optional(),
  phone: z
    .string()
    .trim()
    .max(20, { message: "Phone must be less than 20 characters" })
    .optional()
    .or(z.literal("")),
  location: z
    .string()
    .trim()
    .max(200, { message: "Location must be less than 200 characters" })
    .optional()
    .or(z.literal("")),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Expo push token registration. */
export const registerDeviceSchema = z.object({
  expoPushToken: z.string().min(1).max(200),
  platform: z.enum(["ios", "android", "web"]),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

/**
 * Account deletion is required in-app by App Store guideline 5.1.1(v).
 * Typing the confirmation keeps it from being a one-tap accident.
 */
export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE"),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
