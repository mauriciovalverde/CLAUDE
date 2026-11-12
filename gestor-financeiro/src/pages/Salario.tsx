import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { rpc } from '../lib/supabase';
import { carregar, somar } from '../lib/dados';
import { brl, dataBR, hoje, inicioMes, mesNome, num, pct } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, Select, Stat, Tabela, toast, useDados } from '../components/ui';

const RUBRICAS: Record<string, [string, string]> = {
  salario_base: ['provento', 'Salário-base'], gratificacao: ['provento', 'Gratificação'], adicional: ['provento', 'Adicional'], hora_extra: ['provento', 'Horas extras'],
  servico_extraordinario: ['provento', 'Serviço extraordinário'], auxilio: ['provento', 'Auxílio'], outro_provento: ['provento', 'Outro recebimento'],
  previdencia: ['desconto', 'Previdência'], imposto_renda: ['desconto', 'Imposto de renda'], consignado: ['desconto', 'Consignado'], plano_saude: ['desconto', 'Plano de saúde'],
  associacao: ['desconto', 'Associação'], pensao: ['desconto', 'Pensão'], outro_desconto: ['desconto', 'Outro desconto'],
};

function Contracheque({ base, fechar }: { base: any | null; fechar: () => void }) {
  const [comp, setComp] = useState(base?.competencia?.slice(0, 7) ?? hoje().slice(0, 7));
  const [pag, setPag] = useState(base?.data_pagamento ?? hoje());
  const [itens, setItens] = useState<any[]>(base?.contracheque_itens?.map((i: any) => ({ rubrica: i.rubrica, descricao: i.descricao ?? '', valor: String(i.valor) })) ?? [{ rubrica: 'salario_base', descricao: '', valor: '' }, { rubrica: 'previdencia', descricao: '', valor: '' }]);
  const [erro, setErro] = useState('');
  const val = (v: string) => { const s = String(v ?? '').trim(); return (s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s)) || 0; };
  const bruto = itens.filter((i) => RUBRICAS[i.rubrica][0] === 'provento').reduce((t, i) => t + val(i.valor), 0);
  const desc = itens.filter((i) => RUBRICAS[i.rubrica][0] === 'desconto').reduce((t, i) => t + val(i.valor), 0);
  async function salvar() {
    try {
      const r = await rpc('registrar_contracheque', { p: { competencia: comp + '-01', data_pagamento: pag || null, itens: itens.filter((i) => val(i.valor) > 0).map((i) => ({ tipo: RUBRICAS[i.rubrica][0], rubrica: i.rubrica, descricao: i.descricao || null, valor: val(i.valor) })) } });
      toast(`Contracheque ${comp.split('-').reverse().join('/')} salvo: líquido ${brl(r.liquido)}.`); avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message); }
  }
  return (
    <Modal aberto titulo="Contracheque" fechar={fechar} largo>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Competência (mês)"><Input type="month" value={comp} onChange={(e) => setComp(e.target.value)} /></Campo>
        <Campo rotulo="Data do pagamento"><Input type="date" value={pag} onChange={(e) => setPag(e.target.value)} /></Campo>
      </div>
      <div className="mt-3 space-y-2">
        {itens.map((i, k) => (
          <div key={k} className="grid grid-cols-12 gap-2">
            <Select className="col-span-6 sm:col-span-4" value={i.rubrica} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, rubrica: e.target.value } : x))}>
              <optgroup label="Proventos">{Object.entries(RUBRICAS).filter(([, v]) => v[0] === 'provento').map(([k2, v]) => <option key={k2} value={k2}>{v[1]}</option>)}</optgroup>
              <optgroup label="Descontos">{Object.entries(RUBRICAS).filter(([, v]) => v[0] === 'desconto').map(([k2, v]) => <option key={k2} value={k2}>{v[1]}</option>)}</optgroup>
            </Select>
            <Input className="col-span-6 sm:col-span-4" placeholder="Descrição (opcional)" value={i.descricao} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, descricao: e.target.value } : x))} />
            <Input className="col-span-10 sm:col-span-3" inputMode="decimal" placeholder="Valor" value={i.valor} onChange={(e) => setItens(itens.map((x, j) => j === k ? { ...x, valor: e.target.value } : x))} />
            <button className="col-span-2 sm:col-span-1 text-slate-400 hover:text-rose-600" onClick={() => setItens(itens.filter((_, j) => j !== k))}><Trash2 className="mx-auto h-4 w-4" /></button>
          </div>
        ))}
        <Btn variante="fantasma" onClick={() => setItens([...itens, { rubrica: 'gratificacao', descricao: '', valor: '' }])}><Plus className="h-4 w-4" />Rubrica</Btn>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50"><div>Bruto<br /><strong>{brl(bruto)}</strong></div><div>Descontos<br /><strong className="text-rose-600">{brl(desc)}</strong></div><div>Líquido<br /><strong className="text-emerald-600">{brl(bruto - desc)}</strong></div></div>
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar}>Salvar contracheque</Btn></div>
    </Modal>
  );
}

