import { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { FORMAS_SONHO, carregar } from '../lib/dados';
import { brl, dataBR, hoje, pct } from '../lib/fmt';
// @ts-ignore módulo JS testado
import { aporteMensalSonho } from '../lib/projecao.js';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, Select, Stat, Tabela, toast, useDados } from '../components/ui';

const EMOJIS = ['🏠', '🚗', '✈️', '🎓', '💍', '👶', '🏖️', '💻', '🏍️', '🛋️', '🎉', '⭐'];
const valorBR = (s: string) => (String(s).includes(',') ? Number(String(s).replace(/\./g, '').replace(',', '.')) : Number(s));

function SonhoModal({ s, fechar }: { s: any | null; fechar: () => void }) {
  const [f, setF] = useState<any>({});
  useEffect(() => { if (s) setF({ nome: s.nome ?? '', emoji: s.emoji ?? '⭐', valor_alvo: s.valor_alvo ? String(s.valor_alvo) : '', data_alvo: s.data_alvo ?? '', incluir_na_projecao: s.incluir_na_projecao ?? true, guardado: '', forma: 'Poupança' }); }, [s?.id, !!s]);
  if (!s) return null;
  async function salvar() {
    const alvo = valorBR(f.valor_alvo);
    if (!f.nome.trim() || !(alvo > 0)) { toast('Dê um nome e o valor do sonho.', 'erro'); return; }
    const reg = { nome: f.nome.trim(), emoji: f.emoji, valor_alvo: alvo, data_alvo: f.data_alvo || null, incluir_na_projecao: f.incluir_na_projecao };
    if (s.id) await supabase.from('plan_sonhos').update(reg).eq('id', s.id);
    else {
      const { data, error } = await supabase.from('plan_sonhos').insert(reg).select().single();
      if (error) { toast(error.message, 'erro'); return; }
      const g = valorBR(f.guardado || '0');
      if (g > 0) await supabase.from('plan_sonho_movs').insert({ sonho_id: data.id, valor: g, forma: f.forma, obs: 'Valor que já tinha guardado' });
    }
    toast('Sonho salvo ✨'); avisarMudanca(); fechar();
  }
  return (
    <Modal aberto titulo={s.id ? 'Editar sonho' : 'Novo sonho'} fechar={fechar}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">{EMOJIS.map((e) => <button key={e} onClick={() => setF({ ...f, emoji: e })} className={`rounded-xl p-2 text-2xl ${f.emoji === e ? 'bg-teal-100 ring-2 ring-teal-600 dark:bg-teal-900' : 'bg-slate-100 dark:bg-slate-800'}`}>{e}</button>)}</div>
        <Campo rotulo="Qual é o sonho?"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Casa própria, Viagem, Carro" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quanto precisa (R$)"><Input inputMode="decimal" value={f.valor_alvo} onChange={(e) => setF({ ...f, valor_alvo: e.target.value })} /></Campo>
          <Campo rotulo="Até quando? (opcional)"><Input type="date" value={f.data_alvo} onChange={(e) => setF({ ...f, data_alvo: e.target.value })} /></Campo>
        </div>
        {!s.id && <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Já tem guardado (R$)"><Input inputMode="decimal" value={f.guardado} onChange={(e) => setF({ ...f, guardado: e.target.value })} placeholder="0" /></Campo>
          <Campo rotulo="Onde está guardado"><Select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{FORMAS_SONHO.map((x) => <option key={x}>{x}</option>)}</Select></Campo>
        </div>}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.incluir_na_projecao} onChange={(e) => setF({ ...f, incluir_na_projecao: e.target.checked })} />Reservar todo mês na projeção do ano o valor necessário para chegar na meta</label>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar}>Salvar</Btn></div>
    </Modal>
  );
}

function MovModal({ s, tipo, fechar }: { s: any | null; tipo: 'guardar' | 'retirar'; fechar: () => void }) {
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('Poupança');
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState('');
  useEffect(() => { if (s) { setValor(''); setObs(''); setData(hoje()); setForma(s.movs?.[0]?.forma ?? 'Poupança'); } }, [s?.id, tipo]);
  if (!s) return null;
  async function salvar() {
    const v = valorBR(valor);
    if (!(v > 0)) { toast('Digite o valor.', 'erro'); return; }
    if (tipo === 'retirar' && v > s.guardado) { toast(`Só há ${brl(s.guardado)} guardados neste sonho.`, 'erro'); return; }
    const { error } = await supabase.from('plan_sonho_movs').insert({ sonho_id: s.id, valor: tipo === 'guardar' ? v : -v, forma, data, obs: obs || null });
    if (error) { toast(error.message, 'erro'); return; }
    const novo = s.guardado + (tipo === 'guardar' ? v : -v);
    if (tipo === 'guardar' && novo >= s.valor_alvo) { await supabase.from('plan_sonhos').update({ concluido: true }).eq('id', s.id); toast(`🎉 Parabéns! Você chegou na meta de ${s.nome}!`); }
    else toast(tipo === 'guardar' ? `Guardado ${brl(v)} para ${s.nome} ✨` : `Retirado ${brl(v)} de ${s.nome}.`);
    avisarMudanca(); fechar();
  }
  return (
    <Modal aberto titulo={`${tipo === 'guardar' ? 'Guardar dinheiro' : 'Retirar dinheiro'} · ${s.emoji} ${s.nome}`} fechar={fechar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor (R$)"><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></Campo>
        <Campo rotulo="Data"><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <div className="col-span-2"><Campo rotulo={tipo === 'guardar' ? 'Onde guardou' : 'De onde saiu'}><Select value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS_SONHO.map((x) => <option key={x}>{x}</option>)}</Select></Campo></div>
        <div className="col-span-2"><Campo rotulo="Observação (opcional)"><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: parcela 5 do consórcio" /></Campo></div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn variante={tipo === 'retirar' ? 'perigo' : 'primario'} onClick={salvar}>{tipo === 'guardar' ? 'Guardar' : 'Retirar'}</Btn></div>
    </Modal>
  );
}

