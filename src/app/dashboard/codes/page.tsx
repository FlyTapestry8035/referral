import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { CopyButton } from "@/components/dashboard/copy-button";
import { setCodeRevokedAction } from "@/app/dashboard/actions";
import { shortDate } from "@/lib/format";
import { CreateCodeForm, InviteForm } from "./forms";

type Status = "active" | "revoked" | "expired" | "used up";

export default async function CodesPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const { data: codes } = await supabase.from("referral_codes").select("*").eq("program_id", ctx.program.id).order("created_at", { ascending: false });
  const now = new Date();
  const status = (c: NonNullable<typeof codes>[number]): Status =>
    c.revoked_at ? "revoked" : c.expires_at && new Date(c.expires_at) <= now ? "expired" : c.max_uses !== null && c.uses >= c.max_uses ? "used up" : "active";
  const base = env().APP_URL;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Referral codes</h1>
        <p className="text-muted-foreground mt-1 text-sm">Only people with a valid code can create an account. Revoking a code stops new sign-ups; existing testers keep access.</p>
      </div>

      {ctx.canEdit ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>New code</CardTitle>
              <CardDescription>Format REF-XXXX-XXXX, generated randomly.</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateCodeForm programId={ctx.program.id} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Invite by email</CardTitle>
              <CardDescription>For a specific person.</CardDescription>
            </CardHeader>
            <CardContent>
              <InviteForm programId={ctx.program.id} />
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">Code</th>
                <th scope="col" className="px-4 py-2 font-medium">Label</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Used</th>
                <th scope="col" className="px-4 py-2 font-medium">Expires</th>
                <th scope="col" className="px-4 py-2 font-medium">Status</th>
                <th scope="col" className="px-4 py-2 font-medium">Created</th>
                {ctx.canEdit ? <th scope="col" className="px-4 py-2 font-medium"><span className="sr-only">Actions</span></th> : null}
              </tr>
            </thead>
            <tbody>
              {(codes ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted-foreground px-4 py-8 text-center">
                    No codes yet.
                  </td>
                </tr>
              ) : null}
              {(codes ?? []).map((c) => {
                const s = status(c);
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="font-mono">{c.code}</span>
                      <CopyButton value={c.code} label={`Copy ${c.code}`} />
                      <CopyButton value={`${base}/join?code=${c.code}`} label={`Copy join link for ${c.code}`} />
                    </td>
                    <td className="text-muted-foreground max-w-64 truncate px-4 py-2">{c.label || "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums whitespace-nowrap">
                      {c.uses}
                      <span className="text-muted-foreground"> / {c.max_uses ?? "∞"}</span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{c.expires_at ? shortDate(c.expires_at) : "Never"}</td>
                    <td className="px-4 py-2">
                      <Badge variant={s === "active" ? "secondary" : "outline"} className={s === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : ""}>
                        {s}
                      </Badge>
                    </td>
                    <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">{shortDate(c.created_at)}</td>
                    {ctx.canEdit ? (
                      <td className="px-4 py-2 text-right">
                        {c.revoked_at ? (
                          <ActionButton action={setCodeRevokedAction.bind(null, c.id, false)} ariaLabel={`Restore ${c.code}`}>
                            Restore
                          </ActionButton>
                        ) : (
                          <ActionButton action={setCodeRevokedAction.bind(null, c.id, true)} variant="ghost" ariaLabel={`Revoke ${c.code}`}>
                            Revoke
                          </ActionButton>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
