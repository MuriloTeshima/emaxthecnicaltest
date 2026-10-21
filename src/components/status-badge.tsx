import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DisplayStatus = "PAID" | "PENDING" | "OVERDUE";

const CONFIG: Record<DisplayStatus, { label: string; className: string }> = {
  PAID: { label: "Cobrada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  OVERDUE: { label: "Vencida", className: "bg-red-50 text-red-700 border-red-200" },
};

export function StatusBadge({
  status,
  labels,
}: {
  status: DisplayStatus;
  /** Expenses say "Pagado" instead of "Cobrada". */
  labels?: Partial<Record<DisplayStatus, string>>;
}) {
  const { label, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={cn(className)}>
      {labels?.[status] ?? label}
    </Badge>
  );
}
