"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { NativeSelect } from "@/components/native-select";
import { type Period, formatPeriod, periodToParam, previousPeriods } from "@/domain/period";
import { cn } from "@/lib/utils";

export function PeriodSelect({ value, current }: { value: Period; current: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const options = previousPeriods(current, 8);

  return (
    <div className={cn("w-40 transition-opacity", pending && "opacity-60")}>
      <NativeSelect
        aria-label="Trimestre"
        value={periodToParam(value)}
        onChange={(e) => startTransition(() => router.push(`${pathname}?periodo=${e.target.value}`))}
      >
        {options.map((p) => (
          <option key={periodToParam(p)} value={periodToParam(p)}>
            {formatPeriod(p)}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
