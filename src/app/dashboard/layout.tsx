import Link from "next/link";
import type { Metadata } from "next";
import { LogOutIcon } from "lucide-react";
import { requireDashboard } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NavTabs } from "@/components/dashboard/nav-tabs";
import { ProgramSwitcher } from "@/components/dashboard/program-switcher";

export const metadata: Metadata = { title: "Dashboard · Referral" };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireDashboard();
  const supabase = await createClient();
  const { count } = await supabase
    .from("nominations")
    .select("id", { count: "exact", head: true })
    .eq("program_id", ctx.program.id)
    .eq("status", "pending");

  return (
    <div className="min-h-dvh">
      <header className="bg-background/95 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 pt-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold">
            <span aria-hidden className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs">R</span>
            <span className="hidden sm:inline">Referral</span>
          </Link>
          <span className="text-muted-foreground hidden text-sm md:inline">{ctx.companyName}</span>
          <ProgramSwitcher programs={ctx.programs.map((p) => ({ id: p.id, name: p.name }))} current={ctx.program.id} />
          <div className="ml-auto flex items-center gap-1">
            <span className="text-muted-foreground hidden text-xs lg:inline">
              {ctx.user.email} · {ctx.role}
            </span>
            <ThemeToggle />
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="icon" aria-label="Sign out" type="submit">
                <LogOutIcon />
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pt-2">
          <NavTabs pendingNominations={count ?? 0} />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
