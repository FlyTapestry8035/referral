import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { getMyTesters, getSessionUser } from "@/lib/auth";
import { EmbedForm } from "./embed-form";

export const metadata: Metadata = { title: "Report · Referral", robots: { index: false } };

function cleanUrl(raw: string | undefined): string {
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 2000) : "";
  } catch {
    return "";
  }
}

// Opened as a popup by public/widget.js from a company's own beta app. The tester signs in to
// Referral in the popup (first time only), so reports are tied to their real account.
export default async function WidgetPage({ searchParams }: { searchParams: Promise<{ program?: string; url?: string; vw?: string }> }) {
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/widget?${new URLSearchParams(sp as Record<string, string>).toString()}`)}`);
  const testers = await getMyTesters();
  const tester = testers.find((t) => t.program_id === sp.program) ?? (sp.program ? undefined : testers[0]);

  if (!tester) {
    return (
      <AuthShell title="Not a tester here">
        <p className="text-sm">Your Referral account ({user.email}) isn&apos;t a tester in this beta program.</p>
      </AuthShell>
    );
  }
  if ((tester.terms_version_accepted ?? 0) < (tester.programs?.terms_version ?? 1)) {
    redirect(`/app?p=${tester.program_id}`);
  }

  const viewport = typeof sp.vw === "string" && /^\d{1,5}x\d{1,5}$/.test(sp.vw) ? sp.vw : "";
  return (
    <AuthShell title={`Report to ${tester.programs?.product_name || tester.programs?.name}`} description={cleanUrl(sp.url) ? `From ${cleanUrl(sp.url)}` : undefined}>
      <EmbedForm testerId={tester.id} pageUrl={cleanUrl(sp.url)} viewport={viewport} />
    </AuthShell>
  );
}
