import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { rpc, supabase } from '../lib/supabase';
// @ts-ignore módulo JS testado
import { categorizar, chaveFornecedor, chaveProduto, nomePadrao, UNIDADES } from '../lib/catalogo.js';
import { brl, FORMAS_PAGAMENTO, hoje, lerNum, addDias } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Campo, Dinheiro, Input, Modal, q, Select, toast, useDados } from './ui';

export type LinhaCompra = { produto_id?: string | null; nome: string; quantidade: string; unidade: string; unit: string; total: string; solicitacao_item_id?: string | null; descricao_original?: string };
export type InicialCompra = { data?: string; fornecedor?: string; cnpj?: string; itens?: LinhaCompra[]; desconto?: string; solicitacao_id?: string; nota_id?: string; nota_numero?: string; forma?: string; vencimento?: string; origem?: string; titulo?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;
export const linhaVazia = (): LinhaCompra => ({ nome: '', quantidade: '', unidade: 'un', unit: '', total: '' });

/** Formulário de compra REALIZADA (não confundir com solicitação). Gera a conta a pagar sem duplicar. */
export default function FormCompra({ inicial, fechar, aoSalvar }: { inicial?: InicialCompra; fechar: () => void; aoSalvar?: (r: any) => void }) {
  const { dados: produtos } = useDados(() => q<any[]>(supabase.from('rest_produtos').select('id,nome,chave,unidade,categoria').neq('status', 'inativo').order('nome')), []);
  const { dados: fornecedores } = useDados(() => q<any[]>(supabase.from('rest_fornecedores').select('id,nome,chave,cnpj').eq('ativo', true).order('nome')), []);
  const [data, setData] = useState(inicial?.data ?? hoje());
  const [forn, setForn] = useState(inicial?.fornecedor ?? '');
  const [itens, setItens] = useState<LinhaCompra[]>(inicial?.itens?.length ? inicial.itens : [linhaVazia()]);
  const [desconto, setDesconto] = useState(inicial?.desconto ?? '');
  const [pago, setPago] = useState(inicial?.vencimento ? 'prazo' : 'agora');
  const [forma, setForma] = useState(inicial?.forma ?? 'PIX');
  const [venc, setVenc] = useState(inicial?.vencimento ?? addDias(hoje(), 7));
  const [parcelas, setParcelas] = useState('1');
  const [chegou, setChegou] = useState(true);
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const porChave = useMemo(() => new Map((produtos ?? []).map((p) => [p.chave, p])), [produtos]);

  const mudar = (k: number, campo: keyof LinhaCompra, v: string) => setItens((l) => l.map((x, i) => {
    if (i !== k) return x;
    const n = { ...x, [campo]: v };
    if (campo === 'nome') { const p = porChave.get(chaveProduto(v)); n.produto_id = p?.id ?? null; if (p) n.unidade = p.unidade; }
    const qn = lerNum(n.quantidade), un = lerNum(n.unit);
    if ((campo === 'quantidade' || campo === 'unit') && qn > 0 && un > 0) n.total = String(r2(qn * un)).replace('.', ',');
    if (campo === 'total' && qn > 0 && lerNum(v) > 0) n.unit = String(Math.round((lerNum(v) / qn) * 100) / 100).replace('.', ',');
    return n;
  }));
  const validos = itens.filter((i) => i.nome.trim() && lerNum(i.total) > 0);
  const subtotal = r2(validos.reduce((t, i) => t + lerNum(i.total), 0));
  const total = r2(subtotal - (lerNum(desconto) || 0));
  const fornExistente = (fornecedores ?? []).find((f) => f.chave === chaveFornecedor(forn));

  const salvar = async () => {
    if (!forn.trim()) { toast('Informe o fornecedor', 'erro'); return; }
    if (!validos.length) { toast('Informe pelo menos um item com valor', 'erro'); return; }
    if (total <= 0) { toast('O total precisa ser maior que zero', 'erro'); return; }
    setSalvando(true);
    try {
      const r = await rpc('rest_registrar_compra', { p: {
        data, fornecedor_id: fornExistente?.id ?? null, fornecedor_nome: forn.trim(), fornecedor_chave: chaveFornecedor(forn), cnpj: inicial?.cnpj ?? null,
        desconto: lerNum(desconto) || 0, pago: pago === 'agora', forma_pagamento: forma, vencimento: pago === 'prazo' ? venc : null, parcelas: pago === 'prazo' ? Number(parcelas) : 1,
        solicitacao_id: inicial?.solicitacao_id ?? null, nota_id: inicial?.nota_id ?? null, nota_numero: inicial?.nota_numero ?? null, origem: inicial?.origem ?? 'manual', obs: obs || null, recebida: chegou,
        itens: validos.map((i) => {
          const p = i.produto_id ? (produtos ?? []).find((x) => x.id === i.produto_id) : porChave.get(chaveProduto(i.nome));
          return {
            produto_id: p?.id ?? null, nome: p ? p.nome : nomePadrao(i.nome), chave: chaveProduto(i.nome), categoria: p?.categoria ?? categorizar(i.nome), unidade: i.unidade,
            descricao_original: i.descricao_original ?? i.nome.trim(), quantidade: lerNum(i.quantidade) || null, peso_kg: i.unidade === 'kg' ? (lerNum(i.quantidade) || null) : null,
            valor_unitario: lerNum(i.unit) || null, valor_total: lerNum(i.total), solicitacao_item_id: i.solicitacao_item_id ?? null,
          };
        }),
      } });
      toast(`Compra #${r.numero} registrada: ${brl(r.total)}${chegou ? ' · estoque atualizado' : ''}`);
      avisarMudanca(); aoSalvar?.(r); fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };

  return (
    <Modal aberto fechar={fechar} titulo={inicial?.titulo ?? 'Registrar compra realizada'} largo>
      <datalist id="lista-produtos">{(produtos ?? []).map((p) => <option key={p.id} value={p.nome} />)}</datalist>
      <datalist id="lista-fornecedores">{(fornecedores ?? []).map((f) => <option key={f.id} value={f.nome} />)}</datalist>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
          <Campo rotulo="Data da compra"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo rotulo="Fornecedor" dica={forn && !fornExistente ? 'Fornecedor novo: será cadastrado.' : undefined}><Input list="lista-fornecedores" value={forn} onChange={(e) => setForn(e.target.value)} placeholder="Ex.: Centro Sul" /></Campo>
        </div>
        <div>
          <div className="mb-1 hidden grid-cols-[2.2fr_.8fr_.8fr_1fr_1fr_auto] gap-2 text-xs font-medium text-slate-500 sm:grid"><span>Produto</span><span>Qtd</span><span>Unid.</span><span>Valor unit.</span><span>Total</span><span /></div>
          <div className="space-y-2">
            {itens.map((i, k) => (
              <div key={k} className="grid grid-cols-6 gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800 sm:grid-cols-[2.2fr_.8fr_.8fr_1fr_1fr_auto] sm:border-0 sm:p-0">
                <div className="col-span-6 sm:col-span-1"><Input list="lista-produtos" value={i.nome} onChange={(e) => mudar(k, 'nome', e.target.value)} placeholder="Produto" />{i.nome && !i.produto_id && !porChave.get(chaveProduto(i.nome)) && <span className="text-[11px] text-amber-600">novo produto</span>}</div>
                <Input className="col-span-2 sm:col-span-1" inputMode="decimal" value={i.quantidade} onChange={(e) => mudar(k, 'quantidade', e.target.value)} placeholder="Qtd" />
                <Select className="col-span-2 sm:col-span-1" value={i.unidade} onChange={(e) => mudar(k, 'unidade', e.target.value)}>{UNIDADES.map((u: string) => <option key={u}>{u}</option>)}</Select>
                <div className="col-span-2 sm:col-span-1"><Dinheiro valor={i.unit} mudar={(v) => mudar(k, 'unit', v)} placeholder="unit." /></div>
                <div className="col-span-5 sm:col-span-1"><Dinheiro valor={i.total} mudar={(v) => mudar(k, 'total', v)} placeholder="total" /></div>
                <button onClick={() => setItens((l) => l.length > 1 ? l.filter((_, j) => j !== k) : [linhaVazia()])} className="rounded-lg p-2 text-rose-600" aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <Btn variante="fantasma" className="mt-2" onClick={() => setItens((l) => [...l, linhaVazia()])}><Plus className="h-4 w-4" />Adicionar item</Btn>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo rotulo="Desconto"><Dinheiro valor={desconto} mudar={setDesconto} placeholder="0,00" /></Campo>
          <div className="sm:col-span-2 flex items-end justify-end gap-4 text-sm"><span>Subtotal <b className="tabular-nums">{brl(subtotal)}</b></span><span className="text-base">Total <b className="tabular-nums text-brand-700">{brl(total)}</b></span></div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
          <div className="mb-2 flex gap-2">{[['agora', '✅ Já paguei'], ['prazo', '📅 Vou pagar depois']].map(([v, t]) => <button key={v} onClick={() => setPago(v)} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium ${pago === v ? 'bg-brand-700 text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700'}`}>{t}</button>)}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Forma de pagamento"><Select value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS_PAGAMENTO.map((f) => <option key={f}>{f}</option>)}</Select></Campo>
            {pago === 'prazo' && <><Campo rotulo="Vencimento"><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></Campo>
              <Campo rotulo="Parcelas"><Select value={parcelas} onChange={(e) => setParcelas(e.target.value)}>{Array.from({ length: 12 }, (_, k) => <option key={k} value={k + 1}>{k + 1}x</option>)}</Select></Campo></>}
          </div>
          <p className="mt-2 text-xs text-slate-500">{pago === 'agora' ? 'Entra no financeiro como despesa já paga.' : 'Entra em Contas a pagar e no Google Agenda (vencimentos).'}</p>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={chegou} onChange={(e) => setChegou(e.target.checked)} className="h-4 w-4" />A mercadoria já chegou (dar entrada no estoque agora)</label>
        <Campo rotulo="Observação"><Input value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        {inicial?.nota_id && <Aviso tipo="info">Esta compra ficará ligada à nota fiscal. Uma nota nunca gera duas contas.</Aviso>}
        <Btn className="w-full !py-3" carregando={salvando} onClick={salvar}>Registrar compra de {brl(total)}</Btn>
      </div>
    </Modal>
  );
}
