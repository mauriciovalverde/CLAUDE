import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
// @ts-ignore módulo JS testado
import { chaveFornecedor, semAcento } from '../lib/catalogo.js';
import { brl, cnpjFmt, dataBR, tel } from '../lib/fmt';
import { Abas, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Tabela, Textarea, toast, useDados } from '../components/ui';

const CORES = ['#a3141b', '#f79f31', '#2563eb', '#059669', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];

export async function itensTodos(filtro?: (x: any) => any) {
  // pagina de 1000 em 1000 (limite do servidor)
  const out: any[] = [];
  for (let de = 0; ; de += 1000) {
    let x = supabase.from('rest_v_itens').select('*').order('data').range(de, de + 999);
    if (filtro) x = filtro(x);
    const lote = await q<any[]>(x); out.push(...lote);
    if (lote.length < 1000) break;
  }
  return out;
}

export default function Fornecedores() {
  const [aba, setAba] = useState('lista');
  const [editar, setEditar] = useState<any>(null);
  const [ver, setVer] = useState<any>(null);
  const { dados: forns } = useDados(() => q<any[]>(supabase.from('rest_fornecedores').select('*').order('nome')), []);
  const { dados: itens } = useDados(() => itensTodos(), []);
  const resumo = useMemo(() => {
    const m: Record<string, { total: number; compras: Set<string>; ultima: string }> = {};
    for (const i of itens ?? []) { if (!i.fornecedor_id) continue; const r = (m[i.fornecedor_id] ??= { total: 0, compras: new Set(), ultima: '' }); r.total += Number(i.valor_total); r.compras.add(i.compra_id); if (i.data > r.ultima) r.ultima = i.data; }
    return m;
  }, [itens]);
  const linhas = (forns ?? []).map((f) => ({ ...f, total: resumo[f.id]?.total ?? 0, n: resumo[f.id]?.compras.size ?? 0, ultima: resumo[f.id]?.ultima })).sort((a, b) => b.total - a.total);
  return (
    <div>
      <Cabecalho titulo="Fornecedores" sub="Cadastro, histórico e comparação de preços" acoes={<Btn onClick={() => setEditar({})}><Plus className="h-4 w-4" />Novo fornecedor</Btn>} />
      <Abas abas={[{ id: 'lista', t: 'Fornecedores' }, { id: 'precos', t: '💲 Comparar preços' }]} ativa={aba} mudar={setAba} />
      {aba === 'lista' ? <Tabela linhas={forns ? linhas : null} aoClicar={setVer} vazio="Nenhum fornecedor ainda."
        colunas={[
          { k: 'nome', t: 'Fornecedor', r: (f) => <span>{f.nome}{!f.ativo && <span className="ml-1 text-xs text-slate-400">(inativo)</span>}</span> },
          { k: 'tel', t: 'Telefone', r: (f) => tel(f.telefone) || '—', esconderCelular: true },
          { k: 'n', t: 'Compras', num: true, r: (f) => f.n },
          { k: 'ultima', t: 'Última', r: (f) => dataBR(f.ultima), esconderCelular: true },
          { k: 'total', t: 'Total comprado', num: true, r: (f) => <b>{brl(f.total)}</b> },
        ]} /> : <CompararPrecos itens={itens} />}
      {editar && <EditarFornecedor f={editar} fechar={() => setEditar(null)} />}
      {ver && <VerFornecedor f={ver} itens={(itens ?? []).filter((i) => i.fornecedor_id === ver.id)} fechar={() => setVer(null)} editar={() => { setEditar(ver); setVer(null); }} />}
    </div>
  );
}

