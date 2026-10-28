import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export const colors = { text: "#1f2937", muted: "#6b7280", brand: "#4f46e5", border: "#e5e7eb" };

export const buttonStyle = {
  backgroundColor: colors.brand,
  color: "#ffffff",
  borderRadius: "6px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
} as const;

export const secondaryButtonStyle = { ...buttonStyle, backgroundColor: "#111827" } as const;

export const textStyle = { fontSize: "15px", lineHeight: "24px", color: colors.text, margin: "0 0 16px" } as const;

export function EmailLayout({
  preview,
  children,
  footer,
}: {
  preview: string;
  children: ReactNode;
  footer?: { unsubscribeUrl?: string; note?: string };
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "-apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", border: `1px solid ${colors.border}`, borderRadius: "8px", margin: "24px auto", padding: "28px", maxWidth: "520px" }}>
          {children}
          <Hr style={{ borderColor: colors.border, margin: "24px 0 12px" }} />
          <Section>
            <Text style={{ fontSize: "12px", color: colors.muted, margin: 0 }}>
              {footer?.note ?? "Sent by Referral."}
              {footer?.unsubscribeUrl ? (
                <>
                  {" "}
                  <Link href={footer.unsubscribeUrl} style={{ color: colors.muted, textDecoration: "underline" }}>
                    Unsubscribe from these emails
                  </Link>
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
