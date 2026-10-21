import { LayoutDashboard, type LucideIcon, Landmark, Receipt, FileText, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/impuestos", label: "Impuestos", icon: Landmark },
  { href: "/contactos", label: "Contactos", icon: Users },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
