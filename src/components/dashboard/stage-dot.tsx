import { STAGE_LABELS, type Stage } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const STAGE_DOT: Record<Stage, string> = {
  invited: "bg-muted-foreground/40",
  onboarded: "bg-amber-500",
  testing: "bg-sky-500",
  feedback_sent: "bg-violet-500",
  completed: "bg-emerald-500",
};

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STAGE_DOT[stage])} />
      {STAGE_LABELS[stage]}
    </span>
  );
}
