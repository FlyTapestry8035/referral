import "server-only";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/tokens";

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Compared in constant time. */
export function isAuthorizedCron(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  return safeEqual(header, `Bearer ${env().CRON_SECRET}`);
}
