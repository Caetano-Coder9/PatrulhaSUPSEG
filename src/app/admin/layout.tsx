"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  QrCode,
  Route,
  Users,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  LogOut,
  Menu,
  Shield,
  X,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

const nav = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/locations", label: "Postos", icon: MapPin },
  { href: "/admin/checkpoints", label: "Checkpoints", icon: QrCode },
  { href: "/admin/routes", label: "Rotas", icon: Route },
  { href: "/admin/agents", label: "Agentes", icon: Users },
  { href: "/admin/logs", label: "Logs de Ronda", icon: ClipboardList },
  { href: "/admin/incidents", label: "Ocorrências", icon: AlertTriangle },
  { href: "/admin/reports", label: "Relatórios", icon: BarChart3 },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex bg-navy">
      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#06101f] border-r border-[#1e3a5f] flex flex-col transition-transform lg:static lg:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-5 border-b border-[#1e3a5f] flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">SUPSEGPatrulha</div>
            <div className="text-xs text-gray-400">Painel Admin</div>
          </div>
          <button type="button" className="ml-auto text-gray-400 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  active
                    ? "bg-teal-600/20 text-teal-400 border border-teal-700/40"
                    : "text-gray-300 hover:bg-[#0f2744] hover:text-white"
                )}
                onClick={() => setMenuOpen(false)}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#1e3a5f]">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <button type="button" className="mb-4 inline-flex items-center gap-2 text-gray-300 hover:text-white lg:hidden" onClick={() => setMenuOpen(true)}>
            <Menu className="w-5 h-5" /> Menu
          </button>
          {children}
        </div>
      </main>
    </div>
  );
}
