import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { db } from "@/lib/dados";

/** Tipos de registro do diário (inspirado no Nello: crises, sono, comida, humor, conquistas, ABC). */
export const TIPOS_DIARIO: { k: string; l: string; emoji: string; cor: string }[] = [
  { k: "crise", l: "Crise", emoji: "🌩️", cor: "#E5484D" },
  { k: "comportamento", l: "Comportamento", emoji: "🧩", cor: "#F76B15" },
  { k: "sono", l: "Sono", emoji: "🌙", cor: "#6E56CF" },
  { k: "alimentacao", l: "Alimentação", emoji: "🍎", cor: "#30A46C" },
  { k: "humor", l: "Humor", emoji: "🙂", cor: "#1F5BFF" },
  { k: "sensorial", l: "Sensorial", emoji: "🎧", cor: "#0090FF" },
  { k: "medicacao", l: "Medicação", emoji: "💊", cor: "#D6409F" },
  { k: "terapia", l: "Terapia", emoji: "🗓️", cor: "#12A594" },
  { k: "escola", l: "Escola", emoji: "🎒", cor: "#AB4ABA" },
  { k: "conquista", l: "Conquista", emoji: "⭐", cor: "#FFB224" },
  { k: "saude", l: "Saúde", emoji: "🩺", cor: "#8E4EC6" },
  { k: "nota", l: "Anotação", emoji: "📝", cor: "#64748B" },
];
export const tipoInfo = (k: string) => TIPOS_DIARIO.find((t) => t.k === k) ?? { k, l: k, emoji: "📝", cor: "#64748B" };

export const HUMORES = ["😄 Muito bem", "🙂 Bem", "😐 Neutro", "😟 Agitado", "😢 Triste", "😡 Irritado"];
export const SENTIDOS = ["Auditivo", "Visual", "Tátil", "Olfativo", "Paladar", "Vestibular", "Proprioceptivo"];
export const GATILHOS = ["Barulho", "Mudança de rotina", "Transição", "Fome", "Sono", "Espera", "Lugar cheio", "Frustração", "Pedido negado", "Dor / desconforto", "Não identificado"];
export const ESTRATEGIAS = ["Acolhimento", "Espaço calmo", "Abafador", "Objeto de conforto", "Respiração", "Música", "Antecipação", "Pausa", "Água / lanche", "Contenção leve"];

export type Registro = {
  id: string; familia_id: string; filho_id: string | null; autor_id: string | null; autor_nome: string | null; origem: string | null;
  tipo: string; ocorrido_em: string; humor: string | null; intensidade: number | null; antecedente: string | null;
  comportamento: string | null; consequencia: string | null; sentido: string | null; busca_evita: string | null;
  nota: string | null; foto_path: string | null; created_at: string;
};

/** Família ativa no diário: a própria ou uma que compartilhou o diário com o e-mail do usuário. */
export function useFamiliaDiario() {
  const { familia, user, ready } = useAuth();
  const [opcoes, setOpcoes] = useState<{ id: string; rotulo: string; propria: boolean }[]>([]);
  const [ativa, setAtiva] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const lista: { id: string; rotulo: string; propria: boolean }[] = [];
      if (familia) lista.push({ id: familia.id, rotulo: "Minha família", propria: true });
      const { data } = await db.from("diario_compartilhamentos").select("familia_id").eq("ativo", true).ilike("email", user.email ?? "");
      (data ?? []).forEach((c: any, i: number) => { if (c.familia_id !== familia?.id) lista.push({ id: c.familia_id, rotulo: `Família convidada ${i + 1}`, propria: false }); });
      setOpcoes(lista);
      setAtiva((a) => a ?? lista[0]?.id ?? null);
      setPronto(true);
    })();
  }, [ready, user, familia]);
  const atual = opcoes.find((o) => o.id === ativa);
  return { opcoes, familiaId: ativa, setFamiliaId: setAtiva, propria: !!atual?.propria, pronto };
}

export async function urlFoto(path: string) {
  const { data } = await db.storage.from("diario-fotos").createSignedUrl(path, 3600);
  return data?.signedUrl as string | undefined;
}
