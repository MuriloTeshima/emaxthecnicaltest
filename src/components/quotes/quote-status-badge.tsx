import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { QUOTE_STATUS_LABELS } from "@/schemas/quote";

type QuoteStatus = keyof typeof QUOTE_STATUS_LABELS;

const STYLES: Record<QuoteStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-sky-50 text-sky-700 border-sky-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  INVOICED: "bg-primary/10 text-primary border-primary/20",
};

export function QuoteStatusBadge({ status, expired }: { status: QuoteStatus; expired?: boolean }) {
  if (expired) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Caducado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn(STYLES[status])}>
      {QUOTE_STATUS_LABELS[status]}
    </Badge>
  );
}
