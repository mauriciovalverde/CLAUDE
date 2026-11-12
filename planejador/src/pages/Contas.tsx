import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Plus, Trash2, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORIAS_PAGAR, CATEGORIAS_RECEBER, carregar, criarConta } from '../lib/dados';
import { brl, dataBR, fimMes, hoje } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, Select, Stat, Tabela, toast, useDados } from '../components/ui';

const nomeMes = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const somaMes = (m: string, k: number) => { const d = new Date(m + '-15T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + k); return d.toISOString().slice(0, 7); };
const valorBR = (s: string) => (s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s));

function NovaConta({ aberto, fechar, tipoPadrao }: { aberto: boolean; fechar: () => void; tipoPadrao: string }) {
  const [f, setF] = useState<any>({});
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { if (aberto) { setErro(''); setF({ tipo: tipoPadrao, descricao: '', categoria: tipoPadrao === 'receber' ? 'Salário' : 'Moradia', valor: '', vencimento: hoje(), repeticao: 'unica', vezes: 12, pago: false }); } }, [aberto, tipoPadrao]);
  if (!aberto || !f.tipo) return null;
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const cats = f.tipo === 'receber' ? CATEGORIAS_RECEBER : CATEGORIAS_PAGAR;
  async function salvar() {
    setErro('');
    const valor = valorBR(String(f.valor));
    if (!f.descricao?.trim()) { setErro('Escreva uma descrição (ex.: Aluguel, Salário).'); return; }
    if (!(valor > 0)) { setErro('Digite o valor.'); return; }
    setSalvando(true);
    try {
      const n = await criarConta({ ...f, valor, vezes: Number(f.vezes) });
      toast(n > 1 ? `${n} lançamentos criados (${f.repeticao === 'mensal' ? 'todo mês' : 'parcelas'}).` : 'Conta lançada.');
      avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }
  return (
    <Modal aberto titulo="Nova conta" fechar={fechar}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 grid grid-cols-2 gap-2">
          {[['pagar', '↑ Vou pagar'], ['receber', '↓ Vou receber']].map(([v, t]) => <button key={v} onClick={() => { set('tipo', v); set('categoria', v === 'receber' ? 'Salário' : 'Moradia'); }} className={`rounded-xl border p-2.5 text-sm font-semibold ${f.tipo === v ? (v === 'pagar' ? 'border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40' : 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40') : 'border-slate-200 dark:border-slate-700'}`}>{t}</button>)}
        </div>
        <div className="col-span-2"><Campo rotulo="Descrição"><Input value={f.descricao ?? ''} onChange={(e) => set('descricao', e.target.value)} placeholder={f.tipo === 'receber' ? 'Ex.: Salário' : 'Ex.: Aluguel'} /></Campo></div>
        <Campo rotulo={f.repeticao === 'parcelada' ? 'Valor TOTAL (R$)' : 'Valor (R$)'}><Input inputMode="decimal" value={f.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></Campo>
        <Campo rotulo="Categoria"><Select value={f.categoria} onChange={(e) => set('categoria', e.target.value)}>{cats.map((c) => <option key={c}>{c}</option>)}</Select></Campo>
        <Campo rotulo={f.repeticao === 'unica' ? 'Vencimento' : '1º vencimento'}><Input type="date" value={f.vencimento ?? ''} onChange={(e) => set('vencimento', e.target.value)} /></Campo>
        <Campo rotulo="Repete?"><Select value={f.repeticao} onChange={(e) => set('repeticao', e.target.value)}><option value="unica">Só uma vez</option><option value="mensal">Todo mês</option><option value="parcelada">Parcelado</option></Select></Campo>
        {f.repeticao !== 'unica' && <Campo rotulo={f.repeticao === 'mensal' ? 'Por quantos meses?' : 'Quantas parcelas?'}><Input type="number" min={2} max={60} value={f.vezes} onChange={(e) => set('vezes', e.target.value)} /></Campo>}
        {f.repeticao === 'parcelada' && Number(f.vezes) > 1 && valorBR(String(f.valor)) > 0 && <p className="col-span-2 text-xs text-slate-500">{f.vezes}× de {brl(valorBR(String(f.valor)) / Number(f.vezes))}</p>}
        <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.pago} onChange={(e) => set('pago', e.target.checked)} />{f.tipo === 'receber' ? 'Já recebi' : 'Já paguei'} {f.repeticao !== 'unica' && '(a 1ª)'}</label>
      </div>
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar} carregando={salvando}>Salvar</Btn></div>
    </Modal>
  );
}

