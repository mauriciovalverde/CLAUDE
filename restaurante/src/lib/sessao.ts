// Sessão da equipe: o aparelho lembra o CÓDIGO do restaurante; cada pessoa entra tocando no nome e digitando o PIN.
import { createContext, useContext } from 'react';
import { funcao, supabase } from './supabase';

export type Papel = 'admin' | 'compras' | 'solicitante' | 'caixa' | 'estoque';
export type Eu = { id: string; nome: string; papeis: Papel[]; setor: string | null; restaurante_id: string };
export type Restaurante = { id: string; nome: string; codigo: string; logo_path: string | null; saldo_inicial: number; saldo_em: string; agenda_token: string; cnpj?: string; telefone?: string; endereco?: string };
export type Contexto = { eu: Eu; rest: Restaurante; pode: (p: Papel) => boolean; recarregar: () => void };

export const PAPEIS: { id: Papel; nome: string; desc: string }[] = [
  { id: 'admin', nome: 'Administrador', desc: 'Acesso total: financeiro, equipe, relatórios e configurações' },
  { id: 'compras', nome: 'Responsável pelas compras', desc: 'Recebe solicitações, aprova, registra compras e notas, cadastra fornecedores' },
  { id: 'solicitante', nome: 'Pede produtos', desc: 'Escolhe produtos por categoria e envia solicitações' },
  { id: 'caixa', nome: 'Operador de caixa', desc: 'Faz o fechamento do caixa do seu turno' },
  { id: 'estoque', nome: 'Estoque', desc: 'Registra entradas, saídas e inventário' },
];

const CHAVE = 'rest-aparelho';
type Aparelho = { codigo: string; nome: string; ultimo?: string };
export function lerAparelho(): Aparelho | null { try { const s = localStorage.getItem(CHAVE); return s ? JSON.parse(s) : null; } catch { return null; } }
export function guardarAparelho(a: Aparelho | null) { try { if (a) localStorage.setItem(CHAVE, JSON.stringify(a)); else localStorage.removeItem(CHAVE); } catch { /* ignore */ } }

export async function buscarEquipe(codigo: string) {
  const r = await funcao('rest-acesso', { acao: 'equipe', codigo: codigo.trim().toUpperCase() });
  if (!r.ok) throw new Error(r.mensagem ?? 'Não consegui consultar o restaurante. Confira a internet.');
  return r as { restaurante: { nome: string; codigo: string; logo_path: string | null }; equipe: { id: string; nome: string }[] };
}

async function abrirSessao(s: { access_token: string; refresh_token: string }) {
  const { error } = await supabase.auth.setSession(s);
  if (error) throw new Error(error.message);
}

export async function entrar(codigo: string, funcionarioId: string, pin: string) {
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  const r = await funcao('rest-acesso', { acao: 'entrar', codigo, funcionario_id: funcionarioId, pin });
  if (!r.ok) throw new Error(r.mensagem ?? 'Não consegui entrar.');
  await abrirSessao(r.sessao);
}

export async function criarRestaurante(nome: string, adminNome: string, pin: string) {
  const r = await funcao('rest-acesso', { acao: 'criar_restaurante', nome, admin_nome: adminNome, pin });
  if (!r.ok) throw new Error(r.mensagem ?? 'Não consegui criar o restaurante.');
  guardarAparelho({ codigo: r.codigo, nome: r.restaurante.nome, ultimo: r.funcionario_id });
  await abrirSessao(r.sessao);
  return r.codigo as string;
}

/** Sai (o aparelho continua lembrando o restaurante para a próxima pessoa). */
export async function sair() { await supabase.auth.signOut({ scope: 'local' }).catch(() => {}); }

export async function carregarContexto(): Promise<{ eu: Eu; rest: Restaurante } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: eu } = await supabase.from('rest_funcionarios').select('id,nome,papeis,setor,restaurante_id').eq('user_id', user.id).eq('ativo', true).maybeSingle();
  if (!eu) return null;
  const { data: rest } = await supabase.from('rest_restaurantes').select('*').eq('id', eu.restaurante_id).single();
  return { eu: eu as Eu, rest: rest as Restaurante };
}

export const Ctx = createContext<Contexto | null>(null);
export function useEu() { const c = useContext(Ctx); if (!c) throw new Error('sem sessão'); return c; }
