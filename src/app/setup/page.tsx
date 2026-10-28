import { redirect } from "next/navigation";
import { getMemberships, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";
import { NewProgramForm } from "@/app/dashboard/settings/forms";

// A company member whose company has no program yet lands here.
export default async function SetupPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/app");
  const supabase = await createClient();
  const { count } = await supabase.from("programs").select("id", { count: "exact", head: true });
  if ((count ?? 0) > 0) redirect("/dashboard");
  const editable = memberships.find((m) => m.role !== "viewer");
  return (
    <AuthShell title="Create your first beta program" description={memberships[0].companyName}>
      {editable ? (
        <NewProgramForm companyId={editable.companyId} />
      ) : (
        <p className="text-sm">Your company has no beta programs yet. Ask an owner or admin to create one.</p>
      )}
    </AuthShell>
  );
}
