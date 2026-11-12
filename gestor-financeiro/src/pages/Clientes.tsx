import { useState } from 'react';
import { ArrowLeft, FileDown, Plus } from 'lucide-react';
import { ir } from '../App';
import { supabase, rpc } from '../lib/supabase';
import { carregar, somar } from '../lib/dados';
import { brl, cod, dataBR, tel } from '../lib/fmt';
import { Abas, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Stat, Tabela, Textarea, toast, useDados } from '../components/ui';
import { AgendaIcone, PagarModal } from '../components/Acoes';
import { pdfCliente } from '../lib/pdf';

function NovoCliente({ aberto, fechar }: { aberto: boolean; fechar: () => void }) {
  const [f, setF] = useState({ nome: '', telefone: '', obs: '' });
  const [msg, setMsg] = useState('');
  if (!aberto) return null;
  async function salvar() {
    try {
      const r = await rpc('upsert_cliente', { p_nome: f.nome, p_telefone: f.telefone || null, p_obs: f.obs || null });
      if (r.status === 'ambiguo') { setMsg(r.pergunta); return; }
      toast(r.status === 'criado' ? 'Cliente cadastrado.' : 'Cliente já existia; nada duplicado.'); avisarMudanca(); fechar(); ir(`clientes/${r.cliente_id}`);
    } catch (e: any) { toast(e.message, 'erro'); }
  }
  return (
    <Modal aberto titulo="Novo cliente" fechar={fechar}>
      <div className="space-y-3">
        <Campo rotulo="Nome completo"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Telefone (com DDD)"><Input inputMode="tel" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Observações"><Textarea rows={2} value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} /></Campo>
        {msg && <p className="text-sm text-amber-700">{msg}</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} disabled={!f.nome.trim()}>Salvar</Btn></div>
    </Modal>
  );
}

