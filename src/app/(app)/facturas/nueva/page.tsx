import { Suspense } from "react";
import { SalesDocumentForm } from "@/components/invoices/sales-document-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toISODate, todayUTC } from "@/domain/period";
import { getCompany } from "@/server/company";
import { listContacts } from "@/server/queries/contacts";

export const metadata = { title: "Nueva factura" };

export default function NewInvoicePage() {
  return (
    <>
      <PageHeader title="Nueva factura" description="Elige el cliente, añade los conceptos y guarda. El IVA se calcula solo." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const [contacts, company] = await Promise.all([listContacts("CLIENT"), getCompany()]);
  return <SalesDocumentForm kind="invoice" contacts={contacts} today={toISODate(todayUTC())} termDays={company.paymentTermDays} />;
}
