import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { usePeriodo } from '../lib/periodo';
import { carregar, somar } from '../lib/dados';
import { rpc, sincronizarAgenda, supabase } from '../lib/supabase';
import { brl, cod, dataBR, hoje, pct } from '../lib/fmt';
import { Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, Select, Stat, Tabela, toast, useDados } from '../components/ui';

export function SeletorCliente({ valor, mudar }: { valor: any; mudar: (c: any) => void }) {
  const [clientes, setClientes] = useState<any[]>([]);
  const [novo, setNovo] = useState(false);
  const [n, setN] = useState({ nome: '', telefone: '' });
  useEffect(() => { supabase.from('clientes').select('id,nome,telefone').is('excluido_em', null).order('nome').then(({ data }) => setClientes(data ?? [])); }, []);
  async function criar() {
    const r = await rpc('upsert_cliente', { p_nome: n.nome, p_telefone: n.telefone || null, p_obs: null }).catch((e) => { toast(e.message, 'erro'); return null; });
    if (!r) return;
    if (r.status === 'ambiguo') { toast(r.pergunta, 'info'); return; }
    const c = { id: r.cliente_id, nome: n.nome, telefone: n.telefone };
    setClientes((l) => (l.some((x) => x.id === c.id) ? l : [...l, c])); mudar(c); setNovo(false);
    toast(r.status === 'criado' ? 'Cliente cadastrado.' : 'Cliente já existia (mesmo telefone/nome).', 'info');
  }
  if (novo) return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-dashed border-slate-300 p-2 dark:border-slate-700">
      <Input placeholder="Nome" value={n.nome} onChange={(e) => setN({ ...n, nome: e.target.value })} />
      <Input placeholder="Telefone" value={n.telefone} onChange={(e) => setN({ ...n, telefone: e.target.value })} />
      <Btn variante="secundario" onClick={() => setNovo(false)}>Cancelar</Btn><Btn onClick={criar} disabled={!n.nome.trim()}>Usar</Btn>
    </div>
  );
  return (
    <div className="flex gap-2">
      <Select value={valor?.id ?? ''} onChange={(e) => mudar(clientes.find((c) => c.id === e.target.value))}>
        <option value="">Selecione…</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.telefone ? ` · ${c.telefone}` : ''}</option>)}
      </Select>
      <Btn variante="secundario" onClick={() => setNovo(true)} title="Novo cliente"><Plus className="h-4 w-4" /></Btn>
    </div>
  );
}