function Ficha({ id }: { id: string }) {
  const [aba, setAba] = useState('resumo');
  const [pagar, setPagar] = useState<any>(null);
  const [editando, setEditando] = useState(false);
  const { dados, recarregar } = useDados(async () => {
    const [c, res, vendas, emps, obr, pags] = await Promise.all([
      q(supabase.from('clientes').select('*').eq('id', id).single()),
      q(supabase.from('v_clientes_resumo').select('*').eq('id', id).maybeSingle()),
      q<any[]>(supabase.from('vendas').select('*, venda_itens(quantidade,preco_unitario,total,produtos(nome))').eq('cliente_id', id).is('excluido_em', null).order('data', { ascending: false })),
      q<any[]>(supabase.from('emprestimos').select('*, emprestimo_eventos(tipo,dados,criado_em)').eq('cliente_id', id).is('excluido_em', null).order('data', { ascending: false })),
      carregar.obrigacoes({ cliente: id }),
      q<any[]>(supabase.from('pagamentos').select('*, obrigacoes!inner(cliente_id,descricao,origem)').eq('obrigacoes.cliente_id', id).is('estornado_em', null).order('data', { ascending: false })),
    ]);
    return { c, res, vendas, emps, obr, pags };
  }, [id]);
  const [f, setF] = useState<any>(null);
  if (!dados) return <Cabecalho titulo="Cliente" sub="Carregando…" />;
  const { c, res, vendas, emps, obr, pags } = dados as any;
  const abertas = obr.filter((o: any) => ['pendente', 'parcial', 'atrasado'].includes(o.situacao));
  const linha = [
    ...vendas.map((v: any) => ({ d: v.data, t: `Venda ${cod('V', v.numero)}: ${v.venda_itens.map((i: any) => `${i.quantidade}× ${i.produtos?.nome}`).join(', ')}`, v: v.total })),
    ...emps.map((e: any) => ({ d: e.data, t: `Empréstimo ${cod('E', e.numero)} (${e.taxa_pct}% ${e.periodicidade}, ${e.modalidade})`, v: e.principal })),
    ...pags.map((p: any) => ({ d: p.data, t: `Pagamento: ${p.obrigacoes?.descricao}${p.juros_valor > 0 ? ` (juros ${brl(p.juros_valor)})` : ''}`, v: p.valor })),
  ].sort((a, b) => b.d.localeCompare(a.d));

  async function salvar() {
    const { error } = await supabase.from('clientes').update({ nome: f.nome, telefone: f.telefone || null, observacoes: f.observacoes || null }).eq('id', id);
    if (error) toast(error.message.includes('clientes_tel_unico') ? 'Já existe outro cliente com esse telefone.' : error.message, 'erro');
    else { toast('Cadastro atualizado.'); setEditando(false); recarregar(); }
  }
  async function excluir() {
    if (abertas.length) { toast('Cliente com pendências não pode ir para a lixeira.', 'erro'); return; }
    if (!confirm(`Mover ${c.nome} para a lixeira? (pode ser restaurado em Configurações)`)) return;
    await supabase.from('clientes').update({ excluido_em: new Date().toISOString() }).eq('id', id);
    toast('Cliente movido para a lixeira.'); ir('clientes');
  }

  return (
    <div className="space-y-4">
      <button onClick={() => ir('clientes')} className="flex items-center gap-1 text-sm text-teal-700"><ArrowLeft className="h-4 w-4" />Clientes</button>
      <Cabecalho titulo={c.nome} sub={`${tel(c.telefone) || 'sem telefone'} · cliente desde ${dataBR(c.criado_em)} · ${cod('CL', c.numero)}`}
        acoes={<>
          <Btn variante="secundario" onClick={() => { setF(c); setEditando(true); }}>Editar</Btn>
          <Btn variante="secundario" onClick={() => pdfCliente(c, res, vendas, emps, obr, pags)}><FileDown className="h-4 w-4" />PDF</Btn>
        </>} />
      {c.observacoes && <p className="text-sm text-slate-600 dark:text-slate-300">📝 {c.observacoes}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat rotulo="Total comprado" valor={brl(res?.total_comprado)} sub={`${res?.qtd_compras ?? 0} compras`} />
        <Stat rotulo="Total emprestado" valor={brl(res?.total_emprestado)} />
        <Stat rotulo="Pendente" valor={brl(res?.valor_pendente)} tom={res?.valor_pendente > 0 ? 'alerta' : 'neutro'} sub={res?.valor_atrasado > 0 ? `${brl(res.valor_atrasado)} atrasado` : undefined} />
        <Stat rotulo="Já pagou" valor={brl(res?.valor_pago)} tom="bom" />
        <Stat rotulo="Total movimentado" valor={brl(Number(res?.total_comprado ?? 0) + Number(res?.total_emprestado ?? 0))} sub={`juros pagos ${brl(res?.juros_pagos)}`} />
      </div>
      <Card>
        <Abas abas={[{ id: 'resumo', t: 'Pendências' }, { id: 'vendas', t: 'Compras dele' }, { id: 'emprestimos', t: 'Empréstimos' }, { id: 'pagamentos', t: 'Pagamentos' }, { id: 'linha', t: 'Linha do tempo' }]} ativa={aba} mudar={setAba} />
        {aba === 'resumo' && <Tabela linhas={abertas} vazio="Nenhuma pendência. 🎉" colunas={[
          { k: 'descricao', t: 'Descrição' }, { k: 'vencimento', t: 'Vencimento', r: (o) => dataBR(o.vencimento) },
          { k: 'saldo', t: 'Saldo', num: true, r: (o) => brl(o.saldo) }, { k: 'situacao', t: 'Situação', r: (o) => <Badge s={o.situacao} /> },
          { k: 'ag', t: 'Agenda', r: (o) => <AgendaIcone o={o} /> },
          { k: 'a', t: '', r: (o) => <Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={() => setPagar(o)}>Receber</Btn> },
        ]} />}
        {aba === 'vendas' && <Tabela linhas={vendas} colunas={[
          { k: 'numero', t: 'Venda', r: (v) => cod('V', v.numero) }, { k: 'data', t: 'Data', r: (v) => dataBR(v.data) },
          { k: 'itens', t: 'Itens', r: (v) => v.venda_itens.map((i: any) => `${i.quantidade}× ${i.produtos?.nome}`).join(', ') },
          { k: 'total', t: 'Total', num: true, r: (v) => brl(v.total) }, { k: 'status', t: 'Situação', r: (v) => <Badge s={v.status} /> },
        ]} />}
        {aba === 'emprestimos' && <Tabela linhas={emps} aoClicar={(e) => ir(`emprestimos/${e.id}`)} colunas={[
          { k: 'numero', t: 'Nº', r: (e) => cod('E', e.numero) }, { k: 'data', t: 'Data', r: (e) => dataBR(e.data) },
          { k: 'principal', t: 'Principal', num: true, r: (e) => brl(e.principal) }, { k: 'total_previsto', t: 'Total previsto', num: true, r: (e) => brl(e.total_previsto) },
          { k: 'vencimento', t: 'Vencimento', r: (e) => dataBR(e.vencimento) }, { k: 'status', t: 'Situação', r: (e) => <Badge s={e.status} /> },
        ]} />}
        {aba === 'pagamentos' && <Tabela linhas={pags} colunas={[
          { k: 'data', t: 'Data', r: (p) => dataBR(p.data) }, { k: 'desc', t: 'Referente a', r: (p) => p.obrigacoes?.descricao },
          { k: 'valor', t: 'Valor', num: true, r: (p) => brl(p.valor) }, { k: 'juros_valor', t: 'Juros', num: true, r: (p) => brl(p.juros_valor) },
        ]} />}
        {aba === 'linha' && <ol className="space-y-2 border-l-2 border-teal-700/30 pl-4 text-sm">{linha.map((l, i) => <li key={i}><span className="text-xs text-slate-500">{dataBR(l.d)}</span><div>{l.t} · <strong>{brl(l.v)}</strong></div></li>)}{!linha.length && <li className="text-slate-500">Sem movimentações.</li>}</ol>}
      </Card>
      <div className="text-right"><Btn variante="fantasma" className="text-rose-600" onClick={excluir}>Mover para a lixeira</Btn></div>
      <PagarModal o={pagar} fechar={() => setPagar(null)} />
      <Modal aberto={editando} fechar={() => setEditando(false)} titulo="Editar cliente">
        {f && <div className="space-y-3">
          <Campo rotulo="Nome"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
          <Campo rotulo="Telefone"><Input value={f.telefone ?? ''} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Campo>
          <Campo rotulo="Observações"><Textarea rows={3} value={f.observacoes ?? ''} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Campo>
          <div className="flex justify-end gap-2"><Btn variante="secundario" onClick={() => setEditando(false)}>Cancelar</Btn><Btn onClick={salvar}>Salvar</Btn></div>
        </div>}
      </Modal>
    </div>
  );
}

export default function Clientes({ id }: { id?: string }) {
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState(false);
  const { dados } = useDados(carregar.clientes, []);
  if (id) return <Ficha id={id} />;
  const b = busca.toLowerCase().replace(/\D/g, '') || busca.toLowerCase();
  const linhas = dados?.filter((c) => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || (b && (c.telefone ?? '').replace(/\D/g, '').includes(b))) ?? null;
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Clientes" sub="Cadastro único: a IA reconhece por nome ou telefone" acoes={<Btn onClick={() => setNovo(true)}><Plus className="h-4 w-4" />Novo cliente</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat rotulo="Clientes" valor={dados?.length ?? '—'} />
        <Stat rotulo="A receber" valor={brl(somar(dados, 'valor_pendente'))} />
        <Stat rotulo="Atrasado" valor={brl(somar(dados, 'valor_atrasado'))} tom="alerta" />
        <Stat rotulo="Total vendido" valor={brl(somar(dados, 'total_comprado'))} />
      </div>
      <Card>
        <Input className="mb-3" placeholder="Buscar por nome ou telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Tabela linhas={linhas} aoClicar={(c) => ir(`clientes/${c.id}`)} vazio="Nenhum cliente ainda. Cadastre aqui ou pela Central IA." colunas={[
          { k: 'nome', t: 'Nome' }, { k: 'telefone', t: 'Telefone', r: (c) => tel(c.telefone) || '—' },
          { k: 'total_comprado', t: 'Comprou', num: true, r: (c) => brl(c.total_comprado) },
          { k: 'total_emprestado', t: 'Emprestado', num: true, r: (c) => brl(c.total_emprestado) },
          { k: 'valor_pendente', t: 'Pendente', num: true, r: (c) => <span className={c.valor_atrasado > 0 ? 'font-semibold text-rose-600' : ''}>{brl(c.valor_pendente)}</span> },
        ]} />
      </Card>
      <NovoCliente aberto={novo} fechar={() => setNovo(false)} />
    </div>
  );
}
