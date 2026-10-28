import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "./password";
import { CODE_PATTERN, normalizeReferralCode } from "./codes";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(320));
const name = z.string().trim().min(1, "Enter a name").max(200);

export const joinSchema = z.object({
  code: z
    .string()
    .max(40)
    .transform(normalizeReferralCode)
    .pipe(z.string().regex(CODE_PATTERN, "That referral code is not valid")),
  name,
  email,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
    .max(200),
  acceptTerms: z.literal("on", { error: "You need to accept the program terms" }),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
  next: z.string().max(500).optional(),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z
  .object({
    password: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`).max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const uuid = z.uuid();

// ---------------------------------------------------------------------------
// Company-side forms
// ---------------------------------------------------------------------------
const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(min).max(max).nullable(),
  );

const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.iso.datetime({ offset: true }).or(z.iso.date()).nullable(),
);

export const createCodeSchema = z.object({
  programId: uuid,
  label: z.string().trim().max(200).optional().default(""),
  maxUses: optionalInt(1, 100000),
  expiresAt: optionalDate,
});

export const inviteSchema = z.object({ programId: uuid, name, email });

export const missionSchema = z.object({
  programId: uuid,
  title: z.string().trim().min(1, "Enter a title").max(200),
  description: z.string().trim().max(5000).optional().default(""),
});

export const programSettingsSchema = z.object({
  programId: uuid,
  name: z.string().trim().min(1).max(200),
  productName: z.string().trim().max(200).default(""),
  digestEnabled: z.boolean(),
  digestIntervalDays: z.coerce.number().int().min(1, "At least 1 day").max(365),
  digestSendHour: z.coerce.number().int().min(0).max(23),
  digestTimezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine(isValidTimeZone, "Unknown time zone"),
  digestSubject: z.string().trim().min(1, "Enter a subject").max(200),
  digestIntro: z.string().trim().max(2000),
  nudgesEnabled: z.boolean(),
  nudgeInactiveDays: z.coerce.number().int().min(1).max(365),
  nudgeStuckDays: z.coerce.number().int().min(1).max(365),
  nominationMinHelpfulness: z.coerce.number().int().min(0).max(100),
  nominationsPerTester: z.coerce.number().int().min(0).max(50),
  termsText: z.string().max(50000),
});

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const testerPatchSchema = z.object({
  testerId: uuid,
  field: z.enum(["name", "notes"]),
  value: z.string().max(10000),
}).superRefine((v, ctx) => {
  if (v.field === "name" && (v.value.trim().length < 1 || v.value.length > 200)) {
    ctx.addIssue({ code: "custom", message: "Name must be 1-200 characters", path: ["value"] });
  }
});

export const feedbackKind = z.enum(["bug", "tip", "response"]);
export const feedbackSeverity = z.enum(["low", "medium", "high"]);
export const feedbackStatus = z.enum(["new", "acknowledged", "fixed", "wontfix"]);

export const feedbackContextSchema = z
  .object({
    url: z.string().max(2000).optional(),
    userAgent: z.string().max(1000).optional(),
    viewport: z.string().max(40).optional(),
  })
  .default({});

export const feedbackSubmitSchema = z
  .object({
    kind: feedbackKind,
    title: z.string().trim().min(1, "Give it a short title").max(200),
    body: z.string().trim().max(10000).default(""),
    severity: z.preprocess((v) => (v === "" || v == null ? null : v), feedbackSeverity.nullable()),
    context: feedbackContextSchema,
  })
  .transform((v) => ({ ...v, severity: v.kind === "bug" ? (v.severity ?? "medium") : null }));

export const triageSchema = z.object({
  feedbackId: uuid,
  status: feedbackStatus.optional(),
  severity: z.preprocess((v) => (v === "" ? null : v), feedbackSeverity.nullable()).optional(),
  teamRating: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int().min(0).max(5).nullable()).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  duplicateOf: z.preprocess((v) => (v === "" ? null : v), uuid.nullable()).optional(),
});

export const rewardSchema = z.object({
  programId: uuid,
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).default(""),
  badge: z.string().trim().min(1).max(16).default("🏅"),
  metric: z.enum(["helpfulness", "bugs_count", "tips_count", "responses_count", "progress"]),
  threshold: z.coerce.number().int().min(0).max(100000),
});

export const nominationSchema = z.object({
  testerId: uuid,
  name,
  email,
  reason: z.string().trim().max(1000).default(""),
});

export const webhookSchema = z.object({
  programId: uuid,
  url: z
    .url("Enter a full URL")
    .max(2000)
    .refine((u) => u.startsWith("https://") || u.startsWith("http://"), "Use an http(s) URL"),
  events: z
    .array(z.enum(["feedback.created", "feedback.status_changed", "tester.stage_changed"]))
    .min(1, "Pick at least one event"),
});

export const memberSchema = z.object({
  companyId: uuid,
  email,
  role: z.enum(["owner", "admin", "viewer"]),
});

export const programCreateSchema = z.object({
  companyId: uuid,
  name: z.string().trim().min(1).max(200),
  productName: z.string().trim().max(200).default(""),
});

// First error message per field, for showing next to inputs.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
