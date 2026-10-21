import { Suspense } from "react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toISODate, todayUTC } from "@/domain/period";
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
  const contacts = await listContacts("CLIENT");
  return <InvoiceForm contacts={contacts} today={toISODate(todayUTC())} />;
}
