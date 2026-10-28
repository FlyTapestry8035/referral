import { NextResponse } from "next/server";
import { unsubscribeWithToken } from "@/lib/unsubscribe";

// RFC 8058 one-click unsubscribe target (List-Unsubscribe-Post header). Mail providers POST here.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = await unsubscribeWithToken(token);
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}
