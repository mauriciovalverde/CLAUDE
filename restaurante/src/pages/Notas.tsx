import { useState } from 'react';
import { Camera, FileText, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { abrirArquivo, enviarArquivo } from '../lib/arquivos';
import { lerFotoNota } from '../lib/ocr';
// @ts-ignore módulo JS testado
import { chaveFornecedor } from '../lib/catalogo.js';
import { brl, cnpjFmt, dataBR, hoje, lerNum } from '../lib/fmt';
import { Aviso, avisarMudanca, Badge, Btn, Cabecalho, Campo, Card, Dinheiro, Input, Modal, q, Tabela, toast, useDados } from '../components/ui';
import FormCompra, { type LinhaCompra } from '../components/FormCompra';

export default function Notas() {
  const { rest } = useEu();
  const [busca, setBusca] = useState('');
  const [lendo, setLendo] = useState<{ p: number; msg: string } | null>(null);
  const [rev, setRev] = useState<any>(null);
  const [lancar, setLancar] = useState<any>(null);
  const [ver, setVer] = useState<any>(null);
  const { dados } = useDados(() => q<any[]>(supabase.from('rest_notas').select('*, rest_fornecedores(nome), rest_compras(numero,total)').neq('status', 'descartada').order('criado_em', { ascending: false }).limit(300)), []);
  const lista = (dados ?? []).filter((n) => { const b = busca.toLowerCase().trim(); if (!b) return true; return [n.numero, n.cnpj, n.razao_social, n.rest_fornecedores?.nome, String(n.valor_total), n.data_emissao].some((x) => String(x ?? '').toLowerCase().includes(b.replace(',', '.'))); });

  const fotografar = async (arqs: File[]) => {
    if (!arqs.length) return;
    setLendo({ p: 1, msg: 'Procurando o QR Code…' });
    try {
      const r = await lerFotoNota(arqs, (p, msg) => setLendo({ p, msg }));
      const caminho = await enviarArquivo(rest.id, 'notas', arqs[0]).catch(() => null);
      setRev({ ...r, arquivo_path: caminho });
    } catch (e: any) { toast(e.message, 'erro'); } finally { setLendo(null); }
  };

  return (
    <div>
      <Cabecalho titulo="Notas fiscais" sub="Fotografe a nota: o app lê, você confere e lança a compra" />
      <Card className="mb-3">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white"><Camera className="h-5 w-5" />Fotografar nota<input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { fotografar([...(e.target.files ?? [])]); e.target.value = ''; }} /></label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium dark:border-slate-700"><FileText className="h-5 w-5" />Escolher imagem<input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { fotografar([...(e.target.files ?? [])]); e.target.value = ''; }} /></label>
          <Btn variante="secundario" onClick={() => setRev({ itens: [], avisos: [], manual: true })}>Digitar nota</Btn>
        </div>
        {lendo && <div className="mt-3"><div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-brand-700 transition-all" style={{ width: `${lendo.p}%` }} /></div><p className="mt-1 text-sm text-slate-500">{lendo.msg}</p></div>}
        <p className="mt-2 text-xs text-slate-500">Dica: foto reta, com boa luz e a nota inteira. O QR Code ajuda a pegar CNPJ, número e série sem erro. A leitura é feita no aparelho.</p>
      </Card>
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por fornecedor, número, CNPJ, valor ou data" className="pl-9" /></div>
      <Tabela linhas={lista} aoClicar={setVer} vazio="Nenhuma nota ainda."
        colunas={[
          { k: 'f', t: 'Fornecedor', r: (n) => n.rest_fornecedores?.nome ?? n.razao_social ?? '—' },
          { k: 'numero', t: 'Nº', r: (n) => `${n.numero ?? '—'}${n.serie ? `/${n.serie}` : ''}` },
          { k: 'data', t: 'Emissão', r: (n) => dataBR(n.data_emissao) },
          { k: 'compra', t: 'Compra', r: (n) => n.rest_compras ? `#${n.rest_compras.numero}` : '—', esconderCelular: true },
          { k: 'status', t: 'Situação', r: (n) => <Badge s={n.status} /> },
          { k: 'valor', t: 'Valor', num: true, r: (n) => brl(n.valor_total) },
        ]} />
      {rev && <Revisar dados={rev} fechar={() => setRev(null)} lancar={(n) => { setRev(null); setLancar(n); }} />}
      {lancar && <FormCompra inicial={lancar} fechar={() => setLancar(null)} />}
      {ver && <VerNota nota={ver} fechar={() => setVer(null)} lancar={(n) => { setVer(null); setLancar(n); }} />}
    </div>
  );
}

const paraForm = (n: any, itens: any[]): any => ({
  data: n.data_emissao ?? hoje(), fornecedor: n.fornecedor_nome ?? n.rest_fornecedores?.nome ?? n.razao_social ?? '', cnpj: n.cnpj, nota_id: n.id, nota_numero: n.numero, origem: 'nota', forma: n.forma_pagamento ?? 'PIX', vencimento: n.vencimento ?? undefined,
  titulo: `Lançar compra da nota ${n.numero ?? ''}`,
  itens: itens.map((i): LinhaCompra => ({ nome: i.descricao, descricao_original: i.descricao, quantidade: String(i.quantidade ?? '').replace('.', ','), unidade: i.unidade ?? 'un', unit: String(i.unit ?? '').replace('.', ','), total: String(i.total ?? '').replace('.', ',') })),
  desconto: n.valor_total && itens.length ? String(Math.max(0, Math.round((itens.reduce((t, i) => t + Number(i.total || 0), 0) - Number(n.valor_total)) * 100) / 100)).replace('.', ',') : '',
});

function Revisar({ dados, fechar, lancar }: { dados: any; fechar: () => void; lancar: (n: any) => void }) {
  const [n, setN] = useState({ razao_social: dados.razao_social ?? '', cnpj: dados.cnpj ?? '', numero: dados.numero ?? '', serie: dados.serie ?? '', data_emissao: dados.data_emissao ?? hoje(), valor_total: dados.valor_total != null ? String(dados.valor_total).replace('.', ',') : '', vencimento: '', chave_acesso: dados.chave_acesso ?? '', forma_pagamento: dados.forma_pagamento ?? '' });
  const [salvando, setSalvando] = useState(false);
  const { dados: forns } = useDados(() => q<any[]>(supabase.from('rest_fornecedores').select('id,nome,cnpj,chave')), []);
  const fornCnpj = (forns ?? []).find((f) => f.cnpj && f.cnpj === n.cnpj.replace(/\D/g, ''));
  const salvar = async (e_lancar: boolean) => {
    setSalvando(true);
    try {
      const cnpj = n.cnpj.replace(/\D/g, '') || null;
      const forn = fornCnpj ?? (forns ?? []).find((f) => f.chave === chaveFornecedor(n.razao_social));
      const { data: nota, error } = await supabase.from('rest_notas').insert({
        fornecedor_id: forn?.id ?? null, cnpj, razao_social: n.razao_social || null, numero: n.numero || null, serie: n.serie || null, chave_acesso: n.chave_acesso.replace(/\D/g, '') || null,
        data_emissao: n.data_emissao || null, valor_total: lerNum(n.valor_total) || null, forma_pagamento: n.forma_pagamento || null, vencimento: n.vencimento || null,
        arquivo_path: dados.arquivo_path ?? null, texto_ocr: dados.texto ?? null, dados: { itens: dados.itens, qr: dados.qr ?? null }, divergencias: dados.avisos?.length ? dados.avisos : null, status: 'pendente',
      }).select('*').single();
      if (error) throw new Error(error.message.includes('duplicate') ? 'Esta nota já foi cadastrada antes (mesmo número/CNPJ ou mesma chave). Procure na lista.' : error.message);
      toast('Nota guardada. Falta conferir e lançar a compra.'); avisarMudanca();
      if (e_lancar) lancar(paraForm({ ...nota, fornecedor_nome: forn?.nome ?? n.razao_social }, dados.itens ?? [])); else fechar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setSalvando(false); }
  };
  return (
    <Modal aberto fechar={fechar} titulo="Conferir dados da nota" largo>
      <div className="space-y-3">
        {!dados.manual && <Aviso tipo="alerta">Leitura automática: <b>confira tudo</b> antes de lançar. Nada é considerado conferido sem a sua aprovação.</Aviso>}
        {(dados.avisos ?? []).map((a: string) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Fornecedor (razão social)" dica={fornCnpj ? `Já cadastrado: ${fornCnpj.nome}` : undefined}><Input value={n.razao_social} onChange={(e) => setN({ ...n, razao_social: e.target.value })} /></Campo>
          <Campo rotulo="CNPJ"><Input value={cnpjFmt(n.cnpj)} onChange={(e) => setN({ ...n, cnpj: e.target.value })} /></Campo>
          <Campo rotulo="Número"><Input value={n.numero} onChange={(e) => setN({ ...n, numero: e.target.value })} /></Campo>
          <Campo rotulo="Série"><Input value={n.serie} onChange={(e) => setN({ ...n, serie: e.target.value })} /></Campo>
          <Campo rotulo="Data de emissão"><Input type="date" value={n.data_emissao} onChange={(e) => setN({ ...n, data_emissao: e.target.value })} /></Campo>
          <Campo rotulo="Valor total"><Dinheiro valor={n.valor_total} mudar={(v) => setN({ ...n, valor_total: v })} /></Campo>
          <Campo rotulo="Vencimento (se for a prazo)"><Input type="date" value={n.vencimento} onChange={(e) => setN({ ...n, vencimento: e.target.value })} /></Campo>
          <Campo rotulo="Chave de acesso"><Input value={n.chave_acesso} onChange={(e) => setN({ ...n, chave_acesso: e.target.value })} className="font-mono text-xs" /></Campo>
        </div>
        {(dados.itens ?? []).length > 0 && <div className="rounded-xl bg-slate-50 p-2 text-sm dark:bg-slate-800/50"><b>{dados.itens.length} itens lidos</b> (você confere e corrige na próxima tela){dados.itens.slice(0, 6).map((i: any, k: number) => <div key={k} className={`flex justify-between ${i.conferir ? 'text-amber-600' : ''}`}><span className="truncate">{i.descricao}</span><span className="tabular-nums">{brl(i.total)}</span></div>)}{dados.itens.length > 6 && <div className="text-slate-500">…</div>}</div>}
        <div className="flex flex-wrap gap-2">
          <Btn carregando={salvando} onClick={() => salvar(true)}>Guardar e lançar a compra</Btn>
          <Btn variante="secundario" carregando={salvando} onClick={() => salvar(false)}>Só guardar (lançar depois)</Btn>
        </div>
        <p className="text-xs text-slate-500">Se a compra desta nota já foi lançada, abra a nota na lista e use “Ligar a uma compra existente”: assim não duplica a conta.</p>
      </div>
    </Modal>
  );
}

function VerNota({ nota, fechar, lancar }: { nota: any; fechar: () => void; lancar: (n: any) => void }) {
  const { dados: compras } = useDados(() => nota.compra_id ? Promise.resolve([]) : q<any[]>(supabase.from('rest_compras').select('id,numero,data,total,nota_id, rest_fornecedores(nome)').is('nota_id', null).neq('status', 'cancelada').order('data', { ascending: false }).limit(60)), [nota.id]);
  const parecidas = (compras ?? []).filter((c) => !nota.valor_total || Math.abs(Number(c.total) - Number(nota.valor_total)) < Math.max(1, Number(nota.valor_total) * 0.05));
  const ligar = async (c: any) => {
    const e1 = (await supabase.from('rest_notas').update({ compra_id: c.id, status: 'conferida', conferida_em: new Date().toISOString() }).eq('id', nota.id)).error;
    const e2 = e1 ? null : (await supabase.from('rest_compras').update({ nota_id: nota.id }).eq('id', c.id)).error;
    if (e1 || e2) toast((e1 ?? e2)!.message, 'erro'); else { toast(`Nota ligada à compra #${c.numero}`); avisarMudanca(); fechar(); }
  };
  return (
    <Modal aberto fechar={fechar} titulo={`Nota ${nota.numero ?? ''} · ${nota.rest_fornecedores?.nome ?? nota.razao_social ?? ''}`} largo>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2"><Badge s={nota.status} />{nota.cnpj && <span>CNPJ {cnpjFmt(nota.cnpj)}</span>}<span>· emissão {dataBR(nota.data_emissao)}</span><span>· <b>{brl(nota.valor_total)}</b></span></div>
        {(nota.divergencias ?? []).map((a: string) => <Aviso key={a} tipo="alerta">{a}</Aviso>)}
        {nota.rest_compras && <Aviso tipo={Math.abs(Number(nota.rest_compras.total) - Number(nota.valor_total)) > 0.05 ? 'alerta' : 'ok'}>Ligada à compra #{nota.rest_compras.numero} ({brl(nota.rest_compras.total)}){Math.abs(Number(nota.rest_compras.total) - Number(nota.valor_total)) > 0.05 ? ' — valores diferentes, confira.' : ''}</Aviso>}
        {nota.arquivo_path && <Btn variante="secundario" onClick={async () => { try { await abrirArquivo(nota.arquivo_path); } catch (e: any) { toast(e.message, 'erro'); } }}>Ver foto da nota</Btn>}
        {nota.status === 'pendente' && <>
          <Btn onClick={() => lancar(paraForm(nota, nota.dados?.itens ?? []))}>Conferir e lançar a compra</Btn>
          {parecidas.length > 0 && <div><h4 className="mt-2 font-semibold">Ligar a uma compra já lançada (sem nota)</h4>{parecidas.slice(0, 8).map((c) => <button key={c.id} onClick={() => ligar(c)} className="mt-1 flex w-full justify-between rounded-lg border p-2 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"><span>#{c.numero} · {c.rest_fornecedores?.nome} · {dataBR(c.data)}</span><b>{brl(c.total)}</b></button>)}</div>}
          <Btn variante="fantasma" className="text-rose-600" onClick={async () => { const { error } = await supabase.from('rest_notas').update({ status: 'descartada' }).eq('id', nota.id); if (error) toast(error.message, 'erro'); else { toast('Nota descartada'); avisarMudanca(); fechar(); } }}>Descartar (foto errada/duplicada)</Btn>
        </>}
        {nota.texto_ocr && <details><summary className="cursor-pointer text-xs text-slate-500">Texto lido da foto</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px] dark:bg-slate-800">{nota.texto_ocr}</pre></details>}
      </div>
    </Modal>
  );
}
