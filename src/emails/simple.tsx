import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, buttonStyle, textStyle } from "./layout";

// One template for short transactional emails: verification, password reset, invites,
// nudges and "your bug was fixed" notes.
export type SimpleEmailProps = {
  preview: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  secondaryAction?: { label: string; url: string };
  unsubscribeUrl?: string;
  footerNote?: string;
};

export default function SimpleEmail(props: SimpleEmailProps) {
  return (
    <EmailLayout preview={props.preview} footer={{ unsubscribeUrl: props.unsubscribeUrl, note: props.footerNote }}>
      <Heading as="h2" style={{ fontSize: "20px", margin: "0 0 16px" }}>
        {props.heading}
      </Heading>
      {props.paragraphs.map((p, i) => (
        <Text key={i} style={textStyle}>
          {p}
        </Text>
      ))}
      {props.action ? (
        <Section style={{ margin: "8px 0 0" }}>
          <Button href={props.action.url} style={buttonStyle}>
            {props.action.label}
          </Button>
          {props.secondaryAction ? (
            <>
              {" "}
              <Button href={props.secondaryAction.url} style={{ ...buttonStyle, backgroundColor: "#111827" }}>
                {props.secondaryAction.label}
              </Button>
            </>
          ) : null}
        </Section>
      ) : null}
      {props.action ? (
        <Text style={{ ...textStyle, fontSize: "12px", color: "#6b7280", marginTop: "16px" }}>
          If the button does not work, copy this link into your browser: {props.action.url}
        </Text>
      ) : null}
    </EmailLayout>
  );
}
