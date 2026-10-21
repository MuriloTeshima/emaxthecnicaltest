import { Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { NewContactButtons } from "@/components/contacts/new-contact-buttons";
import { EmptyState } from "@/components/empty-state";
import { FilterBar } from "@/components/filter-bar";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryName, isIntraCommunityCountry, toEuVatNumber } from "@/domain/tax-id";
import { param } from "@/lib/filters";
import { listContactsWithActivity } from "@/server/queries/contacts";

export const metadata = { title: "Contactos" };

const KIND_LABELS = { CLIENT: "Cliente", SUPPLIER: "Proveedor", BOTH: "Cliente y proveedor" } as const;

export default function ContactsPage({ searchParams }: PageProps<"/contactos">) {
  return (
    <>
      <PageHeader
        title="Contactos"
        description="Clientes y proveedores. Se reutilizan al facturar y al registrar gastos."
        actions={<NewContactButtons />}
      />
      <Suspense fallback={<TableSkeleton />}>
        <ContactList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ContactList({ searchParams }: { searchParams: PageProps<"/contactos">["searchParams"] }) {
  const params = await searchParams;
  const values = { q: param(params, "q"), tipo: param(params, "tipo") };
  const contacts = await listContactsWithActivity({ q: values.q, kind: values.tipo });
  const filters = (
    <FilterBar
      searchPlaceholder="Nombre, NIF o email"
      values={values}
      selects={[
        {
          name: "tipo",
          label: "Tipo",
          options: [
            { value: "cliente", label: "Clientes" },
            { value: "proveedor", label: "Proveedores" },
          ],
        },
      ]}
    />
  );
  if (contacts.length === 0) {
    return (
      <>
        {filters}
        <EmptyState
          icon={Users}
          title={values.q || values.tipo ? "Sin resultados" : "Sin contactos"}
          description={values.q || values.tipo ? "Ningún contacto coincide con los filtros." : "Crea tu primer cliente o proveedor."}
        />
      </>
    );
  }

  return (
    <>
      {filters}
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Nombre</TableHead>
              <TableHead>NIF</TableHead>
              <TableHead className="hidden sm:table-cell">País</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="pr-4 text-right">Documentos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => {
              const intraEu = isIntraCommunityCountry(contact.country);
              return (
                <TableRow key={contact.id}>
                  <TableCell className="pl-4">
                    <Link href={`/contactos/${contact.id}`} className="font-medium hover:underline">
                      {contact.name}
                    </Link>
                    {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{intraEu ? toEuVatNumber(contact.country, contact.nif) : contact.nif}</TableCell>
                  <TableCell className="hidden sm:table-cell">{countryName(contact.country)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{KIND_LABELS[contact.kind]}</Badge>
                      {contact.isProfessional && <Badge variant="secondary">Retención IRPF</Badge>}
                      {intraEu && <Badge variant="secondary">UE</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4 text-right text-sm text-muted-foreground tabular-nums">
                    {[
                      contact._count.invoices > 0 && `${contact._count.invoices} fact.`,
                      contact._count.quotes > 0 && `${contact._count.quotes} presup.`,
                      contact._count.expenses > 0 && `${contact._count.expenses} gastos`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
