import { useEffect, useState } from 'react';
import { rpc, sincronizarAgenda, supabase } from '../lib/supabase';
import { brl, dataBR, hoje } from '../lib/fmt';
import { avisarMudanca, Aviso, Btn, Campo, Input, Modal, Select, toast } from './ui';
import { CalendarCheck, CalendarClock, CalendarX } from 'lucide-react';
import { emailCobranca } from '../lib/ia/executor';

export function AgendaIcone({ o }: { o: any }) {
  const s = o.agenda_status;
  if (!s) return <span className="text-xs text-slate-400">—</span>;
  const I = s === 'sincronizado' ? CalendarCheck : s === 'erro' ? CalendarX : CalendarClock;
  const cor = s === 'sincronizado' ? 'text-emerald-600' : s === 'erro' ? 'text-rose-600' : s === 'cancelado' ? 'text-slate-400' : 'text-amber-600';
  const el = <span title={`Agenda: ${s}`} className={`inline-flex items-center gap-1 text-xs ${cor}`}><I className="h-4 w-4" /><span className="hidden xl:inline">{s}</span></span>;
  return o.agenda_link ? <a href={o.agenda_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{el}</a> : el;
}

export function PagarModal({ o, fechar }: { o: any | null; fechar: () => void }) {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hoje());
  const [forma, setForma] = useState('pix');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { if (o) { setValor(String(o.saldo)); setErro(''); } }, [o?.id]);
  if (!o) return null;
  async function salvar() {
    setCarregando(true); setErro('');
    try {
      const r = await rpc('registrar_pagamento', { p_obrigacao: o.id, p_valor: Number(valor.replace(',', '.')), p_data: data, p_forma: forma, p_conta: null, p_obs: null, p_chave: `ui:${o.id}:${valor}:${data}:${Date.now() - (Date.now() % 60000)}` });
      toast(r.status_obrigacao === 'pago' ? 'Quitado ✅' : `Pagamento parcial registrado. Saldo: ${brl(r.saldo_restante)}`);
      sincronizarAgenda([o.id]).then(avisarMudanca); avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message); } finally { setCarregando(false); }
  }
  return (
    <Modal aberto titulo={o.tipo === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'} fechar={fechar}>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{o.descricao}<br />Saldo em aberto: <strong>{brl(o.saldo)}</strong> · vence {dataBR(o.vencimento)}</p>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)" dica="Menor que o saldo = pagamento parcial"><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
        <Campo rotulo="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo rotulo="Forma"><Select value={forma} onChange={(e) => setForma(e.target.value)}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao">Cartão</option><option value="transferencia">Transferência</option><option value="boleto">Boleto</option></Select></Campo>
      </div>
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={carregando}>Confirmar</Btn></div>
    </Modal>
  );
}

export function VencimentoModal({ o, fechar }: { o: any | null; fechar: () => void }) {
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
  const [carregando, setCarregando] = useState(false);
  useEffect(() => { if (o) setData(o.vencimento); }, [o?.id]);
  if (!o) return null;
  async function salvar() {
    setCarregando(true);
    try { await rpc('alterar_vencimento', { p_obrigacao: o.id, p_nova: data, p_motivo: motivo || null }); toast('Vencimento alterado; o evento da agenda será atualizado.'); sincronizarAgenda([o.id]).then(avisarMudanca); avisarMudanca(); fechar(); }
    catch (e: any) { toast(e.message, 'erro'); } finally { setCarregando(false); }
  }
  return (
    <Modal aberto titulo="Alterar vencimento / prorrogar" fechar={fechar}>
      <p className="mb-3 text-sm">{o.descricao} · atual: {dataBR(o.vencimento)}</p>
      <div className="space-y-3"><Campo rotulo="Novo vencimento"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo><Campo rotulo="Motivo (opcional)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo></div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={carregando}>Salvar</Btn></div>
    </Modal>
  );
}

