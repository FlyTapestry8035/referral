import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { AddMemberForm, NewProgramForm, ProgramSettingsForm } from "./forms";
import { updateMemberAction } from "./actions";

export default async function SettingsPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const { data: members } = await supabase.from("company_members").select("user_id, role, created_at").eq("company_id", ctx.companyId).order("created_at");

  // Member emails live in auth.users; RLS has already limited `members` to this company.
  const admin = createAdminClient();
  const emails = new Map<string, string>();
  await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      emails.set(m.user_id, data.user?.email ?? "unknown");
    }),
  );
  const isOwner = ctx.role === "owner";
  const origin = env().APP_URL;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">For {ctx.program.name}.</p>
        </div>
        <ProgramSettingsForm key={ctx.program.id} program={ctx.program} canEdit={ctx.canEdit} cronMode={env().DIGEST_CRON_MODE} />
      </div>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Feedback widget</CardTitle>
            <CardDescription>Add a Report button to your own beta app. Testers sign in to Referral in a small popup the first time.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
              <code>{`<script src="${origin}/widget.js"\n  data-program="${ctx.program.id}" defer></script>`}</code>
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Programs</CardTitle>
            <CardDescription>{ctx.companyName} can run several betas. Switch between them at the top of the page.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-1 text-sm">
              {ctx.programs
                .filter((p) => p.company_id === ctx.companyId)
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>{p.name}</span>
                    {p.id === ctx.program.id ? <Badge variant="secondary">viewing</Badge> : null}
                  </li>
                ))}
            </ul>
            {ctx.canEdit ? <NewProgramForm companyId={ctx.companyId} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>Owners manage everything, admins edit programs, viewers can only look.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="divide-y text-sm">
              {(members ?? []).map((m) => (
                <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">
                    {emails.get(m.user_id)}
                    {m.user_id === ctx.user.id ? <span className="text-muted-foreground"> (you)</span> : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <Badge variant="outline">{m.role}</Badge>
                    {isOwner && m.user_id !== ctx.user.id ? (
                      <>
                        {m.role !== "admin" ? (
                          <ActionButton variant="ghost" action={updateMemberAction.bind(null, ctx.companyId, m.user_id, "admin")}>
                            Make admin
                          </ActionButton>
                        ) : null}
                        {m.role !== "viewer" ? (
                          <ActionButton variant="ghost" action={updateMemberAction.bind(null, ctx.companyId, m.user_id, "viewer")}>
                            Make viewer
                          </ActionButton>
                        ) : null}
                        <ActionButton variant="ghost" confirm="Remove this person from the company?" action={updateMemberAction.bind(null, ctx.companyId, m.user_id, "remove")}>
                          Remove
                        </ActionButton>
                      </>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {ctx.canEdit ? <AddMemberForm companyId={ctx.companyId} isOwner={isOwner} /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
