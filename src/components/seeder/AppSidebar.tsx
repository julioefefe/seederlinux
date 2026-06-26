import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  Layers,
  Settings2,
  Network,
  Variable,
  Monitor,
  History,
  Users,
  Palette,
  Shield,
  Globe,
  Printer,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthProvider";

const MODE = ((import.meta.env.VITE_SEEDER_MODE as string) || "full").toLowerCase();
const HUB_ONLY = new Set(["/painel", "/painel/hub", "/painel/auditoria", "/painel/usuarios", "/painel/configuracoes"]);

const NAV_SECTIONS = [
  {
    title: "Visao Geral",
    items: [
      { to: "/painel", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/painel/organizacoes", label: "Organizacoes", icon: Building2 },
    ],
  },
  {
    title: "Operacoes",
    items: [
      { to: "/painel/estacoes", label: "Estacoes", icon: Monitor },
      { to: "/painel/scripts", label: "Scripts", icon: ScrollText },
      { to: "/painel/perfis", label: "Perfis de Deploy", icon: Layers },
      { to: "/painel/variaveis", label: "Variaveis", icon: Variable },
    ],
  },
  {
    title: "Personalizacao",
    items: [
      { to: "/painel/branding", label: "Identidade Visual", icon: Palette },
      { to: "/painel/navegadores", label: "Politicas Browser", icon: Globe },
      { to: "/painel/impressoras", label: "Impressoras", icon: Printer },
      { to: "/painel/desktop", label: "Politicas Desktop", icon: Cpu },
    ],
  },
  {
    title: "Sistema",
    items: [
      { to: "/painel/hub", label: "SeederHub", icon: Network },
      { to: "/painel/auditoria", label: "Auditoria", icon: History },
      { to: "/painel/usuarios", label: "Usuarios", icon: Users, adminOnly: true },
      { to: "/painel/seguranca", label: "Seguranca", icon: Shield },
      { to: "/painel/configuracoes", label: "Configuracoes", icon: Settings2 },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { hasRole } = useAuth();

  const filteredSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items
      .filter((i) => !i.adminOnly || hasRole("admin_gap"))
      .filter((i) => MODE !== "hub" || HUB_ONLY.has(i.to)),
  })).filter((section) => section.items.length > 0);

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <Link to="/" className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border">
        <img src="/seederlinux-logo.png" alt="SeederLinux" className="size-10 object-contain drop-shadow" />
        <div className="flex flex-col leading-tight">
          <span className="font-display font-bold text-base tracking-tight">SeederLinux</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">
            v3.0 · FAB
          </span>
        </div>
      </Link>

      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {filteredSections.map((section) => (
          <div key={section.title}>
            <div className="px-3 text-[10px] uppercase tracking-[0.16em] text-sidebar-foreground/50 font-medium mb-1.5">
              {section.title}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = item.exact
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as "/painel"}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                      active
                        ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
        <div className="font-mono">v3.0 · {MODE === "hub" ? "Hub" : "Full"}</div>
        <div>built for institutions · open by design</div>
      </div>
    </aside>
  );
}
