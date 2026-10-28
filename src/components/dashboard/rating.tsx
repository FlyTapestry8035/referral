"use client";

import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 0-5 rating as a radio group. 0 is a real rating ("not helpful"), distinct from unrated.
export function RatingControl({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const checked = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={`${n} of 5`}
            disabled={disabled}
            onClick={() => onChange(checked ? null : n)}
            className={cn(
              "grid size-7 place-items-center rounded-md text-xs transition-colors disabled:opacity-50",
              n === 0 ? "w-7 border" : "",
              checked ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground",
            )}
            title={n === 0 ? "0: not helpful" : `${n} star${n === 1 ? "" : "s"}`}
          >
            {n === 0 ? "0" : <StarIcon className={cn("size-3.5", value !== null && n <= value && "fill-current")} />}
          </button>
        );
      })}
    </div>
  );
}
