import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SECOES_PADRAO } from "@/lib/conteudo-padrao";

export const db = supabase as any;

export function useConfig() {
  const [cfg, setCfg] = useState<Record<string, string> & { _ok?: boolean }>({});
  useEffect(() => {
    db.from("configuracoes").select("chave,valor").then(({ data }: any) => {
      const o: Record<string, string> = {};
      (data ?? []).forEach((r: any) => (o[r.chave] = r.valor));
      setCfg({ ...o, _ok: true } as any);
    });
  }, []);
  return cfg;
}

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const run = useCallback(async () => {
    setLoading(true);
    try { setData(await fn()); setErro(null); } catch (e: any) { setErro(e?.message ?? "Erro ao carregar"); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, loading, erro, recarregar: run, setData };
}

export type Secao = { id: string; slug: string; titulo: string; descricao: string | null; icone: string | null; ordem: number; aviso: string | null };
export type Topico = { id: string; secao_id: string; titulo: string; conteudo: string; video_url: string | null; fontes: { nome: string; url: string }[]; ordem: number };

/** Lê a seção do banco; se o admin ainda não carregou o conteúdo, usa o conteúdo padrão embutido. */
export async function carregarSecao(slug: string): Promise<{ secao: Secao; topicos: Topico[]; padrao: boolean } | null> {
  const { data: s } = await db.from("secoes").select("*").eq("slug", slug).maybeSingle();
  if (s) {
    const { data: t } = await db.from("topicos").select("*").eq("secao_id", s.id).order("ordem");
    return { secao: s, topicos: t ?? [], padrao: false };
  }
  const p = SECOES_PADRAO.find((x) => x.slug === slug);
  if (!p) return null;
  return {
    secao: { id: p.slug, slug: p.slug, titulo: p.titulo, descricao: p.descricao, icone: p.icone, ordem: p.ordem, aviso: p.aviso },
    topicos: p.topicos.map((t, i) => ({ ...t, id: `${p.slug}-${i}`, secao_id: p.slug })),
    padrao: true,
  };
}

export function separarCategoria(titulo: string) {
  const m = titulo.match(/^\[(.+?)\]\s*(.*)$/);
  return m ? { cat: m[1], titulo: m[2] } : { cat: null, titulo };
}

export function youtubeEmbed(url?: string | null) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}

export async function registrarAcesso(slug: string) {
  try { await db.rpc("registrar_acesso", { _slug: slug }); } catch { /* silencioso */ }
}

export type Filho = { id: string; nome: string; nascimento: string | null; sexo: string | null };
export function useFilhos(familiaId?: string) {
  return useQuery<Filho[]>(async () => {
    if (!familiaId) return [];
    const { data } = await db.from("filhos").select("id,nome,nascimento,sexo").eq("familia_id", familiaId).order("created_at");
    return data ?? [];
  }, [familiaId]);
}
