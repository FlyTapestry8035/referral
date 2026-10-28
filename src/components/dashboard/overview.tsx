"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { takeaway, type Overview } from "@/lib/metrics";
import type { Stage } from "@/lib/stats";

const FUNNEL_COLORS: Record<Stage, string> = {
  invited: "var(--color-muted-foreground)",
  onboarded: "#f59e0b",
  testing: "#0ea5e9",
  feedback_sent: "#8b5cf6",
  completed: "#10b981",
};

function Tile({ label, value, suffix, hint }: { label: string; value: number; suffix?: string; hint?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {value}
          {suffix ? <span className="text-muted-foreground ml-0.5 text-sm font-normal">{suffix}</span> : null}
        </p>
        {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

type FunnelDatum = Overview["funnel"][number];

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: { payload: FunnelDatum }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p className="text-muted-foreground">
        {d.count} tester{d.count === 1 ? "" : "s"} reached this stage ({d.pct}% of all)
      </p>
    </div>
  );
}

export function OverviewSection({ programName, overview }: { programName: string; overview: Overview }) {
  return (
    <section aria-labelledby="overview-title" className="grid gap-4">
      <div>
        <h1 id="overview-title" className="text-xl font-semibold sm:text-2xl">
          {programName} testers
        </h1>
        <p className="text-muted-foreground mt-1" aria-live="polite">
          {takeaway(overview)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile label="Testers" value={overview.total} hint={`${overview.joined} joined`} />
        <Tile label="Average progress" value={overview.avgProgress} suffix="%" hint="of joined testers" />
        <Tile label="Average helpfulness" value={overview.avgHelpfulness} suffix="/ 100" hint="of joined testers" />
        <Tile label="Bugs found" value={overview.bugs} />
        <Tile label="Tips shared" value={overview.tips} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Testing funnel</CardTitle>
          <CardDescription>Testers who reached each stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-56 w-full" role="img" aria-label={overview.funnel.map((f) => `${f.label}: ${f.count} (${f.pct}%)`).join(", ")}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.funnel} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }} barCategoryGap={6}>
                <XAxis type="number" hide domain={[0, Math.max(1, overview.total)]} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={104}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip content={<FunnelTooltip />} cursor={{ fill: "var(--color-muted)", opacity: 0.5 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={false} background={{ fill: "var(--color-muted)", radius: 4 }}>
                  {overview.funnel.map((f) => (
                    <Cell key={f.stage} fill={FUNNEL_COLORS[f.stage]} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="right"
                    content={(props) => {
                      const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                      const d = overview.funnel[index];
                      return (
                        <text x={Number(x) + Number(width) + 8} y={Number(y) + Number(height) / 2} dominantBaseline="middle" fontSize={12} fill="var(--color-foreground)">
                          {d.count} · {d.pct}%
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
