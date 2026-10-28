import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runDigest } from "@/lib/jobs";
import { deliverPendingWebhooks } from "@/lib/webhooks";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const digest = await runDigest();
  // Piggy-back webhook retries so the Hobby plan's daily crons also cover them.
  const webhooks = await deliverPendingWebhooks({ limit: 200 });
  return NextResponse.json({ ok: true, digest, webhooks });
}
