import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Camera, Minus, Plus, Search, Send, ShoppingCart, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
// @ts-ignore módulo JS testado
import { CATEGORIAS, categorizar, chaveProduto, nomePadrao, nomeCategoria, UNIDADES, semAcento } from '../lib/catalogo.js';
import { enviarArquivo } from '../lib/arquivos';
import { dataHora, lerNum, qtd } from '../lib/fmt';
import { Abas, Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Input, Modal, q, Select, Textarea, toast, useDados } from '../components/ui';

type Item = { produto_id: string | null; nome: string; categoria: string; quantidade: number; unidade: string; obs: string; foto?: File | null; novo?: boolean };
const RASCUNHO = 'rest-lista-pedido';

export default function Pedir() {
  const { eu, rest } = useEu();
  const [aba, setAba] = useState('pedir');
  const [cat, setCat] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState<Item[]>(() => { try { return JSON.parse(localStorage.getItem(RASCUNHO) ?? '[]'); } catch { return []; } });
  const [escolher, setEscolher] = useState<Item | null>(null);
  const [verLista, setVerLista] = useState(false);
  const [enviado, setEnviado] = useState<{ numero: number; texto: string } | null>(null);
  useEffect(() => { try { localStorage.setItem(RASCUNHO, JSON.stringify(lista.map(({ foto, ...i }) => i))); } catch { /* ignore */ } }, [lista]);

  const { dados: produtos } = useDados(() => q<any[]>(supabase.from('rest_produtos').select('id,nome,categoria,unidade,status').neq('status', 'inativo').order('nome')), []);
  const filtrados = useMemo(() => {
    const b = semAcento(busca).toLowerCase().trim();
    return (produtos ?? []).filter((p) => (b ? semAcento(p.nome).toLowerCase().includes(b) : p.categoria === cat));
  }, [produtos, busca, cat]);
  const contagem = useMemo(() => { const c: Record<string, number> = {}; for (const p of produtos ?? []) c[p.categoria] = (c[p.categoria] ?? 0) + 1; return c; }, [produtos]);

  const adicionar = (i: Item) => { setLista((l) => [...l.filter((x) => !(x.produto_id && x.produto_id === i.produto_id) && !(x.novo && x.nome === i.nome)), i]); setEscolher(null); toast(`${i.nome} na lista`); };

  return (
    <div className="pb-20">
      <Cabecalho titulo="Pedir produtos" sub="Escolha a categoria, toque no produto e diga quanto precisa" />
      <Abas abas={[{ id: 'pedir', t: '🛒 Fazer pedido' }, { id: 'minhas', t: '📋 Meus pedidos' }]} ativa={aba} mudar={setAba} />
      {aba === 'minhas' ? <MeusPedidos /> : <>
        <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar produto pelo nome…" className="!py-3 pl-9" /></div>
        {!busca && !cat && <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {CATEGORIAS.map((c: any) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl p-2 text-center shadow-sm active:scale-[.97] ${c.cor} dark:brightness-90`}>
              <span className="text-3xl">{c.emoji}</span><span className="text-[13px] font-semibold leading-tight text-slate-900">{c.nome}</span>
              <span className="text-[11px] text-slate-600">{contagem[c.id] ?? 0} itens</span>
            </button>
          ))}
        </div>}
        {(busca || cat) && <div>
          {!busca && <button onClick={() => setCat(null)} className="mb-2 flex items-center gap-1 text-sm font-medium text-brand-700"><ArrowLeft className="h-4 w-4" />Categorias</button>}
          {!busca && <h2 className="mb-2 text-lg font-bold">{CATEGORIAS.find((c: any) => c.id === cat)?.emoji} {nomeCategoria(cat)}</h2>}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((p) => {
              const naLista = lista.find((x) => x.produto_id === p.id);
              return (
                <button key={p.id} onClick={() => setEscolher(naLista ?? { produto_id: p.id, nome: p.nome, categoria: p.categoria, quantidade: 1, unidade: p.unidade, obs: '' })}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left active:scale-[.99] ${naLista ? 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/30' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'}`}>
                  <span className="font-medium">{p.nome}{p.status === 'pendente' && <span className="ml-1 text-xs text-amber-600">(novo)</span>}</span>
                  {naLista ? <span className="text-sm font-semibold text-brand-700">{qtd(naLista.quantidade)} {naLista.unidade}</span> : <Plus className="h-5 w-5 text-slate-400" />}
                </button>
              );
            })}
          </div>
          {!filtrados.length && <p className="py-4 text-center text-sm text-slate-500">Nenhum produto encontrado.</p>}
          <Btn variante="secundario" className="mt-3 w-full" onClick={() => setEscolher({ produto_id: null, nome: busca ? String(nomePadrao(busca)) : '', categoria: cat ?? (busca ? categorizar(busca) : 'outros'), quantidade: 1, unidade: 'un', obs: '', novo: true })}><Plus className="h-4 w-4" />Produto não está na lista? Adicionar novo</Btn>
        </div>}
      </>}

      {aba === 'pedir' && lista.length > 0 && <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:left-60">
        <Btn className="w-full !py-3 text-base" onClick={() => setVerLista(true)}><ShoppingCart className="h-5 w-5" />Ver minha lista ({lista.length}) e enviar</Btn>
      </div>}

      {escolher && <EscolherQtd item={escolher} fechar={() => setEscolher(null)} ok={adicionar} />}
      {verLista && <MinhaLista lista={lista} setLista={setLista} fechar={() => setVerLista(false)} editar={(i) => { setVerLista(false); setEscolher(i); }}
        enviado={(r) => { setLista([]); setVerLista(false); setEnviado(r); avisarMudanca(); }} restId={rest.id} setor={eu.setor} />}
      <Modal aberto={!!enviado} fechar={() => setEnviado(null)} titulo="Pedido enviado ✅">
        <p className="text-sm">O pedido <b>#{enviado?.numero}</b> foi para o responsável pelas compras. Acompanhe em “Meus pedidos”.</p>
        <a className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-3 py-3 font-semibold text-white" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(enviado?.texto ?? '')}`}>Avisar no WhatsApp</a>
        <Btn variante="secundario" className="mt-2 w-full" onClick={() => setEnviado(null)}>Fechar</Btn>
      </Modal>
    </div>
  );
}

