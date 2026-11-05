import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Papel = "familia" | "profissional" | "equipe" | "admin";
export type Familia = {
  id: string; numero: string | null; status: "pendente" | "aprovado" | "recusado"; motivo_recusa: string | null;
  mae_nome: string; cidade: string | null; uf: string | null; [k: string]: unknown;
};
export type Perfil = { id: string; nome_chamada: string | null; email: string | null; telefone: string | null };

type Ctx = {
  ready: boolean; session: Session | null; user: User | null; perfil: Perfil | null; papeis: Papel[];
  familia: Familia | null; isStaff: boolean; isAdmin: boolean; refresh: () => Promise<void>; sair: () => Promise<void>;
};
const AuthCtx = createContext<Ctx | null>(null);
const db = supabase as any;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [papeis, setPapeis] = useState<Papel[]>([]);
  const [familia, setFamilia] = useState<Familia | null>(null);

  const carregar = useCallback(async (s: Session | null) => {
    if (!s?.user) { setPerfil(null); setPapeis([]); setFamilia(null); return; }
    const uid = s.user.id;
    const [p, r, f] = await Promise.all([
      db.from("perfis").select("id,nome_chamada,email,telefone").eq("id", uid).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", uid),
      db.from("familias").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setPerfil(p.data ?? null);
    setPapeis((r.data ?? []).map((x: { role: Papel }) => x.role));
    setFamilia(f.data ?? null);
  }, []);

  useEffect(() => {
    let vivo = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSession(data.session);
      await carregar(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => carregar(s), 0);
    });
    return () => { vivo = false; sub.subscription.unsubscribe(); };
  }, [carregar]);

  const refresh = useCallback(async () => { await carregar(session); }, [carregar, session]);
  const sair = useCallback(async () => { await supabase.auth.signOut(); setSession(null); await carregar(null); }, [carregar]);
  const isAdmin = papeis.includes("admin");
  const isStaff = isAdmin || papeis.includes("equipe");

  return (
    <AuthCtx.Provider value={{ ready, session, user: session?.user ?? null, perfil, papeis, familia, isStaff, isAdmin, refresh, sair }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}

export function nomeExibicao(perfil: Perfil | null, user: User | null) {
  return (perfil?.nome_chamada || (user?.user_metadata?.nome_chamada as string) || user?.email?.split("@")[0] || "").split(" ")[0];
}
