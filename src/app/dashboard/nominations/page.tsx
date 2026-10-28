import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/format";
import { DecideButtons } from "./decide";

export default async function NominationsPage() {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const { data: nominations } = await supabase
    .from("nominations")
    .select("id, name, email, reason, status, created_at, decided_at, testers(name, helpfulness)")
    .eq("program_id", ctx.program.id)
    .order("created_at", { ascending: false });
  const pending = (nominations ?? []).filter((n) => n.status === "pending");
  const decided = (nominations ?? []).filter((n) => n.status !== "pending");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-xl font-semibold">Nominations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Testers with helpfulness of at least {ctx.program.nomination_min_helpfulness} can nominate up to {ctx.program.nominations_per_tester} people (change this in Settings). Approving sends an invite with a single-use code.
        </p>
      </div>

      <section aria-labelledby="pending-h" className="grid gap-3">
        <h2 id="pending-h" className="font-semibold">
          Waiting for approval ({pending.length})
        </h2>
        {pending.length === 0 ? <p className="text-muted-foreground text-sm">Nothing to review.</p> : null}
        {pending.map((n) => (
          <Card key={n.id} className="flex-row flex-wrap items-start justify-between gap-4 px-5">
            <div className="min-w-0">
              <p className="font-medium">
                {n.name} <span className="text-muted-foreground font-normal">· {n.email}</span>
              </p>
              <p className="text-muted-foreground text-sm">
                Nominated by {n.testers?.name} (helpfulness {n.testers?.helpfulness}) {relativeTime(n.created_at)}
              </p>
              {n.reason ? <p className="mt-1 text-sm">“{n.reason}”</p> : null}
            </div>
            {ctx.canEdit ? <DecideButtons id={n.id} name={n.name} /> : null}
          </Card>
        ))}
      </section>

      {decided.length ? (
        <section aria-labelledby="decided-h" className="grid gap-3">
          <h2 id="decided-h" className="font-semibold">
            Decided
          </h2>
          <ul className="divide-y rounded-xl border text-sm">
            {decided.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {n.name} <span className="text-muted-foreground">({n.email}), by {n.testers?.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge variant={n.status === "approved" ? "secondary" : "outline"}>{n.status}</Badge>
                  <span className="text-muted-foreground text-xs">{relativeTime(n.decided_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
