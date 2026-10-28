import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { deliverPendingWebhooks } from "@/lib/webhooks";

export const maxDuration = 300;

// Optional extra cron for frequent webhook retries (Pro plan). Not in vercel.json by default.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, webhooks: await deliverPendingWebhooks({ limit: 500 }) });
}
