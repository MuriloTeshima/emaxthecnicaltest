"use client";

import { Building2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/native-select";
import { selectCompany } from "@/server/actions/companies";

export interface CompanyOption {
  id: string;
  name: string;
  isDemo: boolean;
}

export function CompanySwitcher({ companies, currentId }: { companies: CompanyOption[]; currentId: string }) {
  const [pending, startTransition] = useTransition();

  function change(id: string) {
    startTransition(async () => {
      const result = await selectCompany(id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Every page shows the other company's data now: reload from scratch.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
        <Building2 className="size-3.5" aria-hidden />
        Empresa
      </span>
      <NativeSelect aria-label="Empresa activa" value={currentId} disabled={pending} onChange={(e) => change(e.target.value)}>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isDemo ? " (demo)" : ""}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
