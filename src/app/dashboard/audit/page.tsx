import Link from "next/link";
import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { dateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const ENTITIES = ["programs", "referral_codes", "testers", "missions", "feedback", "rewards", "nominations", "webhooks"];

function summarize(action: string, meta: Record<string, unknown>): string {
  if (action === "update") {
    return Object.entries(meta)
      .map(([k, v]) => {
        const change = v as { from?: unknown; to?: unknown };
        const show = (x: unknown) => (x === null || x === undefined ? "∅" : typeof x === "string" ? (x.length > 40 ? `${x.slice(0, 40)}…` : x) : JSON.stringify(x));
        return `${k}: ${show(change.from)} → ${show(change.to)}`;
      })
      .join("; ");
  }
  const name = (meta.name ?? meta.title ?? meta.code ?? meta.email ?? meta.url) as string | undefined;
  return name ? String(name) : "";
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  const ctx = await requireDashboard();
  const { entity } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("audit_log").select("*").eq("program_id", ctx.program.id).order("created_at", { ascending: false }).limit(200);
  if (entity && ENTITIES.includes(entity)) query = query.eq("entity", entity);
  const { data: entries } = await query;

  // Actor emails come from auth.users (members of this company, or testers of this program).
  const admin = createAdminClient();
  const actors = new Map<string, string>();
  await Promise.all(
    [...new Set((entries ?? []).map((e) => e.actor_id).filter(Boolean) as string[])].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      actors.set(id, data.user?.email ?? "unknown");
    }),
  );

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Audit log</h1>
        <p className="text-muted-foreground mt-1 text-sm">Every change to this program, newest first. “system” means a scheduled job or server process.</p>
      </div>
      <nav aria-label="Filter by entity" className="flex flex-wrap gap-1 text-sm">
        {["all", ...ENTITIES].map((e) => {
          const active = (entity ?? "all") === e;
          return (
            <Link
              key={e}
              href={e === "all" ? "/dashboard/audit" : `/dashboard/audit?entity=${e}`}
              aria-current={active ? "page" : undefined}
              className={cn("rounded-md border px-2 py-1", active ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {e.replace("_", " ")}
            </Link>
          );
        })}
      </nav>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground bg-muted/50 text-left text-xs">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">When</th>
                <th scope="col" className="px-4 py-2 font-medium">Who</th>
                <th scope="col" className="px-4 py-2 font-medium">Action</th>
                <th scope="col" className="px-4 py-2 font-medium">What</th>
                <th scope="col" className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {(entries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground px-4 py-8 text-center">
                    Nothing logged yet.
                  </td>
                </tr>
              ) : null}
              {(entries ?? []).map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{dateTime(e.created_at)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{e.actor_id ? actors.get(e.actor_id) : <span className="text-muted-foreground">system</span>}</td>
                  <td className="px-4 py-2 capitalize">{e.action}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{e.entity.replace("_", " ")}</td>
                  <td className="text-muted-foreground max-w-xl px-4 py-2 break-words">{summarize(e.action, (e.meta ?? {}) as Record<string, unknown>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
