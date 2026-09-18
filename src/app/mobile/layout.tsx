"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ScanLine, AlertTriangle, RefreshCw, User, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPendingCount, startAutoSync, isOnline } from "@/lib/offline/sync";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: "/mobile/home", label: "Início", icon: Home },
  { href: "/mobile/scan", label: "Escanear", icon: ScanLine },
  { href: "/mobile/incident", label: "Ocorrência", icon: AlertTriangle },
  { href: "/mobile/sync", label: "Sync", icon: RefreshCw },
  { href: "/mobile/profile", label: "Perfil", icon: User },
];

export default function MobileLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(isOnline());
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const stop = startAutoSync(20000);
    const tick = () => getPendingCount().then(setPending);
    tick();
    const id = setInterval(tick, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      stop();
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-navy max-w-lg mx-auto">
      {/* Status bar */}
      <div className="sticky top-0 z-40 bg-[#06101f]/95 backdrop-blur border-b border-[#1e3a5f] px-4 py-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-white">SUPSEGPatrulha</span>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="text-yellow-400 font-medium">{pending} pendente{pending > 1 ? "s" : ""}</span>
          )}
          {online ? (
            <span className="flex items-center gap-1 text-green-400">
              <Wifi className="w-3.5 h-3.5" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400">
              <WifiOff className="w-3.5 h-3.5" /> Offline
            </span>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#06101f] border-t border-[#1e3a5f] safe-area-pb">
        <div className="flex items-stretch">
          {tabs.map((t) => {
            const active = pathname.startsWith(t.href);
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors",
                  active ? "text-teal-400" : "text-gray-500"
                )}
              >
                <Icon className={cn("w-6 h-6", active && "text-teal-400")} />
                {t.label}
                {t.href === "/mobile/sync" && pending > 0 && (
                  <span className="absolute top-2 right-[18%] w-4 h-4 bg-yellow-500 text-[9px] text-black font-bold rounded-full flex items-center justify-center">
                    {pending > 9 ? "9+" : pending}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
