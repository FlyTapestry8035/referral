import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TestersView } from "@/components/dashboard/testers-view";

export default async function TestersPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const [{ data: testers }, { data: codes }, { data: earned }] = await Promise.all([
    supabase.from("testers").select("*").eq("program_id", ctx.program.id).order("helpfulness", { ascending: false }),
    supabase.from("referral_codes").select("id, code").eq("program_id", ctx.program.id),
    supabase.from("tester_rewards").select("tester_id, rewards!inner(name, badge, program_id)").eq("rewards.program_id", ctx.program.id),
  ]);

  const codeMap = Object.fromEntries((codes ?? []).map((c) => [c.id, c.code]));
  const badges: Record<string, { badge: string; name: string }[]> = {};
  for (const e of earned ?? []) {
    (badges[e.tester_id] ??= []).push({ badge: e.rewards.badge, name: e.rewards.name });
  }

  return (
    <TestersView
      programId={ctx.program.id}
      programName={ctx.program.product_name ? `${ctx.program.product_name} beta` : ctx.program.name}
      initialTesters={testers ?? []}
      codes={codeMap}
      badges={badges}
      canEdit={ctx.canEdit}
    />
  );
}
