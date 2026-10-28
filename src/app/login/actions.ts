"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/env";
import { loginSchema, forgotSchema, resetSchema, fieldErrors } from "@/lib/validation";
import { rateLimit } from "@/lib/ratelimit";
import { safeNext } from "@/lib/safe-redirect";
import { homeFor } from "@/lib/auth";
import { sendEmail } from "@/lib/email/send";
import { passwordResetEmail } from "@/lib/email/messages";

export type FormState = { error?: string; success?: string; fields?: Record<string, string> } | undefined;

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = await rateLimit("login");
  if (!limit.success) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const parsed = loginSchema.safeParse({
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "Enter your email and password.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. The link is in the email we sent when you joined." };
    }
    return { error: "Email or password is incorrect." };
  }
  const fallback = await homeFor();
  redirect(safeNext(parsed.data.next, fallback));
}

export async function forgotPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const limit = await rateLimit("forgot");
  if (!limit.success) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const parsed = forgotSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) return { error: "Enter a valid email address.", fields: fieldErrors(parsed.error) };

  const admin = createAdminClient();
  const { data } = await admin.auth.admin.generateLink({ type: "recovery", email: parsed.data.email });
  if (data?.properties?.hashed_token) {
    const url = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`);
    const sent = await sendEmail(passwordResetEmail(parsed.data.email, url));
    if (sent.status === "failed") console.error("[forgot] email failed", sent.error);
  }
  // Same answer whether or not the account exists.
  return { success: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse({ password: formData.get("password") ?? "", confirm: formData.get("confirm") ?? "" });
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.code === "same_password" ? "Choose a password you haven't used before." : "Could not update your password. Try again." };
  redirect(await homeFor());
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
