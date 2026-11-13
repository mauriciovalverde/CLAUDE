import { useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Camera, FileUp, Loader2, Sparkles, Trash2 } from 'lucide-react';
import { lerImagensFatura } from '../lib/ocr';
import { PagamentoModal } from '../components/Pagamento';
import { funcao, supabase } from '../lib/supabase';
import { carregar } from '../lib/dados';
import { brl, dataBR, mesNome } from '../lib/fmt';
import { lerPdfFatura } from '../lib/pdf';
// @ts-ignore módulo JS testado
import { categorizar, vencimentosFuturos } from '../lib/fatura.js';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, Modal, Tabela, toast, useDados } from '../components/ui';

const CORES = ['#0F766E', '#0EA5E9', '#F59E0B', '#8B5CF6', '#EF4444', '#10B981', '#64748B', '#EC4899', '#84CC16', '#F97316', '#14B8A6'];
const valorBR = (s: string) => (String(s).includes(',') ? Number(String(s).replace(/\./g, '').replace(',', '.')) : Number(s));
type Item = { data: string; descricao: string; valor: number; parcela_num: number | null; parcela_total: number | null; categoria: string; usar: boolean; portador?: string | null };
type Restante = { id: string; descricao: string; valor: number; vencimento: string; cartao: string | null; ja_incluso: boolean };
type CartaoSec = { id: string; nome: string; total: number; qtd: number; adicional: boolean; apelido: string; incluir: boolean };
const rotulo = (c: CartaoSec) => c.apelido || c.nome || (c.id === 'principal' ? 'Cartão principal' : `Final ${c.id}`);

/** Parcelas futuras agrupadas por mês (a partir do mês seguinte ao vencimento). */
function futuras(itens: Item[], vencimento: string) {
  const m = new Map<string, { venc: string; total: number; qtd: number }>();
  for (const i of itens) {
    if (!i.usar || !i.parcela_num || !i.parcela_total || i.parcela_num >= i.parcela_total || i.valor <= 0) continue;
    for (const v of vencimentosFuturos(vencimento, i.parcela_total - i.parcela_num) as string[]) {
      const k = v.slice(0, 7); const a = m.get(k) ?? { venc: v, total: 0, qtd: 0 };
      a.total = Math.round((a.total + i.valor) * 100) / 100; a.qtd++; m.set(k, a);
    }
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, x]) => ({ mes, ...x }));
}

async function lerComIA(texto: string) {
  const { data: cfg } = await supabase.from('plan_config').select('ia_modelo').maybeSingle();
  const r = await funcao('ia-modelo', {
    acao: 'chat', provedor: 'ollama_cloud', modelo: cfg?.ia_modelo ?? undefined, ferramentas: [],
    mensagens: [
      { role: 'system', content: 'Você extrai dados de faturas de cartão de crédito brasileiras. Responda SOMENTE um JSON válido, sem texto antes ou depois.' },
      { role: 'user', content: `Extraia desta fatura: {"banco": string|null, "vencimento": "AAAA-MM-DD"|null, "total": número|null, "itens": [{"data":"DD/MM","descricao":string,"valor":número (negativo para estorno/crédito),"parcela_num":número|null,"parcela_total":número|null}]}. Não inclua pagamentos da fatura anterior. Texto:\n\n${texto.slice(0, 14000)}` },
    ],
  });
  if (!r.ok) throw new Error(r.mensagem ?? 'A IA não respondeu.');
  if (r.modelo_usado) await supabase.from('plan_config').update({ ia_modelo: r.modelo_usado }).eq('user_id', (await supabase.auth.getUser()).data.user!.id);
  const txt = String(r.mensagem?.content ?? '');
  const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
  return { banco: j.banco, vencimento: j.vencimento, total: j.total, itens: (j.itens ?? []).map((i: any) => ({ ...i, valor: Number(i.valor), categoria: categorizar(i.descricao ?? '') })) };
}

