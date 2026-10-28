import { redirect } from "next/navigation";
import { getMyTesters, getSessionUser } from "@/lib/auth";

export default async function TesterHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app");
  const testers = await getMyTesters();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Your missions</h1>
      <p className="text-muted-foreground mt-2">Signed in as {user.email}. Programs: {testers.map((t) => t.programs?.name).join(", ") || "none"}.</p>
    </main>
  );
}
