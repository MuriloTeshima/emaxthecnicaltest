import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { NewCompanyForm } from "@/components/settings/new-company-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getCompany } from "@/server/company";

export const metadata = { title: "Configuración" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Configuración" description="Datos de la empresa activa y preferencias de facturación." />
      <div className="flex max-w-3xl flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
          <Settings />
        </Suspense>
        <NewCompanyForm />
      </div>
    </>
  );
}

async function Settings() {
  const company = await getCompany();
  return (
    <CompanySettingsForm
      key={company.id}
      initial={{
        name: company.name,
        nif: company.nif,
        address: company.address ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
        iban: company.iban ?? "",
        invoiceSeries: company.invoiceSeries,
        quoteSeries: company.quoteSeries,
        paymentTermDays: company.paymentTermDays,
      }}
    />
  );
}
