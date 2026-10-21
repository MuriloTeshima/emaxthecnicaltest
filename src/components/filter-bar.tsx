"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface FilterSelect {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Filters live in the URL (?q=…&estado=…), so a filtered list can be
 * reloaded or shared, and the server does the filtering.
 */
export function FilterBar({
  searchPlaceholder,
  selects,
  values,
}: {
  searchPlaceholder: string;
  selects: FilterSelect[];
  values: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(values.q ?? "");

  function apply(patch: Record<string, string>) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...values, ...patch })) if (value) params.set(key, value);
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  }

  // Debounce typing so every keystroke does not hit the server.
  useEffect(() => {
    if (query === (values.q ?? "")) return;
    const timer = setTimeout(() => apply({ q: query }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const active = Object.values(values).some(Boolean);

  return (
    <div className={cn("mb-4 flex flex-col gap-2 transition-opacity sm:flex-row sm:flex-wrap sm:items-center", pending && "opacity-60")}>
      <div className="relative sm:w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label="Buscar" className="pl-8" />
      </div>
      {selects.map((select) => (
        <div key={select.name} className="sm:w-44">
          <NativeSelect aria-label={select.label} value={values[select.name] ?? ""} onChange={(e) => apply({ [select.name]: e.target.value })}>
            <option value="">{select.label}: todos</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}
      {active && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQuery("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
        >
          <X />
          Quitar filtros
        </Button>
      )}
    </div>
  );
}
