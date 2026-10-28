import { Button, Heading, Section, Text } from "@react-email/components";
import { EmailLayout, buttonStyle, secondaryButtonStyle, textStyle } from "./layout";

export type DigestEmailProps = {
  testerName: string;
  programName: string;
  intro: string;
  nextMission: { title: string; description: string } | null;
  bugUrl: string;
  tipUrl: string;
  unsubscribeUrl: string;
};

export default function DigestEmail(props: DigestEmailProps) {
  return (
    <EmailLayout
      preview={props.nextMission ? `Next up: ${props.nextMission.title}` : `Any bugs or tips for ${props.programName}?`}
      footer={{ unsubscribeUrl: props.unsubscribeUrl, note: `You're testing ${props.programName}.` }}
    >
      <Heading as="h2" style={{ fontSize: "20px", margin: "0 0 16px" }}>
        Hi {props.testerName},
      </Heading>
      {props.intro ? <Text style={textStyle}>{props.intro}</Text> : null}
      {props.nextMission ? (
        <Section style={{ backgroundColor: "#f3f4f6", borderRadius: "6px", padding: "12px 16px", margin: "0 0 20px" }}>
          <Text style={{ ...textStyle, margin: 0, fontSize: "13px", color: "#6b7280" }}>Your next mission</Text>
          <Text style={{ ...textStyle, margin: "4px 0 0", fontWeight: 600 }}>{props.nextMission.title}</Text>
          {props.nextMission.description ? (
            <Text style={{ ...textStyle, margin: "4px 0 0", fontSize: "14px" }}>{props.nextMission.description}</Text>
          ) : null}
        </Section>
      ) : (
        <Text style={textStyle}>You have finished every mission. Thank you! Anything else you noticed?</Text>
      )}
      <Section>
        <Button href={props.bugUrl} style={buttonStyle}>
          Report a bug
        </Button>{" "}
        <Button href={props.tipUrl} style={secondaryButtonStyle}>
          Share a tip
        </Button>
      </Section>
    </EmailLayout>
  );
}
