import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="bg-primary text-primary-foreground grid size-6 place-items-center rounded-md text-xs">R</span>
          Referral
        </span>
        <ThemeToggle />
      </header>
      <section className="flex flex-1 flex-col justify-center gap-6 py-16">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Run your private beta like a spreadsheet you never have to update.</h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          Only people with a referral code can join. You see every tester&apos;s progress, bugs and tips live, and Referral emails them on your schedule.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/join">I have a referral code</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
