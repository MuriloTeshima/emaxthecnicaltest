import { Logo } from "@/components/app-shell/logo";
import { MobileNav } from "@/components/app-shell/mobile-nav";
import { NavLinks } from "@/components/app-shell/nav-links";
import { ResetDemoButton } from "@/components/app-shell/reset-demo-button";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 md:flex">
        <Logo />
        <NavLinks />
        <div className="mt-auto flex flex-col gap-1">
          <ResetDemoButton />
          <p className="px-2 text-xs text-muted-foreground">Datos ficticios de demostración.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur md:hidden">
          <MobileNav />
          <Logo />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
