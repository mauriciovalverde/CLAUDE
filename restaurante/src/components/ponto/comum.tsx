import { useEffect, useState } from 'react';
import { FileSpreadsheet, FileText, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { linkPrivado } from '../../lib/arquivos';
import { dataBR, fimMes, inicioMes } from '../../lib/fmt';
import { gerarExcel, gerarPDF, type Rel } from '../../lib/relatorios';
import { COR_CLASSE, COR_NOME, DIAS_SEMANA, fmtHM, horaLocal, isoDow, montarDias, totais, type Cor, type Dia, type Jornada, type Marcacao } from '../../lib/ponto/dados';
import { Btn, Input, q } from '../ui';

/** Imagem do balde privado (link temporário). */
export function FotoPrivada({ caminho, className = 'h-16 w-16', alt = '' }: { caminho?: string | null; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { let vivo = true; setUrl(null); if (caminho) linkPrivado(caminho).then((u) => vivo && setUrl(u)).catch(() => {}); return () => { vivo = false; }; }, [caminho]);
  if (!caminho || !url) return <div className={`${className} flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800`}><UserRound className="h-1/2 w-1/2" /></div>;
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={alt} className={`${className} rounded-xl object-cover`} /></a>;
}

export const CorDia = ({ cor, children }: { cor: Cor; children?: React.ReactNode }) => <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${COR_CLASSE[cor]}`}>{children ?? COR_NOME[cor]}</span>;

export const Legenda = () => <div className="flex flex-wrap gap-1.5">{(Object.keys(COR_NOME) as Cor[]).map((c) => <CorDia key={c} cor={c} />)}</div>;

/** Busca tudo o que a apuração precisa no período (RLS: o empregado só recebe os próprios dados). */
export async function carregarPeriodo(de: string, ate: string, func?: string) {
  const f = <T,>(qr: any) => (func ? qr.eq('funcionario_id', func) : qr) as T;
  const [jornadas, folgas, marcacoes, ausencias] = await Promise.all([
    q<Jornada[]>(f<any>(supabase.from('rest_ponto_jornadas').select('*'))),
    q<any[]>(f<any>(supabase.from('rest_ponto_folgas').select('funcionario_id, data, motivo').gte('data', de).lte('data', ate))),
    q<Marcacao[]>(f<any>(supabase.from('rest_ponto_marcacoes').select('*').gte('data_ref', de).lte('data_ref', ate).order('nsr'))),
    q<any[]>(f<any>(supabase.from('rest_ponto_ausencias').select('id, funcionario_id, data_inicio, data_fim, status, entrega_fisica').lte('data_inicio', ate).gte('data_fim', de))),
  ]);
  return { jornadas, folgas, marcacoes, ausencias };
}

const hm = (d: Dia, tipo: string) => horaLocal(d.marcs.find((m) => m.tipo === tipo)?.horario);
const prev = (d: Dia) => (d.cfg ? `${d.cfg.entrada}–${d.cfg.int_ini ? `${d.cfg.int_ini}/${d.cfg.int_fim}–` : ''}${d.cfg.saida}` : d.folga ? 'Folga' : '—');
/** linhas do espelho para PDF/Excel (dados médicos não aparecem: só "ausência justificada") */
export const linhasEspelho = (dias: Dia[]) => dias.map((d) => ({
  data: d.data, dia: DIAS_SEMANA[isoDow(d.data)].slice(0, 3), previsto: prev(d),
  entrada: hm(d, 'entrada'), sint: hm(d, 'saida_intervalo'), ret: hm(d, 'retorno_intervalo'), saida: hm(d, 'saida'),
  trab: fmtHM(d.trabalhado), cons: fmtHM(d.considerado), saldo: fmtHM(d.saldo), extra: d.extra ? fmtHM(d.extra) : '', noturno: d.noturnoReal ? fmtHM(d.noturnoReal) : '',
  sit: d.atestado ? (d.atestado.status === 'aceito' ? 'Ausência justificada' : 'Justificativa em conferência') : d.situacao,
}));
export const COLS_ESPELHO = [
  { t: 'Data', k: 'data', tipo: 'data' as const }, { t: 'Dia', k: 'dia' }, { t: 'Horário contratual', k: 'previsto' }, { t: 'Entrada', k: 'entrada' }, { t: 'Saída int.', k: 'sint' }, { t: 'Retorno', k: 'ret' }, { t: 'Saída', k: 'saida' },
  { t: 'Trabalhado', k: 'trab' }, { t: 'Considerado', k: 'cons' }, { t: 'Saldo', k: 'saldo' }, { t: 'Extra', k: 'extra' }, { t: 'Noturno', k: 'noturno' }, { t: 'Situação', k: 'sit' },
];

/** Espelho de ponto mensal (Portaria 671, art. 84: empregador, empregado, período, horário contratual, marcações e horas). */
export function Espelho({ func, nome, ficha, empregador, cnpj }: { func: string; nome: string; ficha?: any; empregador: string; cnpj?: string }) {
  const [mes, setMes] = useState(inicioMes().slice(0, 7));
  const [dias, setDias] = useState<Dia[] | null>(null);
  useEffect(() => {
    let vivo = true; setDias(null);
    const de = mes + '-01', ate = fimMes(de);
    carregarPeriodo(de, ate, func).then((p) => vivo && setDias(montarDias(func, de, ate, p.jornadas, p.folgas, p.marcacoes, p.ausencias))).catch(() => vivo && setDias([]));
    return () => { vivo = false; };
  }, [func, mes]);
  const t = dias ? totais(dias) : null;
  const rel = (): Rel => ({
    titulo: `Espelho de ponto — ${nome}`, periodo: `${dataBR(mes + '-01')} a ${dataBR(fimMes(mes + '-01'))}`, restaurante: `${empregador}${cnpj ? ' · CNPJ ' + cnpj : ''}`,
    resumo: [['Empregado', ficha?.nome_completo || nome], ['CPF', ficha?.cpf || '—'], ['Admissão', dataBR(ficha?.data_admissao)], ['Cargo', ficha?.cargo || '—'],
      ['Previsto', fmtHM(t!.previsto)], ['Trabalhado', fmtHM(t!.trabalhado)], ['Saldo', fmtHM(t!.saldo)], ['Extras', fmtHM(t!.extra)], ['Faltas', String(t!.faltas)], ['Atrasos', fmtHM(t!.atraso)], ['Noturno (ficto)', fmtHM(t!.noturnoFicto)], ['Intervalo suprimido', fmtHM(t!.intervaloSuprimido)]],
    tabelas: [{ titulo: 'Marcações e apuração', colunas: COLS_ESPELHO, linhas: linhasEspelho(dias!) }],
  });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="!w-auto" />
        {dias && <><Btn variante="secundario" onClick={() => gerarPDF(rel())}><FileText className="h-4 w-4" />PDF</Btn><Btn variante="secundario" onClick={() => gerarExcel(rel())}><FileSpreadsheet className="h-4 w-4" />Excel</Btn></>}
      </div>
      {t && <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {[['Previsto', fmtHM(t.previsto)], ['Trabalhado', fmtHM(t.trabalhado)], ['Saldo', fmtHM(t.saldo)], ['Horas extras', fmtHM(t.extra)], ['Faltas', t.faltas], ['Atrasos', fmtHM(t.atraso)], ['Saídas antecipadas', fmtHM(t.saidaAntecipada)], ['Em análise', t.pendentes]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60"><div className="text-xs text-slate-500">{k}</div><div className="font-semibold tabular-nums">{v}</div></div>)}
      </div>}
      {!dias ? <div className="p-4 text-center text-sm text-slate-500">Carregando…</div> : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-800/60"><tr>{['Dia', 'Previsto', 'Entrada', 'Saída int.', 'Retorno', 'Saída', 'Trabalhado', 'Saldo', 'Situação'].map((h) => <th key={h} className="px-2 py-1.5 font-medium">{h}</th>)}</tr></thead>
            <tbody>{dias.map((d) => <tr key={d.data} className="border-t border-slate-100 dark:border-slate-800">
              <td className="whitespace-nowrap px-2 py-1.5">{dataBR(d.data).slice(0, 5)} <span className="text-slate-400">{DIAS_SEMANA[isoDow(d.data)].slice(0, 3)}</span></td>
              <td className="whitespace-nowrap px-2 py-1.5 text-slate-500">{prev(d)}</td>
              {['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'].map((tp) => <td key={tp} className="px-2 py-1.5 tabular-nums">{hm(d, tp)}</td>)}
              <td className="px-2 py-1.5 tabular-nums">{d.marcs.length ? fmtHM(d.trabalhado) : ''}</td>
              <td className={`px-2 py-1.5 tabular-nums ${d.saldo < 0 ? 'text-red-600' : d.saldo > 0 ? 'text-emerald-700' : ''}`}>{d.saldo ? fmtHM(d.saldo) : ''}</td>
              <td className="px-2 py-1.5"><CorDia cor={d.cor}>{d.atestado ? (d.atestado.status === 'aceito' ? 'Ausência justificada' : 'Atestado em conferência') : d.situacao}</CorDia></td>
            </tr>)}</tbody>
          </table>
        </div>)}
      <p className="text-xs text-slate-500">Tolerância legal: variações de até 5 minutos por marcação, no máximo 10 minutos por dia, não são descontadas nem pagas (CLT art. 58 §1º). Passando disso, conta o tempo todo. Marcações em análise ainda podem mudar.</p>
    </div>
  );
}
