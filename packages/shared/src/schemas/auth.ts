import { z } from "zod";

/**
 * Ported verbatim from the web app's validationSchemas.ts so the rules users
 * already meet keep working after the move off Supabase Auth.
 */
export const emailField = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" })
  .toLowerCase();

export const passwordField = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(72, { message: "Password must be less than 72 characters" })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

export const fullNameField = z
  .string()
  .trim()
  .min(1, { message: "Name cannot be empty" })
  .max(100, { message: "Name must be less than 100 characters" });

export const signUpSchema = z.object({
  email: emailField,
  password: passwordField,
  fullName: fullNameField,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, { message: "Password is required" }),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordField,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** Google Sign-In: the client sends the ID token, the server verifies it. */
export const googleSignInSchema = z.object({
  idToken: z.string().min(1),
});
export type GoogleSignInInput = z.infer<typeof googleSignInSchema>;

/**
 * Sign in with Apple. Apple only returns the user's name on the very first
 * authorization, so the client forwards it and the server stores it once.
 */
export const appleSignInSchema = z.object({
  identityToken: z.string().min(1),
  fullName: fullNameField.optional(),
});
export type AppleSignInInput = z.infer<typeof appleSignInSchema>;
