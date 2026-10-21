import { FileSignature, FileText, Landmark, LayoutDashboard, type LucideIcon, Receipt, Settings, Users, Wallet } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/presupuestos", label: "Presupuestos", icon: FileSignature },
  { href: "/facturas", label: "Facturas", icon: FileText },
  { href: "/gastos", label: "Gastos", icon: Receipt },
  { href: "/bancos", label: "Bancos", icon: Wallet },
  { href: "/impuestos", label: "Impuestos", icon: Landmark },
  { href: "/contactos", label: "Contactos", icon: Users },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
