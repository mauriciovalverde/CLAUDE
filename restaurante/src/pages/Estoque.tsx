import { useMemo, useState } from 'react';
import { AlertTriangle, Check, ListPlus, Merge, Plus, Search, Trash2 } from 'lucide-react';
import { rpc, supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
// @ts-ignore módulo JS testado
import { CATEGORIAS, nomeCategoria, semAcento, UNIDADES, chaveProduto } from '../lib/catalogo.js';
// @ts-ignore módulo JS
import { linhasCatalogo } from '../lib/catalogoPadrao.js';
import { addDias, dataBR, dataHora, hoje, lerNum, qtd } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Tabela, toast, useDados } from '../components/ui';

const TIPOS: Record<string, string> = { consumo: 'Consumo da cozinha', producao: 'Produção', perda: 'Perda', descarte: 'Descarte (vencido/estragado)', transferencia: 'Transferência', entrada: 'Entrada manual', ajuste: 'Ajuste (informar saldo correto)', inventario: 'Inventário' };

export default function Estoque() {
  const [aba, setAba] = useState('saldo');
  const { dados: produtos, recarregar } = useDados(() => q<any[]>(supabase.from('rest_produtos').select('*').order('nome')), []);
  const pendentes = (produtos ?? []).filter((p) => p.status === 'pendente').length;
  return (
    <div>
      <Cabecalho titulo="Estoque" sub="Saldo atual, saídas, perdas e inventário" />
      <Abas abas={[{ id: 'saldo', t: 'Saldo' }, { id: 'inventario', t: '📝 Inventário' }, { id: 'validade', t: '⏰ Validade' }, { id: 'movs', t: 'Movimentos' }, { id: 'produtos', t: `Produtos${pendentes ? ` (${pendentes} novos)` : ''}` }]} ativa={aba} mudar={setAba} />
      {aba === 'saldo' && <Saldo produtos={produtos} />}
      {aba === 'inventario' && <Inventario produtos={produtos} />}
      {aba === 'validade' && <Validade />}
      {aba === 'movs' && <Movimentos />}
      {aba === 'produtos' && <Produtos produtos={produtos} recarregar={recarregar} />}
    </div>
  );
}

function Filtro({ busca, setBusca, cat, setCat }: any) {
  return (
    <div className="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr]">
      <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar produto" className="pl-9" /></div>
      <Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas as categorias</option>{CATEGORIAS.map((c: any) => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}</Select>
    </div>
  );
}
const filtrar = (lista: any[] | null, busca: string, cat: string) => (lista ?? []).filter((p) => p.status !== 'inativo' && (!cat || p.categoria === cat) && semAcento(p.nome).toLowerCase().includes(semAcento(busca).toLowerCase()));

function Saldo({ produtos }: { produtos: any[] | null }) {
  const [busca, setBusca] = useState(''); const [cat, setCat] = useState(''); const [soBaixo, setSoBaixo] = useState(false);
  const [mov, setMov] = useState<any>(null);
  const baixo = (p: any) => Number(p.estoque_minimo) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo);
  const lista = filtrar(produtos, busca, cat).filter((p) => p.controla_estoque && (!soBaixo || baixo(p)));
  const nBaixo = (produtos ?? []).filter((p) => p.status === 'ativo' && baixo(p)).length;
  return (
    <>
      {nBaixo > 0 && <button onClick={() => setSoBaixo(!soBaixo)} className="mb-3 w-full text-left"><Aviso tipo="alerta"><AlertTriangle className="mr-1 inline h-4 w-4" />{nBaixo} produto(s) no estoque mínimo ou abaixo. {soBaixo ? 'Mostrar todos' : 'Toque para ver só esses'}.</Aviso></button>}
      <Filtro {...{ busca, setBusca, cat, setCat }} />
      <Tabela linhas={produtos ? lista : null} aoClicar={setMov} vazio="Nenhum produto. Eles aparecem ao registrar compras ou importar a planilha."
        colunas={[
          { k: 'nome', t: 'Produto', r: (p) => <span>{p.nome}{p.status === 'pendente' && <span className="ml-1 text-xs text-amber-600">(novo)</span>}</span> },
          { k: 'cat', t: 'Categoria', r: (p) => nomeCategoria(p.categoria), esconderCelular: true },
          { k: 'saldo', t: 'Saldo', num: true, r: (p) => <b className={baixo(p) ? 'text-rose-600' : Number(p.estoque_atual) < 0 ? 'text-rose-600' : ''}>{qtd(p.estoque_atual)} {p.unidade}</b> },
          { k: 'min', t: 'Mínimo', num: true, r: (p) => Number(p.estoque_minimo) > 0 ? `${qtd(p.estoque_minimo)} ${p.unidade}` : '—' },
        ]} />
      {mov && <Movimentar p={mov} fechar={() => setMov(null)} />}
    </>
  );
}

