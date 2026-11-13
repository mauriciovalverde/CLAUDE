import { useMemo, useState } from 'react';
import { CalendarPlus, Copy, Plus } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc, supabase, SUPABASE_URL } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { addDias, addMeses, brl, CATEGORIAS_DESPESA, CATEGORIAS_RECEITA, compacto, dataBR, FORMAS_PAGAMENTO, hoje, inicioMes, lerNum, mesNome } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Dinheiro, Input, Modal, q, Select, Stat, Tabela, toast, useDados } from '../components/ui';

export const linkGoogle = (c: any) => {
  const d = c.vencimento.replaceAll('-', ''); const d2 = addDias(c.vencimento, 1).replaceAll('-', '');
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${c.tipo === 'receber' ? 'Receber' : 'Pagar'}: ${c.descricao} — ${brl(c.valor)}`)}&dates=${d}/${d2}&details=${encodeURIComponent(`Conta #${c.numero ?? ''}`)}`;
};

export default function Financeiro() {
  const [aba, setAba] = useState('pagar');
  return (
    <div>
      <Cabecalho titulo="Financeiro" sub="Contas a pagar e a receber, fluxo de caixa e agenda de vencimentos" />
      <Abas abas={[{ id: 'pagar', t: '📤 A pagar' }, { id: 'receber', t: '📥 A receber' }, { id: 'fluxo', t: '📈 Fluxo de caixa' }, { id: 'agenda', t: '📅 Google Agenda' }]} ativa={aba} mudar={setAba} />
      {(aba === 'pagar' || aba === 'receber') && <Contas tipo={aba} />}
      {aba === 'fluxo' && <Fluxo />}
      {aba === 'agenda' && <Agenda />}
    </div>
  );
}

function Contas({ tipo }: { tipo: string }) {
  const [filtro, setFiltro] = useState('abertas');
  const [nova, setNova] = useState(false);
  const [pagar, setPagar] = useState<any>(null);
  const { dados } = useDados(() => {
    let x = supabase.from('rest_contas').select('*, rest_fornecedores(nome)').eq('tipo', tipo).order('vencimento', { ascending: filtro !== 'pagas' }).limit(500);
    if (filtro === 'abertas') x = x.eq('status', 'pendente'); else if (filtro === 'vencidas') x = x.eq('status', 'pendente').lt('vencimento', hoje()); else if (filtro === 'pagas') x = x.eq('status', 'pago').gte('pago_em', addMeses(hoje(), -3));
    return q<any[]>(x);
  }, [tipo, filtro]);
  const total = (dados ?? []).reduce((t, c) => t + Number(c.valor), 0);
  const situacao = (c: any) => c.status !== 'pendente' ? c.status : c.vencimento < hoje() ? 'atrasado' : 'pendente';
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="!w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value)}><option value="abertas">Em aberto</option><option value="vencidas">Vencidas</option><option value="pagas">{tipo === 'pagar' ? 'Pagas' : 'Recebidas'} (3 meses)</option><option value="todas">Todas</option></Select>
        <span className="text-sm">Total: <b>{brl(total)}</b></span>
        <Btn className="ml-auto" onClick={() => setNova(true)}><Plus className="h-4 w-4" />Nova conta {tipo === 'pagar' ? 'a pagar' : 'a receber'}</Btn>
      </div>
      <Tabela linhas={dados} vazio="Nenhuma conta aqui." aoClicar={(c) => c.status === 'pendente' && setPagar(c)} colunas={[
        { k: 'd', t: 'Descrição', r: (c) => <span>{c.descricao}{c.nota_numero && <span className="text-xs text-slate-400"> · NF {c.nota_numero}</span>}</span> },
        { k: 'cat', t: 'Categoria', r: (c) => c.categoria, esconderCelular: true },
        { k: 'v', t: 'Vencimento', r: (c) => dataBR(c.vencimento) },
        { k: 's', t: 'Situação', r: (c) => <span className="flex items-center gap-1"><Badge s={situacao(c)}>{situacao(c) === 'atrasado' ? 'Vencida' : undefined}</Badge>{c.status === 'pago' && <span className="text-xs text-slate-500">{dataBR(c.pago_em)}</span>}</span> },
        { k: 'g', t: '', r: (c) => c.status === 'pendente' ? <a href={linkGoogle(c)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title="Adicionar ao Google Agenda" className="text-sky-700"><CalendarPlus className="h-4 w-4" /></a> : null, esconderCelular: true },
        { k: 'valor', t: 'Valor', num: true, r: (c) => <b>{brl(c.valor)}</b> },
      ]} />
      {nova && <NovaConta tipo={tipo} fechar={() => setNova(false)} />}
      {pagar && <Pagar c={pagar} fechar={() => setPagar(null)} />}
    </>
  );
}

