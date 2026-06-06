import { z } from 'zod';

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_MEDIAPIPE_MODEL_URL: z.string().url().default(
    'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task'
  ),
  NEXT_PUBLIC_ANALYTICS_ID: z.string().optional(),
});

// Setup runtime defaults so the application operates immediately
const rawServerEnv = {
  DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'localdevelopmentsecretfornextauth32charslong',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'http://localhost:3000',
};

const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  NEXT_PUBLIC_MEDIAPIPE_MODEL_URL: process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_URL || 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  NEXT_PUBLIC_ANALYTICS_ID: process.env.NEXT_PUBLIC_ANALYTICS_ID || '',
};

export const env = {
  ...rawServerEnv,
  ...rawClientEnv,
};

// Perform validation only on Node.js server side execution
if (typeof window === 'undefined') {
  const serverParsed = serverSchema.safeParse(process.env);
  if (!serverParsed.success && process.env.NODE_ENV === 'production') {
    console.error('❌ Server environment validation failed:', serverParsed.error.flatten().fieldErrors);
    throw new Error('Server environment validation failed');
  }

  const clientParsed = clientSchema.safeParse(process.env);
  if (!clientParsed.success && process.env.NODE_ENV === 'production') {
    console.error('❌ Client environment validation failed:', clientParsed.error.flatten().fieldErrors);
    throw new Error('Client environment validation failed');
  }
}
