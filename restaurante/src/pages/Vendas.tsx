import { useMemo, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';
import { brl, compacto, dataBR, fimMes, hoje, inicioMes, lerNum, TURNOS } from '../lib/fmt';
import { Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Dinheiro, Input, Modal, q, Select, Stat, Tabela, toast, useDados } from '../components/ui';

export const FORMAS_VENDA: [string, string, string][] = [['dinheiro', 'Dinheiro', '#16a34a'], ['debito', 'Débito', '#2563eb'], ['credito', 'Crédito', '#7c3aed'], ['pix', 'PIX', '#0891b2'], ['vale_alimentacao', 'Vale-alimentação', '#f59e0b'], ['vale_refeicao', 'Vale-refeição', '#ea580c'], ['outros', 'Outros', '#64748b']];

export default function Vendas() {
  const [de, setDe] = useState(inicioMes()); const [ate, setAte] = useState(fimMes());
  const [nova, setNova] = useState(false); const [importar, setImportar] = useState(false);
  const { dados } = useDados(() => q<any[]>(supabase.from('rest_vendas').select('*').gte('data', de).lte('data', ate).order('data', { ascending: false })), [de, ate]);
  const t = useMemo(() => {
    const r = { bruto: 0, descontos: 0, cancelamentos: 0, estornos: 0, liquido: 0, qtd: 0, formas: {} as Record<string, number>, dias: {} as Record<string, number> };
    for (const v of dados ?? []) { r.bruto += +v.bruto; r.descontos += +v.descontos; r.cancelamentos += +v.cancelamentos; r.estornos += +v.estornos; r.liquido += +v.liquido; r.qtd += v.qtd_vendas ?? 0; for (const [k] of FORMAS_VENDA) r.formas[k] = (r.formas[k] ?? 0) + +v[k]; r.dias[v.data] = (r.dias[v.data] ?? 0) + +v.liquido; }
    return r;
  }, [dados]);
  const dias = Object.entries(t.dias).sort().map(([data, valor]) => ({ data, valor }));
  const pizza = FORMAS_VENDA.map(([k, nome, cor]) => ({ nome, cor, valor: Math.round(t.formas[k] * 100) / 100 })).filter((x) => x.valor > 0);
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Vendas e faturamento" sub="Vem dos fechamentos de caixa; também dá para lançar ou importar do PDV" acoes={<><Btn variante="secundario" onClick={() => setImportar(true)}><Upload className="h-4 w-4" />Importar do PDV</Btn><Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Lançar venda</Btn></>} />
      <Card><div className="grid grid-cols-2 gap-2"><Campo rotulo="De"><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Campo><Campo rotulo="Até"><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo></div></Card>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat rotulo="Faturamento bruto" valor={brl(t.bruto)} />
        <Stat rotulo="Faturamento líquido" valor={brl(t.liquido)} tom="bom" sub="bruto − descontos − cancelamentos − estornos" />
        <Stat rotulo="Pratos vendidos" valor={t.qtd || '—'} sub={t.qtd ? `ticket médio por prato ${brl(t.liquido / t.qtd)}` : 'informe os pratos vendidos no caixa'} />
        <Stat rotulo="Descontos + cancel. + estornos" valor={brl(t.descontos + t.cancelamentos + t.estornos)} tom="alerta" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Card titulo="Faturamento líquido por dia"><div className="h-56">{dias.length ? <ResponsiveContainer><BarChart data={dias} margin={{ left: -10 }}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} /><XAxis dataKey="data" tickFormatter={(d) => d.slice(8)} /><YAxis tickFormatter={compacto} width={48} /><Tooltip formatter={(v: any) => brl(v)} labelFormatter={(d) => dataBR(d)} /><Bar isAnimationActive={false} maxBarSize={56} dataKey="valor" fill="#a3141b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="pt-16 text-center text-sm text-slate-500">Sem vendas no período.</p>}</div></Card>
        <Card titulo="Formas de pagamento"><div className="h-56">{pizza.length ? <ResponsiveContainer><PieChart><Pie isAnimationActive={false} data={pizza} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={2}>{pizza.map((p) => <Cell key={p.nome} fill={p.cor} />)}</Pie><Tooltip formatter={(v: any) => brl(v)} /></PieChart></ResponsiveContainer> : null}</div>
          <div className="space-y-0.5 text-xs">{pizza.map((p) => <div key={p.nome} className="flex justify-between"><span><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: p.cor }} />{p.nome}</span><span className="tabular-nums">{brl(p.valor)} ({t.liquido ? Math.round((p.valor / (t.liquido + t.estornos)) * 100) : 0}%)</span></div>)}</div></Card>
      </div>
      <Tabela linhas={dados} vazio="Sem vendas no período." colunas={[
        { k: 'd', t: 'Data', r: (v) => `${dataBR(v.data)} · ${TURNOS[v.turno] ?? v.turno}` }, { k: 'o', t: 'Origem', r: (v) => <span className="flex gap-1">{v.origem === 'fechamento' ? 'Caixa' : v.origem === 'pdv' ? 'PDV' : 'Manual'}{v.origem === 'fechamento' && <Badge s={v.conferida ? 'conferido' : 'encerrado'} />}</span>, esconderCelular: true },
        { k: 'b', t: 'Bruto', num: true, r: (v) => brl(v.bruto), esconderCelular: true }, { k: 'x', t: 'Desc./canc./estornos', num: true, r: (v) => brl(+v.descontos + +v.cancelamentos + +v.estornos), esconderCelular: true },
        { k: 'q', t: 'Pratos', num: true, r: (v) => v.qtd_vendas ?? '—' }, { k: 'l', t: 'Líquido', num: true, r: (v) => <b>{brl(v.liquido)}</b> },
      ]} />
      {nova && <NovaVenda fechar={() => setNova(false)} />}
      {importar && <ImportarPdv fechar={() => setImportar(false)} />}
    </div>
  );
}

