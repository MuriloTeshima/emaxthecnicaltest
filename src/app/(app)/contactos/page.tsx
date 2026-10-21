import { Users } from "lucide-react";
import { Suspense } from "react";
import { NewContactButtons } from "@/components/contacts/new-contact-buttons";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { countryName, isIntraCommunityCountry, toEuVatNumber } from "@/domain/tax-id";
import { listContactsWithActivity } from "@/server/queries/contacts";

export const metadata = { title: "Contactos" };

const KIND_LABELS = { CLIENT: "Cliente", SUPPLIER: "Proveedor", BOTH: "Cliente y proveedor" } as const;

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Contactos"
        description="Clientes y proveedores. Se reutilizan al facturar y al registrar gastos."
        actions={<NewContactButtons />}
      />
      <Suspense fallback={<TableSkeleton />}>
        <ContactList />
      </Suspense>
    </>
  );
}

async function ContactList() {
  const contacts = await listContactsWithActivity();
  if (contacts.length === 0) {
    return <EmptyState icon={Users} title="Sin contactos" description="Crea tu primer cliente o proveedor." />;
  }

  return (
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
                  <p className="font-medium">{contact.name}</p>
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
                  {contact._count.invoices > 0 && `${contact._count.invoices} fact.`}
                  {contact._count.invoices > 0 && contact._count.expenses > 0 && " · "}
                  {contact._count.expenses > 0 && `${contact._count.expenses} gastos`}
                  {contact._count.invoices + contact._count.expenses === 0 && "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
