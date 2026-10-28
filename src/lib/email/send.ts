import "server-only";
import type { ReactElement } from "react";
import { render } from "@react-email/components";
import { Resend } from "resend";
import { env } from "@/lib/env";

export type SendResult =
  | { status: "sent"; id: string }
  | { status: "stubbed"; id: string }
  | { status: "failed"; error: string };

export type EmailMessage = {
  to: string;
  subject: string;
  react: ReactElement;
  headers?: Record<string, string>;
};

let client: Resend | null = null;

/**
 * Sends through Resend when RESEND_API_KEY is set. Without a key, nothing is sent: the email is
 * printed to the server console (subject, recipient and plain-text body with all links) so local
 * development works end to end. The returned status says which happened.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const e = env();
  const [html, text] = await Promise.all([
    render(message.react),
    render(message.react, { plainText: true }),
  ]);

  if (!e.RESEND_API_KEY) {
    const id = `stub-${crypto.randomUUID()}`;
    console.info(
      `\n[email:stub] RESEND_API_KEY is not set, so this email was NOT sent.\n` +
        `  to:      ${message.to}\n  subject: ${message.subject}\n  id:      ${id}\n` +
        text
          .split("\n")
          .map((l) => `  | ${l}`)
          .join("\n") +
        "\n",
    );
    return { status: "stubbed", id };
  }

  client ??= new Resend(e.RESEND_API_KEY);
  try {
    const { data, error } = await client.emails.send({
      from: e.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html,
      text,
      headers: message.headers,
    });
    if (error || !data) return { status: "failed", error: error?.message ?? "Unknown Resend error" };
    return { status: "sent", id: data.id };
  } catch (err) {
    return { status: "failed", error: err instanceof Error ? err.message : String(err) };
  }
}
