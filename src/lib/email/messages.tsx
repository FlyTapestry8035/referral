import "server-only";
import SimpleEmail from "@/emails/simple";
import DigestEmail, { type DigestEmailProps } from "@/emails/digest";
import type { EmailMessage } from "./send";

export function verificationEmail(to: string, name: string, programName: string, url: string): EmailMessage {
  return {
    to,
    subject: `Confirm your email for ${programName}`,
    react: (
      <SimpleEmail
        preview="Confirm your email to start testing"
        heading={`Welcome, ${name}`}
        paragraphs={[`Your referral code worked and your ${programName} tester account is ready.`, "Confirm your email address to sign in."]}
        action={{ label: "Confirm email", url }}
      />
    ),
  };
}

export function passwordResetEmail(to: string, url: string): EmailMessage {
  return {
    to,
    subject: "Reset your Referral password",
    react: (
      <SimpleEmail
        preview="Reset your password"
        heading="Reset your password"
        paragraphs={["Someone asked to reset the password for this email. If that was not you, ignore this email."]}
        action={{ label: "Choose a new password", url }}
      />
    ),
  };
}

export function testerInviteEmail(to: string, name: string, programName: string, code: string, url: string, invitedBy?: string): EmailMessage {
  return {
    to,
    subject: `You're invited to test ${programName}`,
    react: (
      <SimpleEmail
        preview={`Your private referral code: ${code}`}
        heading={`Hi ${name}, you're invited`}
        paragraphs={[
          invitedBy
            ? `${invitedBy} thought you'd be a great tester for ${programName}, and the team agreed.`
            : `You have been invited to the private beta of ${programName}.`,
          `Your personal referral code is ${code}. It works once.`,
        ]}
        action={{ label: "Create your account", url }}
      />
    ),
  };
}

export function memberInviteEmail(to: string, companyName: string, role: string, url: string): EmailMessage {
  return {
    to,
    subject: `You've been added to ${companyName} on Referral`,
    react: (
      <SimpleEmail
        preview={`Join ${companyName} on Referral`}
        heading={`Join ${companyName}`}
        paragraphs={[`You have been added to ${companyName} as ${role}. Set a password to open the dashboard.`]}
        action={{ label: "Set your password", url }}
      />
    ),
  };
}

export function digestEmail(to: string, subject: string, props: DigestEmailProps): EmailMessage {
  return {
    to,
    subject,
    react: <DigestEmail {...props} />,
    headers: { "List-Unsubscribe": `<${props.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function nudgeEmail(
  to: string,
  opts: { name: string; programName: string; reason: "inactive" | "stuck"; missionTitle?: string; appUrl: string; bugUrl: string; unsubscribeUrl: string },
): EmailMessage {
  const paragraphs =
    opts.reason === "stuck" && opts.missionTitle
      ? [`Looks like "${opts.missionTitle}" has been open for a while. Stuck? Tell us what got in the way. That is useful feedback too.`]
      : [`We haven't seen you in ${opts.programName} for a bit. Even five minutes of testing helps a lot.`];
  return {
    to,
    subject: opts.reason === "stuck" ? `Need a hand with "${opts.missionTitle}"?` : `Got 5 minutes for ${opts.programName}?`,
    react: (
      <SimpleEmail
        preview={paragraphs[0]}
        heading={`Hi ${opts.name}`}
        paragraphs={paragraphs}
        action={{ label: "Open my missions", url: opts.appUrl }}
        secondaryAction={{ label: "Report a problem", url: opts.bugUrl }}
        unsubscribeUrl={opts.unsubscribeUrl}
      />
    ),
    headers: { "List-Unsubscribe": `<${opts.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

export function fixNoticeEmail(to: string, opts: { name: string; programName: string; feedbackTitle: string; unsubscribeUrl: string }): EmailMessage {
  return {
    to,
    subject: `Fixed: "${opts.feedbackTitle}"`,
    react: (
      <SimpleEmail
        preview="Something you reported has been fixed"
        heading={`Thanks, ${opts.name}!`}
        paragraphs={[
          `The ${opts.programName} team just marked your report "${opts.feedbackTitle}" as fixed.`,
          "Reports like yours make the product better. Thank you for taking the time.",
        ]}
        unsubscribeUrl={opts.unsubscribeUrl}
      />
    ),
  };
}
