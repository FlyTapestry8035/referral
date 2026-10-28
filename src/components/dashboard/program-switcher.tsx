"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";
import { selectProgramAction } from "@/app/dashboard/actions";

export function ProgramSwitcher({ programs, current }: { programs: { id: string; name: string }[]; current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <NativeSelect
      aria-label="Program"
      value={current}
      disabled={pending}
      wrapperClassName="w-44 sm:w-56"
      onChange={(e) =>
        start(async () => {
          await selectProgramAction(e.target.value);
          router.refresh();
        })
      }
    >
      {programs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </NativeSelect>
  );
}