export default function Contas() {
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [aba, setAba] = useState('todas');
  const [nova, setNova] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<any>(null);
  const { dados } = useDados(() => carregar.contas(mes + '-01', fimMes(mes + '-01')), [mes]);
  const { dados: atrasadas } = useDados(() => carregar.contas(undefined, new Date(Date.now() - 864e5).toISOString().slice(0, 10)).then((l) => l.filter((c) => c.status === 'pendente')), []);
  const linhas = (dados ?? []).filter((c) => aba === 'todas' || c.tipo === aba);
  const soma = (t: string, st?: string) => (dados ?? []).filter((c) => c.tipo === t && (!st || c.status === st)).reduce((s, c) => s + Number(c.valor), 0);

  async function marcar(c: any, pago: boolean) {
    await supabase.from('plan_contas').update({ status: pago ? 'pago' : 'pendente', pago_em: pago ? hoje() : null }).eq('id', c.id);
    toast(pago ? (c.tipo === 'receber' ? 'Marcado como recebido ✅' : 'Marcado como pago ✅') : 'Voltou para pendente.'); avisarMudanca();
  }
  async function apagar(modo: 'uma' | 'futuras') {
    const c = excluir; const agora = new Date().toISOString();
    if (modo === 'uma' || !c.grupo_id) await supabase.from('plan_contas').update({ excluido_em: agora }).eq('id', c.id);
    else await supabase.from('plan_contas').update({ excluido_em: agora }).eq('grupo_id', c.grupo_id).gte('vencimento', c.vencimento).eq('status', 'pendente');
    setExcluir(null); toast('Removido.'); avisarMudanca();
  }

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Contas" sub="A pagar e a receber" acoes={<><Btn variante="secundario" onClick={() => setNova('receber')}><Plus className="h-4 w-4" />Receber</Btn><Btn onClick={() => setNova('pagar')}><Plus className="h-4 w-4" />Pagar</Btn></>} />
      {!!atrasadas?.length && <Aviso tipo="erro">Você tem <b>{atrasadas.length}</b> conta(s) vencida(s) sem marcar como paga/recebida (total {brl(atrasadas.reduce((s, c) => s + Number(c.valor), 0))}). <button className="font-semibold underline" onClick={() => setMes(atrasadas[0].vencimento.slice(0, 7))}>Ver</button></Aviso>}
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        <Btn variante="fantasma" onClick={() => setMes(somaMes(mes, -1))} aria-label="Mês anterior"><ChevronLeft className="h-5 w-5" /></Btn>
        <span className="font-semibold capitalize">{nomeMes(mes)}</span>
        <Btn variante="fantasma" onClick={() => setMes(somaMes(mes, 1))} aria-label="Próximo mês"><ChevronRight className="h-5 w-5" /></Btn>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat rotulo="Entra" valor={brl(soma('receber'))} tom="bom" sub={`recebido ${brl(soma('receber', 'pago'))}`} />
        <Stat rotulo="Sai" valor={brl(soma('pagar'))} tom="ruim" sub={`pago ${brl(soma('pagar', 'pago'))}`} />
        <Stat rotulo="Sobra" valor={brl(soma('receber') - soma('pagar'))} tom={soma('receber') - soma('pagar') >= 0 ? 'bom' : 'ruim'} />
      </div>
      <Card>
        <Abas abas={[{ id: 'todas', t: 'Todas' }, { id: 'pagar', t: 'A pagar' }, { id: 'receber', t: 'A receber' }]} ativa={aba} mudar={setAba} />
        <Tabela linhas={dados ? linhas : null} vazio="Nenhuma conta neste mês. Toque em “+ Pagar” ou “+ Receber”." colunas={[
          { k: 'descricao', t: 'Descrição', r: (c) => <span><span className={c.tipo === 'receber' ? 'text-emerald-600' : 'text-rose-600'}>{c.tipo === 'receber' ? '↓' : '↑'}</span> {c.descricao}{c.parcela_total ? <span className="text-slate-400"> ({c.parcela_num}/{c.parcela_total})</span> : ''}{c.cartao ? <span className="text-slate-400"> · {c.cartao}</span> : ''}</span> },
          { k: 'categoria', t: 'Categoria', esconderCelular: true },
          { k: 'vencimento', t: 'Vence', r: (c) => <span className={c.status === 'pendente' && c.vencimento < hoje() ? 'font-semibold text-rose-600' : ''}>{dataBR(c.vencimento)}</span> },
          { k: 'valor', t: 'Valor', num: true, r: (c) => <strong>{brl(c.valor)}</strong> },
          { k: 'status', t: 'Situação', r: (c) => <Badge s={c.status === 'pago' ? 'pago' : c.vencimento < hoje() ? 'atrasado' : 'pendente'}>{c.status === 'pago' ? (c.tipo === 'receber' ? 'recebido' : 'pago') : c.vencimento < hoje() ? 'atrasado' : 'pendente'}</Badge> },
          { k: 'a', t: '', r: (c) => <div className="flex justify-end gap-1">
            {c.status === 'pendente' ? <Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={() => marcar(c, true)}><Check className="h-3.5 w-3.5" />{c.tipo === 'receber' ? 'Recebi' : 'Paguei'}</Btn>
              : <Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={() => marcar(c, false)}><Undo2 className="h-3.5 w-3.5" />Desfazer</Btn>}
            <Btn variante="fantasma" className="!px-2 !py-1 text-xs text-slate-400" onClick={() => setExcluir(c)} aria-label="Remover"><Trash2 className="h-3.5 w-3.5" /></Btn>
          </div> },
        ]} />
      </Card>
      <NovaConta aberto={!!nova} tipoPadrao={nova ?? 'pagar'} fechar={() => setNova(null)} />
      <Modal aberto={!!excluir} fechar={() => setExcluir(null)} titulo="Remover conta">
        <p className="text-sm">{excluir?.descricao} · {brl(excluir?.valor)} · {dataBR(excluir?.vencimento)}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Btn variante="secundario" onClick={() => setExcluir(null)}>Cancelar</Btn>
          <Btn variante="perigo" onClick={() => apagar('uma')}>Remover só esta</Btn>
          {excluir?.grupo_id && <Btn variante="perigo" onClick={() => apagar('futuras')}>Esta e as próximas</Btn>}
        </div>
      </Modal>
    </div>
  );
}
