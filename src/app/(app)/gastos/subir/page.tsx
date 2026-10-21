import { Suspense } from "react";
import { ExpenseUpload } from "@/components/expenses/expense-upload";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toISODate, todayUTC } from "@/domain/period";
import { listContacts } from "@/server/queries/contacts";

export const metadata = { title: "Subir factura" };

export default function UploadExpensePage() {
  return (
    <>
      <PageHeader
        title="Subir factura de proveedor"
        description="Leemos el documento, rellenamos el gasto y tú solo revisas y confirmas."
      />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Upload />
      </Suspense>
    </>
  );
}

async function Upload() {
  const suppliers = await listContacts("SUPPLIER");
  return <ExpenseUpload suppliers={suppliers} today={toISODate(todayUTC())} />;
}