export default function Sonhos() {
  const [edit, setEdit] = useState<any>(null);
  const [mov, setMov] = useState<{ s: any; tipo: 'guardar' | 'retirar' } | null>(null);
  const [detalhe, setDetalhe] = useState<any>(null);
  const { dados } = useDados(carregar.sonhos, []);
  const lista = dados ?? [];
  const total = lista.reduce((t, s) => t + s.guardado, 0);
  const porForma = new Map<string, number>();
  lista.forEach((s) => s.movs.forEach((m: any) => porForma.set(m.forma, (porForma.get(m.forma) ?? 0) + Number(m.valor))));
  const mensal = lista.filter((s) => !s.concluido && s.incluir_na_projecao).reduce((t, s) => t + aporteMensalSonho(s, s.guardado, hoje()).mensal, 0);

  async function apagar(s: any) {
    if (!confirm(`Apagar o sonho "${s.nome}"? O histórico de valores guardados também será apagado.`)) return;
    await supabase.from('plan_sonhos').update({ excluido_em: new Date().toISOString() }).eq('id', s.id); setDetalhe(null); avisarMudanca();
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Sonhos" sub="Dinheiro guardado para realizar seus objetivos" acoes={<Btn onClick={() => setEdit({})}><Plus className="h-4 w-4" />Novo sonho</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat rotulo="Total guardado" valor={brl(total)} tom="bom" />
        <Stat rotulo="Guardar por mês" valor={brl(mensal)} sub="para cumprir os prazos" />
        <div className="col-span-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900 md:col-span-1">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Onde está guardado</div>
          {[...porForma].filter(([, v]) => v > 0).map(([f, v]) => <div key={f} className="flex justify-between"><span>{f}</span><b className="tabular-nums">{brl(v)}</b></div>)}
          {!porForma.size && <span className="text-slate-400">—</span>}
        </div>
      </div>
      {!lista.length && dados && <Aviso>✨ Crie seu primeiro sonho: uma casa, uma viagem, um carro, a faculdade dos filhos… Diga quanto precisa e até quando, e o app calcula quanto guardar por mês e reserva esse valor na projeção do ano.</Aviso>}
      <div className="grid gap-3 md:grid-cols-2">
        {lista.map((s) => {
          const p = Math.min(100, (s.guardado / s.valor_alvo) * 100);
          const a = aporteMensalSonho(s, s.guardado, hoje());
          return (
            <Card key={s.id} className="cursor-pointer" >
              <div onClick={() => setDetalhe(s)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2"><span className="text-3xl">{s.emoji}</span><div><div className="font-bold">{s.nome}</div><div className="text-xs text-slate-500">{s.data_alvo ? `até ${dataBR(s.data_alvo)}` : 'sem prazo'}{s.concluido ? ' · 🎉 meta atingida' : ''}</div></div></div>
                  <div className="text-right"><div className="font-bold tabular-nums">{brl(s.guardado)}</div><div className="text-xs text-slate-500">de {brl(s.valor_alvo)}</div></div>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className={`h-full rounded-full ${s.concluido ? 'bg-emerald-500' : 'bg-violet-500'}`} style={{ width: `${p}%` }} /></div>
                <div className="mt-1 flex justify-between text-xs text-slate-500"><span>{pct(p)}</span><span>{a.falta > 0 ? (a.mensal > 0 ? `guardar ${brl(a.mensal)}/mês` : `faltam ${brl(a.falta)}`) : 'concluído'}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <Btn className="flex-1" onClick={() => setMov({ s, tipo: 'guardar' })}><Plus className="h-4 w-4" />Guardar</Btn>
                <Btn variante="secundario" onClick={() => setMov({ s, tipo: 'retirar' })}><Minus className="h-4 w-4" />Retirar</Btn>
              </div>
            </Card>
          );
        })}
      </div>
      <SonhoModal s={edit} fechar={() => setEdit(null)} />
      <MovModal s={mov?.s ?? null} tipo={mov?.tipo ?? 'guardar'} fechar={() => setMov(null)} />
      <Modal aberto={!!detalhe} fechar={() => setDetalhe(null)} titulo={detalhe ? `${detalhe.emoji} ${detalhe.nome}` : ''} largo>
        {detalhe && <div className="space-y-3">
          <Tabela linhas={detalhe.movs} vazio="Nada guardado ainda." colunas={[
            { k: 'data', t: 'Data', r: (m) => dataBR(m.data) }, { k: 'forma', t: 'Onde' }, { k: 'obs', t: 'Obs.', esconderCelular: true },
            { k: 'valor', t: 'Valor', num: true, r: (m) => <span className={m.valor < 0 ? 'text-rose-600' : 'text-emerald-600'}>{brl(m.valor)}</span> },
          ]} />
          <div className="flex justify-between"><Btn variante="fantasma" className="text-rose-600" onClick={() => apagar(detalhe)}><Trash2 className="h-4 w-4" />Apagar sonho</Btn><Btn variante="secundario" onClick={() => { setEdit(detalhe); setDetalhe(null); }}>Editar</Btn></div>
        </div>}
      </Modal>
    </div>
  );
}
