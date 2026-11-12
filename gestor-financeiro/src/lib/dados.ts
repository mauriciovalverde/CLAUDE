import { supabase } from './supabase';
import { q } from '../components/ui';

export const carregar = {
  clientes: () => q<any[]>(supabase.from('v_clientes_resumo').select('*').order('nome')),
  produtos: () => q<any[]>(supabase.from('produtos').select('*').is('excluido_em', null).order('nome')),
  fornecedores: () => q<any[]>(supabase.from('fornecedores').select('*').is('excluido_em', null).order('nome')),
  categorias: () => q<any[]>(supabase.from('categorias').select('*').is('excluido_em', null).order('nome')),
  contas: () => q<any[]>(supabase.from('v_saldo_contas').select('*').order('nome')),
  obrigacoes: (f: { de?: string; ate?: string; tipo?: string; escopo?: string; origem?: string; abertas?: boolean; cliente?: string } = {}) => {
    let x = supabase.from('v_obrigacoes').select('*').order('vencimento');
    if (f.de) x = x.gte('vencimento', f.de);
    if (f.ate) x = x.lte('vencimento', f.ate);
    if (f.tipo) x = x.eq('tipo', f.tipo);
    if (f.escopo) x = x.eq('escopo', f.escopo);
    if (f.origem) x = x.eq('origem', f.origem);
    if (f.cliente) x = x.eq('cliente_id', f.cliente);
    if (f.abertas) x = x.in('situacao', ['pendente', 'parcial', 'atrasado']);
    return q<any[]>(x);
  },
  lancamentos: (de: string, ate: string) => q<any[]>(supabase.from('lancamentos').select('*, categorias(nome,slug,tipo)').is('excluido_em', null).gte('data', de).lte('data', ate).order('data')),
  vendas: (de: string, ate: string) => q<any[]>(supabase.from('vendas').select('*, clientes(nome,telefone), venda_itens(quantidade,preco_unitario,total,custo_unitario,produtos(nome))').is('excluido_em', null).gte('data', de).lte('data', ate).order('data', { ascending: false })),
  compras: (de: string, ate: string) => q<any[]>(supabase.from('compras').select('*, fornecedores(nome), compra_itens(quantidade,custo_unitario,total,produtos(nome),lotes(lote,validade))').is('excluido_em', null).gte('data', de).lte('data', ate).order('data', { ascending: false })),
  emprestimos: () => q<any[]>(supabase.from('emprestimos').select('*, clientes(nome,telefone)').is('excluido_em', null).order('data', { ascending: false })),
  vendasMensal: () => q<any[]>(supabase.from('v_vendas_mensal').select('*').order('mes')),
  alertas: () => q<any[]>(supabase.from('v_estoque_alertas').select('*')),
  pagamentos: (de: string, ate: string) => q<any[]>(supabase.from('pagamentos').select('*, obrigacoes(tipo,escopo,origem,descricao,cliente_id)').is('estornado_em', null).gte('data', de).lte('data', ate)),
  contracheques: () => q<any[]>(supabase.from('contracheques').select('*, contracheque_itens(*)').is('excluido_em', null).order('competencia')),
  config: () => q<any>(supabase.from('configuracoes').select('*').maybeSingle()),
};

export const somar = (a: any[] | null | undefined, k: string, f: (x: any) => boolean = () => true) =>
  (a ?? []).filter(f).reduce((t, x) => t + Number(x[k] ?? 0), 0);

export function porMes<T>(lista: T[], data: (x: T) => string, valor: (x: T) => number) {
  const m = new Map<string, number>();
  for (const x of lista) { const k = data(x).slice(0, 7); m.set(k, (m.get(k) ?? 0) + valor(x)); }
  return m;
}
export function mesesEntre(de: string, ate: string) {
  const out: string[] = []; const d = new Date(de.slice(0, 7) + '-01T12:00:00Z'); const fim = ate.slice(0, 7);
  while (d.toISOString().slice(0, 7) <= fim && out.length < 60) { out.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); }
  return out;
}
