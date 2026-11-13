import { useEffect, useMemo, useState } from 'react';
import { Check, Crosshair, ExternalLink, FileSpreadsheet, FileText, Lock, LockOpen, Plus, Sheet, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { abrirPrivado } from '../lib/arquivos';
import { addDias, brl, dataBR, dataHora, fimMes, inicioMes } from '../lib/fmt';
import { gerarExcel, gerarPDF, type Rel } from '../lib/relatorios';
import { salvarTexto } from '../lib/nativo';
import { COR_NOME, fmtHM, hojeLocal, horaLocal, local, montarDias, NOMES_TIPO, textoMotivos, totais, type Cor, type Dia } from '../lib/ponto/dados';
import { carregarPeriodo, carregarRecebidos, somarRecebidos, COLS_ESPELHO, CorDia, FotoPrivada, Legenda, linhasEspelho } from '../components/ponto/comum';
import FuncionarioPonto from '../components/ponto/FuncionarioPonto';
import { ROTULO_AUS, ROTULO_ENTREGA } from './MeuPonto';
import { Abas, Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Stat, Tabela, Textarea, toast, useDados } from '../components/ui';

const ABAS = [{ id: 'painel', t: 'Painel' }, { id: 'pendencias', t: 'Análise' }, { id: 'planilha', t: 'Planilha' }, { id: 'equipe', t: 'Funcionários' }, { id: 'atestados', t: 'Atestados' }, { id: 'locais', t: 'Locais' }, { id: 'fechamento', t: 'Fechamento' }];

const useEquipe = () => useDados(() => q<any[]>(supabase.from('rest_funcionarios').select('id, nome, ativo, papeis').order('nome')), []);

export default function Ponto() {
  const [aba, setAba] = useState('painel');
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Controle de ponto" sub="Jornada da equipe conforme a CLT e a Portaria MTP 671/2021" />
      <Abas abas={ABAS} ativa={aba} mudar={setAba} />
      {aba === 'painel' && <Painel ir={setAba} />}
      {aba === 'pendencias' && <Pendencias />}
      {aba === 'planilha' && <Planilha />}
      {aba === 'equipe' && <Equipe />}
      {aba === 'atestados' && <Atestados />}
      {aba === 'locais' && <Locais />}
      {aba === 'fechamento' && <Fechamento />}
    </div>
  );
}

/** apura todos os empregados ativos no período */
async function apurarTodos(de: string, ate: string) {
  const [equipe, p] = await Promise.all([q<any[]>(supabase.from('rest_funcionarios').select('id, nome, ativo').eq('ativo', true).order('nome')), carregarPeriodo(de, ate)]);
  return { equipe, p, porFunc: equipe.map((f) => ({ f, dias: montarDias(f.id, de, ate, p.jornadas, p.folgas, p.marcacoes, p.ausencias) })) };
}

