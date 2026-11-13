import { supabase } from './supabase';
import { q } from '../components/ui';

export const CATEGORIAS_PAGAR = ['Moradia', 'Energia', 'Água', 'Internet/Telefone', 'Mercado', 'Alimentação', 'Combustível', 'Transporte', 'Saúde', 'Educação', 'Cartão de crédito', 'Empréstimo/Financiamento', 'Assinaturas', 'Lazer', 'Impostos', 'Outros'];
export const CATEGORIAS_RECEBER = ['Salário', 'Renda extra', 'Aluguel recebido', 'Vendas', 'Reembolso', 'Outros'];
export const FORMAS_SONHO = ['Poupança', 'Consórcio', 'CDB', 'Tesouro Direto', 'Conta digital/caixinha', 'Investimento', 'Cofrinho/dinheiro', 'Outro'];

export async function uid() { return (await supabase.auth.getUser()).data.user!.id; }

export const carregar = {
  config: async () => {
    const { data } = await supabase.from('plan_config').select('*').maybeSingle();
    if (data) return data;
    const { data: novo } = await supabase.from('plan_config').insert({}).select().single();
    return novo;
  },
  contas: (de?: string, ate?: string) => {
    let x = supabase.from('plan_contas').select('*').is('excluido_em', null).order('vencimento');
    if (de) x = x.gte('vencimento', de);
    if (ate) x = x.lte('vencimento', ate);
    return q<any[]>(x);
  },
  pendentes: () => q<any[]>(supabase.from('plan_contas').select('*').is('excluido_em', null).eq('status', 'pendente').order('vencimento')),
  sonhos: async () => {
    const [s, m] = await Promise.all([
      q<any[]>(supabase.from('plan_sonhos').select('*').is('excluido_em', null).order('criado_em')),
      q<any[]>(supabase.from('plan_sonho_movs').select('*').order('data', { ascending: false })),
    ]);
    return s.map((x) => {
      const movs = m.filter((y) => y.sonho_id === x.id);
      return { ...x, movs, guardado: Math.round(movs.reduce((t, y) => t + Number(y.valor), 0) * 100) / 100 };
    });
  },
  caixa: async () => {
    const [cfg, pagas, movs, sonhos] = await Promise.all([
      carregar.config(),
      q<any[]>(supabase.from('plan_contas').select('*').is('excluido_em', null).eq('status', 'pago').not('pago_registrado_em', 'is', null)),
      q<any[]>(supabase.from('plan_sonho_movs').select('*')),
      q<any[]>(supabase.from('plan_sonhos').select('id,nome,emoji')),
    ]);
    // @ts-ignore módulo JS testado
    const { calcularCaixa } = await import('./caixa.js');
    return { cfg, ...(calcularCaixa(cfg, pagas, movs, Object.fromEntries(sonhos.map((s: any) => [s.id, s]))) as any) } as any;
  },
  faturas: () => q<any[]>(supabase.from('plan_faturas').select('*, plan_fatura_itens(*)').order('vencimento', { ascending: false })),
};

/** Cria uma conta única, mensal (repete N meses) ou parcelada (divide o total em N). */
export async function criarConta(p: { tipo: string; descricao: string; categoria: string; valor: number; vencimento: string; repeticao: 'unica' | 'mensal' | 'parcelada'; vezes: number; pago?: boolean }) {
  const grupo = crypto.randomUUID();
  const n = p.repeticao === 'unica' ? 1 : Math.max(1, Math.min(60, p.vezes));
  const base = p.repeticao === 'parcelada' ? Math.floor((p.valor / n) * 100) / 100 : p.valor;
  const [a, m, d] = p.vencimento.split('-').map(Number);
  const linhas = [];
  for (let k = 0; k < n; k++) {
    const dt = new Date(Date.UTC(a, m - 1 + k, 1));
    const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
    dt.setUTCDate(Math.min(d, ult));
    const valor = p.repeticao === 'parcelada' && k === n - 1 ? Math.round((p.valor - base * (n - 1)) * 100) / 100 : base;
    linhas.push({
      tipo: p.tipo, descricao: p.descricao.trim(), categoria: p.categoria, valor, vencimento: dt.toISOString().slice(0, 10),
      grupo_id: n > 1 ? grupo : null, parcela_num: p.repeticao === 'parcelada' ? k + 1 : null, parcela_total: p.repeticao === 'parcelada' ? n : null,
      status: k === 0 && p.pago ? 'pago' : 'pendente', pago_em: k === 0 && p.pago ? new Date().toISOString().slice(0, 10) : null, pago_registrado_em: k === 0 && p.pago ? new Date().toISOString() : null,
    });
  }
  const { error } = await supabase.from('plan_contas').insert(linhas);
  if (error) throw new Error(error.message);
  return linhas.length;
}
