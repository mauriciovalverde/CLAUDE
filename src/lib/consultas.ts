/** Regras e textos compartilhados das teleconsultas. */

export const STATUS_CONSULTA: Record<string, [string, string]> = {
  agendada: ["Agendada", "blue"],
  confirmada: ["Confirmada", "green"],
  realizada: ["Realizada", "navy"],
  falta: ["Não compareceu", "amber"],
  cancelada_familia: ["Cancelada pela família", "red"],
  cancelada_profissional: ["Cancelada pelo profissional", "red"],
};

export const ATIVA = (s: string) => s === "agendada" || s === "confirmada";

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** A sala abre 15 minutos antes e fica disponível até 30 minutos depois do fim. */
export function salaAberta(inicio: string, fim: string, agora = Date.now()) {
  return agora >= new Date(inicio).getTime() - 15 * 60000 && agora <= new Date(fim).getTime() + 30 * 60000;
}

export function falta(inicio: string, agora = Date.now()) {
  const m = Math.round((new Date(inicio).getTime() - agora) / 60000);
  if (m <= 0) return "agora";
  if (m < 60) return `em ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `em ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "amanhã" : `em ${d} dias`;
}

/** Link para adicionar ao Google Agenda (abre no celular sem precisar de login no app). */
export function linkGoogleAgenda(titulo: string, inicio: string, fim: string, detalhes: string) {
  const f = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const q = new URLSearchParams({ action: "TEMPLATE", text: titulo, dates: `${f(inicio)}/${f(fim)}`, details: detalhes });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

export const DICAS_TELECONSULTA = [
  "Escolha um lugar reservado, onde ninguém escute a conversa.",
  "Use fones de ouvido e deixe o celular carregando.",
  "Teste a internet antes. No celular, o link abre direto no navegador.",
  "Entre na sala alguns minutos antes do horário.",
  "Anote antes o que você quer conversar.",
];

export type PsiPerfil = {
  user_id: string; nome: string; registro: string; abordagem: string | null; bio: string | null; foto_url: string | null;
  duracao_min: number; link_sala: string | null; aceita_novos: boolean; ativo: boolean;
};