function Painel({ ir }: { ir: (a: string) => void }) {
  const hoje = hojeLocal();
  const { dados } = useDados(async () => {
    const [t, avisos, ajustes, aus] = await Promise.all([
      apurarTodos(hoje, hoje),
      q<any[]>(supabase.from('rest_ponto_avisos').select('*').is('para', null).order('criado_em', { ascending: false }).limit(20)),
      q<any[]>(supabase.from('rest_ponto_ajustes').select('id').eq('status', 'pendente')),
      q<any[]>(supabase.from('rest_ponto_ausencias').select('id, status, entrega_fisica').or('status.eq.aguardando_conferencia,entrega_fisica.eq.aguardando,entrega_fisica.eq.pendente_regularizacao')),
    ]);
    return { ...t, avisos, ajustes, aus };
  }, [hoje]);
  if (!dados) return <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>;
  const agora = local(new Date()).min;
  const linhas = dados.porFunc.map(({ f, dias }) => ({ f, d: dias[0] }));
  const cont = (c: Cor) => linhas.filter((l) => l.d.cor === c).length;
  const pendMarc = dados.p.marcacoes.filter((m) => m.situacao === 'pendente' && !m.substituida_por).length;
  // alertas calculados agora: sem entrada 15 min após o previsto, sem saída 30 min após o previsto, intervalo não registrado
  const hm = (s?: string) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5)) : null);
  const alertas = linhas.flatMap(({ f, d }) => {
    if (!d.cfg || d.atestado) return [];
    const tem = (t: string) => d.marcs.some((m) => m.tipo === t); const a: string[] = [];
    if (!tem('entrada') && agora > hm(d.cfg.entrada)! + 15) a.push(`${f.nome}: sem registro de entrada (previsto ${d.cfg.entrada})`);
    if (tem('entrada') && d.cfg.int_ini && !tem('saida_intervalo') && agora > hm(d.cfg.int_fim)! + 15) a.push(`${f.nome}: intervalo não registrado`);
    if (tem('entrada') && !tem('saida') && hm(d.cfg.saida)! > hm(d.cfg.entrada)! && agora > hm(d.cfg.saida)! + 30) a.push(`${f.nome}: sem registro de saída (previsto ${d.cfg.saida})`);
    return a;
  });
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat rotulo="Em andamento" valor={cont('azul')} icone={<span className="h-3 w-3 rounded-full bg-sky-500" />} />
        <Stat rotulo="Não iniciados" valor={cont('cinza')} icone={<span className="h-3 w-3 rounded-full bg-slate-400" />} />
        <Stat rotulo="Em análise" valor={pendMarc + dados.ajustes.length} tom={pendMarc + dados.ajustes.length ? 'alerta' : 'neutro'} sub={`${pendMarc} marcações · ${dados.ajustes.length} correções`} />
        <Stat rotulo="Atestados a conferir" valor={dados.aus.length} tom={dados.aus.length ? 'alerta' : 'neutro'} />
      </div>
      {alertas.length > 0 && <Aviso tipo="erro"><b>Atenção agora:</b><ul className="ml-4 list-disc">{alertas.map((a) => <li key={a}>{a}</li>)}</ul></Aviso>}
      <Card titulo={`Hoje, ${dataBR(hoje)}`} acao={<Legenda />}>
        <div className="space-y-1.5">{linhas.map(({ f, d }) => (
          <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-2 text-sm dark:border-slate-800">
            <b className="min-w-[8rem] flex-1">{f.nome}</b>
            <span className="text-xs text-slate-500">{d.cfg ? `${d.cfg.entrada}–${d.cfg.saida}` : d.folga ? 'Folga' : 'Sem jornada'}</span>
            <span className="tabular-nums text-xs">{['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'].map((t) => horaLocal(d.marcs.find((m) => m.tipo === t)?.horario)).join(' · ')}</span>
            <CorDia cor={d.cor}>{d.atestado ? (d.atestado.status === 'aceito' ? 'Ausência justificada' : 'Atestado em conferência') : COR_NOME[d.cor]}</CorDia>
          </div>))}
          {!linhas.length && <p className="text-sm text-slate-500">Cadastre a equipe em Equipe.</p>}
        </div>
      </Card>
      <Card titulo="Notificações" acao={<Btn variante="fantasma" onClick={() => ir('pendencias')}>Ir para análise</Btn>}>
        {!dados.avisos.length ? <p className="text-sm text-slate-500">Sem notificações.</p> : <div className="space-y-1.5">{dados.avisos.map((a) => <div key={a.id} className={`rounded-lg p-2 text-sm ${a.lido ? 'text-slate-500' : 'bg-amber-50 dark:bg-amber-950/30'}`}>{a.texto} <span className="text-xs text-slate-400">· {dataHora(a.criado_em)}</span></div>)}</div>}
        {dados.avisos.some((a) => !a.lido) && <Btn variante="secundario" className="mt-2" onClick={async () => { await supabase.from('rest_ponto_avisos').update({ lido: true }).is('para', null).eq('lido', false); avisarMudanca(); }}>Marcar como lidas</Btn>}
      </Card>
    </div>
  );
}

