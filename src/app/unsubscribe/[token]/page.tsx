import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { testerFromToken } from "@/lib/token-tester";
import { unsubscribeWithToken } from "@/lib/unsubscribe";

export const metadata: Metadata = { title: "Unsubscribe · Referral", robots: { index: false } };

// Confirm with a button (POST) rather than on page load, so link scanners in mail clients
// don't unsubscribe people by accident. One-click unsubscribe (RFC 8058) is /api/unsubscribe.
export default async function UnsubscribePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ done?: string }> }) {
  const { token } = await params;
  const { done } = await searchParams;
  const { tester } = await testerFromToken(token, "unsubscribe");

  if (!tester) {
    return (
      <AuthShell title="Link expired">
        <p className="text-sm">This unsubscribe link is no longer valid. Use the link in a more recent email.</p>
      </AuthShell>
    );
  }
  if (done || tester.unsubscribed_at) {
    return (
      <AuthShell title="You're unsubscribed">
        <p className="text-sm">You won&apos;t get check-in, reminder or thank-you emails from {tester.programs?.name ?? "this beta"} any more. You can still log in and send feedback whenever you like.</p>
      </AuthShell>
    );
  }

  async function confirm() {
    "use server";
    await unsubscribeWithToken(token);
    redirect(`/unsubscribe/${encodeURIComponent(token)}?done=1`);
  }

  return (
    <AuthShell title="Unsubscribe?" description={`Stop check-in, reminder and thank-you emails from ${tester.programs?.name ?? "this beta"}.`}>
      <form action={confirm}>
        <Button type="submit">Unsubscribe {tester.email}</Button>
      </form>
    </AuthShell>
  );
}
