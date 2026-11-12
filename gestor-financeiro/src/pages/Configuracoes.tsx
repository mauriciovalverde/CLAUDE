import { useEffect, useState } from 'react';
import { CalendarCheck, Download, RefreshCw, Unplug } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { carregar } from '../lib/dados';
import { brl, dataBR } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, q, Select, Tabela, toast, useDados } from '../components/ui';

const LEMBRETES = [[10080, '7 dias antes'], [4320, '3 dias antes'], [2880, '2 dias antes'], [1440, '1 dia antes'], [180, '3 horas antes'], [0, 'No horário do vencimento']] as const;

function Agenda({ cfg, salvarCfg }: { cfg: any; salvarCfg: (p: any) => Promise<void> }) {
  const { dados: integ, recarregar } = useDados(async () => {
    const [i, fila] = await Promise.all([q<any>(supabase.from('v_integracoes').select('*').maybeSingle()), q<any[]>(supabase.from('agenda_sync_fila').select('ultimo_erro,tentativas').is('processado_em', null))]);
    return { i, fila };
  }, []);
  const [ocupado, setOcupado] = useState(false);
  const status = integ?.i?.status ?? 'desconectado';
  async function conectar() {
    setOcupado(true);
    const r = await funcao('google-oauth/iniciar');
    setOcupado(false);
    if (r.ok) window.location.href = r.url;
    else toast(r.erro === 'google_nao_configurado' ? 'A credencial OAuth do Google ainda não foi configurada no servidor (veja as instruções abaixo).' : r.erro, 'erro');
  }
  async function sincronizar() { setOcupado(true); const r = await funcao('agenda-sync', { forcar: true }); setOcupado(false); toast(r.ok ? `Sincronização: ${r.sincronizados} ok, ${r.pendentes} pendentes, ${r.erros} erros.` : r.erro, r.ok ? 'ok' : 'erro'); recarregar(); avisarMudanca(); }
  async function reconstruir() {
    if (!confirm('Recolocar todas as contas em aberto na fila da agenda? Não cria duplicados.')) return;
    setOcupado(true); const r = await funcao('agenda-sync', { reconstruir: true, forcar: true }); setOcupado(false);
    toast(r.ok ? `Agenda reconstruída: ${r.sincronizados} ok, ${r.pendentes} pendentes, ${r.erros} erros.` : r.erro, r.ok ? 'ok' : 'erro'); recarregar(); avisarMudanca();
  }
  async function desconectar() { if (!confirm('Desconectar o Google Agenda? As alterações ficam guardadas e sincronizam quando reconectar.')) return; await funcao('google-oauth/desconectar'); recarregar(); avisarMudanca(); }
  const lembretes: number[] = cfg?.lembretes_minutos ?? [4320, 1440, 0];
  return (
    <Card titulo={<span className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-teal-700" />Google Agenda</span>}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${status === 'conectado' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{status === 'conectado' ? `Conectado · ${integ?.i?.conta_email ?? ''}` : status === 'revogado' ? 'Autorização expirada: reconecte' : 'Desconectado'}</span>
        <span className="text-sm text-slate-500">{integ?.fila?.length ?? 0} item(ns) aguardando sincronização</span>
      </div>
      {integ?.i?.ultimo_erro && <div className="mb-3"><Aviso tipo="erro">Último erro: {integ.i.ultimo_erro}</Aviso></div>}
      {!!integ?.fila?.find((f: any) => f.ultimo_erro && f.ultimo_erro !== 'google_desconectado') && <div className="mb-3"><Aviso tipo="alerta">Falha recente: {integ.fila.find((f: any) => f.ultimo_erro)?.ultimo_erro}</Aviso></div>}
      <div className="flex flex-wrap gap-2">
        {status !== 'conectado' ? <Btn onClick={conectar} carregando={ocupado}>Conectar Google Agenda</Btn> : <Btn variante="secundario" onClick={desconectar}><Unplug className="h-4 w-4" />Desconectar</Btn>}
        <Btn variante="secundario" onClick={sincronizar} carregando={ocupado}><RefreshCw className="h-4 w-4" />Sincronizar agora</Btn>
        <Btn variante="fantasma" onClick={reconstruir}>Reconstruir agenda</Btn>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Horário dos eventos"><Input type="time" value={String(cfg?.hora_evento ?? '09:00').slice(0, 5)} onChange={(e) => salvarCfg({ hora_evento: e.target.value })} /></Campo>
        <Campo rotulo="Quando a conta for paga"><Select value={cfg?.agenda_ao_pagar ?? 'marcar_pago'} onChange={(e) => salvarCfg({ agenda_ao_pagar: e.target.value })}><option value="marcar_pago">Marcar evento como ✅ PAGO</option><option value="excluir">Excluir o evento</option></Select></Campo>
        <Campo rotulo="Agenda (ID)" dica="primary = agenda principal"><Input value={cfg?.agenda_calendar_id ?? 'primary'} onChange={(e) => salvarCfg({ agenda_calendar_id: e.target.value || 'primary' })} /></Campo>
      </div>
      <div className="mt-3"><span className="mb-1 block text-sm font-medium">Lembretes (máx. 5)</span><div className="flex flex-wrap gap-2">{LEMBRETES.map(([m, t]) => (
        <label key={m} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${lembretes.includes(m) ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
          <input type="checkbox" checked={lembretes.includes(m)} onChange={(e) => { const n = e.target.checked ? [...lembretes, m].slice(0, 5) : lembretes.filter((x) => x !== m); salvarCfg({ lembretes_minutos: n.sort((a, b) => b - a) }).then(reconstruirSilencioso); }} />{t}
        </label>))}</div></div>
    </Card>
  );
}
async function reconstruirSilencioso() { await funcao('agenda-sync', { reconstruir: true, forcar: true }); }

export default function Configuracoes({ params }: { params?: URLSearchParams }) {
  const { dados: cfg, recarregar } = useDados(carregar.config, []);
  const { dados: contas } = useDados(carregar.contas, []);
  const { dados: lixeira, recarregar: recLixo } = useDados(async () => [
    ...(await q<any[]>(supabase.from('clientes').select('id,nome,excluido_em').not('excluido_em', 'is', null))).map((x) => ({ ...x, tabela: 'clientes' })),
    ...(await q<any[]>(supabase.from('produtos').select('id,nome,excluido_em').not('excluido_em', 'is', null))).map((x) => ({ ...x, tabela: 'produtos' })),
  ], []);
  const [lic, setLic] = useState<any>({});
  useEffect(() => { if (cfg) setLic(cfg.licenca ?? {}); }, [cfg]);
  useEffect(() => {
    const g = params?.get('google');
    if (g === 'conectado') toast('Google Agenda conectado! Sincronizando pendências…');
    else if (g === 'erro') toast(`Falha ao conectar o Google (${params?.get('motivo')}). Tente de novo.`, 'erro');
    else if (g === 'negado') toast('Autorização do Google cancelada.', 'info');
  }, []);
  async function salvarCfg(p: any) { const { error } = await supabase.from('configuracoes').update(p).eq('user_id', (await supabase.auth.getUser()).data.user!.id); if (error) toast(error.message, 'erro'); else { toast('Configuração salva.'); recarregar(); } }
  async function exportar() {
    const tabelas = ['clientes', 'fornecedores', 'produtos', 'lotes', 'compras', 'compra_itens', 'vendas', 'venda_itens', 'emprestimos', 'emprestimo_eventos', 'obrigacoes', 'pagamentos', 'lancamentos', 'recorrencias', 'contracheques', 'contracheque_itens', 'categorias', 'contas_financeiras', 'configuracoes', 'movimentacoes_estoque', 'receitas_medicas'];
    const out: any = { exportado_em: new Date().toISOString(), versao: 1 };
    for (const t of tabelas) out[t] = (await supabase.from(t).select('*')).data ?? [];
    const blob = new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gfi-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    toast('Backup exportado.');
  }
  async function saldoInicial(c: any) {
    const v = prompt(`Saldo inicial de "${c.nome}" (R$):`, '0'); if (v == null) return;
    const { error } = await supabase.from('contas_financeiras').update({ saldo_inicial: Number(v.replace(/\./g, '').replace(',', '.')) }).eq('id', c.id);
    if (error) toast(error.message, 'erro'); else { toast('Saldo inicial salvo.'); avisarMudanca(); }
  }
  async function restaurar(x: any) { await supabase.from(x.tabela).update({ excluido_em: null }).eq('id', x.id); toast('Restaurado.'); recLixo(); avisarMudanca(); }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Configurações" />
      <Agenda cfg={cfg} salvarCfg={salvarCfg} />
      <Card titulo="Contas financeiras (saldos)">
        <Tabela linhas={contas} colunas={[{ k: 'nome', t: 'Conta' }, { k: 'escopo', t: 'Escopo' }, { k: 'saldo', t: 'Saldo atual', num: true, r: (c) => brl(c.saldo) }, { k: 'a', t: '', r: (c) => <Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => saldoInicial(c)}>Saldo inicial</Btn> }]} />
      </Card>
      <Card titulo="Conformidade: juros">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Referência legal de juros (% ao mês)" dica="Padrão conservador 1% a.m. (12% a.a.) para mútuo entre particulares. Confirme com advogado."><Input inputMode="decimal" defaultValue={cfg?.limite_juros_mensal_pct ?? 1} onBlur={(e) => salvarCfg({ limite_juros_mensal_pct: Number(e.target.value.replace(',', '.')) })} /></Campo>
          <Aviso tipo="alerta">Acima dessa referência, o sistema mostra um aviso e só grava com sua confirmação de ciência. Não afirma que a taxa é legal (Lei de Usura; CC arts. 406/591; Lei 1.521/51).</Aviso>
        </div>
      </Card>
      <Card titulo="Conformidade: licenças sanitárias (venda de medicamentos)">
        <div className="grid gap-3 sm:grid-cols-3">
          {[['razao_social', 'Razão social'], ['cnpj', 'CNPJ'], ['afe_anvisa', 'AFE (ANVISA)'], ['licenca_sanitaria', 'Licença sanitária nº'], ['licenca_validade', 'Validade da licença'], ['responsavel_tecnico', 'Responsável técnico (farmacêutico)'], ['crf', 'CRF']].map(([k, t]) => (
            <Campo key={k} rotulo={t}><Input type={k === 'licenca_validade' ? 'date' : 'text'} value={lic[k] ?? ''} onChange={(e) => setLic({ ...lic, [k]: e.target.value })} /></Campo>
          ))}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!lic.autorizado_controlados} onChange={(e) => setLic({ ...lic, autorizado_controlados: e.target.checked })} />Possuo Autorização Especial (Portaria 344) e escrituro no SNGPC</label>
        </div>
        <div className="mt-3 flex items-center gap-3"><Btn onClick={() => salvarCfg({ licenca: lic })}>Salvar licenças</Btn><span className="text-xs text-slate-500">Sem AFE, licença e responsável técnico, a venda de qualquer medicamento é bloqueada.</span></div>
      </Card>
      <Card titulo="Backup, privacidade e lixeira">
        <div className="flex flex-wrap gap-2"><Btn variante="secundario" onClick={exportar}><Download className="h-4 w-4" />Exportar meus dados (JSON)</Btn></div>
        <p className="mt-2 text-xs text-slate-500">LGPD: seus dados ficam no seu banco Supabase, isolados por usuário (RLS). Terceiros que recebem dados: Anthropic (interpretar mensagens do chat) e Google (eventos da agenda). Exclusões são lógicas; registros financeiros só podem ser estornados, nunca apagados. Toda alteração fica na auditoria.</p>
        <div className="mt-3"><Tabela linhas={lixeira} vazio="Lixeira vazia." colunas={[{ k: 'nome', t: 'Item' }, { k: 'tabela', t: 'Tipo' }, { k: 'excluido_em', t: 'Excluído em', r: (x) => dataBR(x.excluido_em) }, { k: 'a', t: '', r: (x) => <Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => restaurar(x)}>Restaurar</Btn> }]} /></div>
      </Card>
    </div>
  );
}
