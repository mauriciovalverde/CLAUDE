import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Clock, FileHeart, Fingerprint, PencilLine, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { enviarPrivado } from '../lib/arquivos';
import { dataBR, dataHora } from '../lib/fmt';
import { proximoRegistro } from '../lib/ponto/apuracao.js';
import { DIAS_SEMANA, hojeLocal, horaLocal, isoDow, local, minDoDia, montarDias, NOMES_TIPO, TIPOS, textoMotivos, valida, relogio } from '../lib/ponto/dados';
import BaterPonto, { enviarFila, filaPendente } from '../components/ponto/BaterPonto';
import { carregarPeriodo, CorDia, Espelho, FotoPrivada } from '../components/ponto/comum';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Textarea, toast, useDados } from '../components/ui';

const ROTULO_AUS: Record<string, string> = { aguardando_conferencia: 'ATESTADO ENVIADO – AGUARDANDO CONFERÊNCIA', aceito: 'Aceito', recusado: 'Recusado' };
const ROTULO_ENTREGA: Record<string, string> = { aguardando: 'Aguardando entrega física', entregue: 'Entregue pessoalmente', conferido: 'Documento conferido', pendente_regularizacao: 'Pendente de regularização' };
export { ROTULO_AUS, ROTULO_ENTREGA };

