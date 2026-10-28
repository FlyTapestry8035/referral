import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runNudges } from "@/lib/jobs";
import { deliverPendingWebhooks } from "@/lib/webhooks";

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const nudges = await runNudges();
  const webhooks = await deliverPendingWebhooks({ limit: 200 });
  return NextResponse.json({ ok: true, nudges, webhooks });
}
