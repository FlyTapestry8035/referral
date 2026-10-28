import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join the beta · Referral" };

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return (
    <AuthShell
      title="Join the private beta"
      description="You need a referral code to create an account."
      footer={
        <>
          Already have an account? <Link href="/login" className="text-foreground underline">Log in</Link>
        </>
      }
    >
      <JoinForm initialCode={typeof code === "string" ? code.slice(0, 40) : ""} />
    </AuthShell>
  );
}
