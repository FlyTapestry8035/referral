import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

// Label + control + hint/error, the way every form in the app lays out an input.
function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

function FormMessage({ kind = "error", children }: { kind?: "error" | "success"; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        kind === "error" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-success/40 bg-success/10 text-foreground",
      )}
    >
      {children}
    </div>
  );
}

export { Field, FormMessage };
