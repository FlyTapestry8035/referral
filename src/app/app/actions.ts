"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { feedbackSubmitSchema, fieldErrors, nominationSchema, uuid } from "@/lib/validation";
import { parseContext, storeScreenshot } from "@/lib/feedback";
import { deliverPendingWebhooks } from "@/lib/webhooks";
import { z } from "zod";

export type TesterActionResult = { ok: true; message?: string } | { ok: false; error: string; fields?: Record<string, string> };

/** The signed-in user's active tester row for a program (RLS also enforces this). */
async function myTester(testerId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Please log in again");
  const supabase = await createClient();
  const { data } = await supabase
    .from("testers")
    .select("id, program_id, user_id, access_revoked_at, terms_version_accepted, programs(terms_version)")
    .eq("id", testerId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data || data.access_revoked_at) throw new Error("You don't have access to this program");
  if ((data.terms_version_accepted ?? 0) < (data.programs?.terms_version ?? 1)) throw new Error("Please accept the updated terms first");
  return { tester: data, supabase };
}

export async function submitFeedbackAction(_prev: TesterActionResult | undefined, formData: FormData): Promise<TesterActionResult> {
  const testerId = uuid.safeParse(formData.get("testerId"));
  if (!testerId.success) return { ok: false, error: "Unknown program" };
  const parsed = feedbackSubmitSchema.safeParse({
    kind: formData.get("kind"),
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    severity: formData.get("severity") ?? "",
    context: parseContext(formData.get("context")),
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  const source = z.enum(["app", "widget", "embed"]).catch("app").parse(formData.get("source"));

  try {
    const { tester, supabase } = await myTester(testerId.data);
    const shot = await storeScreenshot(formData.get("screenshot"), tester.program_id, tester.id);
    if (!shot.ok) return { ok: false, error: shot.error, fields: { screenshot: shot.error } };

    const { error } = await supabase.from("feedback").insert({
      program_id: tester.program_id,
      tester_id: tester.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      body: parsed.data.body,
      severity: parsed.data.severity,
      context: parsed.data.context,
      screenshot_path: shot.path,
      source,
    });
    if (error) return { ok: false, error: "Could not send your feedback. Please try again." };
    after(() => deliverPendingWebhooks({ programId: tester.program_id }));
    revalidatePath("/app");
    return { ok: true, message: parsed.data.kind === "bug" ? "Bug reported. Thank you!" : "Thanks for sharing!" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function setMissionStatusAction(testerId: string, missionId: string, status: "todo" | "doing" | "done"): Promise<TesterActionResult> {
  if (!uuid.safeParse(testerId).success || !uuid.safeParse(missionId).success || !["todo", "doing", "done"].includes(status)) {
    return { ok: false, error: "Invalid mission" };
  }
  try {
    const { tester, supabase } = await myTester(testerId);
    // Update first; insert if this mission has no row yet. (No upsert: clients may only write `status`.)
    const { data: updated, error: updateError } = await supabase
      .from("tester_missions")
      .update({ status })
      .eq("tester_id", tester.id)
      .eq("mission_id", missionId)
      .select("mission_id");
    if (updateError) return { ok: false, error: updateError.message };
    if (!updated?.length) {
      const { error } = await supabase.from("tester_missions").insert({ tester_id: tester.id, mission_id: missionId, status });
      if (error) return { ok: false, error: "Could not update the mission" };
    }
    after(() => deliverPendingWebhooks({ programId: tester.program_id }));
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

export async function acceptTermsAction(testerId: string): Promise<TesterActionResult> {
  if (!uuid.safeParse(testerId).success) return { ok: false, error: "Unknown program" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_terms", { p_tester_id: testerId });
  if (error) return { ok: false, error: "Could not record your acceptance" };
  revalidatePath("/app");
  return { ok: true };
}

export async function nominateAction(_prev: TesterActionResult | undefined, formData: FormData): Promise<TesterActionResult> {
  const parsed = nominationSchema.safeParse({
    testerId: formData.get("testerId"),
    name: formData.get("name"),
    email: formData.get("email"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };
  try {
    const { tester, supabase } = await myTester(parsed.data.testerId);
    const { error } = await supabase.from("nominations").insert({
      program_id: tester.program_id,
      nominated_by_tester_id: tester.id,
      name: parsed.data.name,
      email: parsed.data.email,
      reason: parsed.data.reason,
    });
    if (error) {
      if (error.code === "23505") return { ok: false, error: "Someone has already nominated that person." };
      return { ok: false, error: "You can't nominate anyone right now." };
    }
    revalidatePath("/app");
    return { ok: true, message: `Thanks! The team will review your nomination of ${parsed.data.name}.` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
  }
}
