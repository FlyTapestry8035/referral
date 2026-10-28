import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/dashboard/action-button";
import { CopyButton } from "@/components/dashboard/copy-button";
import { deleteWebhookAction, pingWebhookAction, setWebhookActiveAction } from "@/app/dashboard/manage-actions";
import { dateTime, relativeTime } from "@/lib/format";
import { WebhookForm } from "./webhook-form";

export default async function WebhooksPage() {
  const ctx = await requireDashboard();
  if (!ctx.canEdit) {
    return (
      <div className="grid gap-2">
        <h1 className="text-xl font-semibold">Webhooks</h1>
        <p className="text-muted-foreground text-sm">Webhooks contain signing secrets, so only owners and admins can see them.</p>
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: hooks }, { data: deliveries }] = await Promise.all([
    supabase.from("webhooks").select("*").eq("program_id", ctx.program.id).order("created_at"),
    supabase
      .from("webhook_deliveries")
      .select("id, event, attempts, last_status, last_error, delivered_at, failed_at, next_attempt_at, created_at, webhooks(url)")
      .eq("program_id", ctx.program.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-xl font-semibold">Webhooks</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Referral POSTs JSON to your endpoint. Each request has a <code className="text-xs">Referral-Signature: t=…,v1=…</code> header: HMAC-SHA256 of{" "}
            <code className="text-xs">{"<t>.<raw body>"}</code> with the webhook&apos;s secret. Failed deliveries are retried after 1 min, 5 min, 30 min, 2 h and 12 h.
          </p>
        </div>
        {(hooks ?? []).length === 0 ? <p className="text-muted-foreground text-sm">No webhooks yet.</p> : null}
        {(hooks ?? []).map((h) => (
          <Card key={h.id} className="gap-3 px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-sm break-all">{h.url}</p>
              <Badge variant={h.active ? "secondary" : "outline"}>{h.active ? "active" : "paused"}</Badge>
            </div>
            <div className="flex flex-wrap gap-1">
              {h.events.map((e) => (
                <Badge key={e} variant="outline" className="font-mono">
                  {e}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Signing secret:</span>
              <code>{h.secret.slice(0, 10)}…</code>
              <CopyButton value={h.secret} label="Copy signing secret" />
            </div>
            <div className="flex flex-wrap gap-2">
              <ActionButton action={pingWebhookAction.bind(null, h.id)}>Send test ping</ActionButton>
              <ActionButton action={setWebhookActiveAction.bind(null, h.id, !h.active)}>{h.active ? "Pause" : "Resume"}</ActionButton>
              <ActionButton variant="ghost" confirm="Delete this webhook and its delivery history?" action={deleteWebhookAction.bind(null, h.id)}>
                Delete
              </ActionButton>
            </div>
          </Card>
        ))}

        <Card className="py-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="px-4 pt-4 text-left font-semibold">Recent deliveries</caption>
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Event</th>
                  <th scope="col" className="px-4 py-2 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2 font-medium">Attempts</th>
                  <th scope="col" className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {(deliveries ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-muted-foreground px-4 py-6 text-center">
                      No deliveries yet.
                    </td>
                  </tr>
                ) : null}
                {(deliveries ?? []).map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{d.event}</td>
                    <td className="px-4 py-2">
                      {d.delivered_at ? (
                        <span className="text-emerald-600 dark:text-emerald-400">delivered{d.last_status ? ` (${d.last_status})` : ""}</span>
                      ) : d.failed_at ? (
                        <span className="text-destructive">gave up: {d.last_error}</span>
                      ) : d.attempts > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">
                          retry {relativeTime(d.next_attempt_at)}: {d.last_error}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">queued</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums">{d.attempts}</td>
                    <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">{dateTime(d.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>New webhook</CardTitle>
          <CardDescription>A signing secret is generated for you.</CardDescription>
        </CardHeader>
        <CardContent>
          <WebhookForm programId={ctx.program.id} />
        </CardContent>
      </Card>
    </div>
  );
}
