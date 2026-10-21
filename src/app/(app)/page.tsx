import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompany } from "@/server/company";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Inicio" description="Resumen de la actividad de tu empresa." />
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <CompanySummary />
      </Suspense>
    </>
  );
}

async function CompanySummary() {
  const company = await getCompany();
  return (
    <div className="rounded-xl border p-6">
      <p className="text-sm text-muted-foreground">Empresa</p>
      <p className="text-lg font-medium">{company.name}</p>
      <p className="text-sm text-muted-foreground">NIF {company.nif}</p>
    </div>
  );
}