function NovaVenda({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [produtos, setProdutos] = useState<any[]>([]);
  const [cliente, setCliente] = useState<any>(null);
  const [itens, setItens] = useState<any[]>([]);
  const [f, setF] = useState<any>({});
  const [receita, setReceita] = useState<any>({});
  const [erro, setErro] = useState('');
  const [dup, setDup] = useState(false);
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (aberto) { carregar.produtos().then(setProdutos); setItens([{ produto_id: '', quantidade: 1, preco_unitario: '' }]); setF({ data: hoje(), vencimento: hoje(), pago_na_hora: false, forma_pagamento: 'pix', desconto: '' }); setCliente(null); setErro(''); setDup(false); setReceita({}); } }, [aberto]);
  if (!aberto) return null;
  const precisaReceita = itens.some((i) => ['tarja_vermelha', 'tarja_vermelha_retencao', 'controlado_344'].includes(produtos.find((p) => p.id === i.produto_id)?.classe_regulatoria));
  const total = itens.reduce((t, i) => t + Number(i.quantidade || 0) * Number(String(i.preco_unitario).replace(',', '.') || 0), 0) - Number(String(f.desconto || 0).replace(',', '.'));

  async function salvar(confirmarDup = false) {
    setCarregando(true); setErro('');
    try {
      if (!cliente) throw new Error('Selecione o cliente.');
      let receita_medica_id = null;
      if (precisaReceita) {
        if (!receita.prescritor || !receita.registro || !receita.data) throw new Error('Este produto exige receita: informe prescritor, CRM e data.');
        const { data, error } = await supabase.from('receitas_medicas').insert({ cliente_id: cliente.id, prescritor: receita.prescritor, registro_prescritor: receita.registro, data_emissao: receita.data, tipo: receita.tipo ?? 'simples', retida: !!receita.retida }).select('id').single();
        if (error) throw error; receita_medica_id = data.id;
      }
      const r = await rpc('registrar_venda', { p: {
        cliente_id: cliente.id, data: f.data, vencimento: f.pago_na_hora ? f.data : f.vencimento, pago_na_hora: f.pago_na_hora, forma_pagamento: f.forma_pagamento,
        desconto: Number(String(f.desconto || 0).replace(',', '.')), receita_medica_id, confirmar_duplicada: confirmarDup,
        itens: itens.filter((i) => i.produto_id).map((i) => ({ produto_id: i.produto_id, quantidade: Number(i.quantidade), preco_unitario: Number(String(i.preco_unitario).replace(',', '.')) })),
      } });
      toast(`Venda ${cod('V', r.numero)} registrada: ${brl(r.total)}${r.lucro_bruto != null ? ` · lucro ${brl(r.lucro_bruto)}` : ' · lucro pendente (sem custo)'}`);
      sincronizarAgenda([r.obrigacao_id]).then(avisarMudanca); avisarMudanca(); fechar();
    } catch (e: any) {
      setErro(e.message); setDup(e.message.startsWith('Possível duplicidade'));
    } finally { setCarregando(false); }
  }

  return (
    <Modal aberto titulo="Nova venda" fechar={fechar} largo>
      <div className="space-y-3">
        <Campo rotulo="Cliente"><SeletorCliente valor={cliente} mudar={setCliente} /></Campo>
        <div className="space-y-2">
          <span className="text-sm font-medium">Itens</span>
          {itens.map((i, k) => {
            const p = produtos.find((x) => x.id === i.produto_id);
            return (
              <div key={k} className="grid grid-cols-12 gap-2">
                <Select className="col-span-12 sm:col-span-6" value={i.produto_id} onChange={(e) => { const pr = produtos.find((x) => x.id === e.target.value); setItens(itens.map((x, j) => j === k ? { ...x, produto_id: e.target.value, preco_unitario: pr?.preco_venda ?? '' } : x)); }}>
                  <option value="">Produto…</option>{produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} (estoque {Number(p.estoque_atual)})</option>)}
                </Select>
                <Input className="col-span-4 sm:col-span-2" type="number" min={1} value={i.quantidade} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, quantidade: e.target.value } : x))} title="Quantidade" />
                <Input className="col-span-6 sm:col-span-3" inputMode="decimal" placeholder="Preço un." value={i.preco_unitario} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, preco_unitario: e.target.value } : x))} />
                <button className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600" onClick={() => setItens(itens.filter((_, j) => j !== k))}><Trash2 className="mx-auto h-4 w-4" /></button>
                {p && Number(i.quantidade) > Number(p.estoque_atual) && <p className="col-span-12 text-xs text-rose-600">Estoque insuficiente ({Number(p.estoque_atual)} disponíveis). Lance a compra antes.</p>}
              </div>
            );
          })}
          <Btn variante="fantasma" onClick={() => setItens([...itens, { produto_id: '', quantidade: 1, preco_unitario: '' }])}><Plus className="h-4 w-4" />Item</Btn>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo rotulo="Data da venda"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Desconto (R$)"><Input inputMode="decimal" value={f.desconto} onChange={(e) => setF({ ...f, desconto: e.target.value })} /></Campo>
          <Campo rotulo="Forma"><Select value={f.forma_pagamento} onChange={(e) => setF({ ...f, forma_pagamento: e.target.value })}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="a_prazo">A prazo</option></Select></Campo>
          <Campo rotulo="Recebimento previsto"><Input type="date" value={f.vencimento} disabled={f.pago_na_hora} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pago_na_hora} onChange={(e) => setF({ ...f, pago_na_hora: e.target.checked })} />Já recebi o pagamento</label>
        {precisaReceita && <div className="grid grid-cols-2 gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="col-span-2 text-sm font-medium text-amber-900 dark:text-amber-200">Produto sob prescrição: registre a receita</p>
          <Input placeholder="Prescritor" value={receita.prescritor ?? ''} onChange={(e) => setReceita({ ...receita, prescritor: e.target.value })} />
          <Input placeholder="CRM/UF" value={receita.registro ?? ''} onChange={(e) => setReceita({ ...receita, registro: e.target.value })} />
          <Input type="date" value={receita.data ?? ''} onChange={(e) => setReceita({ ...receita, data: e.target.value })} />
          <Select value={receita.tipo ?? 'simples'} onChange={(e) => setReceita({ ...receita, tipo: e.target.value })}><option value="simples">Simples</option><option value="controle_especial">Controle especial</option><option value="notificacao_A">Notificação A</option><option value="notificacao_B">Notificação B</option></Select>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!receita.retida} onChange={(e) => setReceita({ ...receita, retida: e.target.checked })} />Receita retida</label>
        </div>}
        <div className="text-right text-lg font-bold">Total: {brl(total)}</div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variante="secundario" onClick={fechar}>Cancelar</Btn>
        {dup ? <Btn variante="perigo" onClick={() => salvar(true)} carregando={carregando}>É outra venda, gravar</Btn> : <Btn onClick={() => salvar()} carregando={carregando}>Registrar venda</Btn>}
      </div>
    </Modal>
  );
}

