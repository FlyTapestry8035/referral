import { requireDashboard } from "@/lib/auth";

export default async function DashboardPage() {
  const ctx = await requireDashboard();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{ctx.program.name}</h1>
    </main>
  );
}