export default function MeuPonto() {
  const { eu, rest } = useEu();
  const [agora, setAgora] = useState(new Date());
  const [bater, setBater] = useState(false);
  const [comp, setComp] = useState<any>(null);
  const [modal, setModal] = useState<'' | 'ausencia' | 'correcao' | 'espelho' | 'avisos'>('');
  const [fila, setFila] = useState(filaPendente());
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const tentar = () => enviarFila(rest.id, eu.id).then((n) => { setFila(filaPendente()); if (n) { toast(`${n} registro(s) feito(s) sem internet foram enviados para análise`); avisarMudanca(); } });
    tentar(); window.addEventListener('online', tentar); return () => window.removeEventListener('online', tentar);
  }, [rest.id, eu.id]);

  const hoje = hojeLocal();
  const { dados } = useDados(async () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const [p, ficha, bio, locais, avisos, ausencias] = await Promise.all([
      carregarPeriodo(ontem, hoje, eu.id),
      q<any>(supabase.from('rest_func_ficha').select('*').eq('funcionario_id', eu.id).maybeSingle()),
      q<any>(supabase.from('rest_func_biometria').select('descritor, foto_path').eq('funcionario_id', eu.id).maybeSingle()),
      q<any[]>(supabase.from('rest_ponto_locais').select('*').eq('ativo', true)),
      q<any[]>(supabase.from('rest_ponto_avisos').select('*').eq('para', eu.id).order('criado_em', { ascending: false }).limit(30)),
      q<any[]>(supabase.from('rest_ponto_ausencias').select('*').eq('funcionario_id', eu.id).order('data_inicio', { ascending: false }).limit(10)),
    ]);
    return { p, ficha, bio, locais, avisos, ausencias };
  }, [eu.id, hoje]);

  // dia em andamento: o de ontem, se a jornada virou a noite e ainda não teve saída
  const info = useMemo(() => {
    if (!dados) return null;
    const { p } = dados;
    const minhas = p.marcacoes.filter(valida);
    const ult = [...minhas].sort((a, b) => b.nsr - a.nsr)[0];
    const dataRef = ult && ult.tipo !== 'saida' && Date.now() - Date.parse(ult.horario) < 16 * 3600000 ? ult.data_ref : hoje;
    const dia = montarDias(eu.id, dataRef, dataRef, p.jornadas, p.folgas, p.marcacoes, dados.ausencias)[0];
    const jornada = p.jornadas.filter((j) => j.valido_desde <= dataRef).sort((a, b) => (a.valido_desde < b.valido_desde ? 1 : -1))[0];
    const agoraMin = minDoDia(agora.toISOString(), dataRef);
    const prox = proximoRegistro(dia.marcs.map((m) => ({ tipo: m.tipo, min: minDoDia(m.horario, dataRef) })), dia.cfg, agoraMin, jornada?.quatro_marcacoes ?? true);
    return { dataRef, dia, prox, jornada };
  }, [dados, agora, eu.id, hoje]);

  if (!dados || !info) return <div className="p-10 text-center text-sm text-slate-500">Carregando…</div>;
  const { dia, prox } = info;
  const naoLidos = dados.avisos.filter((a) => !a.lido).length;
  const status = prox.concluido ? 'Jornada concluída' : dia.marcs.length ? 'Em andamento' : 'Ainda não registrou hoje';

  return (
    <div className="space-y-3">
      <Cabecalho titulo="Meu ponto" sub="Registro de jornada com selfie, localização e horário do servidor" acoes={<Btn variante="secundario" onClick={() => setModal('avisos')}><Bell className="h-4 w-4" />Avisos{naoLidos ? ` (${naoLidos})` : ''}</Btn>} />
      {fila > 0 && <Aviso tipo="alerta"><WifiOff className="mr-1 inline h-4 w-4" />{fila} registro(s) feito(s) sem internet estão guardados neste aparelho e serão enviados assim que a conexão voltar.</Aviso>}
      <Card>
        <div className="flex items-center gap-3">
          <FotoPrivada caminho={dados.ficha?.foto_path ?? dados.bio?.foto_path} className="h-16 w-16" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-bold">{dados.ficha?.nome_completo || eu.nome}</div>
            <div className="text-sm text-slate-500">{DIAS_SEMANA[isoDow(info.dataRef)]}, {dataBR(info.dataRef)} · <span className="tabular-nums">{relogio(local(agora).min)}</span></div>
            <div className="text-sm">{dia.cfg ? <>Previsto: <b>{dia.cfg.entrada}</b>{dia.cfg.int_ini && <> · intervalo <b>{dia.cfg.int_ini}–{dia.cfg.int_fim}</b></>} · saída <b>{dia.cfg.saida}</b></> : <span className="text-slate-500">{dia.folga ? 'Hoje é sua folga' : info.jornada ? 'Sem jornada prevista hoje' : 'Jornada ainda não cadastrada pelo administrador'}</span>}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm"><CorDia cor={dia.cor}>{status}</CorDia></div>
        {!prox.concluido ? <>
          <button onClick={() => setBater(true)} className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-700 py-5 text-xl font-bold text-white shadow-lg active:scale-[.99]"><Fingerprint className="h-7 w-7" />BATER PONTO</button>
          <div className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">Próximo: <b>{NOMES_TIPO[prox.tipo as keyof typeof NOMES_TIPO]}</b>{prox.previsto != null && <> · previsto {relogio(prox.previsto)}</>}</div>
          {prox.previsto != null && !prox.dentroJanela && <div className="text-center text-xs text-amber-700 dark:text-amber-400">A janela abre às {relogio(prox.abreEm!)} (5 min antes). Se registrar antes, o horário real é guardado e vai para análise.</div>}
        </> : <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Todas as marcações de hoje foram feitas. Bom descanso!</div>}
      </Card>

      <Card titulo="Marcações de hoje">
        {!dia.todas.length ? <p className="text-sm text-slate-500">Nenhuma marcação ainda.</p> : <div className="space-y-2">{dia.todas.map((m) => (
          <div key={m.id} className={`flex items-center gap-3 rounded-xl border p-2 text-sm dark:border-slate-800 ${valida(m) ? '' : 'opacity-50'}`}>
            <Clock className="h-4 w-4 text-slate-400" />
            <div className="flex-1"><b>{NOMES_TIPO[m.tipo as keyof typeof NOMES_TIPO]}</b> às <b className="tabular-nums">{horaLocal(m.horario)}</b>{m.origem === 'ajuste' && ' (correção aprovada)'}{m.substituida_por && ' (substituída)'}
              <div className="text-xs text-slate-500">NSR {m.nsr}{m.motivos?.length ? ' · ' + textoMotivos(m.motivos) : ''}</div></div>
            <div className="shrink-0"><CorDia cor={m.substituida_por ? 'cinza' : m.situacao === 'aprovado' ? 'verde' : m.situacao === 'pendente' ? 'amarelo' : 'vermelho'}>{m.substituida_por ? 'Substituída' : m.situacao === 'aprovado' ? 'Aprovada' : m.situacao === 'pendente' ? 'Em análise' : 'Rejeitada'}</CorDia></div>
          </div>))}</div>}
      </Card>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Btn variante="secundario" onClick={() => setModal('ausencia')}><FileHeart className="h-4 w-4" />Comunicar ausência</Btn>
        <Btn variante="secundario" onClick={() => setModal('correcao')}><PencilLine className="h-4 w-4" />Solicitar correção</Btn>
        <Btn variante="secundario" onClick={() => setModal('espelho')}><CalendarDays className="h-4 w-4" />Espelho do mês</Btn>
      </div>

      {dados.ausencias.length > 0 && <Card titulo="Minhas ausências comunicadas">
        <div className="space-y-2 text-sm">{dados.ausencias.map((a) => <div key={a.id} className="rounded-xl border p-2 dark:border-slate-800"><b>{dataBR(a.data_inicio)}{a.data_fim !== a.data_inicio && ` a ${dataBR(a.data_fim)}`}</b> · {ROTULO_AUS[a.status]}<div className="text-xs text-slate-500">{ROTULO_ENTREGA[a.entrega_fisica]}{a.entregue_em && ` em ${dataBR(a.entregue_em)}`}{a.obs_admin && ` · ${a.obs_admin}`}</div></div>)}</div>
      </Card>}

      {bater && <BaterPonto fechar={() => setBater(false)} ctx={{ restId: rest.id, funcId: eu.id, descritorRef: dados.bio?.descritor ?? null, locais: dados.locais, proximo: prox }}
        pronto={(c) => { setBater(false); setComp({ ...c, cpf: dados.ficha?.cpf }); setFila(filaPendente()); avisarMudanca(); }} />}
      {comp && <Comprovante c={comp} fechar={() => setComp(null)} />}
      {modal === 'ausencia' && <ComunicarAusencia fechar={() => setModal('')} />}
      {modal === 'correcao' && <SolicitarCorrecao fechar={() => setModal('')} />}
      {modal === 'espelho' && <Modal aberto largo fechar={() => setModal('')} titulo="Meu espelho de ponto"><Espelho func={eu.id} nome={eu.nome} ficha={dados.ficha} empregador={rest.nome} cnpj={rest.cnpj} /></Modal>}
      {modal === 'avisos' && <Avisos lista={dados.avisos} fechar={() => setModal('')} />}
    </div>
  );
}