function EditarFornecedor({ f, fechar }: { f: any; fechar: () => void }) {
  const [d, setD] = useState({ nome: f.nome ?? '', fantasia: f.fantasia ?? '', cnpj: f.cnpj ?? '', telefone: f.telefone ?? '', endereco: f.endereco ?? '', contato: f.contato ?? '', categoria: f.categoria ?? '', condicoes_pagamento: f.condicoes_pagamento ?? '', prazo_entrega_dias: f.prazo_entrega_dias ?? '', obs: f.obs ?? '', ativo: f.ativo ?? true });
  const [salvando, setSalvando] = useState(false);
  const c = (k: keyof typeof d) => ({ value: d[k] as any, onChange: (e: any) => setD({ ...d, [k]: e.target.value }) });
  return (
    <Modal aberto fechar={fechar} titulo={f.id ? 'Editar fornecedor' : 'Novo fornecedor'} largo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Nome ou razão social"><Input {...c('nome')} /></Campo>
        <Campo rotulo="Nome fantasia"><Input {...c('fantasia')} /></Campo>
        <Campo rotulo="CNPJ"><Input {...c('cnpj')} /></Campo>
        <Campo rotulo="Telefone / WhatsApp"><Input {...c('telefone')} inputMode="tel" /></Campo>
        <Campo rotulo="Responsável comercial"><Input {...c('contato')} /></Campo>
        <Campo rotulo="Categoria (o que fornece)"><Input {...c('categoria')} placeholder="Ex.: hortifruti, carnes" /></Campo>
        <Campo rotulo="Condições de pagamento"><Input {...c('condicoes_pagamento')} placeholder="Ex.: 7 dias no boleto" /></Campo>
        <Campo rotulo="Prazo médio de entrega (dias)"><Input {...c('prazo_entrega_dias')} inputMode="numeric" /></Campo>
        <div className="sm:col-span-2"><Campo rotulo="Endereço"><Input {...c('endereco')} /></Campo></div>
        <div className="sm:col-span-2"><Campo rotulo="Observações"><Textarea rows={2} {...c('obs')} /></Campo></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} />Ativo</label>
      </div>
      <Btn className="mt-4 w-full" carregando={salvando} disabled={d.nome.trim().length < 2} onClick={async () => {
        setSalvando(true);
        const reg = { ...d, nome: d.nome.trim(), cnpj: d.cnpj.replace(/\D/g, '') || null, prazo_entrega_dias: d.prazo_entrega_dias === '' ? null : Number(d.prazo_entrega_dias), ...(f.id ? {} : { chave: chaveFornecedor(d.nome), grafias: [d.nome.trim()] }) };
        const { error } = f.id ? await supabase.from('rest_fornecedores').update(reg).eq('id', f.id) : await supabase.from('rest_fornecedores').insert(reg);
        setSalvando(false);
        if (error) toast(error.message.includes('duplicate') ? 'Já existe um fornecedor com esse nome ou CNPJ.' : error.message, 'erro'); else { toast('Fornecedor salvo'); avisarMudanca(); fechar(); }
      }}>Salvar</Btn>
    </Modal>
  );
}

