import { useEffect, useState } from 'react';
import { Check, Image as Img, Plus, ShoppingBasket, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { abrirArquivo } from '../lib/arquivos';
// @ts-ignore módulo JS testado
import { UNIDADES } from '../lib/catalogo.js';
import { dataHora, lerNum, qtd } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, toast, useDados } from '../components/ui';
import FormCompra, { type LinhaCompra } from '../components/FormCompra';

const GRUPOS: Record<string, string[]> = { pendentes: ['enviada', 'em_analise'], aprovadas: ['aprovada', 'em_compra', 'parcial'], concluidas: ['comprada', 'recebida', 'reprovada', 'cancelada'] };

export default function Solicitacoes() {
  const [aba, setAba] = useState('pendentes');
  const [ver, setVer] = useState<string | null>(null);
  const { dados, recarregar } = useDados(() => q<any[]>(supabase.from('rest_solicitacoes').select('*, solicitante:rest_funcionarios!rest_solicitacoes_solicitante_id_fkey(nome), rest_solicitacao_itens(id)').in('status', GRUPOS[aba]).order('enviada_em', { ascending: false, nullsFirst: false }).limit(200)), [aba]);
  // aviso em tempo real quando chega pedido novo (com o app aberto)
  useEffect(() => {
    const canal = supabase.channel('solicitacoes').on('postgres_changes', { event: '*', schema: 'public', table: 'rest_solicitacoes' }, (p: any) => {
      if (p.new?.status === 'enviada' && p.old?.status !== 'enviada') toast(`📋 Novo pedido #${p.new.numero} chegou`, 'info');
      recarregar();
    }).subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [recarregar]);
  return (
    <div>
      <Cabecalho titulo="Solicitações de compra" sub="Pedidos da equipe: aprove, ajuste e transforme em compra" />
      <Abas abas={[{ id: 'pendentes', t: '🔔 Para analisar' }, { id: 'aprovadas', t: '✅ Aprovadas' }, { id: 'concluidas', t: 'Concluídas' }]} ativa={aba} mudar={setAba} />
      {dados && !dados.length && <Card><p className="text-center text-sm text-slate-500">Nada aqui.</p></Card>}
      <div className="grid gap-2 sm:grid-cols-2">
        {(dados ?? []).map((s) => (
          <button key={s.id} onClick={() => setVer(s.id)} className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-[.99] dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-2"><span className="font-semibold">#{s.numero} · {s.solicitante?.nome}</span><Badge s={s.status} /></div>
            <div className="mt-1 text-sm text-slate-500">{s.setor} · {s.rest_solicitacao_itens.length} itens · {dataHora(s.enviada_em ?? s.criado_em)}</div>
            {s.obs && <div className="mt-1 truncate text-xs text-slate-500">“{s.obs}”</div>}
          </button>
        ))}
      </div>
      {ver && <Detalhe id={ver} fechar={() => { setVer(null); recarregar(); }} />}
    </div>
  );
}

function Detalhe({ id, fechar }: { id: string; fechar: () => void }) {
  const { eu } = useEu();
  const { dados: s, recarregar } = useDados(async () => {
    const { data, error } = await supabase.from('rest_solicitacoes').select('*, solicitante:rest_funcionarios!rest_solicitacoes_solicitante_id_fkey(nome,telefone), rest_solicitacao_itens(*, rest_produtos(nome,unidade,status))').eq('id', id).single();
    if (error) throw error;
    const ids = data.rest_solicitacao_itens.map((i: any) => i.id);
    const { data: comprados } = ids.length ? await supabase.from('rest_compra_itens').select('solicitacao_item_id,quantidade,qtd_recebida').in('solicitacao_item_id', ids) : { data: [] as any[] };
    return { ...data, comprados: comprados ?? [] };
  }, [id]);
  const [motivo, setMotivo] = useState('');
  const [reprovar, setReprovar] = useState(false);
  const [comprar, setComprar] = useState(false);
  const [novo, setNovo] = useState({ nome: '', q: '', u: 'un' });
  if (!s) return null;
  const itens = s.rest_solicitacao_itens.sort((a: any, b: any) => a.criado_em.localeCompare(b.criado_em));
  const comprado = (i: any) => s.comprados.filter((c: any) => c.solicitacao_item_id === i.id);
  const status = async (st: string, extra: Record<string, unknown> = {}) => {
    const { error } = await supabase.from('rest_solicitacoes').update({ status: st, analisada_por: eu.id, analisada_em: new Date().toISOString(), ...extra }).eq('id', id);
    if (error) toast(error.message, 'erro'); else { toast('Atualizado'); avisarMudanca(); recarregar(); }
  };
  const item = async (iid: string, mud: Record<string, unknown>) => { const { error } = await supabase.from('rest_solicitacao_itens').update(mud).eq('id', iid); if (error) toast(error.message, 'erro'); else recarregar(); };
  const editavel = !['comprada', 'recebida', 'cancelada', 'reprovada'].includes(s.status);
  const pendentesCompra = itens.filter((i: any) => !i.removido && !comprado(i).length);
  const linhas: LinhaCompra[] = pendentesCompra.map((i: any) => ({ produto_id: i.produto_id, nome: i.rest_produtos?.nome ?? i.nome_livre, quantidade: String(i.qtd_aprovada ?? i.quantidade).replace('.', ','), unidade: i.unidade, unit: '', total: '', solicitacao_item_id: i.id }));
  const textoFornecedor = `Pedido ${eu.nome ? `(${eu.nome})` : ''}:\n` + pendentesCompra.map((i: any) => `• ${i.rest_produtos?.nome ?? i.nome_livre}: ${qtd(i.qtd_aprovada ?? i.quantidade)} ${i.unidade}${i.obs ? ` (${i.obs})` : ''}`).join('\n');

  return (
    <Modal aberto fechar={fechar} titulo={`Pedido #${s.numero}`} largo>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2"><Badge s={s.status} /><span><b>{s.solicitante?.nome}</b> · {s.setor} · {dataHora(s.enviada_em ?? s.criado_em)}</span></div>
        {s.obs && <Aviso>“{s.obs}”</Aviso>}
        {s.motivo && <Aviso tipo="erro">Motivo da reprovação: {s.motivo}</Aviso>}
        <div className="space-y-1.5">
          {itens.map((i: any) => {
            const c = comprado(i); const qc = c.reduce((t: number, x: any) => t + Number(x.quantidade ?? 0), 0); const qr = c.reduce((t: number, x: any) => t + Number(x.qtd_recebida ?? 0), 0);
            return (
              <div key={i.id} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 dark:border-slate-800 ${i.removido ? 'opacity-50' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className={`font-medium ${i.removido ? 'line-through' : ''}`}>{i.rest_produtos?.nome ?? i.nome_livre}{i.rest_produtos?.status === 'pendente' && <span className="ml-1 text-xs text-amber-600">(produto novo)</span>}{i.adicionado_pelo_responsavel && <span className="ml-1 text-xs text-sky-600">(adicionado por você)</span>}</div>
                  <div className="text-xs text-slate-500">Pediu {qtd(i.quantidade)} {i.unidade}{i.obs ? ` · ${i.obs}` : ''}{c.length ? ` · comprado ${qtd(qc)} · recebido ${qtd(qr)}` : ''}</div>
                </div>
                {i.foto_path && <button className="rounded-lg p-1.5 text-sky-700" onClick={async () => { try { await abrirArquivo(i.foto_path); } catch (e: any) { toast(e.message, 'erro'); } }} aria-label="Ver foto"><Img className="h-5 w-5" /></button>}
                {editavel && !i.removido && <div className="flex items-center gap-1"><span className="text-xs text-slate-500">Aprovar</span><Input className="!w-20 !py-1 text-right" inputMode="decimal" defaultValue={String(i.qtd_aprovada ?? i.quantidade).replace('.', ',')} onBlur={(e) => { const v = lerNum(e.target.value); if (v > 0 && v !== Number(i.qtd_aprovada ?? i.quantidade)) item(i.id, { qtd_aprovada: v }); }} /><span className="text-xs">{i.unidade}</span></div>}
                {editavel && <button className={`rounded-lg p-1.5 ${i.removido ? 'text-emerald-600' : 'text-rose-600'}`} onClick={() => item(i.id, { removido: !i.removido })} aria-label={i.removido ? 'Voltar item' : 'Remover item'}>{i.removido ? <Plus className="h-4 w-4" /> : <X className="h-4 w-4" />}</button>}
              </div>
            );
          })}
        </div>
        {editavel && <div className="flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
          <Campo rotulo="Adicionar item"><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Produto" /></Campo>
          <Input className="!w-20" inputMode="decimal" value={novo.q} onChange={(e) => setNovo({ ...novo, q: e.target.value })} placeholder="Qtd" />
          <Select className="!w-24" value={novo.u} onChange={(e) => setNovo({ ...novo, u: e.target.value })}>{UNIDADES.map((u: string) => <option key={u}>{u}</option>)}</Select>
          <Btn variante="secundario" disabled={!novo.nome.trim() || !(lerNum(novo.q) > 0)} onClick={async () => {
            const { error } = await supabase.from('rest_solicitacao_itens').insert({ solicitacao_id: id, nome_livre: novo.nome.trim(), quantidade: lerNum(novo.q), unidade: novo.u, adicionado_pelo_responsavel: true });
            if (error) toast(error.message, 'erro'); else { setNovo({ nome: '', q: '', u: 'un' }); recarregar(); }
          }}><Plus className="h-4 w-4" /></Btn>
        </div>}
        <div className="flex flex-wrap gap-2 border-t pt-3 dark:border-slate-800">
          {s.status === 'enviada' && <Btn variante="secundario" onClick={() => status('em_analise')}>Em análise</Btn>}
          {['enviada', 'em_analise'].includes(s.status) && <Btn onClick={() => status('aprovada')}><Check className="h-4 w-4" />Aprovar</Btn>}
          {['enviada', 'em_analise', 'aprovada'].includes(s.status) && <Btn variante="perigo" onClick={() => setReprovar(true)}>Reprovar</Btn>}
          {s.status === 'aprovada' && <Btn variante="secundario" onClick={() => status('em_compra')}>Compra em andamento</Btn>}
          {['aprovada', 'em_compra', 'parcial'].includes(s.status) && pendentesCompra.length > 0 && <Btn onClick={() => setComprar(true)}><ShoppingBasket className="h-4 w-4" />Registrar compra destes itens</Btn>}
          {pendentesCompra.length > 0 && editavel && <a className="inline-flex items-center rounded-xl bg-[#25D366] px-3 py-2 text-sm font-medium text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(textoFornecedor)}`}>Enviar lista ao fornecedor</a>}
        </div>
        <p className="text-xs text-slate-500">Aprovar não registra compra. A compra só entra quando você registra o que foi comprado, com valores.</p>
      </div>
      <Modal aberto={reprovar} fechar={() => setReprovar(false)} titulo="Reprovar pedido">
        <Campo rotulo="Motivo (o funcionário verá)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
        <Btn variante="perigo" className="mt-3 w-full" onClick={() => { status('reprovada', { motivo: motivo || null }); setReprovar(false); }}>Reprovar</Btn>
      </Modal>
      {comprar && <FormCompra inicial={{ itens: linhas, solicitacao_id: id, titulo: `Compra do pedido #${s.numero}` }} fechar={() => setComprar(false)} aoSalvar={() => recarregar()} />}
    </Modal>
  );
}
