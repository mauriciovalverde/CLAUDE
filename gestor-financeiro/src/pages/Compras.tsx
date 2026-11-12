import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { usePeriodo } from '../lib/periodo';
import { carregar, somar } from '../lib/dados';
import { rpc, sincronizarAgenda } from '../lib/supabase';
import { brl, cod, dataBR, hoje } from '../lib/fmt';
import { Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, Select, Stat, Tabela, toast, useDados } from '../components/ui';

function NovaCompra({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [itens, setItens] = useState<any[]>([]);
  const [f, setF] = useState<any>({});
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (aberto) { carregar.produtos().then(setProdutos); carregar.fornecedores().then(setFornecedores); setItens([{ produto_id: '', quantidade: 1, custo_unitario: '', lote: '', validade: '' }]); setF({ data: hoje(), vencimento: hoje(), parcelas: 1, pago_na_hora: false, forma_pagamento: 'pix', fornecedor_nome: '' }); setErro(''); } }, [aberto]);
  if (!aberto) return null;
  const total = itens.reduce((t, i) => t + Number(i.quantidade || 0) * Number(String(i.custo_unitario).replace(',', '.') || 0), 0);
  async function salvar() {
    setCarregando(true); setErro('');
    try {
      const itensOk = itens.filter((i) => i.produto_id);
      if (!itensOk.length) throw new Error('Adicione ao menos um produto.');
      for (const i of itensOk) {
        const p = produtos.find((x) => x.id === i.produto_id);
        if (p?.classe_regulatoria !== 'nao_medicamento' && (!i.lote || !i.validade)) throw new Error(`"${p?.nome}" é medicamento: lote e validade são obrigatórios (rastreabilidade).`);
      }
      const r = await rpc('registrar_compra', { p: {
        fornecedor_nome: f.fornecedor_nome || null, data: f.data, vencimento: f.pago_na_hora ? f.data : f.vencimento, parcelas: Number(f.parcelas), pago_na_hora: f.pago_na_hora, forma_pagamento: f.forma_pagamento,
        itens: itensOk.map((i) => ({ produto_id: i.produto_id, quantidade: Number(i.quantidade), custo_unitario: Number(String(i.custo_unitario).replace(',', '.')), lote: i.lote || null, validade: i.validade || null })),
        chave_idempotencia: `ui:compra:${JSON.stringify(itensOk)}:${f.vencimento}:${Math.floor(Date.now() / 60000)}`,
      } });
      toast(`Compra ${cod('C', r.numero)} registrada: ${brl(r.total)}. Estoque atualizado.`);
      sincronizarAgenda(r.obrigacoes.map((o: any) => o.obrigacao_id)).then(avisarMudanca); avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  }
  return (
    <Modal aberto titulo="Nova compra de estoque" fechar={fechar} largo>
      <div className="space-y-3">
        <Campo rotulo="Fornecedor"><Input list="forn" value={f.fornecedor_nome} onChange={(e) => setF({ ...f, fornecedor_nome: e.target.value })} placeholder="Nome (novo ou existente)" /><datalist id="forn">{fornecedores.map((x) => <option key={x.id} value={x.nome} />)}</datalist></Campo>
        {itens.map((i, k) => (
          <div key={k} className="grid grid-cols-12 gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/40">
            <Select className="col-span-12 sm:col-span-5" value={i.produto_id} onChange={(e) => { const p = produtos.find((x) => x.id === e.target.value); setItens(itens.map((x, j) => j === k ? { ...x, produto_id: e.target.value, custo_unitario: p?.preco_compra ?? '' } : x)); }}>
              <option value="">Produto… (cadastre em Estoque)</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Select>
            <Input className="col-span-4 sm:col-span-2" type="number" min={1} value={i.quantidade} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, quantidade: e.target.value } : x))} title="Qtd" />
            <Input className="col-span-6 sm:col-span-4" inputMode="decimal" placeholder="Custo unitário" value={i.custo_unitario} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, custo_unitario: e.target.value } : x))} />
            <button className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600" onClick={() => setItens(itens.filter((_, j) => j !== k))}><Trash2 className="mx-auto h-4 w-4" /></button>
            <Input className="col-span-6" placeholder="Lote" value={i.lote} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, lote: e.target.value } : x))} />
            <Input className="col-span-6" type="date" title="Validade" value={i.validade} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, validade: e.target.value } : x))} />
          </div>
        ))}
        <Btn variante="fantasma" onClick={() => setItens([...itens, { produto_id: '', quantidade: 1, custo_unitario: '', lote: '', validade: '' }])}><Plus className="h-4 w-4" />Item</Btn>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Data"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Vencimento (1ª)"><Input type="date" value={f.vencimento} disabled={f.pago_na_hora} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></Campo>
          <Campo rotulo="Parcelas"><Input type="number" min={1} value={f.parcelas} onChange={(e) => setF({ ...f, parcelas: e.target.value })} /></Campo>
          <Campo rotulo="Forma"><Select value={f.forma_pagamento} onChange={(e) => setF({ ...f, forma_pagamento: e.target.value })}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="boleto">Boleto</option><option value="cartao">Cartão</option></Select></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pago_na_hora} onChange={(e) => setF({ ...f, pago_na_hora: e.target.checked })} />Já paguei</label>
        <div className="text-right text-lg font-bold">Total: {brl(total)}</div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={carregando}>Registrar compra</Btn></div>
    </Modal>
  );
}

export default function Compras() {
  const { periodo } = usePeriodo();
  const [nova, setNova] = useState(false);
  const { dados } = useDados(() => carregar.compras(periodo.de, periodo.ate), [periodo.de, periodo.ate]);
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Compras" sub="Entrada de estoque e contas de fornecedores" acoes={<Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Nova compra</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat rotulo="Total comprado" valor={brl(somar(dados, 'total'))} sub={`${dados?.length ?? 0} compras`} />
        <Stat rotulo="Pago" valor={brl(somar(dados, 'total', (c) => c.status === 'pago'))} tom="bom" />
        <Stat rotulo="Pendente" valor={brl(somar(dados, 'total', (c) => c.status !== 'pago'))} tom="alerta" />
      </div>
      <Card>
        <Tabela linhas={dados} vazio="Nenhuma compra no período." colunas={[
          { k: 'numero', t: 'Compra', r: (c) => cod('C', c.numero) }, { k: 'data', t: 'Data', r: (c) => dataBR(c.data) },
          { k: 'forn', t: 'Fornecedor', r: (c) => c.fornecedores?.nome ?? '—' },
          { k: 'itens', t: 'Itens', r: (c) => c.compra_itens.map((i: any) => `${Number(i.quantidade)}× ${i.produtos?.nome} a ${brl(i.custo_unitario)}${i.lotes ? ` (lote ${i.lotes.lote})` : ''}`).join(', ') },
          { k: 'total', t: 'Total', num: true, r: (c) => brl(c.total) }, { k: 'status', t: 'Pagamento', r: (c) => <Badge s={c.status} /> },
        ]} />
      </Card>
      <NovaCompra aberto={nova} fechar={() => setNova(false)} />
    </div>
  );
}
