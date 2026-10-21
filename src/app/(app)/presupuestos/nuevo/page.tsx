import { Suspense } from "react";
import { SalesDocumentForm } from "@/components/invoices/sales-document-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toISODate, todayUTC } from "@/domain/period";
import { listContacts } from "@/server/queries/contacts";

export const metadata = { title: "Nuevo presupuesto" };

const QUOTE_VALIDITY_DAYS = 30;

export default function NewQuotePage() {
  return (
    <>
      <PageHeader title="Nuevo presupuesto" description="Prepara la propuesta. Cuando el cliente la acepte, conviértela en factura sin volver a escribirla." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const contacts = await listContacts("CLIENT");
  return <SalesDocumentForm kind="quote" contacts={contacts} today={toISODate(todayUTC())} termDays={QUOTE_VALIDITY_DAYS} />;
}
