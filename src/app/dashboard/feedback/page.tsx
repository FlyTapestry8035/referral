import Link from "next/link";
import { BugIcon, LightbulbIcon, MessageSquareIcon } from "lucide-react";
import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { dateTime } from "@/lib/format";
import { TriageControls } from "./triage-controls";
import { cn } from "@/lib/utils";

const KIND_ICON = { bug: BugIcon, tip: LightbulbIcon, response: MessageSquareIcon };
const SEVERITY_CLASS = { high: "bg-red-500/15 text-red-700 dark:text-red-300", medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300", low: "bg-muted text-muted-foreground" };

type Search = { q?: string; kind?: string; status?: string; severity?: string; tag?: string; dupes?: string };

export default async function FeedbackInbox({ searchParams }: { searchParams: Promise<Search> }) {
  const ctx = await requireDashboard();
  const sp = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("feedback")
    .select("id, kind, title, body, severity, status, team_rating, tags, duplicate_of, screenshot_path, context, source, created_at, testers(name, email)")
    .eq("program_id", ctx.program.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.kind && ["bug", "tip", "response"].includes(sp.kind)) query = query.eq("kind", sp.kind as "bug");
  if (sp.status && ["new", "acknowledged", "fixed", "wontfix"].includes(sp.status)) query = query.eq("status", sp.status as "new");
  if (sp.severity && ["low", "medium", "high"].includes(sp.severity)) query = query.eq("severity", sp.severity as "low");
  if (sp.tag) query = query.contains("tags", [sp.tag.toLowerCase().slice(0, 40)]);
  if (sp.dupes !== "show") query = query.is("duplicate_of", null);
  if (sp.q) {
    // Escape PostgREST/LIKE metacharacters so search text is matched literally.
    const q = sp.q.slice(0, 100).replace(/[%_\\]/g, (c) => `\\${c}`).replace(/[,()"]/g, " ");
    query = query.or(`title.ilike.%${q}%,body.ilike.%${q}%`);
  }
  const [{ data: items }, { data: all }] = await Promise.all([
    query,
    supabase.from("feedback").select("id, title, duplicate_of, tags").eq("program_id", ctx.program.id).order("created_at", { ascending: false }).limit(500),
  ]);

  const originals = (all ?? []).filter((f) => !f.duplicate_of);
  const dupCount = new Map<string, number>();
  for (const f of all ?? []) if (f.duplicate_of) dupCount.set(f.duplicate_of, (dupCount.get(f.duplicate_of) ?? 0) + 1);
  const titleOf = new Map((all ?? []).map((f) => [f.id, f.title]));
  const allTags = [...new Set((all ?? []).flatMap((f) => f.tags))].sort();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-semibold">Feedback inbox</h1>
        <p className="text-muted-foreground mt-1 text-sm">Triage bugs and tips. Marking an item fixed emails a thank-you to the tester who reported it.</p>
      </div>

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Search titles and details" aria-label="Search feedback" className="w-full sm:w-64" />
        <NativeSelect name="kind" defaultValue={sp.kind ?? ""} aria-label="Type" wrapperClassName="w-32">
          <option value="">All types</option>
          <option value="bug">Bugs</option>
          <option value="tip">Tips</option>
          <option value="response">Responses</option>
        </NativeSelect>
        <NativeSelect name="status" defaultValue={sp.status ?? ""} aria-label="Status" wrapperClassName="w-36">
          <option value="">Any status</option>
          <option value="new">New</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="fixed">Fixed</option>
          <option value="wontfix">Won&apos;t fix</option>
        </NativeSelect>
        <NativeSelect name="severity" defaultValue={sp.severity ?? ""} aria-label="Severity" wrapperClassName="w-32">
          <option value="">Any severity</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </NativeSelect>
        {allTags.length ? (
          <NativeSelect name="tag" defaultValue={sp.tag ?? ""} aria-label="Tag" wrapperClassName="w-32">
            <option value="">Any tag</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        ) : null}
        <label className="flex h-9 items-center gap-2 text-sm">
          <input type="checkbox" name="dupes" value="show" defaultChecked={sp.dupes === "show"} className="accent-primary size-4" />
          Show merged duplicates
        </label>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
        {Object.values(sp).some(Boolean) ? (
          <Button asChild variant="ghost">
            <Link href="/dashboard/feedback">Clear</Link>
          </Button>
        ) : null}
      </form>

      <p className="text-muted-foreground text-sm" aria-live="polite">
        {items?.length ?? 0} item{items?.length === 1 ? "" : "s"}
        {(items?.length ?? 0) >= 200 ? " (showing the newest 200)" : ""}
      </p>

      <ul className="grid gap-3">
        {(items ?? []).map((f) => {
          const Icon = KIND_ICON[f.kind];
          const ctxInfo = (f.context ?? {}) as { url?: string; userAgent?: string; viewport?: string };
          return (
            <li key={f.id} className={cn("bg-card rounded-xl border p-4 shadow-sm", f.duplicate_of && "opacity-70")}>
              <div className="flex flex-wrap items-start gap-3">
                <Icon aria-hidden className="text-muted-foreground mt-1 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium break-words">{f.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {f.testers?.name} · {dateTime(f.created_at)} · via {f.source.replace("_", " ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {f.severity ? <Badge className={SEVERITY_CLASS[f.severity]}>{f.severity}</Badge> : null}
                  <Badge variant="outline" className="capitalize">
                    {f.status === "wontfix" ? "won't fix" : f.status}
                  </Badge>
                  {dupCount.get(f.id) ? <Badge variant="secondary">+{dupCount.get(f.id)} duplicate{dupCount.get(f.id) === 1 ? "" : "s"}</Badge> : null}
                  {f.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </div>
              {f.duplicate_of ? <p className="mt-2 text-xs">Duplicate of “{titleOf.get(f.duplicate_of) ?? "another item"}”</p> : null}
              {f.body ? <p className="mt-2 text-sm break-words whitespace-pre-wrap">{f.body}</p> : null}
              {ctxInfo.url || ctxInfo.viewport || ctxInfo.userAgent ? (
                <dl className="text-muted-foreground mt-2 grid gap-x-4 text-xs sm:grid-cols-[auto_1fr]">
                  {ctxInfo.url ? (
                    <>
                      <dt>Page</dt>
                      <dd className="truncate">{ctxInfo.url}</dd>
                    </>
                  ) : null}
                  {ctxInfo.viewport ? (
                    <>
                      <dt>Viewport</dt>
                      <dd>{ctxInfo.viewport}</dd>
                    </>
                  ) : null}
                  {ctxInfo.userAgent ? (
                    <>
                      <dt>Browser</dt>
                      <dd className="truncate">{ctxInfo.userAgent}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}
              <div className="mt-3 border-t pt-3">
                <TriageControls
                  item={f}
                  canEdit={ctx.canEdit}
                  mergeTargets={originals.filter((o) => o.id !== f.id).map((o) => ({ id: o.id, title: o.title }))}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {items?.length === 0 ? <p className="text-muted-foreground py-8 text-center text-sm">No feedback matches these filters.</p> : null}
    </div>
  );
}
