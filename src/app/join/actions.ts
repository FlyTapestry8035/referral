"use server";

import { redirect } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { env, appUrl } from "@/lib/env";
import { joinSchema, fieldErrors } from "@/lib/validation";
import { CODE_PATTERN, normalizeReferralCode } from "@/lib/codes";
import { rateLimit } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/email/send";
import { verificationEmail } from "@/lib/email/messages";

export type JoinState = { error?: string; fields?: Record<string, string> } | undefined;

// The same message for every code problem (unknown, revoked, expired, used up) so codes can't be probed.
const GENERIC_CODE_ERROR = "That referral code can't be used. Check it and try again, or ask for a new one.";
const ACCOUNT_ERROR = "We couldn't create an account with those details. If you already have an account, log in instead.";

export type TermsLookup = { programName: string; productName: string; termsText: string; termsVersion: number } | null;

/**
 * Shows the program's terms once a well-formed code is entered. Rate limited like /join and
 * returns null for every kind of invalid code.
 */
export async function lookupTerms(rawCode: string): Promise<TermsLookup> {
  const code = normalizeReferralCode(String(rawCode ?? "").slice(0, 40));
  if (!CODE_PATTERN.test(code)) return null;
  const limit = await rateLimit("codeLookup");
  if (!limit.success) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("referral_codes")
    .select("max_uses, uses, expires_at, revoked_at, programs(name, product_name, terms_text, terms_version)")
    .eq("code", code)
    .maybeSingle();
  if (
    !data ||
    !data.programs ||
    data.revoked_at ||
    (data.expires_at && new Date(data.expires_at) <= new Date()) ||
    (data.max_uses !== null && data.uses >= data.max_uses)
  ) {
    return null;
  }
  return {
    programName: data.programs.name,
    productName: data.programs.product_name,
    termsText: data.programs.terms_text,
    termsVersion: data.programs.terms_version,
  };
}

export async function joinAction(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const limit = await rateLimit("join");
  if (!limit.success) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const parsed = joinSchema.safeParse({
    code: formData.get("code") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
    password: formData.get("password") ?? "",
    acceptTerms: formData.get("acceptTerms") ?? "",
  });
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    if (fields.code) return { error: GENERIC_CODE_ERROR, fields: { code: GENERIC_CODE_ERROR } };
    return { error: "Please fix the highlighted fields.", fields };
  }
  const { code, name, email, password } = parsed.data;
  const seenTermsVersion = Number(formData.get("termsVersion") ?? 0);

  const admin = createAdminClient();

  // 1. Redeem the code (row lock + checks + increment in one transaction).
  const { data: redeemed, error: redeemError } = await admin.rpc("redeem_referral_code", { p_code: code });
  const redemption = redeemed?.[0];
  if (redeemError || !redemption) return { error: GENERIC_CODE_ERROR, fields: { code: GENERIC_CODE_ERROR } };

  const release = () => admin.rpc("release_referral_code", { p_code_id: redemption.code_id });

  const { data: program } = await admin
    .from("programs")
    .select("id, name, terms_version")
    .eq("id", redemption.program_id)
    .single();
  if (!program) {
    await release();
    return { error: GENERIC_CODE_ERROR };
  }
  if (seenTermsVersion !== program.terms_version) {
    await release();
    return { error: "The program terms were just updated. Please read them again and re-submit." };
  }

  // An invited tester row (created by "invite by email" or a nomination) is claimed, not duplicated.
  const { data: existingTester } = await admin
    .from("testers")
    .select("id, user_id, referral_code_id")
    .eq("program_id", program.id)
    .eq("email", email)
    .maybeSingle();
  if (existingTester?.user_id) {
    await release();
    return { error: ACCOUNT_ERROR };
  }

  // 2. Only now create the user. generateLink creates an unconfirmed user and returns a
  //    verification token that we email ourselves (so it goes through Resend, not Supabase SMTP).
  let userId: string;
  let needsVerification = true;
  let verifyUrl = "";
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "signup",
    email,
    password,
    options: { data: { name } },
  });

  if (link?.user && link.properties?.hashed_token) {
    userId = link.user.id;
    verifyUrl = appUrl(`/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=signup&next=/app`);
  } else if (linkError && (linkError.code === "email_exists" || linkError.code === "user_already_exists")) {
    // Someone who already has a Referral account (e.g. tester in another program) can join with
    // their existing password. Proving the password stops anyone attaching rows to a stranger's account.
    const e = env();
    const probe = createPlainClient(e.NEXT_PUBLIC_SUPABASE_URL, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: signIn } = await probe.auth.signInWithPassword({ email, password });
    if (!signIn?.user) {
      await release();
      return { error: ACCOUNT_ERROR };
    }
    userId = signIn.user.id;
    needsVerification = false;
    await probe.auth.signOut();
  } else {
    await release();
    console.error("[join] generateLink failed", linkError?.code, linkError?.message);
    return { error: ACCOUNT_ERROR };
  }

  // 3. Tester row with terms acceptance.
  const now = new Date().toISOString();
  const testerFields = {
    user_id: userId,
    name,
    terms_accepted_at: now,
    terms_version_accepted: program.terms_version,
  };
  const { data: tester, error: testerError } = existingTester
    ? await admin
        .from("testers")
        .update({ ...testerFields, referral_code_id: existingTester.referral_code_id ?? redemption.code_id })
        .eq("id", existingTester.id)
        .select("id")
        .single()
    : await admin
        .from("testers")
        .insert({ ...testerFields, program_id: program.id, email, referral_code_id: redemption.code_id })
        .select("id")
        .single();

  if (testerError || !tester) {
    console.error("[join] tester insert failed", testerError?.message);
    if (needsVerification) await admin.auth.admin.deleteUser(userId);
    await release();
    return { error: ACCOUNT_ERROR };
  }
  await admin.from("terms_acceptances").insert({ tester_id: tester.id, terms_version: program.terms_version });

  if (!needsVerification) redirect("/login?joined=1");

  const sent = await sendEmail(verificationEmail(email, name, program.name, verifyUrl));
  if (sent.status === "failed") console.error("[join] verification email failed", sent.error);
  redirect(`/join/check-email?email=${encodeURIComponent(email)}`);
}