function NovaConta({ tipo, fechar }: { tipo: string; fechar: () => void }) {
  const { dados: forns } = useDados(() => q<any[]>(supabase.from('rest_fornecedores').select('id,nome').order('nome')), []);
  const [f, setF] = useState({ descricao: '', categoria: tipo === 'pagar' ? 'Energia' : 'Outras receitas', fornecedor_id: '', nota_numero: '', emissao: hoje(), vencimento: hoje(), valor: '', vezes: '1', repetir: 'unica', pago: false, forma: 'PIX' });
  return (
    <Modal aberto fechar={fechar} titulo={tipo === 'pagar' ? 'Nova conta a pagar' : 'Nova conta a receber'}>
      <div className="space-y-3">
        <Campo rotulo="Descrição"><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder={tipo === 'pagar' ? 'Ex.: Conta de luz' : 'Ex.: Evento particular'} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Categoria"><Select value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>{(tipo === 'pagar' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA).map((c) => <option key={c}>{c}</option>)}</Select></Campo>
          <Campo rotulo="Valor"><Dinheiro valor={f.valor} mudar={(v) => setF({ ...f, valor: v })} /></Campo>
          {tipo === 'pagar' && <Campo rotulo="Fornecedor (opcional)"><Select value={f.fornecedor_id} onChange={(e) => setF({ ...f, fornecedor_id: e.target.value })}><option value="">—</option>{(forns ?? []).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select></Campo>}
          {tipo === 'pagar' && <Campo rotulo="Nº da nota (opcional)"><Input value={f.nota_numero} onChange={(e) => setF({ ...f, nota_numero: e.target.value })} /></Campo>}
          <Campo rotulo="Data de emissão"><Input type="date" value={f.emissao} onChange={(e) => setF({ ...f, emissao: e.target.value })} /></Campo>
          <Campo rotulo="Vencimento"><Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></Campo>
          <Campo rotulo="Repetição"><Select value={f.repetir} onChange={(e) => setF({ ...f, repetir: e.target.value })}><option value="unica">Só esta</option><option value="mensal">Todo mês (fixa)</option><option value="parcelada">Parcelada</option></Select></Campo>
          {f.repetir !== 'unica' && <Campo rotulo={f.repetir === 'mensal' ? 'Por quantos meses' : 'Nº de parcelas'}><Input inputMode="numeric" value={f.vezes} onChange={(e) => setF({ ...f, vezes: e.target.value.replace(/\D/g, '') })} /></Campo>}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.pago} onChange={(e) => setF({ ...f, pago: e.target.checked })} />{tipo === 'pagar' ? 'Já paguei a primeira' : 'Já recebi a primeira'}</label>
        <Btn className="w-full" disabled={!f.descricao.trim() || !(lerNum(f.valor) > 0)} onClick={async () => {
          const n = f.repetir === 'unica' ? 1 : Math.max(1, Math.min(60, Number(f.vezes) || 1));
          const total = lerNum(f.valor); const base = f.repetir === 'parcelada' ? Math.floor((total / n) * 100) / 100 : total; const grupo = crypto.randomUUID();
          const linhas = Array.from({ length: n }, (_, k) => {
            const [a, m, d] = f.vencimento.split('-').map(Number); const dt = new Date(Date.UTC(a, m - 1 + k, 1)); const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(d, ult));
            const valor = f.repetir === 'parcelada' && k === n - 1 ? Math.round((total - base * (n - 1)) * 100) / 100 : base;
            return { tipo, descricao: f.descricao.trim() + (f.repetir === 'parcelada' && n > 1 ? ` (${k + 1}/${n})` : ''), categoria: f.categoria, fornecedor_id: f.fornecedor_id || null, nota_numero: f.nota_numero || null, emissao: f.emissao, vencimento: dt.toISOString().slice(0, 10), valor, parcela_num: k + 1, parcela_total: n, grupo_id: n > 1 ? grupo : null, origem: 'manual', status: k === 0 && f.pago ? 'pago' : 'pendente', pago_em: k === 0 && f.pago ? hoje() : null, forma_pagamento: k === 0 && f.pago ? f.forma : null };
          });
          const { error } = await supabase.from('rest_contas').insert(linhas);
          if (error) toast(error.message, 'erro'); else { toast(`${linhas.length} conta(s) lançada(s)`); avisarMudanca(); fechar(); }
        }}>Salvar</Btn>
      </div>
    </Modal>
  );
}