function VerFornecedor({ f, itens, fechar, editar }: { f: any; itens: any[]; fechar: () => void; editar: () => void }) {
  const { pode } = useEu();
  const { dados: contas } = useDados(() => pode('admin') ? q<any[]>(supabase.from('rest_contas').select('valor,status,vencimento,pago_em').eq('fornecedor_id', f.id).not('status', 'in', '(cancelado,historico)')) : Promise.resolve(null), [f.id]);
  const compras = useMemo(() => { const m = new Map<string, { numero: number; data: string; total: number }>(); for (const i of itens) { const c = m.get(i.compra_id) ?? { numero: i.compra_numero, data: i.data, total: 0 }; c.total += Number(i.valor_total); m.set(i.compra_id, c); } return [...m.values()].sort((a, b) => b.data.localeCompare(a.data)); }, [itens]);
  const produtos = useMemo(() => { const m = new Map<string, { produto: string; vezes: number; total: number; ultimo: number | null }>(); for (const i of itens) { const p = m.get(i.produto) ?? { produto: i.produto, vezes: 0, total: 0, ultimo: null }; p.vezes++; p.total += Number(i.valor_total); if (i.valor_unitario) p.ultimo = Number(i.valor_unitario); m.set(i.produto, p); } return [...m.values()].sort((a, b) => b.total - a.total); }, [itens]);
  const pend = (contas ?? []).filter((c) => c.status === 'pendente').reduce((t, c) => t + Number(c.valor), 0);
  const pagos = (contas ?? []).filter((c) => c.status === 'pago');
  return (
    <Modal aberto fechar={fechar} titulo={f.nome} largo>
      <div className="space-y-3 text-sm">
        <div className="text-slate-600 dark:text-slate-300">{[f.fantasia, f.cnpj && `CNPJ ${cnpjFmt(f.cnpj)}`, f.telefone && tel(f.telefone), f.contato && `Contato: ${f.contato}`, f.condicoes_pagamento, f.prazo_entrega_dias && `Entrega em ~${f.prazo_entrega_dias} dias`].filter(Boolean).join(' · ') || 'Sem dados de contato.'}</div>
        {f.grafias?.length > 1 && <div className="text-xs text-slate-500">Também escrito como: {f.grafias.join(', ')}</div>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Card><div className="text-xs text-slate-500">Total comprado</div><div className="font-bold">{brl(compras.reduce((t, c) => t + c.total, 0))}</div></Card>
          <Card><div className="text-xs text-slate-500">Compras</div><div className="font-bold">{compras.length}</div></Card>
          {contas && <Card><div className="text-xs text-slate-500">Em aberto</div><div className="font-bold text-amber-700">{brl(pend)}</div></Card>}
          {contas && <Card><div className="text-xs text-slate-500">Pagamentos feitos</div><div className="font-bold">{pagos.length}</div></Card>}
        </div>
        <div className="flex gap-2">
          <Btn variante="secundario" onClick={editar}>Editar cadastro</Btn>
          {f.telefone && <a className="inline-flex items-center rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/55${f.telefone.replace(/\D/g, '')}`}>WhatsApp</a>}
        </div>
        <h4 className="font-semibold">Produtos fornecidos</h4>
        <Tabela linhas={produtos.slice(0, 40)} chave="produto" colunas={[{ k: 'produto', t: 'Produto' }, { k: 'vezes', t: 'Vezes', num: true }, { k: 'ultimo', t: 'Último preço', num: true, r: (p) => p.ultimo ? brl(p.ultimo) : '—' }, { k: 'total', t: 'Total', num: true, r: (p) => brl(p.total) }]} />
        <h4 className="font-semibold">Histórico de compras</h4>
        <Tabela linhas={compras.slice(0, 50)} chave="numero" colunas={[{ k: 'numero', t: 'Compra', r: (c) => `#${c.numero}` }, { k: 'data', t: 'Data', r: (c) => dataBR(c.data) }, { k: 'total', t: 'Total', num: true, r: (c) => brl(c.total) }]} />
      </div>
    </Modal>
  );
}

function CompararPrecos({ itens }: { itens: any[] | null }) {
  const [busca, setBusca] = useState('');
  const [prod, setProd] = useState('');
  const produtos = useMemo(() => { const m = new Map<string, { id: string; nome: string; n: number; forns: Set<string> }>(); for (const i of itens ?? []) { if (!i.produto_id || !i.valor_unitario) continue; const p = m.get(i.produto_id) ?? { id: i.produto_id, nome: i.produto, n: 0, forns: new Set() }; p.n++; p.forns.add(i.fornecedor); m.set(i.produto_id, p); } return [...m.values()].sort((a, b) => b.forns.size - a.forns.size || b.n - a.n); }, [itens]);
  const filtrados = produtos.filter((p) => semAcento(p.nome).toLowerCase().includes(semAcento(busca).toLowerCase()));
  const sel = prod || filtrados[0]?.id || '';
  const dados = (itens ?? []).filter((i) => i.produto_id === sel && i.valor_unitario);
  const porForn = useMemo(() => {
    const m = new Map<string, { fornecedor: string; ultimo: number; ultimaData: string; menor: number; maior: number; soma: number; n: number; unidade: string }>();
    for (const i of dados) { const v = Number(i.valor_unitario); const r = m.get(i.fornecedor) ?? { fornecedor: i.fornecedor ?? '—', ultimo: v, ultimaData: i.data, menor: v, maior: v, soma: 0, n: 0, unidade: i.unidade }; if (i.data >= r.ultimaData) { r.ultimo = v; r.ultimaData = i.data; } r.menor = Math.min(r.menor, v); r.maior = Math.max(r.maior, v); r.soma += v; r.n++; m.set(i.fornecedor, r); }
    return [...m.values()].sort((a, b) => a.ultimo - b.ultimo);
  }, [dados]);
  const forns = porForn.map((p) => p.fornecedor);
  const serie = useMemo(() => { const m = new Map<string, any>(); for (const i of dados) { const r = m.get(i.data) ?? { data: i.data }; r[i.fornecedor] = Number(i.valor_unitario); m.set(i.data, r); } return [...m.values()].sort((a, b) => a.data.localeCompare(b.data)); }, [dados]);
  const primeiro = dados[0] ? Number(dados[0].valor_unitario) : null, ultimo = dados.at(-1) ? Number(dados.at(-1).valor_unitario) : null;
  return (
    <div className="space-y-3">
      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="Procurar produto"><Input value={busca} onChange={(e) => { setBusca(e.target.value); setProd(''); }} placeholder="Ex.: carne, batata" /></Campo>
          <Campo rotulo="Produto"><Select value={sel} onChange={(e) => setProd(e.target.value)}>{filtrados.slice(0, 300).map((p) => <option key={p.id} value={p.id}>{p.nome} ({p.forns.size} forn.)</option>)}</Select></Campo>
        </div>
      </Card>
      {porForn.length > 0 && <Card titulo={`Preço por fornecedor${porForn[0] ? ` (por ${porForn[0].unidade})` : ''}`} acao={primeiro && ultimo ? <span className={`text-sm font-semibold ${ultimo > primeiro ? 'text-rose-600' : 'text-emerald-600'}`}>Desde a 1ª compra: {ultimo > primeiro ? '+' : ''}{(((ultimo - primeiro) / primeiro) * 100).toFixed(1).replace('.', ',')}%</span> : null}>
        <Tabela linhas={porForn} chave="fornecedor" colunas={[
          { k: 'fornecedor', t: 'Fornecedor', r: (p) => <span>{p.fornecedor}{p === porForn[0] && porForn.length > 1 && <span className="ml-1 rounded bg-emerald-100 px-1.5 text-xs text-emerald-800">mais barato</span>}</span> },
          { k: 'ultimo', t: 'Último', num: true, r: (p) => <b>{brl(p.ultimo)}</b> }, { k: 'ultimaData', t: 'Em', r: (p) => dataBR(p.ultimaData) },
          { k: 'menor', t: 'Menor', num: true, r: (p) => brl(p.menor) }, { k: 'media', t: 'Média', num: true, r: (p) => brl(p.soma / p.n) }, { k: 'n', t: 'Compras', num: true },
        ]} />
      </Card>}
      {serie.length > 1 && <Card titulo="Evolução do preço">
        <div className="h-64"><ResponsiveContainer><LineChart data={serie} margin={{ left: -10, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="data" tickFormatter={(d) => dataBR(d).slice(0, 5)} /><YAxis tickFormatter={(v) => `R$${v}`} width={60} />
          <Tooltip formatter={(v: any) => brl(v)} labelFormatter={(d) => dataBR(d)} /><Legend />
          {forns.map((f, k) => <Line isAnimationActive={false} key={f} type="monotone" dataKey={f} stroke={CORES[k % CORES.length]} connectNulls dot={{ r: 2 }} />)}
        </LineChart></ResponsiveContainer></div>
      </Card>}
      {!porForn.length && itens && <Card><p className="text-center text-sm text-slate-500">Sem preços registrados para este produto.</p></Card>}
    </div>
  );
}