/** Comprovante de registro (Portaria 671, art. 79: NSR, empregador, local, empregado, data e hora). */
function Comprovante({ c, fechar }: { c: any; fechar: () => void }) {
  if (c.offline) return <Modal aberto fechar={fechar} titulo="Registro guardado no aparelho"><Aviso tipo="alerta">Sem internet agora. O registro de {NOMES_TIPO[c.tipo as keyof typeof NOMES_TIPO]?.toLowerCase()} feito às {new Date(c.horario_informado).toLocaleTimeString('pt-BR')} foi guardado neste aparelho e será enviado assim que a conexão voltar. Ele vai para análise do administrador (contingência).</Aviso><Btn className="mt-3 w-full" onClick={fechar}>Entendi</Btn></Modal>;
  const baixar = async () => {
    const { jsPDF } = await import('jspdf');
    const d = new jsPDF({ unit: 'mm', format: [80, 120] });
    const linhas = ['COMPROVANTE DE REGISTRO DE PONTO', '', `Empregador: ${c.empregador}`, `Empregado: ${c.nome}`, `CPF: ${c.cpf || 'não informado'}`, `Registro: ${NOMES_TIPO[c.tipo as keyof typeof NOMES_TIPO]}`, `Data e hora: ${new Date(c.horario).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, `NSR: ${c.nsr}`, `Local: ${c.endereco || '—'}`, `Situação: ${c.situacao}`, '', 'Código de integridade (SHA-256):', c.hash.slice(0, 32), c.hash.slice(32)];
    d.setFontSize(7); linhas.forEach((l, i) => d.text(d.splitTextToSize(l.normalize('NFC'), 70), 5, 8 + i * 6));
    const { salvarArquivo } = await import('../lib/nativo');
    await salvarArquivo(`comprovante-ponto-nsr-${c.nsr}.pdf`, d.output('datauristring').split(',')[1], 'application/pdf');
  };
  return (
    <Modal aberto fechar={fechar} titulo="Ponto registrado">
      <div className="space-y-1 rounded-xl border border-dashed border-slate-300 p-4 font-mono text-xs dark:border-slate-700">
        <div className="mb-2 text-center text-sm font-bold">COMPROVANTE DE REGISTRO</div>
        <div>Empregador: {c.empregador}</div><div>Empregado: {c.nome}</div><div>CPF: {c.cpf || 'não informado'}</div>
        <div>Registro: <b>{NOMES_TIPO[c.tipo as keyof typeof NOMES_TIPO]}</b></div>
        <div>Data/hora (servidor): <b>{new Date(c.horario).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</b></div>
        <div>NSR: {c.nsr}</div><div>Local: {c.endereco || '—'}</div>
        <div className="break-all text-[10px] text-slate-500">SHA-256: {c.hash}</div>
      </div>
      {c.situacao === 'pendente' ? <Aviso tipo="alerta">Registrado e enviado para análise: {textoMotivos(c.motivos)}.</Aviso> : <Aviso tipo="ok">Registro aprovado.</Aviso>}
      <div className="mt-3 flex gap-2"><Btn variante="secundario" className="flex-1" onClick={baixar}>Baixar comprovante</Btn><Btn className="flex-1" onClick={fechar}>OK</Btn></div>
    </Modal>
  );
}

function ComunicarAusencia({ fechar }: { fechar: () => void }) {
  const { eu, rest } = useEu();
  const [d, setD] = useState({ inicio: hojeLocal(), fim: hojeLocal(), obs: '' });
  const [arq, setArq] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const enviar = async () => {
    if (d.fim < d.inicio) return toast('A data final é antes da inicial', 'erro');
    setSalvando(true);
    try {
      const caminho = arq ? await enviarPrivado(rest.id, eu.id, 'atestados', arq, arq.name) : null;
      await q(supabase.from('rest_ponto_ausencias').insert({ data_inicio: d.inicio, data_fim: d.fim, observacao: d.obs || null, arquivo_path: caminho }));
      toast(caminho ? 'Atestado enviado – aguardando conferência' : 'Ausência comunicada'); avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto fechar={fechar} titulo="Comunicar ausência por saúde">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2"><Campo rotulo="De"><Input type="date" value={d.inicio} onChange={(e) => setD({ ...d, inicio: e.target.value, fim: d.fim < e.target.value ? e.target.value : d.fim })} /></Campo><Campo rotulo="Até"><Input type="date" value={d.fim} min={d.inicio} onChange={(e) => setD({ ...d, fim: e.target.value })} /></Campo></div>
        <Campo rotulo="Atestado médico (foto ou PDF)" dica="Leve também o documento original ao responsável: a entrega física é registrada."><Input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setArq(e.target.files?.[0] ?? null)} /></Campo>
        <Campo rotulo="Observação (opcional)"><Textarea rows={2} value={d.obs} onChange={(e) => setD({ ...d, obs: e.target.value })} placeholder="Não é preciso informar diagnóstico." /></Campo>
        <p className="text-xs text-slate-500">Seus dados de saúde são confidenciais: só você e o administrador veem o atestado. Ele não aparece em relatórios gerais.</p>
        <Btn className="w-full" carregando={salvando} onClick={enviar}>Enviar</Btn>
      </div>
    </Modal>
  );
}

function SolicitarCorrecao({ fechar }: { fechar: () => void }) {
  const [d, setD] = useState({ data: hojeLocal(), tipo: 'entrada', hora: '', just: '' });
  const [salvando, setSalvando] = useState(false);
  const enviar = async () => {
    if (!d.hora || d.just.trim().length < 5) return toast('Informe o horário correto e a justificativa', 'erro');
    setSalvando(true);
    try {
      // horário de Brasília (sem horário de verão desde 2019); a saída depois da meia-noite fica no dia seguinte
      let data = d.data; if ((d.tipo === 'saida' || d.tipo === 'retorno_intervalo') && d.hora < '05:00') data = new Date(Date.parse(d.data + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
      await q(supabase.from('rest_ponto_ajustes').insert({ data_ref: d.data, tipo: d.tipo, horario_proposto: `${data}T${d.hora}:00-03:00`, justificativa: d.just.trim() }));
      toast('Correção enviada para o administrador'); avisarMudanca(); fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto fechar={fechar} titulo="Solicitar correção de marcação">
      <div className="space-y-3">
        <Aviso>A marcação original nunca é apagada: a correção, se aprovada, é registrada como um novo lançamento ligado ao original, com o nome de quem aprovou.</Aviso>
        <div className="grid grid-cols-2 gap-2"><Campo rotulo="Dia"><Input type="date" value={d.data} onChange={(e) => setD({ ...d, data: e.target.value })} /></Campo>
          <Campo rotulo="Marcação"><Select value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t} value={t}>{NOMES_TIPO[t as keyof typeof NOMES_TIPO]}</option>)}</Select></Campo></div>
        <Campo rotulo="Horário correto"><Input type="time" value={d.hora} onChange={(e) => setD({ ...d, hora: e.target.value })} /></Campo>
        <Campo rotulo="Justificativa"><Textarea rows={2} value={d.just} onChange={(e) => setD({ ...d, just: e.target.value })} placeholder="Ex.: esqueci de registrar a saída, saí às 17h" /></Campo>
        <Btn className="w-full" carregando={salvando} onClick={enviar}>Enviar solicitação</Btn>
      </div>
    </Modal>
  );
}

function Avisos({ lista, fechar }: { lista: any[]; fechar: () => void }) {
  useEffect(() => { const ids = lista.filter((a) => !a.lido).map((a) => a.id); if (ids.length) supabase.from('rest_ponto_avisos').update({ lido: true }).in('id', ids).then(() => avisarMudanca()); }, [lista]);
  return <Modal aberto fechar={fechar} titulo="Avisos">{!lista.length ? <p className="text-sm text-slate-500">Nenhum aviso.</p> : <div className="space-y-2">{lista.map((a) => <div key={a.id} className={`rounded-xl border p-2 text-sm dark:border-slate-800 ${a.lido ? '' : 'border-brand-300 bg-brand-50 dark:bg-brand-950/30'}`}>{a.texto}<div className="text-xs text-slate-500">{dataHora(a.criado_em)}</div></div>)}</div>}</Modal>;
}