function EscolherQtd({ item, fechar, ok }: { item: Item; fechar: () => void; ok: (i: Item) => void }) {
  const [i, setI] = useState<Item>(item);
  const [q2, setQ2] = useState(String(item.quantidade).replace('.', ','));
  const passo = ['kg', 'L'].includes(i.unidade) ? 0.5 : 1;
  const mudar = (d: number) => { const v = Math.max(0, (lerNum(q2) || 0) + d); setQ2(String(Math.round(v * 1000) / 1000).replace('.', ',')); };
  const valido = i.nome.trim().length >= 2 && lerNum(q2) > 0;
  return (
    <Modal aberto fechar={fechar} titulo={i.novo ? 'Novo produto' : i.nome}>
      <div className="space-y-4">
        {i.novo && <>
          <Campo rotulo="Nome do produto"><Input autoFocus value={i.nome} onChange={(e) => setI({ ...i, nome: e.target.value, categoria: i.categoria === 'outros' ? categorizar(e.target.value) : i.categoria })} placeholder="Ex.: Coentro" /></Campo>
          <Campo rotulo="Categoria"><Select value={i.categoria} onChange={(e) => setI({ ...i, categoria: e.target.value })}>{CATEGORIAS.map((c: any) => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}</Select></Campo>
          <Aviso>O produto entra no cadastro como <b>novo</b>; o responsável confere o nome e a categoria depois.</Aviso>
        </>}
        <div>
          <span className="mb-1 block text-sm font-medium">Quantidade</span>
          <div className="flex items-center gap-2">
            <button onClick={() => mudar(-passo)} className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800" aria-label="Menos"><Minus className="h-6 w-6" /></button>
            <Input inputMode="decimal" value={q2} onChange={(e) => setQ2(e.target.value.replace(/[^\d,.]/g, ''))} className="!py-3 text-center text-2xl font-bold" />
            <button onClick={() => mudar(passo)} className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-800" aria-label="Mais"><Plus className="h-6 w-6" /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">{UNIDADES.map((u: string) => <button key={u} onClick={() => setI({ ...i, unidade: u })} className={`rounded-full px-3 py-1.5 text-sm ${i.unidade === u ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>{u}</button>)}</div>
        </div>
        <Campo rotulo="Observação (opcional)"><Input value={i.obs} onChange={(e) => setI({ ...i, obs: e.target.value })} placeholder="Ex.: bem maduro, marca X" /></Campo>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"><Camera className="h-5 w-5" />{i.foto ? `Foto: ${i.foto.name}` : 'Anexar foto (opcional)'}<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setI({ ...i, foto: e.target.files?.[0] ?? null })} /></label>
        <Btn className="w-full !py-3 text-base" disabled={!valido} onClick={() => ok({ ...i, nome: i.novo ? String(nomePadrao(i.nome)) : i.nome, quantidade: lerNum(q2) })}>Colocar na lista</Btn>
      </div>
    </Modal>
  );
}

function MinhaLista({ lista, setLista, fechar, editar, enviado, restId, setor }: { lista: Item[]; setLista: (f: (l: Item[]) => Item[]) => void; fechar: () => void; editar: (i: Item) => void; enviado: (r: { numero: number; texto: string }) => void; restId: string; setor: string | null }) {
  const [obs, setObs] = useState('');
  const [s, setS] = useState(setor ?? 'Cozinha');
  const [carregando, setCarregando] = useState(false);
  const enviar = async () => {
    setCarregando(true);
    try {
      const { data: sol, error } = await supabase.from('rest_solicitacoes').insert({ setor: s, obs: obs || null, status: 'em_elaboracao' }).select('id,numero').single();
      if (error) throw error;
      const linhas = [];
      for (const i of lista) {
        let produto_id = i.produto_id;
        if (!produto_id) {
          const chave = chaveProduto(i.nome);
          const { data: ex } = await supabase.from('rest_produtos').select('id').eq('chave', chave).maybeSingle();
          if (ex) produto_id = ex.id;
          else {
            const { data: np, error: e2 } = await supabase.from('rest_produtos').insert({ nome: i.nome, chave, categoria: i.categoria, unidade: i.unidade, status: 'pendente', grafias: [i.nome] }).select('id').single();
            if (e2) throw e2; produto_id = np.id;
          }
        }
        const foto_path = i.foto ? await enviarArquivo(restId, 'pedidos', i.foto).catch(() => null) : null;
        linhas.push({ solicitacao_id: sol.id, produto_id, quantidade: i.quantidade, unidade: i.unidade, obs: i.obs || null, foto_path });
      }
      const { error: e3 } = await supabase.from('rest_solicitacao_itens').insert(linhas);
      if (e3) throw e3;
      const { error: e4 } = await supabase.from('rest_solicitacoes').update({ status: 'enviada', enviada_em: new Date().toISOString() }).eq('id', sol.id);
      if (e4) throw e4;
      const texto = `📋 Pedido de compra #${sol.numero} (${s})\n` + lista.map((i) => `• ${i.nome}: ${qtd(i.quantidade)} ${i.unidade}${i.obs ? ` (${i.obs})` : ''}`).join('\n') + (obs ? `\nObs.: ${obs}` : '');
      enviado({ numero: sol.numero, texto });
    } catch (e: any) { toast(e.message ?? String(e), 'erro'); } finally { setCarregando(false); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={`Minha lista (${lista.length})`}>
      <div className="space-y-2">
        {lista.map((i, k) => (
          <div key={k} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-800">
            <button className="min-w-0 flex-1 text-left" onClick={() => editar(i)}><div className="truncate font-medium">{i.nome}{i.novo && <span className="ml-1 text-xs text-amber-600">(novo)</span>}</div><div className="text-sm text-slate-500">{qtd(i.quantidade)} {i.unidade}{i.obs ? ` · ${i.obs}` : ''}{i.foto ? ' · 📷' : ''}</div></button>
            <button onClick={() => setLista((l) => l.filter((_, j) => j !== k))} className="rounded-lg p-2 text-rose-600" aria-label="Remover"><Trash2 className="h-5 w-5" /></button>
          </div>
        ))}
        <Campo rotulo="Setor"><Select value={s} onChange={(e) => setS(e.target.value)}>{['Cozinha', 'Salão', 'Bar', 'Caixa', 'Limpeza', 'Estoque', 'Administração'].map((x) => <option key={x}>{x}</option>)}</Select></Campo>
        <Campo rotulo="Observação geral (opcional)"><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: precisa para o almoço de amanhã" /></Campo>
        <Btn className="w-full !py-3 text-base" carregando={carregando} disabled={!lista.length} onClick={enviar}><Send className="h-5 w-5" />Enviar pedido</Btn>
      </div>
    </Modal>
  );
}

function MeusPedidos() {
  const { eu } = useEu();
  const { dados, recarregar } = useDados(() => q<any[]>(supabase.from('rest_solicitacoes').select('*, rest_solicitacao_itens(*, rest_produtos(nome))').eq('solicitante_id', eu.id).order('criado_em', { ascending: false }).limit(50)), [eu.id]);
  if (!dados) return null;
  if (!dados.length) return <Card><p className="text-center text-sm text-slate-500">Você ainda não fez pedidos.</p></Card>;
  return (
    <div className="space-y-2">
      {dados.map((s) => (
        <Card key={s.id}>
          <div className="mb-1 flex items-center justify-between gap-2"><span className="font-semibold">Pedido #{s.numero}</span><Badge s={s.status} /></div>
          <div className="mb-2 text-xs text-slate-500">{dataHora(s.enviada_em ?? s.criado_em)} · {s.setor}{s.motivo ? ` · Motivo: ${s.motivo}` : ''}</div>
          <ul className="space-y-0.5 text-sm">{s.rest_solicitacao_itens.map((i: any) => <li key={i.id} className={i.removido ? 'text-slate-400 line-through' : ''}>• {i.rest_produtos?.nome ?? i.nome_livre}: {qtd(i.qtd_aprovada ?? i.quantidade)} {i.unidade}{i.qtd_aprovada != null && Number(i.qtd_aprovada) !== Number(i.quantidade) ? <span className="text-xs text-amber-600"> (pediu {qtd(i.quantidade)})</span> : ''}</li>)}</ul>
          {['em_elaboracao', 'enviada'].includes(s.status) && <Btn variante="fantasma" className="mt-2 text-rose-600" onClick={async () => { const { error } = await supabase.from('rest_solicitacoes').update({ status: 'cancelada' }).eq('id', s.id); if (error) toast(error.message, 'erro'); else { toast('Pedido cancelado'); recarregar(); } }}>Cancelar pedido</Btn>}
        </Card>
      ))}
    </div>
  );
}