function Movimentar({ p, fechar }: { p: any; fechar: () => void }) {
  const [tipo, setTipo] = useState('consumo'); const [qv, setQv] = useState(''); const [motivo, setMotivo] = useState(''); const [validade, setValidade] = useState('');
  const [minimo, setMinimo] = useState(String(p.estoque_minimo ?? 0).replace('.', ','));
  const [salvando, setSalvando] = useState(false);
  const { dados: hist } = useDados(() => q<any[]>(supabase.from('rest_estoque_movs').select('*, rest_funcionarios(nome)').eq('produto_id', p.id).order('criado_em', { ascending: false }).limit(30)), [p.id]);
  return (
    <Modal aberto fechar={fechar} titulo={p.nome} largo>
      <div className="space-y-3">
        <div className="text-sm">Saldo atual: <b className="text-lg">{qtd(p.estoque_atual)} {p.unidade}</b></div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Campo rotulo="O que aconteceu?"><Select value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(TIPOS).filter(([k]) => k !== 'inventario').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Campo>
          <Campo rotulo={tipo === 'ajuste' ? `Saldo correto (${p.unidade})` : `Quantidade (${p.unidade})`}><Input inputMode="decimal" value={qv} onChange={(e) => setQv(e.target.value)} /></Campo>
          <Campo rotulo="Motivo / observação"><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={tipo === 'perda' ? 'Ex.: caiu no chão' : ''} /></Campo>
          {tipo === 'entrada' && <Campo rotulo="Validade (opcional)"><Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>}
        </div>
        <Btn className="w-full" carregando={salvando} disabled={!(lerNum(qv) >= 0) || qv === ''} onClick={async () => {
          setSalvando(true);
          try { const r = await rpc('rest_movimentar_estoque', { p_produto: p.id, p_tipo: tipo, p_quantidade: lerNum(qv), p_motivo: motivo || null, p_validade: validade || null, p_lote: null }); toast(`Registrado. Novo saldo: ${qtd(r.saldo)} ${p.unidade}`); avisarMudanca(); fechar(); }
          catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
        }}>Registrar</Btn>
        <div className="flex items-end gap-2"><Campo rotulo="Estoque mínimo (alerta)"><Input inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} /></Campo>
          <Btn variante="secundario" onClick={async () => { const { error } = await supabase.from('rest_produtos').update({ estoque_minimo: lerNum(minimo) || 0 }).eq('id', p.id); if (error) toast(error.message, 'erro'); else { toast('Mínimo salvo'); avisarMudanca(); } }}>Salvar mínimo</Btn></div>
        <h4 className="font-semibold">Histórico</h4>
        <Tabela linhas={hist} vazio="Sem movimentos." colunas={[
          { k: 'q', t: 'Quando', r: (m) => dataHora(m.criado_em) }, { k: 't', t: 'Tipo', r: (m) => TIPOS[m.tipo] },
          { k: 'qt', t: 'Qtd', num: true, r: (m) => <span className={Number(m.quantidade) < 0 ? 'text-rose-600' : 'text-emerald-700'}>{Number(m.quantidade) > 0 ? '+' : ''}{qtd(m.quantidade)}</span> },
          { k: 's', t: 'Saldo', num: true, r: (m) => qtd(m.saldo_apos) }, { k: 'p', t: 'Quem', r: (m) => m.rest_funcionarios?.nome ?? '—', esconderCelular: true }, { k: 'm', t: 'Motivo', r: (m) => m.motivo ?? '', esconderCelular: true },
        ]} />
      </div>
    </Modal>
  );
}

