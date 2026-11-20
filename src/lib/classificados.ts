import { BadgePercent, BriefcaseBusiness, HandHeart, Store, type LucideIcon } from "lucide-react";
import { db } from "@/lib/dados";

export type Categoria = "emprego" | "negocio" | "cupom" | "profissional";
export const CATEGORIAS: { k: Categoria; nome: string; curto: string; I: LucideIcon; tom: string; desc: string }[] = [
  { k: "emprego", nome: "Empregos inclusivos", curto: "Empregos", I: BriefcaseBusiness, tom: "bg-primary-soft text-primary", desc: "Vagas com horário flexível, remotas, parciais ou perto de casa." },
  { k: "profissional", nome: "Profissionais e serviços adaptados", curto: "Especialistas", I: HandHeart, tom: "bg-success-soft text-success", desc: "Cuidadores, terapeutas, transporte adaptado, serviços em casa." },
  { k: "cupom", nome: "Cupons e descontos", curto: "Cupons", I: BadgePercent, tom: "bg-coral-soft text-coral", desc: "Descontos de estabelecimentos parceiros." },
  { k: "negocio", nome: "Empreendedores da comunidade", curto: "Negócios", I: Store, tom: "bg-warning-soft text-warning", desc: "Vitrine de pequenos negócios de famílias atípicas." },
];
export const cat = (k: string) => CATEGORIAS.find((c) => c.k === k) ?? CATEGORIAS[0];

export const SUBCATEGORIAS: Record<Categoria, string[]> = {
  emprego: ["Comércio", "Escritório", "Serviços gerais", "Saúde", "Educação", "Alimentação", "Atendimento", "Outro"],
  profissional: ["Cuidadores", "Psicólogos e terapeutas", "Acompanhante para consultas", "Transporte adaptado", "Salão de beleza", "Massagem e bem-estar", "Entrega de medicamentos", "Serviços domiciliares", "Aulas e reforço", "Outro"],
  cupom: ["Supermercados", "Farmácias", "Roupas e calçados", "Material pedagógico", "Produtos de acessibilidade", "Cuidado e higiene", "Saúde e bem-estar", "Outro"],
  negocio: ["Alimentação", "Artesanato", "Vestuário", "Serviços domésticos", "Aulas", "Consultoria", "Comércio", "Outro"],
};
/** Atalhos de busca rápida que aparecem junto às categorias. */
export const ATALHOS_SUB: [Categoria, string][] = [["profissional", "Cuidadores"], ["cupom", "Farmácias"], ["profissional", "Transporte adaptado"], ["cupom", "Supermercados"]];

export const CONDICOES = ["Horário flexível", "Trabalho remoto", "Jornada parcial", "Perto de casa", "Atendimento em casa", "Horário adaptado", "Ambiente calmo", "Aceita criança junto", "Acessível para cadeirantes", "Primeira consulta gratuita"];

export const DISTANCIAS = [1, 3, 5, 10, 20, 50, 100];
export const PRECOS: [string, string][] = [["", "Qualquer preço"], ["gratis", "Gratuito"], ["50", "Até R$ 50"], ["100", "Até R$ 100"], ["200", "Até R$ 200"], ["combinar", "A combinar"]];

export const STATUS_CLS: Record<string, [string, string]> = {
  pendente: ["Em análise", "amber"], aprovado: ["Publicado", "green"], rejeitado: ["Não aprovado", "red"], suspenso: ["Suspenso", "red"], encerrado: ["Encerrado", "navy"],
};

export type Anuncio = {
  id: string; user_id: string; categoria: Categoria; subcategoria: string | null; titulo: string; descricao: string; cidade: string; bairro: string | null; uf: string;
  lat: number | null; lng: number | null; valor: number | null; valor_tipo: string; horarios: string | null; condicoes: string[]; contato_chat: boolean; whatsapp: string | null;
  registro_prof: string | null; estabelecimento: string | null; cupom_regras: string | null; cupom_limite: number | null; cupom_usos: number; fotos: string[];
  validade: string; status: string; motivo: string | null; verificado: boolean; destaque: boolean; created_at: string; atualizado_em: string;
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: v % 1 ? 2 : 0 });
export function precoTxt(a: Pick<Anuncio, "valor" | "valor_tipo" | "categoria">) {
  if (a.valor_tipo === "gratis") return "Gratuito";
  if (a.valor_tipo === "nao_se_aplica") return null;
  if (a.valor_tipo === "a_combinar" || a.valor == null) return a.categoria === "emprego" ? "Salário a combinar" : "A combinar";
  return (a.valor_tipo === "a_partir" ? "A partir de " : "") + brl(Number(a.valor));
}
export const localTxt = (a: Pick<Anuncio, "cidade" | "bairro" | "uf">) => [a.bairro, `${a.cidade}, ${a.uf}`].filter(Boolean).join(" · ");

export function fotoUrl(path?: string | null) {
  if (!path) return null;
  return db.storage.from("classificados").getPublicUrl(path).data.publicUrl as string;
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
export function distanciaKm(a: [number, number], b: [number, number]) {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLa = rad(b[0] - a[0]), dLo = rad(b[1] - a[1]);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const kmTxt = (k: number) => (k < 1 ? "menos de 1 km" : `${k < 10 ? k.toFixed(1).replace(".", ",") : Math.round(k)} km`);

export const vencido = (a: Pick<Anuncio, "validade">) => a.validade < new Date().toISOString().slice(0, 10);
export const diasRestantes = (validade: string) => Math.ceil((new Date(validade + "T23:59:59").getTime() - Date.now()) / 864e5);

/** Reduz a foto (máx. 1600 px, JPEG) e envia para a pasta do próprio usuário. */
export async function enviarFoto(uid: string, f: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error("Envie fotos em JPG, PNG ou WEBP.");
  let arq: Blob = f;
  try {
    const bmp = await createImageBitmap(f);
    const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const b: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (b && b.size < f.size) arq = b;
  } catch { /* usa o original */ }
  if (arq.size > 5 * 1024 * 1024) throw new Error("Foto acima de 5 MB.");
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("classificados").upload(path, arq, { contentType: arq.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}
