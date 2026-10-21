import { Suspense } from "react";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { toISODate, todayUTC } from "@/domain/period";
import { listContacts } from "@/server/queries/contacts";

export const metadata = { title: "Nuevo gasto" };

export default function NewExpensePage() {
  return (
    <>
      <PageHeader title="Nuevo gasto" description="Registra una factura recibida. El IVA, la retención y el total se calculan solos." />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const suppliers = await listContacts("SUPPLIER");
  return <ExpenseForm suppliers={suppliers} today={toISODate(todayUTC())} />;
}
