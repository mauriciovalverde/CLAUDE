import { useMemo, useState } from 'react';
import { PackageCheck, Plus } from 'lucide-react';
import { rpc, supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { brl, dataBR, dataHora, fimMes, hoje, inicioMes, lerNum, qtd } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Stat, Tabela, toast, useDados } from '../components/ui';
import FormCompra from '../components/FormCompra';

const ORIGEM: Record<string, string> = { manual: 'Manual', planilha: 'Planilha', nota: 'Nota fiscal', ia: 'IA' };

export default function Compras() {
  const { pode } = useEu();
  const [aba, setAba] = useState('lista');
  const [de, setDe] = useState(inicioMes());
  const [ate, setAte] = useState(fimMes());
  const [forn, setForn] = useState('');
  const [nova, setNova] = useState(false);
  const [ver, setVer] = useState<any>(null);
  const [receber, setReceber] = useState<any>(null);
  const { dados: fornecedores } = useDados(() => q<any[]>(supabase.from('rest_fornecedores').select('id,nome').order('nome')), []);
  const { dados } = useDados(() => {
    let x = supabase.from('rest_compras').select('*, rest_fornecedores(nome), rest_compra_itens(count)').order('data', { ascending: false }).order('numero', { ascending: false });
    if (aba === 'receber') x = x.eq('status', 'comprada'); else { x = x.gte('data', de).lte('data', ate); if (forn) x = x.eq('fornecedor_id', forn); }
    return q<any[]>(x.limit(500));
  }, [aba, de, ate, forn]);
  const total = useMemo(() => (dados ?? []).filter((c) => !['cancelada', 'historico'].includes(c.status)).reduce((t, c) => t + Number(c.total), 0), [dados]);

  return (
    <div>
      <Cabecalho titulo="Compras" sub="Compras efetivamente realizadas (pedido aprovado ainda não é compra)" acoes={pode('compras') && <Btn onClick={() => setNova(true)}><Plus className="h-4 w-4" />Registrar compra</Btn>} />
      <Abas abas={[{ id: 'lista', t: 'Todas' }, { id: 'receber', t: '🚚 A receber' }]} ativa={aba} mudar={setAba} />
      {aba === 'lista' && <Card className="mb-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Campo rotulo="De"><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></Campo>
          <Campo rotulo="Até"><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></Campo>
          <Campo rotulo="Fornecedor"><Select value={forn} onChange={(e) => setForn(e.target.value)}><option value="">Todos</option>{(fornecedores ?? []).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</Select></Campo>
          <Stat rotulo={`${dados?.length ?? 0} compras`} valor={brl(total)} />
        </div>
      </Card>}
      {aba === 'receber' && <Aviso tipo="info">Quando a mercadoria chegar, confira e toque em <b>Receber</b>: informe o que realmente chegou. Só então entra no estoque.</Aviso>}
      <div className="mt-3">
        <Tabela linhas={dados} aoClicar={(c) => setVer(c)} vazio="Nenhuma compra neste período."
          colunas={[
            { k: 'f', t: 'Fornecedor', r: (c) => <span>{c.rest_fornecedores?.nome ?? '—'} <span className="text-xs text-slate-400">#{c.numero}</span></span> },
            { k: 'data', t: 'Data', r: (c) => <>{dataBR(c.data)}{c.data_estimada && <span title="data estimada pela semana da planilha" className="text-amber-600">*</span>}</> },
            { k: 'i', t: 'Itens', r: (c) => c.rest_compra_itens?.[0]?.count ?? 0, esconderCelular: true },
            { k: 'origem', t: 'Origem', r: (c) => ORIGEM[c.origem], esconderCelular: true },
            { k: 'status', t: 'Situação', r: (c) => <Badge s={c.status} /> },
            { k: 'total', t: 'Total', num: true, r: (c) => <b>{brl(c.total)}</b> },
            ...(aba === 'receber' ? [{ k: 'acao', t: '', r: (c: any) => <Btn variante="secundario" onClick={(e) => { e.stopPropagation(); setReceber(c); }}><PackageCheck className="h-4 w-4" />Receber</Btn> }] : []),
          ]} />
      </div>
      {nova && <FormCompra fechar={() => setNova(false)} />}
      {ver && <DetalheCompra compra={ver} fechar={() => setVer(null)} receber={() => { setReceber(ver); setVer(null); }} />}
      {receber && <Receber compra={receber} fechar={() => setReceber(null)} />}
    </div>
  );
}

export function DetalheCompra({ compra, fechar, receber }: { compra: any; fechar: () => void; receber?: () => void }) {
  const { pode } = useEu();
  const { dados } = useDados(async () => {
    const itens = await q<any[]>(supabase.from('rest_compra_itens').select('*, rest_produtos(nome,unidade), rest_solicitacao_itens(quantidade,qtd_aprovada,unidade)').eq('compra_id', compra.id));
    const nota = compra.nota_id ? (await supabase.from('rest_notas').select('numero,serie,cnpj,valor_total,data_emissao').eq('id', compra.nota_id).maybeSingle()).data : null;
    const contas = pode('admin') ? await q<any[]>(supabase.from('rest_contas').select('numero,valor,vencimento,status,parcela_num,parcela_total').eq('compra_id', compra.id).order('parcela_num')) : null;
    return { itens, nota, contas };
  }, [compra.id]);
  const temSolic = dados?.itens.some((i) => i.rest_solicitacao_itens);
  const diverg = (dados?.itens ?? []).filter((i) => i.qtd_recebida != null && i.quantidade != null && Number(i.qtd_recebida) < Number(i.quantidade));
  return (
    <Modal aberto fechar={fechar} titulo={`Compra #${compra.numero} · ${compra.rest_fornecedores?.nome ?? ''}`} largo>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2"><Badge s={compra.status} /><span>{dataBR(compra.data)}</span><span>· {ORIGEM[compra.origem]}</span>{compra.recebido_em && <span>· recebida {dataHora(compra.recebido_em)}</span>}</div>
        {compra.data_estimada && <Aviso tipo="alerta">Data estimada: na planilha original esta compra não tinha data escrita.</Aviso>}
        {diverg.length > 0 && <Aviso tipo="alerta">Chegou menos do que foi comprado em {diverg.length} item(ns).</Aviso>}
        {dados?.nota && <Aviso tipo={Math.abs(Number(dados.nota.valor_total) - Number(compra.total)) > 0.05 ? 'alerta' : 'ok'}>Nota fiscal nº {dados.nota.numero}{dados.nota.serie ? `/${dados.nota.serie}` : ''} · {brl(dados.nota.valor_total)}{Math.abs(Number(dados.nota.valor_total) - Number(compra.total)) > 0.05 ? ` — diferente do total da compra (${brl(compra.total)}). Confira.` : ' — confere com a compra.'}</Aviso>}
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase text-slate-500 dark:border-slate-800"><th className="py-1.5">Produto</th>{temSolic && <th className="text-right">Solicitado</th>}<th className="text-right">Comprado</th><th className="text-right">Recebido</th><th className="text-right">Unit.</th><th className="text-right">Total</th></tr></thead>
          <tbody>{(dados?.itens ?? []).map((i) => {
            const falta = i.qtd_recebida != null && i.quantidade != null && Number(i.qtd_recebida) < Number(i.quantidade);
            return (
              <tr key={i.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">{i.rest_produtos?.nome ?? i.descricao_original}{i.descricao_original && i.rest_produtos?.nome && i.descricao_original.toUpperCase() !== i.rest_produtos.nome.toUpperCase() && <div className="text-[11px] text-slate-400">original: {i.descricao_original}</div>}</td>
                {temSolic && <td className="text-right tabular-nums">{i.rest_solicitacao_itens ? `${qtd(i.rest_solicitacao_itens.qtd_aprovada ?? i.rest_solicitacao_itens.quantidade)} ${i.rest_solicitacao_itens.unidade}` : '—'}</td>}
                <td className="text-right tabular-nums">{qtd(i.quantidade)} {i.unidade}</td>
                <td className={`text-right tabular-nums ${falta ? 'font-semibold text-amber-600' : ''}`}>{i.qtd_recebida != null ? qtd(i.qtd_recebida) : '—'}</td>
                <td className="text-right tabular-nums">{i.valor_unitario ? brl(i.valor_unitario) : '—'}</td>
                <td className="text-right tabular-nums">{brl(i.valor_total)}</td>
              </tr>
            );
          })}</tbody>
          <tfoot>
            {Number(compra.desconto) > 0 && <tr><td colSpan={temSolic ? 5 : 4} className="pt-2 text-right">Desconto</td><td className="pt-2 text-right tabular-nums">−{brl(compra.desconto)}</td></tr>}
            <tr><td colSpan={temSolic ? 5 : 4} className="pt-1 text-right font-semibold">Total</td><td className="pt-1 text-right font-bold tabular-nums">{brl(compra.total)}</td></tr>
          </tfoot>
        </table></div>
        {dados?.contas && <div><h4 className="mb-1 font-semibold">Pagamento</h4>{dados.contas.map((c) => <div key={c.numero} className="flex justify-between"><span>{c.parcela_total > 1 ? `Parcela ${c.parcela_num}/${c.parcela_total}` : 'Conta'} #{c.numero} · vence {dataBR(c.vencimento)}</span><span className="flex gap-2">{brl(c.valor)} <Badge s={c.status} /></span></div>)}</div>}
        {compra.obs && <p className="text-xs text-slate-500">Obs.: {compra.obs}</p>}
        <div className="flex flex-wrap gap-2">
          {compra.status === 'comprada' && receber && <Btn onClick={receber}><PackageCheck className="h-4 w-4" />Receber mercadoria</Btn>}
          {pode('admin') && compra.status !== 'cancelada' && <Btn variante="perigo" onClick={async () => {
            if (!confirm('Cancelar esta compra? As contas dela (em aberto e já pagas) também serão canceladas e deixam de contar no caixa. Se a mercadoria já entrou no estoque, faça um ajuste no Estoque.')) return;
            const e1 = (await supabase.from('rest_compras').update({ status: 'cancelada' }).eq('id', compra.id)).error;
            // as contas da compra são canceladas pelo banco (gatilho rest_compras_cancela_contas)
            if (e1) toast(e1.message, 'erro'); else { toast('Compra cancelada'); avisarMudanca(); fechar(); }
          }}>Cancelar compra</Btn>}
        </div>
      </div>
    </Modal>
  );
}

function Receber({ compra, fechar }: { compra: any; fechar: () => void }) {
  const { dados: itens } = useDados(() => q<any[]>(supabase.from('rest_compra_itens').select('*, rest_produtos(nome)').eq('compra_id', compra.id)), [compra.id]);
  const [rec, setRec] = useState<Record<string, { q: string; validade: string; lote: string }>>({});
  const [salvando, setSalvando] = useState(false);
  const val = (i: any) => rec[i.id] ?? { q: String(i.quantidade ?? '').replace('.', ','), validade: '', lote: '' };
  return (
    <Modal aberto fechar={fechar} titulo={`Receber compra #${compra.numero}`} largo>
      <p className="mb-3 text-sm text-slate-600">Confira cada item e corrija a quantidade se chegou menos. Validade e lote são opcionais.</p>
      <div className="space-y-2">{(itens ?? []).map((i) => {
        const v = val(i); const falta = lerNum(v.q) < Number(i.quantidade ?? 0);
        return (
          <div key={i.id} className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-2 dark:border-slate-800 sm:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="col-span-2 sm:col-span-1"><div className="font-medium">{i.rest_produtos?.nome ?? i.descricao_original}</div><div className="text-xs text-slate-500">Comprado: {qtd(i.quantidade)} {i.unidade}</div></div>
            <Campo rotulo="Chegou"><Input inputMode="decimal" value={v.q} onChange={(e) => setRec({ ...rec, [i.id]: { ...v, q: e.target.value } })} className={falta ? 'border-amber-500' : ''} /></Campo>
            <Campo rotulo="Validade"><Input type="date" value={v.validade} onChange={(e) => setRec({ ...rec, [i.id]: { ...v, validade: e.target.value } })} /></Campo>
            <Campo rotulo="Lote"><Input value={v.lote} onChange={(e) => setRec({ ...rec, [i.id]: { ...v, lote: e.target.value } })} /></Campo>
          </div>
        );
      })}</div>
      <Btn className="mt-3 w-full !py-3" carregando={salvando} onClick={async () => {
        setSalvando(true);
        try {
          const r = await rpc('rest_receber_compra', { p_compra: compra.id, p_itens: (itens ?? []).map((i) => { const v = val(i); return { item_id: i.id, qtd_recebida: lerNum(v.q) || 0, validade: v.validade || null, lote: v.lote || null }; }) });
          toast(r.divergencia ? 'Recebido com falta: ficou registrado para conferência' : 'Mercadoria recebida e estoque atualizado');
          avisarMudanca(); fechar();
        } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
      }}><PackageCheck className="h-5 w-5" />Confirmar recebimento</Btn>
      <p className="mt-2 text-center text-xs text-slate-500">Data de hoje: {dataBR(hoje())}</p>
    </Modal>
  );
}
