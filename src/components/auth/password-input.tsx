"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { passwordStrength, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { cn } from "@/lib/utils";

const COLORS = ["bg-destructive", "bg-destructive", "bg-warning", "bg-chart-2", "bg-success"];

export function PasswordInput({ id, name, invalid, autoComplete = "new-password" }: { id: string; name: string; invalid?: boolean; autoComplete?: string }) {
  const [value, setValue] = useState("");
  const strength = passwordStrength(value);
  return (
    <div className="grid gap-2">
      <Input
        id={id}
        name={name}
        type="password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={`${id}-strength`}
      />
      <div className="flex items-center gap-2" id={`${id}-strength`} aria-live="polite">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={cn("h-1.5 flex-1 rounded-full", value && strength.score >= i ? COLORS[strength.score] : "bg-muted")} />
          ))}
        </div>
        <span className="text-muted-foreground w-24 text-right text-xs">
          {value ? strength.label : `${MIN_PASSWORD_LENGTH}+ characters`}
        </span>
      </div>
    </div>
  );
}
