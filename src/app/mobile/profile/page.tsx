"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(data);
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-bold text-white">Perfil</h1>
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-teal-600/30 flex items-center justify-center">
          <User className="w-7 h-7 text-teal-400" />
        </div>
        <div>
          <div className="font-semibold text-white">{profile?.full_name ?? "…"}</div>
          <div className="text-sm text-gray-400">{profile?.email}</div>
          <div className="text-xs text-teal-400 mt-1 capitalize">{profile?.role}</div>
        </div>
      </div>
      {profile?.shift_info && (
        <div className="card text-sm text-gray-300">
          <span className="text-gray-500">Turno: </span>
          {profile.shift_info}
        </div>
      )}
      {profile?.phone_number && (
        <div className="card text-sm text-gray-300">
          <span className="text-gray-500">Telefone: </span>
          {profile.phone_number}
        </div>
      )}
      <button className="btn-danger w-full flex items-center justify-center gap-2" onClick={logout}>
        <LogOut className="w-5 h-5" /> Sair
      </button>
    </div>
  );
}