function Pendencias() {
  const { dados } = useDados(async () => {
    const [marc, aju, equipe, bio] = await Promise.all([
      q<any[]>(supabase.from('rest_ponto_marcacoes').select('*').eq('situacao', 'pendente').is('substituida_por', null).order('horario', { ascending: false })),
      q<any[]>(supabase.from('rest_ponto_ajustes').select('*').eq('status', 'pendente').order('solicitado_em')),
      q<any[]>(supabase.from('rest_funcionarios').select('id, nome')),
      q<any[]>(supabase.from('rest_func_biometria').select('funcionario_id, foto_path')),
    ]);
    return { marc, aju, nome: Object.fromEntries(equipe.map((f) => [f.id, f.nome])), ref: Object.fromEntries(bio.map((b) => [b.funcionario_id, b.foto_path])) };
  }, []);
  const [obs, setObs] = useState<Record<string, string>>({});
  const decidir = async (fn: string, args: any, ok: string) => { const { error } = await supabase.rpc(fn, args); if (error) toast(error.message, 'erro'); else { toast(ok); avisarMudanca(); } };
  if (!dados) return <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>;
  return (
    <div className="space-y-3">
      <Aviso>Marcações fora da janela, fora do local, sem rosto confirmado ou de contingência ficam aqui. O horário real nunca é alterado; ao aprovar, ele passa a valer como está. Para outro horário, use a correção (o original fica guardado).</Aviso>
      <Card titulo={`Marcações em análise (${dados.marc.length})`}>
        {!dados.marc.length ? <p className="text-sm text-slate-500">Nada para analisar.</p> : <div className="space-y-3">{dados.marc.map((m) => (
          <div key={m.id} className="rounded-xl border border-amber-200 p-3 text-sm dark:border-amber-900">
            <div className="flex gap-3">
              <div className="flex gap-1"><FotoPrivada caminho={m.selfie_path} className="h-20 w-20" /><FotoPrivada caminho={dados.ref[m.funcionario_id]} className="h-20 w-20 opacity-80" /></div>
              <div className="min-w-0 flex-1">
                <b>{dados.nome[m.funcionario_id]}</b> · {NOMES_TIPO[m.tipo as keyof typeof NOMES_TIPO]} · <b>{dataBR(m.data_ref)} {horaLocal(m.horario)}</b>{m.previsto && <span className="text-slate-500"> (previsto {horaLocal(m.previsto)}, {m.diferenca_min > 0 ? '+' : ''}{m.diferenca_min} min)</span>}
                <div className="text-amber-700 dark:text-amber-400">{textoMotivos(m.motivos)}</div>
                <div className="text-xs text-slate-500">NSR {m.nsr} · {m.origem === 'contingencia' ? 'contingência' : 'app'}{m.horario_informado && ` · horário do aparelho ${horaLocal(m.horario_informado)}`}{m.face_distancia != null && ` · distância facial ${m.face_distancia.toFixed(2).replace(".", ",")} (confere até 0,50)`}{m.distancia_m != null && ` · ${m.distancia_m} m do local`}</div>
                {m.endereco && <div className="truncate text-xs text-slate-500">{m.endereco}</div>}
                {m.lat != null && <a className="inline-flex items-center gap-1 text-xs text-brand-700" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${m.lat}&mlon=${m.lng}#map=18/${m.lat}/${m.lng}`}>Ver no mapa<ExternalLink className="h-3 w-3" /></a>}
                {m.justificativa && <div className="mt-1 rounded-lg bg-slate-50 p-1.5 text-xs dark:bg-slate-800">Justificativa: {m.justificativa}</div>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input placeholder="Observação (obrigatória para rejeitar)" value={obs[m.id] ?? ''} onChange={(e) => setObs({ ...obs, [m.id]: e.target.value })} className="!w-auto flex-1" />
              <Btn onClick={() => decidir('rest_ponto_analisar', { p_id: m.id, p_situacao: 'aprovado', p_obs: obs[m.id] || null }, 'Marcação aprovada')}><Check className="h-4 w-4" />Aprovar</Btn>
              <Btn variante="perigo" onClick={() => decidir('rest_ponto_analisar', { p_id: m.id, p_situacao: 'rejeitado', p_obs: obs[m.id] || '' }, 'Marcação rejeitada')}><X className="h-4 w-4" />Rejeitar</Btn>
            </div>
          </div>))}</div>}
      </Card>
      <Card titulo={`Solicitações de correção (${dados.aju.length})`}>
        {!dados.aju.length ? <p className="text-sm text-slate-500">Nenhuma solicitação.</p> : <div className="space-y-2">{dados.aju.map((a) => (
          <div key={a.id} className="rounded-xl border p-3 text-sm dark:border-slate-800">
            <b>{dados.nome[a.funcionario_id]}</b> · {dataBR(a.data_ref)} · {NOMES_TIPO[a.tipo as keyof typeof NOMES_TIPO]} → <b>{horaLocal(a.horario_proposto)}</b>
            <div className="text-xs text-slate-500">“{a.justificativa}” · pedido em {dataHora(a.solicitado_em)}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input placeholder="Observação (obrigatória para recusar)" value={obs[a.id] ?? ''} onChange={(e) => setObs({ ...obs, [a.id]: e.target.value })} className="!w-auto flex-1" />
              <Btn onClick={() => decidir('rest_ponto_ajuste_decidir', { p_id: a.id, p_aprovar: true, p_obs: obs[a.id] || null }, 'Correção aprovada (original preservado)')}><Check className="h-4 w-4" />Aprovar</Btn>
              <Btn variante="perigo" onClick={() => decidir('rest_ponto_ajuste_decidir', { p_id: a.id, p_aprovar: false, p_obs: obs[a.id] || '' }, 'Correção recusada')}><X className="h-4 w-4" />Recusar</Btn>
            </div>
          </div>))}</div>}
      </Card>
    </div>
  );
}

function Planilha() {
  const { rest } = useEu();
  const [f, setF] = useState({ de: inicioMes(), ate: hojeLocal(), func: '', cor: '' });
  const { dados } = useDados(() => apurarTodos(f.de, f.ate), [f.de, f.ate]);
  const linhas = useMemo(() => {
    if (!dados) return null;
    return dados.porFunc.filter((x) => !f.func || x.f.id === f.func).flatMap(({ f: func, dias }) => linhasEspelho(dias).map((l, i) => ({ ...l, id: func.id + l.data, func: func.nome, cor: dias[i].cor, saldoMin: dias[i].saldo, extraMin: dias[i].extra, atrasoMin: dias[i].atraso, faltante: dias[i].faltante })))
      .filter((l) => !f.cor || l.cor === f.cor);
  }, [dados, f.func, f.cor]);
  const tot = (k: string) => (linhas ?? []).reduce((t, l: any) => t + (l[k] || 0), 0);
  const rel = (): Rel => ({ titulo: 'Planilha de ponto', periodo: `${dataBR(f.de)} a ${dataBR(f.ate)}`, restaurante: rest.nome, resumo: [['Saldo', fmtHM(tot('saldoMin'))], ['Horas extras', fmtHM(tot('extraMin'))], ['Atrasos', fmtHM(tot('atrasoMin'))], ['Linhas', String(linhas!.length)]], tabelas: [{ titulo: 'Ponto por dia', colunas: [{ t: 'Funcionário', k: 'func' }, ...COLS_ESPELHO], linhas: linhas! }] });
  const csv = () => { const cols = [{ t: 'Funcionário', k: 'func' }, ...COLS_ESPELHO]; const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`; salvarTexto(`ponto-${f.de}-a-${f.ate}.csv`, '﻿' + [cols.map((c) => esc(c.t)).join(';'), ...linhas!.map((l: any) => cols.map((c) => esc(c.k === 'data' ? dataBR(l.data) : l[c.k])).join(';'))].join('\n')); };
  return (
    <div className="space-y-3">
      <Card>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Campo rotulo="De"><Input type="date" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} /></Campo>
          <Campo rotulo="Até"><Input type="date" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} /></Campo>
          <Campo rotulo="Funcionário"><Select value={f.func} onChange={(e) => setF({ ...f, func: e.target.value })}><option value="">Todos</option>{dados?.equipe.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select></Campo>
          <Campo rotulo="Situação"><Select value={f.cor} onChange={(e) => setF({ ...f, cor: e.target.value })}><option value="">Todas</option>{Object.entries(COR_NOME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
        </div>
        {linhas && <div className="mt-3 flex flex-wrap gap-2"><Btn variante="secundario" onClick={() => gerarExcel(rel())}><FileSpreadsheet className="h-4 w-4" />Excel (XLSX)</Btn><Btn variante="secundario" onClick={() => gerarPDF(rel())}><FileText className="h-4 w-4" />PDF</Btn><Btn variante="secundario" onClick={csv}><Sheet className="h-4 w-4" />CSV</Btn>
          <span className="ml-auto self-center text-sm text-slate-500">Saldo {fmtHM(tot('saldoMin'))} · extras {fmtHM(tot('extraMin'))} · atrasos {fmtHM(tot('atrasoMin'))}</span></div>}
      </Card>
      <Tabela linhas={linhas} vazio="Nada no período." colunas={[
        { k: 'func', t: 'Funcionário' }, { k: 'data', t: 'Data', r: (l: any) => `${dataBR(l.data).slice(0, 5)} ${l.dia}` }, { k: 'previsto', t: 'Previsto', esconderCelular: true },
        { k: 'm', t: 'Marcações', r: (l: any) => <span className="tabular-nums">{[l.entrada, l.sint, l.ret, l.saida].join(' · ')}</span> },
        { k: 'trab', t: 'Trabalhado', num: true }, { k: 'saldo', t: 'Saldo', num: true }, { k: 'extra', t: 'Extra', num: true, esconderCelular: true },
        { k: 'sit', t: 'Situação', r: (l: any) => <CorDia cor={l.cor}>{l.sit}</CorDia> },
      ]} />
    </div>
  );
}

function Equipe() {
  const { dados } = useEquipe();
  const [sel, setSel] = useState<any>(null);
  const { dados: extra } = useDados(async () => {
    const [fichas, jornadas, bio] = await Promise.all([q<any[]>(supabase.from('rest_func_ficha').select('funcionario_id, cargo, cpf, pis, data_admissao, foto_path')), q<any[]>(supabase.from('rest_ponto_jornadas').select('funcionario_id')), q<any[]>(supabase.from('rest_func_biometria').select('funcionario_id'))]);
    return { ficha: Object.fromEntries(fichas.map((x) => [x.funcionario_id, x])), jorn: new Set(jornadas.map((x) => x.funcionario_id)), bio: new Set(bio.map((x) => x.funcionario_id)) };
  }, []);
  return (
    <div className="space-y-3">
      <Aviso>Toque na pessoa para abrir a ficha cadastral completa, a jornada, o rosto de referência, o espelho e o histórico com as selfies. Novas pessoas são adicionadas em Equipe.</Aviso>
      <Tabela linhas={dados?.filter((f) => f.ativo)} aoClicar={setSel} colunas={[
        { k: 'nome', t: 'Nome', r: (f) => <span className="flex items-center gap-2"><FotoPrivada caminho={extra?.ficha[f.id]?.foto_path} className="h-8 w-8" />{f.nome}</span> },
        { k: 'cargo', t: 'Cargo', r: (f) => extra?.ficha[f.id]?.cargo ?? '—' },
        { k: 'doc', t: 'Ficha', r: (f) => { const x = extra?.ficha[f.id]; return x?.cpf && x?.pis && x?.data_admissao ? <CorDia cor="verde">Completa</CorDia> : <CorDia cor="amarelo">Incompleta</CorDia>; } },
        { k: 'j', t: 'Jornada', r: (f) => (extra?.jorn.has(f.id) ? <CorDia cor="verde">Cadastrada</CorDia> : <CorDia cor="vermelho">Falta cadastrar</CorDia>) },
        { k: 'b', t: 'Rosto', r: (f) => (extra?.bio.has(f.id) ? <CorDia cor="verde">Cadastrado</CorDia> : <CorDia cor="cinza">No 1º registro</CorDia>), esconderCelular: true },
      ]} />
      {sel && <FuncionarioPonto f={sel} fechar={() => setSel(null)} />}
    </div>
  );
}

function Atestados() {
  const { dados } = useDados(async () => {
    const [aus, equipe] = await Promise.all([q<any[]>(supabase.from('rest_ponto_ausencias').select('*').order('enviado_em', { ascending: false }).limit(200)), q<any[]>(supabase.from('rest_funcionarios').select('id, nome'))]);
    return { aus, nome: Object.fromEntries(equipe.map((f) => [f.id, f.nome])) };
  }, []);
  const [ed, setEd] = useState<any>(null);
  return (
    <div className="space-y-3">
      <Aviso tipo="alerta">Dados de saúde são sensíveis (LGPD art. 11): só o administrador e o próprio funcionário veem os atestados. Nos relatórios gerais aparece apenas “ausência justificada”.</Aviso>
      <Tabela linhas={dados?.aus} aoClicar={setEd} vazio="Nenhuma ausência comunicada." colunas={[
        { k: 'f', t: 'Funcionário', r: (a) => dados!.nome[a.funcionario_id] },
        { k: 'p', t: 'Período', r: (a) => `${dataBR(a.data_inicio)}${a.data_fim !== a.data_inicio ? ' a ' + dataBR(a.data_fim) : ''}` },
        { k: 's', t: 'Conferência', r: (a) => <CorDia cor={a.status === 'aceito' ? 'verde' : a.status === 'recusado' ? 'vermelho' : 'amarelo'}>{ROTULO_AUS[a.status]}</CorDia> },
        { k: 'e', t: 'Entrega física', r: (a) => <CorDia cor={a.entrega_fisica === 'conferido' || a.entrega_fisica === 'entregue' ? 'verde' : a.entrega_fisica === 'pendente_regularizacao' ? 'vermelho' : 'cinza'}>{ROTULO_ENTREGA[a.entrega_fisica]}{a.entregue_em ? ` · ${dataBR(a.entregue_em)}` : ''}</CorDia> },
      ]} />
      {ed && <EditarAtestado a={ed} nome={dados!.nome[ed.funcionario_id]} fechar={() => setEd(null)} />}
    </div>
  );
}

function EditarAtestado({ a, nome, fechar }: { a: any; nome: string; fechar: () => void }) {
  const { eu } = useEu();
  const [d, setD] = useState({ status: a.status, entrega_fisica: a.entrega_fisica, entregue_em: a.entregue_em ?? '', obs_admin: a.obs_admin ?? '' });
  const salvar = async () => {
    try {
      await q(supabase.from('rest_ponto_ausencias').update({ ...d, entregue_em: d.entregue_em || null, conferido_por: eu.id, conferido_em: new Date().toISOString() }).eq('id', a.id));
      toast('Atestado atualizado'); avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={`Ausência de ${nome}`}>
      <div className="space-y-3 text-sm">
        <div>{dataBR(a.data_inicio)} a {dataBR(a.data_fim)} · enviado em {dataHora(a.enviado_em)}</div>
        {a.observacao && <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-800">{a.observacao}</div>}
        {a.arquivo_path ? <Btn variante="secundario" onClick={() => abrirPrivado(a.arquivo_path).catch((e) => toast(e.message, 'erro'))}><ExternalLink className="h-4 w-4" />Abrir atestado</Btn> : <Aviso tipo="alerta">Sem arquivo anexado.</Aviso>}
        <Campo rotulo="Conferência do documento"><Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}>{Object.entries(ROTULO_AUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Entrega física"><Select value={d.entrega_fisica} onChange={(e) => setD({ ...d, entrega_fisica: e.target.value, entregue_em: e.target.value !== 'aguardando' && !d.entregue_em ? hojeLocal() : d.entregue_em })}>{Object.entries(ROTULO_ENTREGA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
          <Campo rotulo="Data da entrega"><Input type="date" value={d.entregue_em} onChange={(e) => setD({ ...d, entregue_em: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Observação para o funcionário"><Textarea rows={2} value={d.obs_admin} onChange={(e) => setD({ ...d, obs_admin: e.target.value })} /></Campo>
        <p className="text-xs text-slate-500">Atestado aceito abona os dias (não conta falta nem desconta horas).</p>
        <Btn className="w-full" onClick={salvar}>Salvar</Btn>
      </div>
    </Modal>
  );
}

function Locais() {
  const { dados } = useDados(() => q<any[]>(supabase.from('rest_ponto_locais').select('*').order('nome')), []);
  const [ed, setEd] = useState<any>(null);
  return (
    <div className="space-y-3">
      <Aviso>O registro feito dentro do raio de um local autorizado é aprovado automaticamente (se o rosto também conferir). Fora do raio, o funcionário ainda consegue registrar, com justificativa, e vai para análise.</Aviso>
      <Btn onClick={() => setEd({ raio_m: 100, ativo: true })}><Plus className="h-4 w-4" />Novo local</Btn>
      <Tabela linhas={dados} aoClicar={setEd} vazio="Nenhum local cadastrado: sem local, a localização é guardada mas não é conferida." colunas={[
        { k: 'nome', t: 'Local' }, { k: 'endereco', t: 'Endereço', r: (l) => l.endereco ?? '—' }, { k: 'raio_m', t: 'Raio', r: (l) => `${l.raio_m} m`, num: true },
        { k: 'ativo', t: 'Situação', r: (l) => <CorDia cor={l.ativo ? 'verde' : 'cinza'}>{l.ativo ? 'Ativo' : 'Inativo'}</CorDia> },
      ]} />
      {ed && <EditarLocal l={ed} fechar={() => setEd(null)} />}
    </div>
  );
}

function EditarLocal({ l, fechar }: { l: any; fechar: () => void }) {
  const [d, setD] = useState({ nome: l.nome ?? '', endereco: l.endereco ?? '', lat: l.lat ?? '', lng: l.lng ?? '', raio_m: l.raio_m ?? 100, ativo: l.ativo ?? true });
  const [buscando, setBuscando] = useState(false);
  const aqui = () => { setBuscando(true); navigator.geolocation?.getCurrentPosition((p) => { setD((x) => ({ ...x, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); setBuscando(false); }, () => { toast('Não consegui a localização. Verifique a permissão.', 'erro'); setBuscando(false); }, { enableHighAccuracy: true, timeout: 15000 }); };
  const salvar = async () => {
    const lat = Number(String(d.lat).replace(',', '.')), lng = Number(String(d.lng).replace(',', '.'));
    if (!d.nome || !isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return toast('Informe nome, latitude e longitude', 'erro');
    try {
      const reg = { nome: d.nome, endereco: d.endereco || null, lat, lng, raio_m: Number(d.raio_m), ativo: d.ativo };
      await q(l.id ? supabase.from('rest_ponto_locais').update(reg).eq('id', l.id) : supabase.from('rest_ponto_locais').insert(reg));
      toast('Local salvo'); avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={l.id ? 'Editar local' : 'Novo local autorizado'}>
      <div className="space-y-3">
        <Campo rotulo="Nome"><Input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} placeholder="Restaurante — salão" /></Campo>
        <Campo rotulo="Endereço"><Input value={d.endereco} onChange={(e) => setD({ ...d, endereco: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-2"><Campo rotulo="Latitude"><Input value={d.lat} onChange={(e) => setD({ ...d, lat: e.target.value })} /></Campo><Campo rotulo="Longitude"><Input value={d.lng} onChange={(e) => setD({ ...d, lng: e.target.value })} /></Campo></div>
        <Btn variante="secundario" carregando={buscando} onClick={aqui}><Crosshair className="h-4 w-4" />Usar minha localização atual</Btn>
        <Campo rotulo={`Raio permitido: ${d.raio_m} m`} dica="Considere a imprecisão do GPS dentro de prédios (30 a 80 m)."><input type="range" min={20} max={1000} step={10} value={d.raio_m} onChange={(e) => setD({ ...d, raio_m: Number(e.target.value) })} className="w-full" /></Campo>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} />Ativo</label>
        <Btn className="w-full" onClick={salvar}>Salvar</Btn>
      </div>
    </Modal>
  );
}

function Fechamento() {
  const [mes, setMes] = useState(addDias(inicioMes(), -1).slice(0, 7));
  const de = mes + '-01', ate = fimMes(de);
  const { dados } = useDados(async () => {
    const [t, hist, aju, receb] = await Promise.all([apurarTodos(de, ate), q<any[]>(supabase.from('rest_ponto_fechamentos').select('*').order('mes', { ascending: false })), q<any[]>(supabase.from('rest_ponto_ajustes').select('id').eq('status', 'pendente').gte('data_ref', de).lte('data_ref', ate)), carregarRecebidos(de, ate, null).catch(() => [])]);
    return { ...t, hist, aju, receb };
  }, [mes]);
  const [motivo, setMotivo] = useState('');
  const [rodando, setRodando] = useState(false);
  if (!dados) return <div className="p-6 text-center text-sm text-slate-500">Carregando…</div>;
  const atual = dados.hist.find((h) => h.mes === de);
  const resumo = dados.porFunc.map(({ f, dias }) => ({ id: f.id, nome: f.nome, ...totais(dias), recebido: somarRecebidos(dados.receb.filter((x) => x.funcionario_id === f.id)) }));
  const pend = resumo.reduce((t, r) => t + r.pendentes, 0);
  const fechar = async () => {
    setRodando(true);
    const { error } = await supabase.rpc('rest_ponto_fechar_mes', { p_mes: de, p_resumo: { gerado_em: new Date().toISOString(), funcionarios: resumo.map((r) => ({ id: r.id, nome: r.nome, previsto: r.previsto, trabalhado: r.trabalhado, saldo: r.saldo, extra: r.extra, faltas: r.faltas, atraso: r.atraso, noturno: r.noturnoReal, pendentes: r.pendentes, vales: r.recebido.vale, transporte: r.recebido.transporte, outros_recebidos: r.recebido.outros })) } });
    setRodando(false); if (error) toast(error.message, 'erro'); else { toast('Mês fechado'); avisarMudanca(); }
  };
  const reabrir = async () => { const { error } = await supabase.rpc('rest_ponto_reabrir_mes', { p_mes: de, p_motivo: motivo }); if (error) toast(error.message, 'erro'); else { toast('Mês reaberto (fica no histórico)'); setMotivo(''); avisarMudanca(); } };
  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="!w-auto" />
          {atual?.status === 'fechado' ? <CorDia cor="verde">Fechado em {dataHora(atual.fechado_em)}</CorDia> : <CorDia cor="cinza">Aberto</CorDia>}
        </div>
        {atual?.status !== 'fechado' ? <div className="mt-3 space-y-2">
          {dados.aju.length > 0 && <Aviso tipo="erro">Há {dados.aju.length} solicitação(ões) de correção pendente(s) neste mês. Decida na aba Análise antes de fechar.</Aviso>}
          {pend > 0 && <Aviso tipo="alerta">{pend} marcação(ões) ainda em análise. Você pode fechar, mas o ideal é analisar antes.</Aviso>}
          <Btn disabled={dados.aju.length > 0} carregando={rodando} onClick={fechar}><Lock className="h-4 w-4" />Fechar {mes.split('-').reverse().join('/')}</Btn>
          <p className="text-xs text-slate-500">Depois de fechado, ninguém altera marcações nem análises do mês. A equipe recebe aviso para conferir o espelho.</p>
        </div> : <div className="mt-3 flex flex-wrap gap-2"><Input placeholder="Motivo da reabertura (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className="!w-auto flex-1" /><Btn variante="secundario" onClick={reabrir}><LockOpen className="h-4 w-4" />Reabrir</Btn></div>}
      </Card>
      <Tabela linhas={resumo} colunas={[
        { k: 'nome', t: 'Funcionário' }, { k: 'p', t: 'Previsto', r: (r) => fmtHM(r.previsto), num: true }, { k: 't', t: 'Trabalhado', r: (r) => fmtHM(r.trabalhado), num: true },
        { k: 's', t: 'Saldo', r: (r) => <span className={r.saldo < 0 ? 'text-red-600' : ''}>{fmtHM(r.saldo)}</span>, num: true }, { k: 'e', t: 'Extras', r: (r) => fmtHM(r.extra), num: true },
        { k: 'f', t: 'Faltas', r: (r) => r.faltas, num: true }, { k: 'a', t: 'Atrasos', r: (r) => fmtHM(r.atraso), num: true, esconderCelular: true }, { k: 'n', t: 'Noturno', r: (r) => fmtHM(r.noturnoReal), num: true, esconderCelular: true },
        { k: 'pe', t: 'Em análise', r: (r) => r.pendentes || '', num: true },
        { k: 'rv', t: 'Vales', r: (r) => (r.recebido.vale ? brl(r.recebido.vale) : ''), num: true }, { k: 'rt', t: 'Transporte', r: (r) => (r.recebido.transporte ? brl(r.recebido.transporte) : ''), num: true },
        { k: 'ro', t: 'Outros receb.', r: (r) => (r.recebido.outros ? brl(r.recebido.outros) : ''), num: true, esconderCelular: true },
      ]} />
      <p className="text-xs text-slate-500">Vales, transporte e outros = o que cada um já recebeu pelo caixa no mês (lançado na sangria do Caixa, atrelado ao funcionário). Use para descontar/acertar no pagamento.</p>
      <Card titulo="Histórico de fechamentos">
        {!dados.hist.length ? <p className="text-sm text-slate-500">Nenhum mês fechado ainda.</p> : <div className="space-y-1.5 text-sm">{dados.hist.map((h) => <div key={h.id}><b>{h.mes.slice(5, 7)}/{h.mes.slice(0, 4)}</b> · fechado em {dataHora(h.fechado_em)}{h.status === 'reaberto' && <> · <span className="text-amber-700">reaberto em {dataHora(h.reaberto_em)}: {h.motivo_reabertura}</span></>}</div>)}</div>}
      </Card>
    </div>
  );
}

