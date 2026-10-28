"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Testers" },
  { href: "/dashboard/feedback", label: "Feedback inbox" },
  { href: "/dashboard/codes", label: "Codes" },
  { href: "/dashboard/missions", label: "Missions" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/rewards", label: "Rewards" },
  { href: "/dashboard/nominations", label: "Nominations" },
  { href: "/dashboard/webhooks", label: "Webhooks" },
  { href: "/dashboard/audit", label: "Audit log" },
];

export function NavTabs({ pendingNominations }: { pendingNominations: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard sections" className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm whitespace-nowrap transition-colors",
              active ? "border-foreground text-foreground font-medium" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
            {tab.href === "/dashboard/nominations" && pendingNominations > 0 ? (
              <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]">{pendingNominations}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
