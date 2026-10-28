"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireEditor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { triageSchema, uuid } from "@/lib/validation";
import { sendFixNotice } from "@/lib/notify";
import { deliverPendingWebhooks } from "@/lib/webhooks";
import type { ActionResult } from "@/app/dashboard/actions";

export async function triageFeedbackAction(input: {
  feedbackId: string;
  status?: string;
  severity?: string | null;
  teamRating?: number | string | null;
  tags?: string[];
  duplicateOf?: string | null;
}): Promise<ActionResult> {
  const parsed = triageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { feedbackId, status, severity, teamRating, tags, duplicateOf } = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase.from("feedback").select("id, program_id, status, kind").eq("id", feedbackId).maybeSingle();
  if (!before) return { ok: false, error: "Feedback not found" };
  try {
    await requireEditor(before.program_id);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not allowed" };
  }

  if (duplicateOf) {
    if (duplicateOf === feedbackId) return { ok: false, error: "An item cannot duplicate itself" };
    const { data: target } = await supabase.from("feedback").select("id, program_id, duplicate_of").eq("id", duplicateOf).maybeSingle();
    if (!target || target.program_id !== before.program_id) return { ok: false, error: "Pick an item from the same program" };
    if (target.duplicate_of) return { ok: false, error: "That item is itself a duplicate; merge into its original instead" };
  }

  const patch: {
    status?: typeof status;
    severity?: typeof severity;
    team_rating?: number | null;
    tags?: string[];
    duplicate_of?: string | null;
  } = {};
  if (status !== undefined) patch.status = status;
  if (severity !== undefined) patch.severity = before.kind === "bug" ? severity : null;
  if (teamRating !== undefined) patch.team_rating = teamRating;
  if (tags !== undefined) patch.tags = [...new Set(tags.map((t) => t.toLowerCase()))];
  if (duplicateOf !== undefined) patch.duplicate_of = duplicateOf;

  const { error } = await supabase.from("feedback").update(patch).eq("id", feedbackId);
  if (error) return { ok: false, error: error.message };

  // Re-point items that were duplicates of this one, so merges never chain.
  if (duplicateOf) {
    await createAdminClient().from("feedback").update({ duplicate_of: duplicateOf }).eq("duplicate_of", feedbackId);
  }

  if (status === "fixed" && before.status !== "fixed") {
    after(async () => {
      const r = await sendFixNotice(feedbackId);
      if (r.status === "failed") console.error("[fix-notice] failed", r.error);
    });
  }
  after(() => deliverPendingWebhooks({ programId: before.program_id }));
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

export async function screenshotUrlAction(feedbackId: string): Promise<string | null> {
  if (!uuid.safeParse(feedbackId).success) return null;
  const supabase = await createClient();
  // RLS decides whether this user may see the feedback at all.
  const { data } = await supabase.from("feedback").select("screenshot_path").eq("id", feedbackId).maybeSingle();
  if (!data?.screenshot_path) return null;
  const { data: signed } = await createAdminClient().storage.from("screenshots").createSignedUrl(data.screenshot_path, 60 * 10);
  return signed?.signedUrl ?? null;
}
