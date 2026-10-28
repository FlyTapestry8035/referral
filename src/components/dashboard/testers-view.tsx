"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { computeOverview } from "@/lib/metrics";
import { OverviewSection } from "./overview";
import { TesterSheet, useSheetRows } from "./tester-sheet";
import { TesterPanel, type PanelTester } from "./tester-panel";
import { FormMessage } from "@/components/ui/field";
import { updateTesterFieldAction } from "@/app/dashboard/actions";
import type { Database } from "@/lib/supabase/database.types";

type TesterRow = Database["public"]["Tables"]["testers"]["Row"];

export function TestersView({
  programId,
  programName,
  initialTesters,
  codes,
  badges,
  canEdit,
}: {
  programId: string;
  programName: string;
  initialTesters: TesterRow[];
  codes: Record<string, string>;
  badges: Record<string, { badge: string; name: string }[]>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [testers, setTesters] = useState(initialTesters);
  const [synced, setSynced] = useState(initialTesters);
  const [openId, setOpenId] = useState<string | null>(null);
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A server refresh brings new props: adopt them (render-time sync, no effect needed).
  if (initialTesters !== synced) {
    setSynced(initialTesters);
    setTesters(initialTesters);
  }

  // Live updates. RLS applies to Realtime too, so members only receive their program's rows.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      // Codes and badges are joined server-side; a debounced refresh picks them up.
      refreshTimer.current = setTimeout(() => router.refresh(), 1500);
    };

    (async () => {
      // The browser client loads the session lazily. Give Realtime the user's token before
      // joining, otherwise the channel joins as anon and RLS hides every row.
      const { data } = await supabase.auth.getSession();
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      // A unique topic per mount: re-joining a topic right after leaving it can collide.
      channel = supabase
        .channel(`dashboard:${programId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "testers", filter: `program_id=eq.${programId}` },
          (payload) => {
            if (payload.eventType === "DELETE") {
              const id = (payload.old as Partial<TesterRow>).id;
              setTesters((list) => list.filter((t) => t.id !== id));
            } else {
              const row = payload.new as TesterRow;
              setTesters((list) => (list.some((t) => t.id === row.id) ? list.map((t) => (t.id === row.id ? row : t)) : [...list, row]));
            }
            scheduleRefresh();
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "feedback", filter: `program_id=eq.${programId}` }, () => {
          setFeedbackVersion((v) => v + 1);
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    })();

    return () => {
      cancelled = true;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [programId, router]);

  const rows = useSheetRows(testers, codes, badges);
  const overview = useMemo(() => computeOverview(testers), [testers]);

  const saveField = async (id: string, field: "name" | "notes", value: string) => {
    const previous = testers.find((t) => t.id === id);
    if (!previous) return;
    setError(null);
    setTesters((list) => list.map((t) => (t.id === id ? { ...t, [field]: value } : t))); // optimistic
    const result = await updateTesterFieldAction({ testerId: id, field, value });
    if (!result.ok) {
      setTesters((list) => list.map((t) => (t.id === id ? { ...t, [field]: previous[field] } : t)));
      setError(`Could not save: ${result.error}`);
    }
  };

  const panelTester: PanelTester | null = useMemo(() => {
    const t = testers.find((x) => x.id === openId);
    const r = rows.find((x) => x.id === openId);
    if (!t || !r) return null;
    return {
      ...r,
      user_id: t.user_id,
      created_at: t.created_at,
      terms_accepted_at: t.terms_accepted_at,
      terms_version_accepted: t.terms_version_accepted,
      unsubscribed_at: t.unsubscribed_at,
    };
  }, [openId, testers, rows]);

  return (
    <div className="grid gap-6">
      <OverviewSection programName={programName} overview={overview} />
      <section aria-labelledby="sheet-title" className="bg-card grid gap-3 rounded-xl border p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="sheet-title" className="font-semibold">
            Tester sheet
          </h2>
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs" title={live ? "Receiving live updates" : "Connecting to live updates"}>
            <span aria-hidden className={`size-2 rounded-full ${live ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            {live ? "Live" : "Connecting"}
          </span>
        </div>
        {error ? <FormMessage>{error}</FormMessage> : null}
        <TesterSheet rows={rows} canEdit={canEdit} onOpen={setOpenId} onSaveField={saveField} />
      </section>
      <TesterPanel
        tester={panelTester}
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        canEdit={canEdit}
        onSaveNotes={(id, notes) => saveField(id, "notes", notes)}
        feedbackVersion={feedbackVersion}
      />
    </div>
  );
}
