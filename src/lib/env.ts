import "server-only";
import { z } from "zod";

// Server-only environment. Importing this from a client component fails the build.
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Referral <onboarding@resend.dev>"),
  CRON_SECRET: z.string().min(16),
  TOKEN_SECRET: z.string().min(32),
  APP_URL: z.url(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  // "daily" matches the Vercel Hobby plan; set "hourly" if vercel.json runs the digest cron every hour.
  DIGEST_CRON_MODE: z.enum(["daily", "hourly"]).default("daily"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse({
    ...process.env,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || undefined,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
    DIGEST_CRON_MODE: process.env.DIGEST_CRON_MODE || undefined,
  });
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${missing}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(path = "/"): string {
  return new URL(path, env().APP_URL).toString();
}