function Inventario({ produtos }: { produtos: any[] | null }) {
  const [busca, setBusca] = useState(''); const [cat, setCat] = useState('');
  const [cont, setCont] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const lista = filtrar(produtos, busca, cat).filter((p) => p.controla_estoque);
  const alterados = Object.entries(cont).filter(([, v]) => v.trim() !== '' && lerNum(v) >= 0);
  return (
    <>
      <Aviso tipo="info">Conte o que tem na prateleira e digite. Só os produtos preenchidos são ajustados; a diferença fica registrada como inventário.</Aviso>
      <div className="mt-3"><Filtro {...{ busca, setBusca, cat, setCat }} /></div>
      <div className="space-y-1.5">{lista.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0 flex-1"><div className="truncate font-medium">{p.nome}</div><div className="text-xs text-slate-500">Sistema: {qtd(p.estoque_atual)} {p.unidade}</div></div>
          <Input className="!w-24 text-right" inputMode="decimal" placeholder="contado" value={cont[p.id] ?? ''} onChange={(e) => setCont({ ...cont, [p.id]: e.target.value })} /><span className="w-10 text-xs">{p.unidade}</span>
        </div>
      ))}</div>
      {alterados.length > 0 && <div className="pb-safe sticky bottom-0 mt-3 bg-slate-50 py-2 dark:bg-slate-950"><Btn className="w-full !py-3" carregando={salvando} onClick={async () => {
        setSalvando(true); let ok = 0;
        for (const [id, v] of alterados) { try { await rpc('rest_movimentar_estoque', { p_produto: id, p_tipo: 'inventario', p_quantidade: lerNum(v), p_motivo: `Inventário ${dataBR(hoje())}`, p_validade: null, p_lote: null }); ok++; } catch (e: any) { toast(e.message, 'erro'); } }
        setSalvando(false); setCont({}); toast(`Inventário salvo: ${ok} produto(s)`); avisarMudanca();
      }}><Check className="h-5 w-5" />Salvar contagem de {alterados.length} produto(s)</Btn></div>}
    </>
  );
}

function Validade() {
  const { dados } = useDados(async () => {
    const movs = await q<any[]>(supabase.from('rest_estoque_movs').select('produto_id,validade,quantidade,lote,criado_em, rest_produtos(nome,unidade,estoque_atual)').eq('tipo', 'entrada').not('validade', 'is', null).lte('validade', addDias(hoje(), 10)).order('validade'));
    return movs.filter((m) => Number(m.rest_produtos?.estoque_atual ?? 0) > 0);
  }, []);
  return (
    <>
      <Aviso tipo="info">Produtos com validade informada no recebimento que vencem nos próximos 10 dias (ou já venceram) e ainda têm saldo.</Aviso>
      <div className="mt-3"><Tabela linhas={dados} vazio="Nada vencendo. 👍" colunas={[
        { k: 'p', t: 'Produto', r: (m) => m.rest_produtos?.nome }, { k: 'v', t: 'Validade', r: (m) => <span className={m.validade < hoje() ? 'font-semibold text-rose-600' : 'text-amber-700'}>{dataBR(m.validade)}{m.validade < hoje() ? ' (vencido)' : ''}</span> },
        { k: 'l', t: 'Lote', r: (m) => m.lote ?? '—' }, { k: 'q', t: 'Entrou', num: true, r: (m) => `${qtd(m.quantidade)} ${m.rest_produtos?.unidade}` }, { k: 's', t: 'Saldo atual', num: true, r: (m) => `${qtd(m.rest_produtos?.estoque_atual)} ${m.rest_produtos?.unidade}` },
      ]} /></div>
    </>
  );
}

function Movimentos() {
  const [tipo, setTipo] = useState('');
  const { dados } = useDados(() => { let x = supabase.from('rest_estoque_movs').select('*, rest_produtos(nome,unidade), rest_funcionarios(nome)').order('criado_em', { ascending: false }).limit(300); if (tipo) x = x.eq('tipo', tipo); return q<any[]>(x); }, [tipo]);
  return (
    <>
      <Select className="mb-3 !w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos os tipos</option>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
      <Tabela linhas={dados} vazio="Sem movimentos." colunas={[
        { k: 'p', t: 'Produto', r: (m) => m.rest_produtos?.nome }, { k: 'q', t: 'Quando', r: (m) => dataHora(m.criado_em) }, { k: 't', t: 'Tipo', r: (m) => TIPOS[m.tipo] },
        { k: 'qt', t: 'Qtd', num: true, r: (m) => <span className={Number(m.quantidade) < 0 ? 'text-rose-600' : 'text-emerald-700'}>{Number(m.quantidade) > 0 ? '+' : ''}{qtd(m.quantidade)} {m.rest_produtos?.unidade}</span> },
        { k: 'f', t: 'Quem', r: (m) => m.rest_funcionarios?.nome ?? '—', esconderCelular: true }, { k: 'm', t: 'Motivo', r: (m) => m.motivo ?? '', esconderCelular: true },
      ]} />
    </>
  );
}

