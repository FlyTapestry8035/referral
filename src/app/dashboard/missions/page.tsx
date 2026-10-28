import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MissionList, NewMissionForm, type MissionItem } from "./missions-editor";

export default async function MissionsPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const [{ data: missions }, { count: testerCount }] = await Promise.all([
    supabase.from("missions").select("id, title, description, position").eq("program_id", ctx.program.id).order("position").order("created_at"),
    supabase.from("testers").select("id", { count: "exact", head: true }).eq("program_id", ctx.program.id).not("user_id", "is", null),
  ]);
  const ids = (missions ?? []).map((m) => m.id);
  const { data: progress } = ids.length ? await supabase.from("tester_missions").select("mission_id, status").in("mission_id", ids) : { data: [] };

  const items: MissionItem[] = (missions ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    done: (progress ?? []).filter((p) => p.mission_id === m.id && p.status === "done").length,
    doing: (progress ?? []).filter((p) => p.mission_id === m.id && p.status === "doing").length,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">Missions</h1>
          <p className="text-muted-foreground mt-1 text-sm">An ordered checklist for testers. Each tester&apos;s progress is the share of missions they have finished.</p>
        </div>
        <MissionList missions={items} canEdit={ctx.canEdit} testerCount={testerCount ?? 0} />
      </div>
      {ctx.canEdit ? (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Add a mission</CardTitle>
            <CardDescription>New missions go to the end of the list.</CardDescription>
          </CardHeader>
          <CardContent>
            <NewMissionForm programId={ctx.program.id} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
