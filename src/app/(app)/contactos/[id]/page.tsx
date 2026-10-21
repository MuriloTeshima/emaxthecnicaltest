import { ArrowLeft, FilePlus, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ContactEditDialog } from "@/components/contacts/contact-edit-dialog";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { countryName, isIntraCommunityCountry, toEuVatNumber } from "@/domain/tax-id";
import { formatDate, formatEUR } from "@/lib/format";
import { getContactDetail } from "@/server/queries/contacts";

export const metadata = { title: "Contacto" };

const KIND_LABELS = { CLIENT: "Cliente", SUPPLIER: "Proveedor", BOTH: "Cliente y proveedor" } as const;
const PAID_LABELS = { PAID: "Pagado", PENDING: "Pendiente" } as const;

export default function ContactPage({ params }: PageProps<"/contactos/[id]">) {
  return (
    <>
      <Link href="/contactos" className={buttonVariants({ variant: "ghost", size: "sm", className: "mb-4 -ml-2" })}>
        <ArrowLeft />
        Contactos
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ContactDetail params={params} />
      </Suspense>
    </>
  );
}

async function ContactDetail({ params }: { params: PageProps<"/contactos/[id]">["params"] }) {
  const { id } = await params;
  const contact = await getContactDetail(id);
  if (!contact) notFound();

  const { invoices, quotes, expenses, stats, ...rest } = contact;
  const isClient = contact.kind !== "SUPPLIER";
  const isSupplier = contact.kind !== "CLIENT";
  const intraEu = isIntraCommunityCountry(contact.country);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{KIND_LABELS[contact.kind]}</Badge>
            {contact.isProfessional && <Badge variant="secondary">Retención IRPF</Badge>}
            <span className="font-mono text-xs">{intraEu ? toEuVatNumber(contact.country, contact.nif) : contact.nif}</span>
            <span>· {countryName(contact.country)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isClient && (
            <Link href="/facturas/nueva" className={buttonVariants({ variant: "outline" })}>
              <FilePlus />
              Nueva factura
            </Link>
          )}
          <ContactEditDialog contact={rest} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isClient && <Stat label="Facturado" value={formatEUR(stats.invoicedCents)} />}
        {isClient && <Stat label="Pendiente de cobro" value={formatEUR(stats.pendingCents)} />}
        {isSupplier && <Stat label="Gastado" value={formatEUR(stats.spentCents)} />}
        {isSupplier && <Stat label="Pendiente de pago" value={formatEUR(stats.toPayCents)} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {isClient && (
            <History title="Facturas" empty="Sin facturas emitidas.">
              {invoices.map((i) => (
                <Row key={i.id} href={`/facturas/${i.id}`} title={i.number} date={i.issueDate} amount={i.totalCents}>
                  <StatusBadge status={i.displayStatus} />
                </Row>
              ))}
            </History>
          )}
          {isClient && quotes.length > 0 && (
            <History title="Presupuestos" empty="">
              {quotes.map((q) => (
                <Row key={q.id} href={`/presupuestos/${q.id}`} title={q.number} date={q.issueDate} amount={q.totalCents}>
                  <QuoteStatusBadge status={q.status} />
                </Row>
              ))}
            </History>
          )}
          {isSupplier && (
            <History title="Gastos" empty="Sin gastos registrados.">
              {expenses.map((e) => (
                <Row key={e.id} href="/gastos" title={e.concept} date={e.date} amount={e.totalCents}>
                  <StatusBadge status={e.status} labels={PAID_LABELS} />
                </Row>
              ))}
            </History>
          )}
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Datos de contacto</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:underline">
                <Mail className="size-4 text-muted-foreground" /> {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:underline">
                <Phone className="size-4 text-muted-foreground" /> {contact.phone}
              </a>
            )}
            {contact.address && (
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {contact.address}
              </p>
            )}
            {!contact.email && !contact.phone && !contact.address && <p className="text-muted-foreground">Sin datos de contacto. Pulsa «Editar» para añadirlos.</p>}
            {contact.notes && <p className="rounded-lg bg-muted/50 p-3 whitespace-pre-line text-muted-foreground">{contact.notes}</p>}
            <p className="text-xs text-muted-foreground">Alta: {formatDate(contact.createdAt)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-lg font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function History({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y">{children}</ul>}</CardContent>
    </Card>
  );
}

function Row({ href, title, date, amount, children }: { href: string; title: string; date: Date; amount: number; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">{formatDate(date)}</span>
        </span>
        {children}
        <span className="w-28 text-right font-mono text-sm tabular-nums">{formatEUR(amount)}</span>
      </Link>
    </li>
  );
}