function Produtos({ produtos, recarregar }: { produtos: any[] | null; recarregar: () => void }) {
  const { pode } = useEu();
  const [busca, setBusca] = useState(''); const [cat, setCat] = useState('');
  const [editar, setEditar] = useState<any>(null);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [mesclar, setMesclar] = useState(false);
  const pend = (produtos ?? []).filter((p) => p.status === 'pendente');
  const lista = (produtos ?? []).filter((p) => (!cat || p.categoria === cat) && semAcento(p.nome).toLowerCase().includes(semAcento(busca).toLowerCase()));
  const sel = useMemo(() => (produtos ?? []).filter((p) => marcados.includes(p.id)), [produtos, marcados]);
  const [adicionando, setAdicionando] = useState(false);
  // itens da lista padrão que ainda não existem (pela chave padronizada)
  const faltam = useMemo(() => { if (!produtos) return []; const tem = new Set(produtos.map((p) => p.chave)); return linhasCatalogo(chaveProduto).filter((l: any) => !tem.has(l.chave)); }, [produtos]);
  return (
    <>
      {pend.length > 0 && <Card titulo={`Produtos novos criados pela equipe (${pend.length})`} className="mb-3">
        <p className="mb-2 text-xs text-slate-500">Confira o nome e a categoria e aprove. Se for repetido, marque e use “Juntar”.</p>
        {pend.map((p) => <div key={p.id} className="flex items-center justify-between gap-2 border-b py-1.5 text-sm last:border-0 dark:border-slate-800"><span>{p.nome} · <span className="text-slate-500">{nomeCategoria(p.categoria)}</span></span><span className="flex gap-1"><Btn variante="secundario" onClick={() => setEditar(p)}>Editar</Btn><Btn onClick={async () => { await supabase.from('rest_produtos').update({ status: 'ativo' }).eq('id', p.id); recarregar(); }}><Check className="h-4 w-4" /></Btn></span></div>)}
      </Card>}
      {(pode('compras') || pode('estoque')) && <div className="mb-3 flex flex-wrap gap-2">
        <Btn onClick={() => setEditar({ novo: true, nome: '', categoria: cat || 'outros', unidade: 'un', estoque_minimo: 0, controla_estoque: true, status: 'ativo', grafias: [] })}><Plus className="h-4 w-4" />Novo produto</Btn>
        {faltam.length > 0 && <Btn variante="secundario" carregando={adicionando} onClick={async () => {
          setAdicionando(true);
          const { error } = await supabase.from('rest_produtos').upsert(faltam, { onConflict: 'restaurante_id,chave', ignoreDuplicates: true });
          setAdicionando(false);
          if (error) toast(error.message, 'erro'); else { toast(`${faltam.length} produtos da lista padrão adicionados`); recarregar(); avisarMudanca(); }
        }}><ListPlus className="h-4 w-4" />Adicionar lista padrão ({faltam.length} produtos)</Btn>}
      </div>}
      <Filtro {...{ busca, setBusca, cat, setCat }} />
      {marcados.length >= 2 && pode('compras') && <Btn className="mb-2" onClick={() => setMesclar(true)}><Merge className="h-4 w-4" />Juntar {marcados.length} produtos (são o mesmo)</Btn>}
      <Tabela linhas={produtos ? lista : null} colunas={[
        { k: 'x', t: '', r: (p) => <input type="checkbox" checked={marcados.includes(p.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setMarcados(e.target.checked ? [...marcados, p.id] : marcados.filter((m) => m !== p.id))} className="h-4 w-4" /> },
        { k: 'nome', t: 'Produto', r: (p) => <button className="text-left" onClick={() => setEditar(p)}>{p.nome}{p.grafias?.length > 1 && <div className="text-[11px] text-slate-400">{p.grafias.slice(0, 3).join(' · ')}</div>}</button> },
        { k: 'cat', t: 'Categoria', r: (p) => nomeCategoria(p.categoria) }, { k: 'u', t: 'Unid.', r: (p) => p.unidade }, { k: 's', t: 'Situação', r: (p) => <Badge s={p.status} /> },
      ]} />
      {editar && <EditarProduto p={editar} fechar={() => { setEditar(null); recarregar(); }} />}
      <Modal aberto={mesclar} fechar={() => setMesclar(false)} titulo="Juntar produtos repetidos">
        <p className="mb-2 text-sm">Qual nome fica? O histórico de compras, o estoque e as grafias dos outros passam para ele.</p>
        <div className="space-y-1">{sel.map((p) => <Btn key={p.id} variante="secundario" className="w-full justify-start" onClick={async () => {
          try { await rpc('rest_mesclar_produtos', { p_manter: p.id, p_remover: sel.filter((x) => x.id !== p.id).map((x) => x.id) }); toast(`Produtos juntados em “${p.nome}”`); setMarcados([]); setMesclar(false); recarregar(); avisarMudanca(); }
          catch (e: any) { toast(e.message, 'erro'); }
        }}>Manter “{p.nome}” ({qtd(p.estoque_atual)} {p.unidade})</Btn>)}</div>
      </Modal>
    </>
  );
}

function EditarProduto({ p, fechar }: { p: any; fechar: () => void }) {
  const { pode } = useEu();
  const [d, setD] = useState({ nome: p.nome, categoria: p.categoria, unidade: p.unidade, estoque_minimo: String(p.estoque_minimo ?? 0).replace('.', ','), controla_estoque: p.controla_estoque, status: p.status });
  const [excluir, setExcluir] = useState(false);
  const salvar = async () => {
    const nome = d.nome.trim();
    if (nome.length < 2) { toast('Informe o nome do produto', 'erro'); return; }
    const nova = chaveProduto(nome);
    const base = { nome, categoria: d.categoria, unidade: d.unidade, estoque_minimo: lerNum(d.estoque_minimo) || 0, controla_estoque: d.controla_estoque, status: d.status };
    const { error } = p.novo
      ? await supabase.from('rest_produtos').insert({ ...base, chave: nova, grafias: [nome] })
      : await supabase.from('rest_produtos').update({ ...base, ...(nova !== p.chave ? { chave: nova, grafias: [...new Set([...(p.grafias ?? []), p.nome])] } : {}) }).eq('id', p.id);
    if (error) toast(error.message.includes('duplicate') ? 'Já existe um produto com esse nome. Use “Juntar” para unir os dois.' : error.message, 'erro'); else { toast(p.novo ? 'Produto cadastrado' : 'Produto salvo'); avisarMudanca(); fechar(); }
  };
  // produto com histórico (compras, pedidos, estoque) não some do banco: fica inativo para preservar o histórico
  const apagar = async () => {
    const conta = async (t: string) => (await supabase.from(t).select('id', { count: 'exact', head: true }).eq('produto_id', p.id)).count ?? 0;
    const usos = (await conta('rest_compra_itens')) + (await conta('rest_solicitacao_itens')) + (await conta('rest_estoque_movs'));
    const { error } = usos ? await supabase.from('rest_produtos').update({ status: 'inativo' }).eq('id', p.id) : await supabase.from('rest_produtos').delete().eq('id', p.id);
    if (error) toast(error.message, 'erro');
    else { toast(usos ? `Produto desativado: tem ${usos} registro(s) no histórico, que foram mantidos.` : 'Produto excluído'); avisarMudanca(); fechar(); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={p.novo ? 'Novo produto' : 'Produto'}>
      <div className="space-y-3">
        <Campo rotulo="Nome padronizado"><Input autoFocus={p.novo} value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Categoria"><Select value={d.categoria} onChange={(e) => setD({ ...d, categoria: e.target.value })}>{CATEGORIAS.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Campo>
          <Campo rotulo="Unidade"><Select value={d.unidade} onChange={(e) => setD({ ...d, unidade: e.target.value })}>{UNIDADES.map((u: string) => <option key={u}>{u}</option>)}</Select></Campo>
          <Campo rotulo="Estoque mínimo"><Input inputMode="decimal" value={d.estoque_minimo} onChange={(e) => setD({ ...d, estoque_minimo: e.target.value })} /></Campo>
          <Campo rotulo="Situação"><Select value={d.status} onChange={(e) => setD({ ...d, status: e.target.value })}><option value="ativo">Ativo</option><option value="pendente">Novo (a conferir)</option><option value="inativo">Inativo</option></Select></Campo>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.controla_estoque} onChange={(e) => setD({ ...d, controla_estoque: e.target.checked })} />Controlar estoque deste produto</label>
        {p.grafias?.length > 0 && <p className="text-xs text-slate-500">Grafias originais: {p.grafias.join(' · ')}</p>}
        <Btn className="w-full" onClick={salvar}>{p.novo ? 'Cadastrar' : 'Salvar'}</Btn>
        {!p.novo && pode('compras') && (excluir
          ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm dark:border-rose-900 dark:bg-rose-950/40"><p className="mb-2">Excluir <b>{p.nome}</b>? Se ele já aparece em compras, pedidos ou estoque, fica só <b>desativado</b> (some das listas) para não perder o histórico.</p><div className="flex gap-2"><Btn variante="perigo" onClick={apagar}><Trash2 className="h-4 w-4" />Sim, excluir</Btn><Btn variante="secundario" onClick={() => setExcluir(false)}>Não</Btn></div></div>
          : <Btn variante="fantasma" className="w-full text-rose-600" onClick={() => setExcluir(true)}><Trash2 className="h-4 w-4" />Excluir produto</Btn>)}
      </div>
    </Modal>
  );
}