export default function Vendas() {
  const { periodo } = usePeriodo();
  const [nova, setNova] = useState(false);
  const [busca, setBusca] = useState('');
  const { dados } = useDados(() => carregar.vendas(periodo.de, periodo.ate), [periodo.de, periodo.ate]);
  const fat = somar(dados, 'total');
  const comCusto = (dados ?? []).filter((v) => v.lucro_bruto != null);
  const lucro = somar(comCusto, 'lucro_bruto');
  const linhas = dados?.filter((v) => !busca || `${v.clientes?.nome} ${v.venda_itens.map((i: any) => i.produtos?.nome).join(' ')}`.toLowerCase().includes(busca.toLowerCase())) ?? null;
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Vendas" sub={`${dataBR(periodo.de)} a ${dataBR(periodo.ate)}`} acoes={<Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Nova venda</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat rotulo="Faturamento" valor={brl(fat)} sub={`${dados?.length ?? 0} vendas`} />
        <Stat rotulo="Custo (CMV)" valor={brl(somar(comCusto, 'custo_total'))} />
        <Stat rotulo="Lucro bruto" valor={brl(lucro)} tom="bom" sub={comCusto.length < (dados?.length ?? 0) ? `${(dados?.length ?? 0) - comCusto.length} sem custo` : undefined} />
        <Stat rotulo="Margem" valor={pct(somar(comCusto, 'total') ? (lucro / somar(comCusto, 'total')) * 100 : null)} />
        <Stat rotulo="Ticket médio" valor={brl(dados?.length ? fat / dados.length : 0)} />
      </div>
      <Card>
        <Input className="mb-3" placeholder="Buscar cliente ou produto…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Tabela linhas={linhas} vazio="Nenhuma venda no período." colunas={[
          { k: 'numero', t: 'Venda', r: (v) => cod('V', v.numero) }, { k: 'data', t: 'Data', r: (v) => dataBR(v.data) },
          { k: 'cliente', t: 'Cliente', r: (v) => <a className="text-teal-700 hover:underline" href={`#/clientes/${v.cliente_id}`}>{v.clientes?.nome}</a> },
          { k: 'itens', t: 'Itens', r: (v) => v.venda_itens.map((i: any) => `${Number(i.quantidade)}× ${i.produtos?.nome}`).join(', ') },
          { k: 'total', t: 'Total', num: true, r: (v) => brl(v.total) },
          { k: 'lucro', t: 'Lucro', num: true, r: (v) => v.lucro_bruto == null ? <span className="text-xs text-amber-600">sem custo</span> : brl(v.lucro_bruto) },
          { k: 'margem', t: 'Margem', num: true, esconderCelular: true, r: (v) => pct(v.margem_pct) },
          { k: 'status', t: 'Situação', r: (v) => <Badge s={v.status} /> },
        ]} />
      </Card>
      <NovaVenda aberto={nova} fechar={() => setNova(false)} />
    </div>
  );
}