function Pagar({ c, fechar }: { c: any; fechar: () => void }) {
  const [modo, setModo] = useState('tudo'); const [valor, setValor] = useState(''); const [data, setData] = useState(hoje()); const [forma, setForma] = useState('PIX');
  const [venc, setVenc] = useState(addMeses(c.vencimento, 1).slice(0, 8) + c.vencimento.slice(8)); const [novoVenc, setNovoVenc] = useState(c.vencimento);
  const [salvando, setSalvando] = useState(false);
  const v = modo === 'tudo' ? Number(c.valor) : lerNum(valor);
  return (
    <Modal aberto fechar={fechar} titulo={c.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento'}>
      <div className="space-y-3 text-sm">
        <div><b>{c.descricao}</b><div className="text-slate-500">{brl(c.valor)} · vence {dataBR(c.vencimento)}{c.rest_fornecedores?.nome ? ` · ${c.rest_fornecedores.nome}` : ''}</div></div>
        <div className="flex gap-2">{[['tudo', 'Valor total'], ['parte', 'Só uma parte']].map(([k, t]) => <button key={k} onClick={() => setModo(k)} className={`flex-1 rounded-xl px-3 py-2 font-medium ${modo === k ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{t}</button>)}</div>
        {modo === 'parte' && <><Campo rotulo="Quanto foi pago"><Dinheiro valor={valor} mudar={setValor} /></Campo><Campo rotulo="Vencimento do restante"><Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} /></Campo></>}
        <div className="grid grid-cols-2 gap-2"><Campo rotulo="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo><Campo rotulo="Forma"><Select value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS_PAGAMENTO.map((x) => <option key={x}>{x}</option>)}</Select></Campo></div>
        <Btn className="w-full" carregando={salvando} disabled={!(v > 0) || v > Number(c.valor) + 0.005} onClick={async () => {
          setSalvando(true);
          try { const r = await rpc('rest_pagar_conta', { p_conta: c.id, p_valor: v, p_data: data, p_forma: forma, p_venc_restante: modo === 'parte' ? venc : null }); toast(r.restante_id ? `Pago ${brl(v)}. Restante de ${brl(Number(c.valor) - v)} lançado.` : 'Pagamento registrado'); avisarMudanca(); fechar(); }
          catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
        }}>Confirmar {brl(v || 0)}</Btn>
        <div className="flex items-end gap-2 border-t pt-3 dark:border-slate-800"><Campo rotulo="Mudar vencimento"><Input type="date" value={novoVenc} onChange={(e) => setNovoVenc(e.target.value)} /></Campo>
          <Btn variante="secundario" disabled={novoVenc === c.vencimento} onClick={async () => { const { error } = await supabase.from('rest_contas').update({ vencimento: novoVenc }).eq('id', c.id); if (error) toast(error.message, 'erro'); else { toast('Vencimento alterado (a agenda acompanha)'); avisarMudanca(); fechar(); } }}>Salvar</Btn></div>
        <Btn variante="fantasma" className="text-rose-600" onClick={async () => { if (!confirm('Cancelar esta conta?')) return; const { error } = await supabase.from('rest_contas').update({ status: 'cancelado' }).eq('id', c.id); if (error) toast(error.message, 'erro'); else { toast('Conta cancelada'); avisarMudanca(); fechar(); } }}>Cancelar conta</Btn>
      </div>
    </Modal>
  );
}

function Fluxo() {
  const { rest, recarregar } = useEu();
  const [editSaldo, setEditSaldo] = useState(false); const [saldo, setSaldo] = useState(String(rest.saldo_inicial).replace('.', ',')); const [saldoEm, setSaldoEm] = useState(rest.saldo_em);
  const { dados } = useDados(async () => {
    const de = addMeses(inicioMes(), -5), ate = addMeses(inicioMes(), 4);
    const [vendas, contas, painel] = await Promise.all([
      q<any[]>(supabase.from('rest_vendas').select('data,liquido').gte('data', de)),
      q<any[]>(supabase.from('rest_contas').select('tipo,valor,status,vencimento,pago_em,emissao,categoria,descricao').neq('status', 'cancelado').or(`vencimento.gte.${de},pago_em.gte.${de}`).lte('vencimento', ate)),
      rpc('rest_painel', { p_de: inicioMes(), p_ate: hoje() }),
    ]);
    return { vendas, contas, painel };
  }, [rest.saldo_em, rest.saldo_inicial]);
  const meses = useMemo(() => {
    if (!dados) return [];
    const m: Record<string, any> = {};
    const g = (iso: string) => (m[iso.slice(0, 7)] ??= { mes: iso.slice(0, 7), vendas: 0, recebido: 0, pago: 0, prevReceber: 0, prevPagar: 0 });
    for (const v of dados.vendas) g(v.data).vendas += +v.liquido;
    for (const c of dados.contas) {
      if (c.status === 'pago') { const x = g(c.pago_em); if (c.tipo === 'pagar') x.pago += +c.valor; else x.recebido += +c.valor; }
      else { const x = g(c.vencimento < hoje() ? hoje() : c.vencimento); if (c.tipo === 'pagar') x.prevPagar += +c.valor; else x.prevReceber += +c.valor; }
    }
    return Object.values(m).sort((a: any, b: any) => a.mes.localeCompare(b.mes)).map((x: any) => ({ ...x, entradas: x.vendas + x.recebido + x.prevReceber, saidas: x.pago + x.prevPagar, resultado: x.vendas + x.recebido + x.prevReceber - x.pago - x.prevPagar }));
  }, [dados]);
  const p = dados?.painel;
  const vencidas = (dados?.contas ?? []).filter((c) => c.status === 'pendente' && c.tipo === 'pagar' && c.vencimento < hoje());
  const proximas = (dados?.contas ?? []).filter((c) => c.status === 'pendente' && c.vencimento >= hoje() && c.vencimento <= addDias(hoje(), 30)).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <button onClick={() => setEditSaldo(true)} className="text-left"><Stat rotulo="Saldo de caixa (estimado)" valor={p ? brl(p.saldo_caixa) : '…'} sub={`desde ${dataBR(rest.saldo_em)} · toque para ajustar`} /></button>
        <Stat rotulo="A pagar (em aberto)" valor={p ? brl(p.a_pagar) : '…'} tom="alerta" />
        <Stat rotulo="Vencidas" valor={p ? brl(p.vencidas) : '…'} tom={p?.vencidas > 0 ? 'ruim' : 'neutro'} sub={p ? `${p.qtd_vencidas} conta(s)` : ''} />
        <Stat rotulo="A receber" valor={p ? brl(p.a_receber) : '…'} tom="bom" />
      </div>
      <Aviso tipo="info">Saldo de caixa = saldo informado + vendas líquidas + recebimentos − pagamentos (desde a data do saldo). Não é o extrato do banco: vendas no cartão podem cair depois.</Aviso>
      <Card titulo="Entradas, saídas e previsão (6 meses para trás e 4 para frente)">
        <div className="h-64"><ResponsiveContainer><ComposedChart data={meses} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="mes" tickFormatter={(m) => mesNome(m + '-01')} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} labelFormatter={(m) => mesNome(m + '-01')} /><Legend />
          <Bar isAnimationActive={false} maxBarSize={56} dataKey="entradas" name="Entradas" fill="#16a34a" radius={[3, 3, 0, 0]} /><Bar isAnimationActive={false} maxBarSize={56} dataKey="saidas" name="Saídas" fill="#a3141b" radius={[3, 3, 0, 0]} /><Line isAnimationActive={false} dataKey="resultado" name="Resultado" stroke="#f79f31" strokeWidth={2} />
        </ComposedChart></ResponsiveContainer></div>
        <Tabela linhas={meses} chave="mes" colunas={[
          { k: 'mes', t: 'Mês', r: (x) => <span>{mesNome(x.mes + '-01')}{x.mes > hoje().slice(0, 7) ? ' (previsão)' : ''}</span> },
          { k: 'v', t: 'Vendas', num: true, r: (x) => brl(x.vendas), esconderCelular: true }, { k: 'pg', t: 'Pago', num: true, r: (x) => brl(x.pago), esconderCelular: true },
          { k: 'pp', t: 'A pagar (previsto)', num: true, r: (x) => brl(x.prevPagar), esconderCelular: true },
          { k: 'e', t: 'Entradas', num: true, r: (x) => brl(x.entradas) }, { k: 's', t: 'Saídas', num: true, r: (x) => brl(x.saidas) },
          { k: 'r', t: 'Resultado', num: true, r: (x) => <b className={x.resultado < 0 ? 'text-rose-600' : 'text-emerald-700'}>{brl(x.resultado)}</b> },
        ]} />
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card titulo={`Contas vencidas (${vencidas.length})`}>{vencidas.length ? vencidas.map((c, k) => <div key={k} className="flex justify-between border-b py-1 text-sm last:border-0 dark:border-slate-800"><span className="truncate">{c.descricao} · {dataBR(c.vencimento)}</span><b className="text-rose-600">{brl(c.valor)}</b></div>) : <p className="text-sm text-slate-500">Nenhuma. 👍</p>}</Card>
        <Card titulo="Próximos 30 dias">{proximas.length ? proximas.map((c, k) => <div key={k} className="flex justify-between border-b py-1 text-sm last:border-0 dark:border-slate-800"><span className="truncate">{c.tipo === 'receber' ? '📥' : '📤'} {c.descricao} · {dataBR(c.vencimento)}</span><b>{brl(c.valor)}</b></div>) : <p className="text-sm text-slate-500">Nada previsto.</p>}</Card>
      </div>
      <Modal aberto={editSaldo} fechar={() => setEditSaldo(false)} titulo="Saldo de caixa">
        <p className="mb-3 text-sm text-slate-600">Informe quanto o restaurante tinha (caixa + banco) numa data. A partir dela o app soma as vendas e recebimentos e desconta os pagamentos.</p>
        <div className="grid grid-cols-2 gap-2"><Campo rotulo="Saldo"><Dinheiro valor={saldo} mudar={setSaldo} /></Campo><Campo rotulo="Em"><Input type="date" value={saldoEm} onChange={(e) => setSaldoEm(e.target.value)} /></Campo></div>
        <Btn className="mt-3 w-full" onClick={async () => { const { error } = await supabase.from('rest_restaurantes').update({ saldo_inicial: lerNum(saldo) || 0, saldo_em: saldoEm }).eq('id', rest.id); if (error) toast(error.message, 'erro'); else { toast('Saldo atualizado'); setEditSaldo(false); recarregar(); avisarMudanca(); } }}>Salvar</Btn>
      </Modal>
    </div>
  );
}

function Agenda() {
  const { rest, recarregar } = useEu();
  const url = `${SUPABASE_URL}/functions/v1/rest-agenda?t=${rest.agenda_token}`;
  const copiar = async () => { try { await navigator.clipboard.writeText(url); toast('Link copiado'); } catch { toast('Copie o link manualmente', 'info'); } };
  return (
    <div className="space-y-3">
      <Card titulo="Vencimentos no Google Agenda (automático)">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Copie o link abaixo.</li>
          <li>No computador, abra <b>calendar.google.com</b> → ao lado de “Outras agendas” toque em <b>+</b> → <b>Do URL</b>.</li>
          <li>Cole o link e toque em <b>Adicionar agenda</b>.</li>
        </ol>
        <div className="mt-3 flex gap-2"><Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} /><Btn variante="secundario" onClick={copiar}><Copy className="h-4 w-4" /></Btn></div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-400">
          <li>Cada conta com vencimento vira um compromisso: “Pagar: Compra #12 · Centro Sul — R$ 480,00”.</li>
          <li>Se o vencimento mudar, o compromisso muda; se a conta for paga, aparece como ✅ Pago. Não duplica.</li>
          <li>O Google atualiza agendas por link algumas vezes por dia (não é instantâneo).</li>
          <li>Lembretes de 3 dias, 1 dia e no dia vão no calendário; o Google Agenda usa as notificações padrão da agenda para agendas por link — ative em Configurações da agenda → Notificações.</li>
          <li>Também dá para adicionar uma conta específica tocando no ícone 📅 na lista de contas.</li>
        </ul>
      </Card>
      <Card titulo="Segurança do link">
        <p className="text-sm text-slate-600">Quem tiver o link vê os vencimentos (descrição e valor). Se ele vazar, gere outro: o antigo para de funcionar.</p>
        <Btn variante="secundario" className="mt-2" onClick={async () => {
          const novo = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((b) => b.toString(16).padStart(2, '0')).join('');
          const { error } = await supabase.from('rest_restaurantes').update({ agenda_token: novo }).eq('id', rest.id);
          if (error) toast(error.message, 'erro'); else { toast('Novo link gerado. Adicione de novo no Google Agenda.'); recarregar(); }
        }}>Gerar novo link</Btn>
      </Card>
    </div>
  );
}
