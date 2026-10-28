import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs">R</span>
          Referral
        </Link>
        <div className="bg-card rounded-xl border p-6 shadow-sm">
          <h1 className="text-xl font-semibold">{title}</h1>
          {description ? <p className="text-muted-foreground mt-1 text-sm">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="text-muted-foreground mt-4 text-center text-sm">{footer}</div> : null}
      </div>
    </main>
  );
}
