import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { brl, dataBR, hoje } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Campo, Input, Modal, toast } from './ui';

const valorBR = (s: string) => (s.includes(',') ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s));
const proximoMes = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); const dt = new Date(Date.UTC(a, m, 1)); const ult = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(d, ult)); return dt.toISOString().slice(0, 10); };

/** Pagar (ou receber) tudo ou só uma parte; a parte que faltou vira uma nova conta. */
export function PagamentoModal({ c, fechar }: { c: any | null; fechar: () => void }) {
  const [modo, setModo] = useState<'tudo' | 'parte'>('tudo');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hoje());
  const [vencRest, setVencRest] = useState('');
  const [juros, setJuros] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { if (c) { setModo('tudo'); setValor(''); setData(hoje()); setVencRest(proximoMes(c.vencimento < hoje() ? hoje() : c.vencimento)); setJuros(''); setErro(''); } }, [c?.id]);
  if (!c) return null;
  const receber = c.tipo === 'receber';
  const ehCartao = c.categoria === 'Cartão de crédito' || !!c.cartao;
  const pago = valorBR(valor || '0');
  const restante = Math.round((Number(c.valor) - pago) * 100) / 100;
  const extra = valorBR(juros || '0') || 0;

  async function confirmar() {
    setErro(''); setSalvando(true);
    try {
      if (modo === 'tudo') {
        const { error } = await supabase.from('plan_contas').update({ status: 'pago', pago_em: data, pago_registrado_em: new Date().toISOString() }).eq('id', c.id);
        if (error) throw error;
        toast(receber ? `Recebido ${brl(c.valor)} ✅ Entrou no caixa.` : `Pago ${brl(c.valor)} ✅ Saiu do caixa.`);
      } else {
        if (!(pago > 0)) throw new Error(`Digite quanto ${receber ? 'recebeu' : 'pagou'}.`);
        if (pago >= Number(c.valor)) throw new Error(`O valor é igual ou maior que a conta. Use “${receber ? 'Recebi tudo' : 'Paguei tudo'}”.`);
        if (!vencRest) throw new Error('Escolha quando vence o restante.');
        const { error: e1 } = await supabase.from('plan_contas').update({ valor: pago, status: 'pago', pago_em: data, pago_registrado_em: new Date().toISOString(), descricao: `${c.descricao} (parcial: ${brl(pago)} de ${brl(c.valor)})` }).eq('id', c.id);
        if (e1) throw e1;
        const { error: e2 } = await supabase.from('plan_contas').insert({
          tipo: c.tipo, descricao: `Restante · ${c.descricao}${extra > 0 ? ` (+ ${brl(extra)} de juros)` : ''}`, categoria: c.categoria,
          valor: Math.round((restante + extra) * 100) / 100, vencimento: vencRest, grupo_id: c.grupo_id, cartao: c.cartao, origem: 'manual',
        });
        if (e2) throw e2;
        toast(`${receber ? 'Recebido' : 'Pago'} ${brl(pago)}. Restante de ${brl(restante + extra)} lançado para ${dataBR(vencRest)}. Caixa atualizado.`);
      }
      avisarMudanca(); fechar();
    } catch (e: any) { setErro(e.message ?? String(e)); } finally { setSalvando(false); }
  }

  return (
    <Modal aberto titulo={receber ? 'Registrar recebimento' : 'Registrar pagamento'} fechar={fechar}>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">{c.descricao} · <b>{brl(c.valor)}</b> · vence {dataBR(c.vencimento)}</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {[['tudo', receber ? 'Recebi tudo' : 'Paguei tudo'], ['parte', receber ? 'Recebi uma parte' : 'Paguei uma parte']].map(([v, t]) => (
          <button key={v} onClick={() => setModo(v as any)} className={`rounded-xl border p-2.5 text-sm font-semibold ${modo === v ? 'border-teal-600 bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200' : 'border-slate-200 dark:border-slate-700'}`}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {modo === 'parte' && <Campo rotulo={receber ? 'Quanto recebeu (R$)' : 'Quanto pagou (R$)'}><Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></Campo>}
        <Campo rotulo={receber ? 'Data do recebimento' : 'Data do pagamento'}><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>
      </div>
      {modo === 'parte' && pago > 0 && restante > 0 && <div className="mt-3 space-y-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30">
        <p className="text-sm">Ficou faltando <b>{brl(restante)}</b>. Vou lançar como uma nova conta:</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Quando vence o restante"><Input type="date" value={vencRest} onChange={(e) => setVencRest(e.target.value)} /></Campo>
          {!receber && <Campo rotulo="Juros/encargos (opcional)" dica={ehCartao ? 'veja na próxima fatura' : undefined}><Input inputMode="decimal" placeholder="0,00" value={juros} onChange={(e) => setJuros(e.target.value)} /></Campo>}
        </div>
        {!receber && ehCartao && <p className="text-xs text-amber-900 dark:text-amber-200">⚠️ Pagar só parte da fatura do cartão costuma cair no <b>rotativo</b>, com juros altos. O restante vem na próxima fatura; quando você importá-la, o app tira este lançamento para não contar duas vezes.</p>}
        <p className="text-sm">Total do restante: <b>{brl(restante + extra)}</b> em {vencRest ? dataBR(vencRest) : '—'}</p>
      </div>}
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={confirmar} carregando={salvando}>Confirmar</Btn></div>
    </Modal>
  );
}

