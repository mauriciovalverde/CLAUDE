/** Regras e textos compartilhados das teleconsultas. */

export const STATUS_CONSULTA: Record<string, [string, string]> = {
  pendente: ["Aguardando confirmação", "amber"],
  agendada: ["Aguardando confirmação", "amber"],
  confirmada: ["Confirmada", "green"],
  recusada: ["Horário recusado", "red"],
  reagendada: ["Reagendada", "navy"],
  realizada: ["Realizada", "navy"],
  falta: ["Não compareceu", "amber"],
  cancelada_familia: ["Cancelada pela família", "red"],
  cancelada_profissional: ["Cancelada pelo profissional", "red"],
};

export const ATIVA = (s: string) => s === "pendente" || s === "confirmada";

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
  especialidades: string[]; modalidades: string[]; intervalo_min: number; antecedencia_horas: number; endereco_presencial: string | null;
};

export const MODALIDADE: Record<string, string> = { online: "Online (vídeo)", presencial: "Presencial" };

export const ESPECIALIDADES_SUGERIDAS = [
  "Autismo (TEA)", "TDAH", "Ansiedade", "Depressão", "Luto", "Orientação parental", "Terapia de casal", "Terapia familiar",
  "Infantil", "Adolescentes", "Adultos", "Neuropsicologia", "Análise do Comportamento (ABA)", "TCC", "Psicanálise", "Recém-diagnóstico",
];

/** Mensagem padrão enviada ao WhatsApp do Centro. Abrir o WhatsApp não confirma a consulta. */
export function mensagemWhatsApp(d: { nome: string; nascimento: string | null; telefone: string | null; psicologo: string; inicio: string; modalidade: string }) {
  const nasc = d.nascimento ? new Date(d.nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "não informada";
  const data = new Date(d.inicio).toLocaleDateString("pt-BR", { timeZone: "America/Bahia" });
  const hora = new Date(d.inicio).toLocaleTimeString("pt-BR", { timeZone: "America/Bahia", hour: "2-digit", minute: "2-digit" });
  const tel = d.telefone ? d.telefone.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : "não informado";
  return [
    "*QUERO CONFIRMAR MINHA CONSULTA*",
    "",
    "*Dados do paciente:*",
    `• Nome: ${d.nome}`,
    `• Data de nascimento: ${nasc}`,
    `• Telefone: ${tel}`,
    "",
    "*Dados da consulta:*",
    `• Psicólogo: ${d.psicologo}`,
    `• Data pretendida: ${data}`,
    `• Horário: ${hora}`,
    `• Modalidade: ${d.modalidade === "presencial" ? "Presencial" : "Online"}`,
    "",
    "Solicito a confirmação da disponibilidade para esta consulta.",
  ].join("\n");
}