export function NovaContaModal({ aberto, fechar, escopoPadrao = 'pessoal', tipoPadrao = 'pagar' }: { aberto: boolean; fechar: () => void; escopoPadrao?: string; tipoPadrao?: string }) {
  const [f, setF] = useState<any>({});
  const [cats, setCats] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [recorrente, setRecorrente] = useState(false);
  useEffect(() => { if (aberto) { setF({ tipo: tipoPadrao, escopo: escopoPadrao, pago: false, vencimento: hoje(), parcelas: 1 }); setRecorrente(false); supabase.from('categorias').select('*').is('excluido_em', null).order('nome').then(({ data }) => setCats(data ?? [])); } }, [aberto]);
  if (!aberto) return null;
  const opcoes = cats.filter((c) => c.escopo === f.escopo && (f.tipo === 'pagar' ? c.tipo === 'despesa' : c.tipo === 'receita'));
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  async function salvar() {
    setCarregando(true);
    try {
      const valor = Number(String(f.valor ?? '').replace(',', '.'));
      if (!f.descricao || !valor) throw new Error('Informe descrição e valor.');
      const slug = f.categoria_slug ?? opcoes[0]?.slug;
      if (recorrente) {
        const cat = cats.find((c) => c.escopo === f.escopo && c.slug === slug);
        const { error } = await supabase.from('recorrencias').insert({ descricao: f.descricao, tipo: f.tipo, escopo: f.escopo, categoria_id: cat?.id, valor, dia_vencimento: Number(f.vencimento.slice(8, 10)), inicio: f.vencimento });
        if (error) throw error;
        await supabase.functions.invoke('agenda-sync', { body: { forcar: true } }).catch(() => null);
        toast('Recorrência criada. As próximas contas serão geradas automaticamente.');
      } else {
        const r = await rpc('registrar_conta', { p: { ...f, valor, categoria_slug: slug, chave_idempotencia: `ui:conta:${f.descricao}:${valor}:${f.vencimento}:${Math.floor(Date.now() / 60000)}` } });
        toast(`${f.tipo === 'pagar' ? 'Despesa' : 'Receita'} registrada (${r.categoria}).`);
        sincronizarAgenda(r.obrigacoes.map((o: any) => o.obrigacao_id)).then(avisarMudanca);
      }
      avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setCarregando(false); }
  }
  return (
    <Modal aberto titulo="Nova conta / lançamento" fechar={fechar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Tipo"><Select value={f.tipo} onChange={(e) => set('tipo', e.target.value)}><option value="pagar">Despesa (a pagar)</option><option value="receber">Receita (a receber)</option></Select></Campo>
        <Campo rotulo="Escopo"><Select value={f.escopo} onChange={(e) => set('escopo', e.target.value)}><option value="pessoal">Pessoal</option><option value="comercial">Comercial</option></Select></Campo>
        <div className="col-span-2"><Campo rotulo="Descrição"><Input value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex.: Energia da casa" /></Campo></div>
        <Campo rotulo="Valor total (R$)"><Input inputMode="decimal" value={f.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></Campo>
        <Campo rotulo="Categoria"><Select value={f.categoria_slug ?? opcoes[0]?.slug ?? ''} onChange={(e) => set('categoria_slug', e.target.value)}>{opcoes.map((c) => <option key={c.id} value={c.slug}>{c.nome}</option>)}</Select></Campo>
        <Campo rotulo="Vencimento"><Input type="date" value={f.vencimento} onChange={(e) => set('vencimento', e.target.value)} /></Campo>
        <Campo rotulo="Parcelas"><Input type="number" min={1} value={f.parcelas} disabled={recorrente} onChange={(e) => set('parcelas', Number(e.target.value))} /></Campo>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.pago} disabled={recorrente} onChange={(e) => set('pago', e.target.checked)} /> Já foi {f.tipo === 'pagar' ? 'paga' : 'recebida'} (1ª parcela)</label>
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} /> Repete todo mês (recorrente, no mesmo dia)</label>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={carregando}>Salvar</Btn></div>
    </Modal>
  );
}

/** Envio de e-mail pelo Gmail do usuário (cobrança ou relatório). */
export function EmailModal({ aberto, fechar, titulo, para: paraInicial = '', assunto: assuntoInicial = '', html, anexo, tipo = 'avulso', clienteId, obrigacaoId, aoSalvarEmail }:
  { aberto: boolean; fechar: () => void; titulo: string; para?: string; assunto?: string; html: string; anexo?: () => { nome: string; base64: string }; tipo?: string; clienteId?: string; obrigacaoId?: string; aoSalvarEmail?: (e: string) => void }) {
  const [para, setPara] = useState(paraInicial);
  const [assunto, setAssunto] = useState(assuntoInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { if (aberto) { setPara(paraInicial); setAssunto(assuntoInicial); setErro(''); } }, [aberto]);
  if (!aberto) return null;
  async function enviar() {
    setEnviando(true); setErro('');
    try {
      if (clienteId && para && para !== paraInicial) { await supabase.from('clientes').update({ email: para }).eq('id', clienteId); aoSalvarEmail?.(para); }
      const a = anexo?.();
      const { funcao } = await import('../lib/supabase');
      const r = await funcao('gmail-enviar', { para, assunto, html, tipo, cliente_id: clienteId, obrigacao_id: obrigacaoId, anexo_base64: a?.base64, anexo_nome: a?.nome });
      if (!r.ok) throw new Error(r.mensagem ?? r.erro);
      toast(`E-mail enviado para ${para} ✉️`); fechar();
    } catch (e: any) { setErro(e.message); } finally { setEnviando(false); }
  }
  return (
    <Modal aberto titulo={titulo} fechar={fechar} largo>
      <div className="space-y-3">
        <Campo rotulo="Para (e-mail)" dica={clienteId ? 'Se for novo, fica salvo no cadastro do cliente.' : undefined}><Input type="email" value={para} onChange={(e) => setPara(e.target.value)} placeholder="nome@exemplo.com" /></Campo>
        <Campo rotulo="Assunto"><Input value={assunto} onChange={(e) => setAssunto(e.target.value)} /></Campo>
        <div><span className="mb-1 block text-sm font-medium">Prévia da mensagem</span><div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-900 dark:border-slate-700" dangerouslySetInnerHTML={{ __html: html }} /></div>
        {anexo && <p className="text-xs text-slate-500">📎 O relatório em PDF vai anexado.</p>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={enviar} carregando={enviando} disabled={!para || !assunto}>Enviar pelo meu Gmail</Btn></div>
    </Modal>
  );
}

export function CobrancaEmailModal({ o, fechar }: { o: any | null; fechar: () => void }) {
  const [dados, setDados] = useState<{ email: string; nome: string } | null>(null);
  useEffect(() => {
    if (!o) return;
    Promise.all([
      o.cliente_id ? supabase.from('clientes').select('email').eq('id', o.cliente_id).single() : Promise.resolve({ data: null }),
      supabase.from('configuracoes').select('nome_negocio').maybeSingle(),
    ]).then(([c, cfg]: any) => setDados({ email: c.data?.email ?? '', nome: cfg.data?.nome_negocio ?? '' }));
  }, [o?.id]);
  if (!o || !dados) return null;
  const m = emailCobranca(o, dados.nome);
  return <EmailModal aberto titulo={`Cobrança por e-mail · ${o.cliente_nome ?? ''}`} fechar={() => { setDados(null); fechar(); }} para={dados.email} assunto={m.assunto} html={m.html} tipo="cobranca" clienteId={o.cliente_id} obrigacaoId={o.id} />;
}
