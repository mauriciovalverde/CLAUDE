import { useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { carregar, somar } from '../lib/dados';
import { usePeriodo } from '../lib/periodo';
import { brl, dataBR, num, pct } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Stat, Tabela, toast, useDados } from '../components/ui';

const CLASSES: Record<string, string> = {
  nao_medicamento: 'Mercadoria comum / correlato', mip: 'Medicamento isento de prescrição (MIP)', tarja_vermelha: 'Tarja vermelha (sob prescrição)',
  tarja_vermelha_retencao: 'Tarja vermelha com retenção (ex.: antimicrobiano)', controlado_344: 'Controlado – Portaria 344/98',
};

function ProdutoModal({ p, fechar }: { p: any | null; fechar: () => void }) {
  const [f, setF] = useState<any>(p);
  const [erro, setErro] = useState('');
  if (!p) return null;
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const nb = (v: any) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  async function salvar() {
    setErro('');
    if (!f.nome?.trim()) { setErro('Informe o nome.'); return; }
    if (f.classe_regulatoria !== 'nao_medicamento' && !f.registro_anvisa) { setErro('Medicamento exige o número de registro/notificação na ANVISA.'); return; }
    const reg = { nome: f.nome, nome_comercial: f.nome_comercial || null, principio_ativo: f.principio_ativo || null, apresentacao: f.apresentacao || null, codigo: f.codigo || null, unidade: f.unidade || 'un', preco_compra: nb(f.preco_compra), preco_venda: nb(f.preco_venda), estoque_minimo: nb(f.estoque_minimo) ?? 0, classe_regulatoria: f.classe_regulatoria, registro_anvisa: f.registro_anvisa || null, fornecedor_id: f.fornecedor_id || null };
    const { error } = f.id ? await supabase.from('produtos').update(reg).eq('id', f.id) : await supabase.from('produtos').insert(reg);
    if (error) { setErro(error.message.includes('produtos_codigo_unico') ? 'Já existe produto com esse código.' : error.message); return; }
    toast('Produto salvo.'); avisarMudanca(); fechar();
  }
  return (
    <Modal aberto titulo={f.id ? 'Editar produto' : 'Novo produto'} fechar={fechar} largo>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3"><Campo rotulo="Nome do produto / medicamento"><Input value={f.nome ?? ''} onChange={(e) => set('nome', e.target.value)} /></Campo></div>
        <Campo rotulo="Nome comercial"><Input value={f.nome_comercial ?? ''} onChange={(e) => set('nome_comercial', e.target.value)} /></Campo>
        <Campo rotulo="Princípio ativo"><Input value={f.principio_ativo ?? ''} onChange={(e) => set('principio_ativo', e.target.value)} /></Campo>
        <Campo rotulo="Apresentação"><Input value={f.apresentacao ?? ''} onChange={(e) => set('apresentacao', e.target.value)} placeholder="ex.: caixa 30 cp 500 mg" /></Campo>
        <Campo rotulo="Código / EAN"><Input value={f.codigo ?? ''} onChange={(e) => set('codigo', e.target.value)} /></Campo>
        <Campo rotulo="Unidade"><Input value={f.unidade ?? 'un'} onChange={(e) => set('unidade', e.target.value)} /></Campo>
        <Campo rotulo="Estoque mínimo"><Input inputMode="decimal" value={f.estoque_minimo ?? ''} onChange={(e) => set('estoque_minimo', e.target.value)} /></Campo>
        <Campo rotulo="Preço de compra (R$)" dica="atualizado a cada compra"><Input inputMode="decimal" value={f.preco_compra ?? ''} onChange={(e) => set('preco_compra', e.target.value)} /></Campo>
        <Campo rotulo="Preço de venda (R$)"><Input inputMode="decimal" value={f.preco_venda ?? ''} onChange={(e) => set('preco_venda', e.target.value)} /></Campo>
        <Campo rotulo="Margem"><div className="py-2 text-sm font-semibold">{f.preco_venda && f.preco_compra ? pct(((nb(f.preco_venda)! - nb(f.preco_compra)!) / nb(f.preco_venda)!) * 100) : '—'}</div></Campo>
        <div className="col-span-2 sm:col-span-2"><Campo rotulo="Classe regulatória"><Select value={f.classe_regulatoria ?? 'nao_medicamento'} onChange={(e) => set('classe_regulatoria', e.target.value)}>{Object.entries(CLASSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo></div>
        <Campo rotulo="Registro ANVISA"><Input value={f.registro_anvisa ?? ''} onChange={(e) => set('registro_anvisa', e.target.value)} /></Campo>
      </div>
      {f.classe_regulatoria && f.classe_regulatoria !== 'nao_medicamento' && <div className="mt-3"><Aviso tipo="alerta">Medicamentos só podem ser vendidos com AFE/ANVISA, licença sanitária e responsável técnico cadastrados em Configurações. Itens sob prescrição exigem receita; os da Portaria 344 exigem autorização especial e SNGPC.</Aviso></div>}
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar}>Salvar</Btn></div>
    </Modal>
  );
}

function AjusteModal({ p, fechar }: { p: any | null; fechar: () => void }) {
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState('');
  if (!p) return null;
  async function salvar() {
    const novo = Number(qtd.replace(',', '.'));
    if (isNaN(novo) || novo < 0 || !motivo.trim()) { toast('Informe a quantidade contada e o motivo.', 'erro'); return; }
    const dif = novo - Number(p.estoque_atual);
    if (dif === 0) { fechar(); return; }
    const { error } = await supabase.rpc('movimentar_estoque', { p_produto: p.id, p_lote: null, p_tipo: dif > 0 ? 'entrada' : 'saida', p_qtd: Math.abs(dif), p_origem: 'inventario', p_origem_id: null, p_obs: motivo });
    if (error) toast(error.message, 'erro'); else { toast('Inventário ajustado.'); avisarMudanca(); fechar(); }
  }
  return (
    <Modal aberto titulo={`Ajuste de inventário · ${p.nome}`} fechar={fechar}>
      <p className="mb-3 text-sm">Sistema: <strong>{num(p.estoque_atual)} {p.unidade}</strong></p>
      <div className="space-y-3"><Campo rotulo="Quantidade contada"><Input inputMode="decimal" value={qtd} onChange={(e) => setQtd(e.target.value)} /></Campo><Campo rotulo="Motivo (obrigatório)"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="perda, avaria, contagem…" /></Campo></div>
      <div className="mt-4 flex justify-end gap-2"><Btn variante="secundario" onClick={fechar}>Cancelar</Btn><Btn onClick={salvar}>Ajustar</Btn></div>
    </Modal>
  );
}

export default function Estoque() {
  const { periodo } = usePeriodo();
  const [aba, setAba] = useState('inventario');
  const [editar, setEditar] = useState<any>(null);
  const [ajuste, setAjuste] = useState<any>(null);
  const { dados } = useDados(async () => {
    const [produtos, alertas, lotes, movs, vendas] = await Promise.all([
      carregar.produtos(), carregar.alertas(),
      q<any[]>(supabase.from('lotes').select('*, produtos(nome)').order('validade')),
      q<any[]>(supabase.from('movimentacoes_estoque').select('*, produtos(nome)').order('criado_em', { ascending: false }).limit(200)),
      carregar.vendas(periodo.de, periodo.ate),
    ]);
    return { produtos, alertas, lotes, movs, vendas };
  }, [periodo.de, periodo.ate]);
  const d: any = dados ?? {};
  const rank = new Map<string, { nome: string; q: number; fat: number; lucro: number }>();
  (d.vendas ?? []).forEach((v: any) => v.venda_itens.forEach((i: any) => { const k = i.produtos?.nome ?? '—'; const a = rank.get(k) ?? { nome: k, q: 0, fat: 0, lucro: 0 }; a.q += +i.quantidade; a.fat += +i.total; a.lucro += i.custo_unitario != null ? +i.total - i.quantidade * i.custo_unitario : 0; rank.set(k, a); }));
  const ranking = [...rank.values()];

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Estoque" sub="Inventário em tempo real, lotes, validades e rastreabilidade" acoes={<Btn onClick={() => setEditar({ classe_regulatoria: 'nao_medicamento', unidade: 'un' })}><Plus className="h-4 w-4" />Novo produto</Btn>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat rotulo="Produtos" valor={d.produtos?.length ?? '—'} />
        <Stat rotulo="Unidades" valor={num(somar(d.produtos, 'estoque_atual'))} />
        <Stat rotulo="Valor ao custo" valor={brl(somar((d.produtos ?? []).map((p: any) => ({ v: p.estoque_atual * (p.preco_compra ?? 0) })), 'v'))} />
        <Stat rotulo="Alertas" valor={d.alertas?.length ?? 0} tom={d.alertas?.length ? 'alerta' : 'neutro'} />
      </div>
      <Card>
        <Abas abas={[{ id: 'inventario', t: 'Inventário' }, { id: 'lotes', t: 'Lotes e validades' }, { id: 'alertas', t: 'Alertas' }, { id: 'movs', t: 'Movimentações' }, { id: 'vendidos', t: 'Mais vendidos' }, { id: 'lucrativos', t: 'Mais lucrativos' }]} ativa={aba} mudar={setAba} />
        {aba === 'inventario' && <Tabela linhas={d.produtos} aoClicar={setEditar} vazio="Nenhum produto. Cadastre aqui ou registre uma compra pela IA." colunas={[
          { k: 'nome', t: 'Produto', r: (p) => <span>{p.nome}{p.apresentacao && <span className="text-slate-400"> · {p.apresentacao}</span>}</span> },
          { k: 'classe', t: 'Classe', esconderCelular: true, r: (p) => <span className="text-xs">{p.classe_regulatoria === 'nao_medicamento' ? 'comum' : p.classe_regulatoria.replace(/_/g, ' ')}</span> },
          { k: 'estoque_atual', t: 'Estoque', num: true, r: (p) => <span className={p.estoque_atual <= p.estoque_minimo ? 'font-semibold text-rose-600' : ''}>{num(p.estoque_atual)} {p.unidade}</span> },
          { k: 'preco_compra', t: 'Custo', num: true, r: (p) => p.preco_compra != null ? brl(p.preco_compra) : '—' },
          { k: 'preco_venda', t: 'Venda', num: true, r: (p) => p.preco_venda != null ? brl(p.preco_venda) : '—' },
          { k: 'margem_pct', t: 'Margem', num: true, r: (p) => pct(p.margem_pct) },
          { k: 'a', t: '', r: (p) => <Btn variante="fantasma" className="!px-2 !py-1 text-xs" onClick={(e) => { e.stopPropagation(); setAjuste(p); }}>Ajustar</Btn> },
        ]} />}
        {aba === 'lotes' && <Tabela linhas={d.lotes} colunas={[
          { k: 'p', t: 'Produto', r: (l) => l.produtos?.nome }, { k: 'lote', t: 'Lote' }, { k: 'validade', t: 'Validade', r: (l) => dataBR(l.validade) },
          { k: 'quantidade', t: 'Saldo', num: true, r: (l) => num(l.quantidade) }, { k: 'custo_unitario', t: 'Custo', num: true, r: (l) => brl(l.custo_unitario) },
        ]} />}
        {aba === 'alertas' && <Tabela linhas={d.alertas} chave="nome" vazio="Nenhum alerta. ✅" colunas={[
          { k: 'nome', t: 'Produto' }, { k: 'alerta', t: 'Alerta', r: (a) => <Badge s={a.alerta === 'estoque_baixo' ? 'parcial' : 'atrasado'}>{a.alerta.replace(/_/g, ' ')}</Badge> },
          { k: 'estoque_atual', t: 'Qtd', num: true, r: (a) => num(a.estoque_atual) }, { k: 'lote', t: 'Lote', r: (a) => a.lote ?? '—' }, { k: 'validade', t: 'Validade', r: (a) => dataBR(a.validade) },
        ]} />}
        {aba === 'movs' && <Tabela linhas={d.movs} colunas={[
          { k: 'criado_em', t: 'Quando', r: (m) => new Date(m.criado_em).toLocaleString('pt-BR') }, { k: 'p', t: 'Produto', r: (m) => m.produtos?.nome },
          { k: 'tipo', t: 'Tipo', r: (m) => <span className={m.tipo === 'entrada' ? 'text-emerald-600' : 'text-rose-600'}>{m.tipo}</span> }, { k: 'origem', t: 'Origem' },
          { k: 'quantidade', t: 'Qtd', num: true, r: (m) => num(m.quantidade) }, { k: 'saldo_apos', t: 'Saldo após', num: true, r: (m) => num(m.saldo_apos) },
          { k: 'observacao', t: 'Obs.', esconderCelular: true },
        ]} />}
        {aba === 'vendidos' && <Tabela linhas={[...ranking].sort((a, b) => b.q - a.q)} chave="nome" vazio="Sem vendas no período." colunas={[{ k: 'nome', t: 'Produto' }, { k: 'q', t: 'Qtd vendida', num: true, r: (r) => num(r.q) }, { k: 'fat', t: 'Faturamento', num: true, r: (r) => brl(r.fat) }]} />}
        {aba === 'lucrativos' && <Tabela linhas={[...ranking].sort((a, b) => b.lucro - a.lucro)} chave="nome" vazio="Sem vendas no período." colunas={[{ k: 'nome', t: 'Produto' }, { k: 'lucro', t: 'Lucro bruto', num: true, r: (r) => brl(r.lucro) }, { k: 'm', t: 'Margem', num: true, r: (r) => pct(r.fat ? (r.lucro / r.fat) * 100 : null) }]} />}
      </Card>
      {editar && <ProdutoModal p={editar} fechar={() => setEditar(null)} />}
      <AjusteModal p={ajuste} fechar={() => setAjuste(null)} />
    </div>
  );
}