export default function Salario() {
  const [edit, setEdit] = useState<any>(null);
  const { dados } = useDados(carregar.contracheques, []);
  const lista = dados ?? [];
  const serie = lista.map((c: any, i: number) => ({ mes: mesNome(c.competencia), Bruto: +c.bruto, Líquido: +c.liquido, Descontos: +c.descontos, 'Variação %': i ? ((c.liquido - lista[i - 1].liquido) / (lista[i - 1].liquido || 1)) * 100 : 0 }));
  const ult = lista[lista.length - 1], ant = lista[lista.length - 2];
  const anos = new Map<string, { ano: string; bruto: number; liquido: number; descontos: number }>();
  lista.forEach((c: any) => { const a = c.competencia.slice(0, 4); const x = anos.get(a) ?? { ano: a, bruto: 0, liquido: 0, descontos: 0 }; x.bruto += +c.bruto; x.liquido += +c.liquido; x.descontos += +c.descontos; anos.set(a, x); });
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Salário · Polícia Militar" sub="Receita pessoal: não entra no faturamento do negócio" acoes={<Btn onClick={() => setEdit({})}><Plus className="h-4 w-4" />Lançar contracheque</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat rotulo="Último bruto" valor={brl(ult?.bruto)} sub={ult ? mesNome(ult.competencia) : '—'} />
        <Stat rotulo="Último líquido" valor={brl(ult?.liquido)} tom="bom" sub={ant ? `variação ${pct(((ult.liquido - ant.liquido) / (ant.liquido || 1)) * 100)}` : undefined} />
        <Stat rotulo="Descontos (último)" valor={brl(ult?.descontos)} tom="ruim" sub={ult ? `${pct((ult.descontos / (ult.bruto || 1)) * 100)} do bruto` : undefined} />
        <Stat rotulo="Líquido no ano" valor={brl(anos.get(hoje().slice(0, 4))?.liquido ?? 0)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card titulo="Bruto × líquido × descontos"><ResponsiveContainer width="100%" height={230}><BarChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis width={45} tickFormatter={(v) => num(v / 1000, 0) + 'k'} /><Tooltip formatter={(v: any) => brl(v)} /><Legend /><Bar dataKey="Bruto" fill="#0EA5E9" /><Bar dataKey="Líquido" fill="#10B981" /><Bar dataKey="Descontos" fill="#EF4444" /></BarChart></ResponsiveContainer></Card>
        <Card titulo="Variação mensal do líquido"><ResponsiveContainer width="100%" height={230}><LineChart data={serie}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="mes" /><YAxis width={40} tickFormatter={(v) => num(v, 0) + '%'} /><Tooltip formatter={(v: any) => pct(v)} /><Line dataKey="Variação %" stroke="#0F766E" strokeWidth={2} /></LineChart></ResponsiveContainer></Card>
      </div>
      <Card titulo="Histórico de contracheques">
        <Tabela linhas={dados ? [...lista].reverse() : null} aoClicar={setEdit} vazio="Nenhum contracheque. Lance aqui ou diga à IA: “Recebi o salário de novembro: base 5.200, gratificação 1.300, previdência 650”." colunas={[
          { k: 'competencia', t: 'Competência', r: (c) => mesNome(c.competencia) }, { k: 'data_pagamento', t: 'Pago em', r: (c) => dataBR(c.data_pagamento) },
          { k: 'bruto', t: 'Bruto', num: true, r: (c) => brl(c.bruto) }, { k: 'descontos', t: 'Descontos', num: true, r: (c) => brl(c.descontos) },
          { k: 'liquido', t: 'Líquido', num: true, r: (c) => <strong>{brl(c.liquido)}</strong> },
          { k: 'cons', t: 'Consignados', num: true, esconderCelular: true, r: (c) => brl(somar(c.contracheque_itens, 'valor', (i) => i.rubrica === 'consignado')) },
        ]} />
      </Card>
      <Card titulo="Evolução anual">
        <Tabela linhas={[...anos.values()]} chave="ano" colunas={[{ k: 'ano', t: 'Ano' }, { k: 'bruto', t: 'Bruto', num: true, r: (a) => brl(a.bruto) }, { k: 'descontos', t: 'Descontos', num: true, r: (a) => brl(a.descontos) }, { k: 'liquido', t: 'Líquido', num: true, r: (a) => brl(a.liquido) }]} />
      </Card>
      {edit && <Contracheque base={edit.id ? edit : null} fechar={() => setEdit(null)} />}
    </div>
  );
}
