import { z } from "zod";

const password = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(200);

export const registerSchema = z.object({
  email: z.email(),
  password,
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const resendSchema = z.object({
  email: z.email(),
});

export const verifyQuerySchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
