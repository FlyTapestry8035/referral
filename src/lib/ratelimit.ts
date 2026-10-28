import "server-only";
import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = { success: boolean; remaining: number; reset: number };

// In-memory fixed-window fallback for local development. Not shared between serverless
// instances, so production should set the Upstash variables.
const memory = new Map<string, { count: number; resetAt: number }>();

export function memoryLimit(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return { success: true, remaining: limit - 1, reset: now + windowMs };
  }
  entry.count++;
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count), reset: entry.resetAt };
}

const upstashLimiters = new Map<string, Ratelimit>();

function upstash(name: string, limit: number, windowSeconds: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const id = `${name}:${limit}:${windowSeconds}`;
  let limiter = upstashLimiters.get(id);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `referral:rl:${name}`,
    });
    upstashLimiters.set(id, limiter);
  }
  return limiter;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export const LIMITS = {
  join: { limit: 5, windowSeconds: 600 },
  codeLookup: { limit: 20, windowSeconds: 600 },
  login: { limit: 10, windowSeconds: 300 },
  forgot: { limit: 5, windowSeconds: 900 },
  feedbackToken: { limit: 20, windowSeconds: 600 },
} as const;

export async function rateLimit(name: keyof typeof LIMITS, key?: string): Promise<LimitResult> {
  const { limit, windowSeconds } = LIMITS[name];
  const id = key ?? (await clientIp());
  const remote = upstash(name, limit, windowSeconds);
  if (remote) {
    const r = await remote.limit(id);
    return { success: r.success, remaining: r.remaining, reset: r.reset };
  }
  return memoryLimit(`${name}:${id}`, limit, windowSeconds * 1000);
}