function NovaVenda({ fechar }: { fechar: () => void }) {
  const [f, setF] = useState<Record<string, string>>({ data: hoje(), turno: 'dia', bruto: '', descontos: '', cancelamentos: '', estornos: '', qtd: '' });
  return (
    <Modal aberto fechar={fechar} titulo="Lançar venda manual">
      <Aviso>Use só para vendas que não passaram pelo fechamento de caixa (evita contar duas vezes).</Aviso>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Campo rotulo="Data"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
        <Campo rotulo="Turno"><Select value={f.turno} onChange={(e) => setF({ ...f, turno: e.target.value })}>{Object.entries(TURNOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
        {FORMAS_VENDA.map(([k, nome]) => <Campo key={k} rotulo={nome}><Dinheiro valor={f[k] ?? ''} mudar={(v) => setF({ ...f, [k]: v })} /></Campo>)}
        <Campo rotulo="Descontos"><Dinheiro valor={f.descontos} mudar={(v) => setF({ ...f, descontos: v })} /></Campo>
        <Campo rotulo="Cancelamentos"><Dinheiro valor={f.cancelamentos} mudar={(v) => setF({ ...f, cancelamentos: v })} /></Campo>
        <Campo rotulo="Estornos"><Dinheiro valor={f.estornos} mudar={(v) => setF({ ...f, estornos: v })} /></Campo>
        <Campo rotulo="Pratos vendidos"><Input inputMode="numeric" value={f.qtd} onChange={(e) => setF({ ...f, qtd: e.target.value })} /></Campo>
      </div>
      <Btn className="mt-4 w-full" onClick={async () => {
        const formas = Object.fromEntries(FORMAS_VENDA.map(([k]) => [k, lerNum(f[k]) || 0]));
        const recebido = Object.values(formas).reduce((a, b) => a + b, 0);
        if (recebido <= 0) { toast('Informe os valores recebidos', 'erro'); return; }
        const { error } = await supabase.from('rest_vendas').insert({ data: f.data, turno: f.turno, ...formas, bruto: recebido + (lerNum(f.descontos) || 0) + (lerNum(f.cancelamentos) || 0), descontos: lerNum(f.descontos) || 0, cancelamentos: lerNum(f.cancelamentos) || 0, estornos: lerNum(f.estornos) || 0, qtd_vendas: f.qtd ? Number(f.qtd) : null, origem: 'manual' });
        if (error) toast(error.message, 'erro'); else { toast('Venda lançada'); avisarMudanca(); fechar(); }
      }}>Salvar</Btn>
    </Modal>
  );
}

// Importa CSV/Excel do PDV: uma linha por venda ou por dia, com colunas de data e valor (forma e desconto opcionais).
function ImportarPdv({ fechar }: { fechar: () => void }) {
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState({ data: '', valor: '', forma: '', desconto: '' });
  const [salvando, setSalvando] = useState(false);
  const ler = async (arq: File) => {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(await arq.arrayBuffer(), { cellDates: true });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    if (!rows.length) { toast('Arquivo vazio', 'erro'); return; }
    const c = Object.keys(rows[0]); setCols(c); setLinhas(rows);
    const achar = (re: RegExp) => c.find((x) => re.test(x)) ?? '';
    setMap({ data: achar(/data|dia|date/i), valor: achar(/valor|total|venda|amount/i), forma: achar(/forma|pagamento|tipo|modalidade/i), desconto: achar(/desc/i) });
  };
  const paraData = (v: any) => { if (v instanceof Date) return new Date(v.getTime() + 60000).toISOString().slice(0, 10); const m = String(v).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; const m2 = String(v).match(/(\d{4})-(\d{2})-(\d{2})/); return m2 ? m2[0] : null; };
  const forma = (s: string) => { const t = s.toLowerCase(); return /pix/.test(t) ? 'pix' : /d[ée]bito/.test(t) ? 'debito' : /cr[ée]dito/.test(t) ? 'credito' : /dinheiro|esp[ée]cie/.test(t) ? 'dinheiro' : /alimenta/.test(t) ? 'vale_alimentacao' : /refei/.test(t) ? 'vale_refeicao' : 'outros'; };
  const dias = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of linhas ?? []) { const d = paraData(r[map.data]); const v = lerNum(r[map.valor]); if (!d || !(v > 0)) continue; const x = m.get(d) ?? { data: d, qtd: 0, descontos: 0, ...Object.fromEntries(FORMAS_VENDA.map(([k]) => [k, 0])) }; x[map.forma ? forma(String(r[map.forma])) : 'outros'] += v; x.qtd++; if (map.desconto) x.descontos += lerNum(r[map.desconto]) || 0; m.set(d, x); }
    return [...m.values()].sort((a, b) => a.data.localeCompare(b.data));
  }, [linhas, map]);
  return (
    <Modal aberto fechar={fechar} titulo="Importar vendas do PDV" largo>
      <p className="mb-2 text-sm text-slate-600">Exporte do seu sistema de vendas em Excel ou CSV. Precisa ter pelo menos a data e o valor. As vendas são somadas por dia; importar o mesmo arquivo de novo não duplica.</p>
      <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
      {linhas && <div className="mt-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(['data', 'valor', 'forma', 'desconto'] as const).map((k) => <Campo key={k} rotulo={`Coluna de ${k}`}><Select value={map[k]} onChange={(e) => setMap({ ...map, [k]: e.target.value })}><option value="">—</option>{cols.map((c) => <option key={c}>{c}</option>)}</Select></Campo>)}</div>
        <p className="text-sm">{linhas.length} linhas → <b>{dias.length} dias</b> · total {brl(dias.reduce((t, d) => t + FORMAS_VENDA.reduce((s, [k]) => s + d[k], 0), 0))}</p>
        <Btn className="w-full" carregando={salvando} disabled={!dias.length} onClick={async () => {
          setSalvando(true);
          const regs = dias.map((d) => { const rec = FORMAS_VENDA.reduce((s, [k]) => s + d[k], 0); return { data: d.data, turno: 'dia', origem: 'pdv', qtd_vendas: d.qtd, descontos: Math.round(d.descontos * 100) / 100, bruto: Math.round((rec + d.descontos) * 100) / 100, ...Object.fromEntries(FORMAS_VENDA.map(([k]) => [k, Math.round(d[k] * 100) / 100])), assinatura: `pdv:${d.data}:${rec.toFixed(2)}:${d.qtd}` }; });
          const { error } = await supabase.from('rest_vendas').upsert(regs, { onConflict: 'restaurante_id,assinatura', ignoreDuplicates: true });
          setSalvando(false);
          if (error) toast(error.message, 'erro'); else { toast(`${regs.length} dia(s) importados`); avisarMudanca(); fechar(); }
        }}>Importar {dias.length} dia(s)</Btn>
      </div>}
    </Modal>
  );
}
