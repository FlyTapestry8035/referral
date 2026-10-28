import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in · Referral" };

const NOTICES: Record<string, string> = {
  confirmed: "Email confirmed. Log in to start testing.",
  joined: "You've joined the program. Log in with your existing password.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; joined?: string; error?: string; confirmed?: string }> }) {
  const sp = await searchParams;
  const notice = sp.joined ? NOTICES.joined : sp.confirmed ? NOTICES.confirmed : undefined;
  return (
    <AuthShell
      title="Log in"
      description={sp.error === "link" ? "That link is invalid or has expired. Log in, or request a new link." : "Testers and company members both log in here."}
      footer={
        <>
          Have a referral code? <Link href="/join" className="text-foreground underline">Join the beta</Link>
        </>
      }
    >
      <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} notice={notice} />
    </AuthShell>
  );
}