export default function Cartao() {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [precisaSenha, setPrecisaSenha] = useState<File | null>(null);
  const [senha, setSenha] = useState('');
  const [rev, setRev] = useState<null | { cartao: string; vencimento: string; total: string; totalCabecalho: number | null; itens: Item[]; cartoes: CartaoSec[]; restantes: Restante[]; arquivo: string; texto: string; viaIA?: boolean; viaFoto?: boolean }>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<{ p: number; msg: string } | null>(null);
  const [importando, setImportando] = useState(false);
  const [ver, setVer] = useState<any>(null);
  const { dados: faturas } = useDados(carregar.faturas, []);
  const { dados: contasFatura } = useDados(async () => (await supabase.from('plan_contas').select('*').is('excluido_em', null).eq('origem', 'fatura')).data ?? [], []);
  const [pagar, setPagar] = useState<any>(null);
  const contaDa = (f: any) => (contasFatura ?? []).find((c: any) => c.fatura_id === f.id);
  const situacao = (f: any) => { const c = contaDa(f); if (!c) return null; if (c.status === 'pendente') return c.vencimento < new Date().toISOString().slice(0, 10) ? 'atrasada' : 'a pagar'; return /\(parcial/.test(c.descricao) ? 'paga em parte' : 'paga'; };

  async function montarRevisao(f: any, arquivo: string) {
    const { data: cfg } = await supabase.from('plan_config').select('cartoes').maybeSingle();
    const memo = (cfg?.cartoes ?? {}) as Record<string, { apelido?: string; incluir?: boolean }>;
    const cartoes: CartaoSec[] = (f.cartoes ?? []).map((c: any) => ({ ...c, apelido: memo[c.id]?.apelido ?? '', incluir: memo[c.id]?.incluir ?? true }));
    const fora = new Set(cartoes.filter((c) => !c.incluir).map((c) => c.id));
    const itens = f.itens.map((i: any) => ({ ...i, usar: !fora.has(i.portador ?? 'principal') }));
    const totalCab = f.total ?? null;
    const soma = Math.round(itens.filter((i: Item) => i.usar).reduce((t: number, i: Item) => t + i.valor, 0) * 100) / 100;
    // restantes de pagamentos parciais de faturas anteriores: a nova fatura normalmente já os inclui
    const { data: rs } = await supabase.from('plan_contas').select('id,descricao,valor,vencimento,cartao').is('excluido_em', null).eq('status', 'pendente').eq('tipo', 'pagar').like('descricao', 'Restante · Fatura%');
    const banco = f.banco ?? 'Cartão';
    const restantes: Restante[] = (rs ?? []).filter((r: any) => !f.vencimento || r.vencimento <= f.vencimento).map((r: any) => ({ ...r, valor: Number(r.valor), ja_incluso: !r.cartao || r.cartao === banco }));
    setRev({ cartao: banco, vencimento: f.vencimento ?? '', total: String(fora.size ? soma : (totalCab ?? soma)), totalCabecalho: totalCab, itens, cartoes, restantes, arquivo, texto: f.linhas.join('\n'), viaFoto: !!f.viaFoto });
  }

  async function lerFotos(arqs: File[]) {
    setLendo(true); setErro(''); setProgresso({ p: 0, msg: 'Começando…' });
    try { await montarRevisao(await lerImagensFatura(arqs, (p, msg) => setProgresso({ p, msg })), arqs.map((a) => a.name).join(', ')); }
    catch (e: any) { setErro(e.message ?? 'Falha ao ler a imagem.'); }
    finally { setLendo(false); setProgresso(null); if (fotoRef.current) fotoRef.current.value = ''; }
  }

  /** Marca/desmarca um cartão inteiro (ex.: só o meu, sem o da esposa) e recalcula o total. */
  function alternarCartao(id: string, incluir: boolean) {
    if (!rev) return;
    const cartoes = rev.cartoes.map((c) => c.id === id ? { ...c, incluir } : c);
    const itens = rev.itens.map((i) => (i.portador ?? 'principal') === id ? { ...i, usar: incluir } : i);
    const todos = cartoes.every((c) => c.incluir);
    const soma = Math.round(itens.filter((i) => i.usar).reduce((t, i) => t + i.valor, 0) * 100) / 100;
    setRev({ ...rev, cartoes, itens, total: String(todos && rev.totalCabecalho ? rev.totalCabecalho : soma) });
  }

  async function ler(arq: File, s?: string) {
    setLendo(true); setErro('');
    try {
      const f: any = await lerPdfFatura(arq, s);
      setPrecisaSenha(null); setSenha('');
      await montarRevisao(f, arq.name);
    } catch (e: any) {
      if (e.senha) setPrecisaSenha(arq); setErro(e.message);
    } finally { setLendo(false); if (arquivoRef.current) arquivoRef.current.value = ''; }
  }

  async function tentarIA() {
    if (!rev) return; setLendo(true); setErro('');
    try {
      const f = await lerComIA(rev.texto);
      setRev({ ...rev, cartao: f.banco ?? rev.cartao, vencimento: f.vencimento ?? rev.vencimento, total: String(f.total ?? rev.total), totalCabecalho: f.total ?? rev.totalCabecalho, itens: f.itens.map((i: any) => ({ ...i, usar: true, portador: null })), cartoes: [], viaIA: true });
      toast('Fatura lida pela IA. Confira com atenção antes de importar.', 'info');
    } catch (e: any) { setErro('Leitura pela IA falhou: ' + e.message); } finally { setLendo(false); }
  }

  async function importar() {
    if (!rev) return;
    const total = valorBR(rev.total), venc = rev.vencimento, cartao = rev.cartao.trim() || 'Cartão';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(venc)) { setErro('Informe a data de vencimento da fatura.'); return; }
    if (!(total > 0)) { setErro('Informe o total da fatura.'); return; }
    setImportando(true); setErro('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const existente = (faturas ?? []).find((f) => f.cartao === cartao && f.vencimento === venc);
      if (existente) {
        if (!confirm('Esta fatura já foi importada. Substituir pela nova leitura?')) { setImportando(false); return; }
        await supabase.from('plan_faturas').delete().eq('id', existente.id);
      }
      const varios = rev.cartoes.length > 1;
      const escolhidos = rev.cartoes.filter((c) => c.incluir);
      const sufixo = varios && escolhidos.length < rev.cartoes.length ? ` (${escolhidos.map(rotulo).join(', ')})` : '';
      if (varios) {
        const memo: Record<string, any> = {};
        rev.cartoes.forEach((c) => { memo[c.id] = { apelido: c.apelido || undefined, incluir: c.incluir }; });
        const { data: cfgAtual } = await supabase.from('plan_config').select('cartoes').maybeSingle();
        await supabase.from('plan_config').update({ cartoes: { ...(cfgAtual?.cartoes ?? {}), ...memo } }).eq('user_id', user!.id);
      }
      const { data: fat, error } = await supabase.from('plan_faturas').insert({ cartao, vencimento: venc, total, arquivo_nome: rev.arquivo }).select().single();
      if (error) throw error;
      await supabase.from('plan_fatura_itens').insert(rev.itens.filter((i) => i.usar).map((i) => ({ fatura_id: fat.id, data: i.data, descricao: i.descricao, valor: i.valor, parcela_num: i.parcela_num, parcela_total: i.parcela_total, categoria: i.categoria, portador: i.portador ? rotulo(rev.cartoes.find((c) => c.id === i.portador) ?? ({ id: i.portador } as CartaoSec)) : null })));
      // previsões antigas (de faturas anteriores) a partir deste mês são substituídas por esta fatura, mais recente
      const { data: anteriores } = await supabase.from('plan_faturas').select('id').eq('cartao', cartao).lt('vencimento', venc);
      if (anteriores?.length) await supabase.from('plan_contas').update({ excluido_em: new Date().toISOString() }).eq('origem', 'fatura_parcela').eq('status', 'pendente').gte('vencimento', venc.slice(0, 7) + '-01').in('fatura_id', anteriores.map((a) => a.id));
      const linhas: any[] = [{ tipo: 'pagar', descricao: `Fatura ${cartao}${sufixo}`, categoria: 'Cartão de crédito', valor: total, vencimento: venc, origem: 'fatura', fatura_id: fat.id, cartao }];
      const temMaisNova = (faturas ?? []).some((f) => f.cartao === cartao && f.vencimento > venc);
      if (!temMaisNova) for (const p of futuras(rev.itens, venc)) linhas.push({ tipo: 'pagar', descricao: `Parcelas já compradas no ${cartao}${sufixo} (${p.qtd})`, categoria: 'Cartão de crédito', valor: p.total, vencimento: p.venc, origem: 'fatura_parcela', fatura_id: fat.id, cartao });
      const { error: e2 } = await supabase.from('plan_contas').insert(linhas.map((l) => ({ ...l, user_id: user!.id })));
      if (e2) throw e2;
      const incluidos = rev.restantes.filter((r) => r.ja_incluso).map((r) => r.id);
      if (incluidos.length) await supabase.from('plan_contas').update({ excluido_em: new Date().toISOString() }).in('id', incluidos);
      toast(`Fatura importada: ${brl(total)}${linhas.length > 1 ? ` + parcelas previstas em ${linhas.length - 1} mês(es)` : ''}.`);
      setRev(null); avisarMudanca();
    } catch (e: any) { setErro(e.message); } finally { setImportando(false); }
  }

  async function excluirFatura(f: any) {
    if (!confirm(`Remover a fatura ${f.cartao} de ${dataBR(f.vencimento)} e suas parcelas previstas?`)) return;
    await supabase.from('plan_faturas').delete().eq('id', f.id); setVer(null); toast('Fatura removida.'); avisarMudanca();
  }

  const fut = rev ? futuras(rev.itens, rev.vencimento || '2000-01-01') : [];
  const somaItens = rev ? Math.round(rev.itens.filter((i) => i.usar).reduce((s, i) => s + i.valor, 0) * 100) / 100 : 0;
  const cats = ver ? Object.entries((ver.plan_fatura_itens ?? []).filter((i: any) => i.valor > 0).reduce((m: any, i: any) => ({ ...m, [i.categoria]: (m[i.categoria] ?? 0) + Number(i.valor) }), {})).map(([name, value]) => ({ name, value: Math.round((value as number) * 100) / 100 })).sort((a: any, b: any) => b.value - a.value) : [];

  return (
    <div className="space-y-4">
      <Cabecalho titulo="Cartão de crédito" sub="Envie o PDF ou uma foto da fatura: o app lê as compras, separa os cartões e prevê as parcelas" />
      <Card>
        <input ref={arquivoRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
        <button onClick={() => arquivoRef.current?.click()} disabled={lendo} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-teal-600/50 p-6 text-teal-800 hover:bg-teal-50 dark:text-teal-300 dark:hover:bg-teal-950/30">
          {lendo ? <Loader2 className="h-8 w-8 animate-spin" /> : <FileUp className="h-8 w-8" />}
          <span className="font-semibold">{lendo ? 'Lendo a fatura…' : 'Escolher PDF da fatura'}</span>
          <span className="text-xs text-slate-500">Baixe a fatura em PDF no app do seu banco. O arquivo é lido no seu celular e não é enviado para ninguém.</span>
        </button>
        <input ref={fotoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && lerFotos([...e.target.files])} />
        <button onClick={() => fotoRef.current?.click()} disabled={lendo} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Camera className="h-5 w-5 text-teal-700" />Enviar foto ou print da fatura
        </button>
        <p className="mt-1 text-center text-[11px] text-slate-500">Pode escolher várias imagens (uma por página). Foto reta, com boa luz e sem cortar os valores.</p>
        {progresso && <div className="mt-3"><div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"><div className="h-full bg-teal-600 transition-all" style={{ width: `${progresso.p}%` }} /></div><p className="mt-1 text-xs text-slate-500">{progresso.msg}</p></div>}
        {precisaSenha && <div className="mt-3 flex gap-2"><Input type="password" placeholder="Senha do PDF" value={senha} onChange={(e) => setSenha(e.target.value)} /><Btn onClick={() => ler(precisaSenha, senha)} carregando={lendo}>Abrir</Btn></div>}
        {erro && !rev && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      </Card>

      <Card titulo="Faturas importadas">
        <Tabela linhas={faturas} aoClicar={setVer} vazio="Nenhuma fatura ainda." colunas={[
          { k: 'cartao', t: 'Cartão' }, { k: 'vencimento', t: 'Vencimento', r: (f) => dataBR(f.vencimento) },
          { k: 'itens', t: 'Compras', num: true, r: (f) => f.plan_fatura_itens?.length ?? 0 },
          { k: 'total', t: 'Total', num: true, r: (f) => <strong>{brl(f.total)}</strong> },
          { k: 'sit', t: 'Situação', r: (f) => { const st = situacao(f); return st ? <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st === 'paga' ? 'bg-emerald-100 text-emerald-800' : st === 'paga em parte' ? 'bg-sky-100 text-sky-800' : st === 'atrasada' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}`}>{st}</span> : '—'; } },
          { k: 'a', t: '', r: (f) => { const c = contaDa(f); return c?.status === 'pendente' ? <Btn variante="secundario" className="!px-2 !py-1 text-xs" onClick={(e) => { e.stopPropagation(); setPagar(c); }}>Paguei</Btn> : null; } },
        ]} />
        <p className="mt-2 text-xs text-slate-500">A fatura é a mesma conta que aparece em Contas: pagar aqui ou lá dá no mesmo, e o valor sai do caixa.</p>
      </Card>

      <Modal aberto={!!rev} fechar={() => { setRev(null); setErro(''); }} titulo="Confira a fatura" largo>
        {rev && <div className="space-y-3">
          {rev.viaIA && <Aviso tipo="alerta">Lida pela IA: confira valores e parcelas com atenção.</Aviso>}
          {rev.viaFoto && <Aviso tipo="alerta">Lida a partir de imagem: confira os valores, a leitura de foto pode trocar algum número.</Aviso>}
          {rev.cartoes.length > 1 && <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 dark:border-teal-900 dark:bg-teal-950/30">
            <p className="mb-2 text-sm font-semibold">Esta fatura tem {rev.cartoes.length} cartões. Marque o que deve entrar:</p>
            <div className="space-y-2">{rev.cartoes.map((c) => (
              <div key={c.id} className={`flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 dark:bg-slate-900 ${c.incluir ? '' : 'opacity-50'}`}>
                <input type="checkbox" className="h-5 w-5" checked={c.incluir} onChange={(e) => alternarCartao(c.id, e.target.checked)} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{c.id === 'principal' ? 'Sem identificação' : `Final ${c.id}`}{c.adicional && <span className="ml-1 rounded bg-slate-100 px-1.5 text-[10px] dark:bg-slate-800">adicional</span>}{c.nome && <span className="text-slate-500"> · {c.nome}</span>}</div>
                  <input className="mt-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950" placeholder="Apelido (ex.: Eu, Esposa)" value={c.apelido} onChange={(e) => setRev({ ...rev, cartoes: rev.cartoes.map((x) => x.id === c.id ? { ...x, apelido: e.target.value } : x) })} />
                </div>
                <div className="text-right"><div className="font-bold tabular-nums">{brl(c.total)}</div><div className="text-[11px] text-slate-500">{c.qtd} compra(s)</div></div>
              </div>))}</div>
            <p className="mt-2 text-[11px] text-slate-500">O app lembra a sua escolha e os apelidos nas próximas faturas.</p>
          </div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo rotulo="Cartão"><Input value={rev.cartao} onChange={(e) => setRev({ ...rev, cartao: e.target.value })} /></Campo>
            <Campo rotulo="Vencimento"><Input type="date" value={rev.vencimento} onChange={(e) => setRev({ ...rev, vencimento: e.target.value })} /></Campo>
            <Campo rotulo="Total da fatura (R$)" dica={rev.itens.length ? `soma das compras marcadas: ${brl(somaItens)}` : undefined}><Input inputMode="decimal" value={rev.total} onChange={(e) => setRev({ ...rev, total: e.target.value })} /></Campo>
          </div>
          {!!rev.restantes.length && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <p className="font-semibold">Você pagou parte de uma fatura anterior. O restante já está nesta fatura?</p>
            {rev.restantes.map((r) => (
              <label key={r.id} className="mt-2 flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 h-5 w-5" checked={r.ja_incluso} onChange={(e) => setRev({ ...rev, restantes: rev.restantes.map((x) => x.id === r.id ? { ...x, ja_incluso: e.target.checked } : x) })} />
                <span>Sim, <b>{brl(r.valor)}</b> ({r.descricao.replace('Restante · ', '')}, previsto para {dataBR(r.vencimento)}) já vem nesta fatura. <span className="text-xs text-slate-500">Marcado: o lançamento separado é removido para não contar duas vezes.</span></span>
              </label>))}
          </div>}
          {!rev.itens.length && <Aviso tipo="alerta">Não reconheci as compras deste modelo de fatura. Você ainda pode importar só o total, ou <button className="font-semibold underline" onClick={tentarIA}>tentar ler com a IA</button> (precisa da chave grátis do Ollama em Configurações).</Aviso>}
          {!!rev.itens.length && <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm"><tbody>{rev.itens.map((i, k) => (
              <tr key={k} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${i.usar ? '' : 'opacity-40'}`}>
                <td className="p-2"><input type="checkbox" checked={i.usar} onChange={(e) => setRev({ ...rev, itens: rev.itens.map((x, j) => j === k ? { ...x, usar: e.target.checked } : x) })} /></td>
                <td className="p-2 text-xs text-slate-500">{i.data}</td>
                <td className="p-2">{i.descricao}{i.parcela_total && <span className="ml-1 rounded bg-violet-100 px-1.5 text-xs text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">{i.parcela_num}/{i.parcela_total}</span>}<span className="block text-[11px] text-slate-400">{i.categoria}{rev.cartoes.length > 1 && i.portador ? ` · ${rotulo(rev.cartoes.find((c) => c.id === i.portador) ?? ({ id: i.portador } as CartaoSec))}` : ''}</span></td>
                <td className={`p-2 text-right tabular-nums ${i.valor < 0 ? 'text-emerald-600' : ''}`}>{brl(i.valor)}</td>
              </tr>))}</tbody></table>
          </div>}
          {!!fut.length && <div className="rounded-xl bg-violet-50 p-3 text-sm dark:bg-violet-950/30"><b>Parcelas que já vão cair nas próximas faturas:</b>
            <div className="mt-1 flex flex-wrap gap-2">{fut.map((p) => <span key={p.mes} className="rounded-lg bg-white px-2 py-1 text-xs dark:bg-slate-900">{mesNome(p.mes)}: <b>{brl(p.total)}</b></span>)}</div>
            <p className="mt-1 text-xs text-slate-500">Elas entram na projeção do ano. Quando você importar a fatura de cada mês, a previsão é trocada pelo valor real.</p></div>}
          {rev.itens.length > 0 && <p className="text-right"><button className="inline-flex items-center gap-1 text-xs text-teal-700" onClick={tentarIA} disabled={lendo}><Sparkles className="h-3.5 w-3.5" />Leitura errada? Tentar com a IA</button></p>}
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="flex justify-end gap-2"><Btn variante="secundario" onClick={() => setRev(null)}>Cancelar</Btn><Btn onClick={importar} carregando={importando}>Importar fatura</Btn></div>
        </div>}
      </Modal>

      <PagamentoModal c={pagar} fechar={() => setPagar(null)} />
      <Modal aberto={!!ver} fechar={() => setVer(null)} titulo={ver ? `${ver.cartao} · vence ${dataBR(ver.vencimento)}` : ''} largo>
        {ver && <div className="space-y-3">
          <p className="text-lg font-bold">{brl(ver.total)}</p>
          {(() => { const por = new Map<string, number>(); (ver.plan_fatura_itens ?? []).forEach((i: any) => i.portador && por.set(i.portador, (por.get(i.portador) ?? 0) + Number(i.valor))); return por.size > 1 ? <div className="flex flex-wrap gap-2">{[...por].map(([k, v]) => <span key={k} className="rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{k}: <b>{brl(v)}</b></span>)}</div> : null; })()}
          {!!cats.length && <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={cats} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>{cats.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}</Pie><Tooltip formatter={(v: any) => brl(v)} /><Legend /></PieChart></ResponsiveContainer>}
          <Tabela linhas={ver.plan_fatura_itens} vazio="Só o total foi importado." colunas={[
            { k: 'data', t: 'Data' }, { k: 'descricao', t: 'Compra', r: (i) => <span>{i.descricao}{i.parcela_total ? ` (${i.parcela_num}/${i.parcela_total})` : ''}</span> },
            { k: 'categoria', t: 'Categoria', esconderCelular: true, r: (i) => <span>{i.categoria}{i.portador ? <span className="text-slate-400"> · {i.portador}</span> : ''}</span> }, { k: 'valor', t: 'Valor', num: true, r: (i) => brl(i.valor) },
          ]} />
          <div className="flex justify-between">{contaDa(ver)?.status === 'pendente' ? <Btn onClick={() => { setPagar(contaDa(ver)); setVer(null); }}>Paguei (tudo ou parte)</Btn> : <span className="text-sm text-slate-500">{situacao(ver) ? `Situação: ${situacao(ver)}` : ''}</span>}<Btn variante="fantasma" className="text-rose-600" onClick={() => excluirFatura(ver)}><Trash2 className="h-4 w-4" />Remover fatura</Btn></div>
        </div>}
      </Modal>
    </div>
  );
}
