"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AgentsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").order("full_name").then(({ data }) => setRows(data ?? []));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Agentes</h1>
      <p className="text-sm text-gray-400">
        Usuários são criados no Supabase Auth. O profile é gerado automaticamente.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[#1e3a5f]">
              <th className="pb-3 pr-4">Nome</th>
              <th className="pb-3 pr-4">E-mail</th>
              <th className="pb-3 pr-4">Função</th>
              <th className="pb-3 pr-4">Telefone</th>
              <th className="pb-3">Turno</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[#1e3a5f]/40">
                <td className="py-3 pr-4 font-medium text-white">{r.full_name}</td>
                <td className="py-3 pr-4 text-gray-300">{r.email}</td>
                <td className="py-3 pr-4">
                  <span className={`status-badge ${r.role === "admin" ? "bg-purple-900/50 text-purple-300" : "bg-teal-900/50 text-teal-300"}`}>
                    {r.role}
                  </span>
                </td>
                <td className="py-3 pr-4 text-gray-400">{r.phone_number ?? "—"}</td>
                <td className="py-3 text-gray-400">{r.shift_info ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
