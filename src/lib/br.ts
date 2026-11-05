// Utilidades brasileiras: CPF, telefone, CEP, datas.
export const digits = (s: string | null | undefined) => String(s ?? "").replace(/\D/g, "");

export function cpfValido(v: string) {
  const c = digits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  let d = ((s * 10) % 11) % 10;
  if (d !== +c[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  d = ((s * 10) % 11) % 10;
  return d === +c[10];
}
export const fmtCPF = (v: string) => {
  const c = digits(v).slice(0, 11);
  return c.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};
export const mascaraCPF = (v: string) => {
  const c = digits(v);
  return c.length === 11 ? `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**` : "—";
};
export const fmtTel = (v: string) => {
  const c = digits(v).slice(0, 11);
  if (c.length <= 2) return c;
  if (c.length <= 6) return `(${c.slice(0, 2)}) ${c.slice(2)}`;
  if (c.length <= 10) return `(${c.slice(0, 2)}) ${c.slice(2, 6)}-${c.slice(6)}`;
  return `(${c.slice(0, 2)}) ${c.slice(2, 7)}-${c.slice(7)}`;
};
export const telValido = (v: string) => [10, 11].includes(digits(v).length);
export const fmtCEP = (v: string) => {
  const c = digits(v).slice(0, 8);
  return c.length > 5 ? `${c.slice(0, 5)}-${c.slice(5)}` : c;
};
export const emailValido = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const dataValida = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
  const d = new Date(s + "T12:00:00");
  return d.getFullYear() > 1900 && d <= new Date();
};
export const idade = (s?: string | null) => {
  if (!s) return null;
  const b = new Date(s + "T12:00:00"), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
export const fData = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
export const fDataLonga = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fHora = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const fDataHora = (iso: string | Date) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const paraInputLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export function baixarArquivo(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}
export const csv = (linhas: (string | number | null | undefined)[][]) =>
  "﻿" + linhas.map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");

export const WHATSAPP_PADRAO = "5573933002471";
export const MSG_CONFIRMACAO_PADRAO = "Quero confirmar meu cadastro!";
export const waLink = (numero: string, msg?: string) =>
  `https://wa.me/${digits(numero)}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
export const TERMOS_VERSAO = "1.0";

export const DIAGNOSTICOS = [
  "TEA (autismo)", "TDAH", "Síndrome de Down", "Deficiência intelectual", "Deficiência física",
  "Deficiência auditiva", "Deficiência visual", "Paralisia cerebral", "Atraso no desenvolvimento",
  "Doença rara", "Outra condição", "Em investigação",
];
export const TERAPIAS = ["Fonoaudiologia","Terapia ocupacional","Psicologia","Psicopedagogia","Fisioterapia","Musicoterapia","Equoterapia","Hidroterapia","Nutrição","ABA"];
export const CATEGORIAS_DIRETORIO: [string, string][] = [
  ["clinicas","Clínicas"],["psicologos","Psicólogos"],["fonoaudiologos","Fonoaudiólogos"],
  ["terapeutas_ocupacionais","Terapeutas ocupacionais"],["neuropediatras","Neuropediatras"],
  ["nutricionistas","Nutricionistas"],["associacoes","Associações"],["instituicoes_apoio","Instituições de apoio"],
  ["servicos_publicos","Serviços públicos"],["projetos_sociais","Projetos sociais"],
];
export const nomeCategoria = (k: string) => CATEGORIAS_DIRETORIO.find((c) => c[0] === k)?.[1] ?? k;

/** Endereço completo dentro do app (funciona no Lovable e em subpasta, ex.: GitHub Pages). */
export const urlApp = (p: string) => window.location.origin + String(import.meta.env.BASE_URL || "/").replace(/\/$/, "") + p;
