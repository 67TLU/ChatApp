import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});

export const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  username: z.string()
    .min(3, 'Username ít nhất 3 ký tự')
    .max(32, 'Username tối đa 32 ký tự')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username chỉ chứa chữ, số và _'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  displayName: z.string().max(64).optional(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});