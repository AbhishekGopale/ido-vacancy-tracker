import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('4000').transform((v) => parseInt(v, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters').default('super_secret_jwt_key_change_in_production_32char_min'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  JWT_REFRESH_SECRET: z.string().min(16).default('super_secret_refresh_jwt_key_change_in_prod'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  EMAIL_PROVIDER: z.enum(['log', 'smtp']).default('log'),
  EMAIL_FROM: z.string().default('"Abhishek Gopale" <abhishek.gopale@idonneous.com>'),
  EMAIL_APPROVER: z.string().default('divya@idonneous.com'),
  EMAIL_HOST: z.string().optional().default('smtp.mailtrap.io'),
  EMAIL_PORT: z.string().optional().default('2525').transform((v) => parseInt(v, 10)),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EMAIL_SECURE: z.string().optional().default('false').transform((v) => v === 'true'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = _env.data;
