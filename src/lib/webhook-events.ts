// Browser-safe list of webhook events (lib/webhook-signing.ts uses node:crypto).
export const WEBHOOK_EVENTS = ["feedback.created", "feedback.status_changed", "tester.stage_changed"] as const;
