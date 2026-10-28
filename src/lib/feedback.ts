import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, { ext: string; magic: (b: Uint8Array) => boolean }> = {
  "image/png": { ext: "png", magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": { ext: "webp", magic: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 },
};

export type ScreenshotResult = { ok: true; path: string | null } | { ok: false; error: string };

/**
 * Validates an uploaded screenshot (type, size and file signature, not just the claimed
 * content type) and stores it privately at <program>/<tester>/<uuid>.<ext>.
 */
export async function storeScreenshot(file: FormDataEntryValue | null, programId: string, testerId: string): Promise<ScreenshotResult> {
  if (!file || typeof file === "string" || file.size === 0) return { ok: true, path: null };
  if (file.size > MAX_BYTES) return { ok: false, error: "Screenshot is larger than 5 MB" };
  const type = TYPES[file.type];
  if (!type) return { ok: false, error: "Screenshot must be PNG, JPEG or WebP" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!type.magic(bytes)) return { ok: false, error: "That file is not a valid image" };

  const path = `${programId}/${testerId}/${randomUUID()}.${type.ext}`;
  const { error } = await createAdminClient().storage.from("screenshots").upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "Could not store the screenshot" };
  return { ok: true, path };
}

export function parseContext(raw: FormDataEntryValue | null): Record<string, string> {
  if (typeof raw !== "string" || raw.length > 4000) return {};
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, string> = {};
    if (typeof v.url === "string") out.url = v.url.slice(0, 2000);
    if (typeof v.userAgent === "string") out.userAgent = v.userAgent.slice(0, 1000);
    if (typeof v.viewport === "string" && /^\d{1,5}x\d{1,5}$/.test(v.viewport)) out.viewport = v.viewport;
    return out;
  } catch {
    return {};
  }
}
