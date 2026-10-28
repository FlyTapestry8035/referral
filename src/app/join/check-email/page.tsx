import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <AuthShell title="Check your email" description="One more step before you can start testing.">
      <p className="text-sm">
        We sent a confirmation link to <strong>{typeof email === "string" ? email : "your email address"}</strong>. Open it to
        confirm your address, then you&apos;ll land on your missions.
      </p>
      <p className="text-muted-foreground mt-4 text-sm">
        Nothing arrived? Check spam, or <Link className="underline" href="/login">try logging in</Link> once you have confirmed.
      </p>
    </AuthShell>
  );
}
