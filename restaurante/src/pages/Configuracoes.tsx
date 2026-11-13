import { useState } from 'react';
import { Download, FileSpreadsheet, KeyRound, LogOut } from 'lucide-react';
import { funcao, rpc, supabase } from '../lib/supabase';
import { sair, useEu } from '../lib/sessao';
import { salvarArquivo } from '../lib/nativo';
// @ts-ignore módulos JS testados
import { lerPlanilhaCompras } from '../lib/planilha.js';
// @ts-ignore
import { montarImportacao } from '../lib/importar.js';
import { brl, dataBR, dataHora } from '../lib/fmt';
import { Aviso, avisarMudanca, Btn, Cabecalho, Campo, Card, Input, q, toast, useDados } from '../components/ui';
import ConfigIA from '../components/ConfigIA';

export default function Configuracoes() {
  const { pode } = useEu();
  return (
    <div className="space-y-3">
      <Cabecalho titulo="Configurações" />
      <TrocarPin />
      {pode('admin') && <><DadosRestaurante /><ImportarPlanilha /><ConfigIA /><Backup /></>}
      <Card><Btn variante="secundario" onClick={() => sair()}><LogOut className="h-4 w-4" />Sair (outra pessoa vai usar o aparelho)</Btn></Card>
    </div>
  );
}

function TrocarPin() {
  const [a, setA] = useState(''); const [b, setB] = useState(''); const [c, setC] = useState('');
  return (
    <Card titulo={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Trocar meu PIN</span>}>
      <div className="grid grid-cols-3 gap-2">
        <Input type="password" inputMode="numeric" maxLength={6} placeholder="PIN atual" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ''))} />
        <Input type="password" inputMode="numeric" maxLength={6} placeholder="Novo PIN" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ''))} />
        <Input type="password" inputMode="numeric" maxLength={6} placeholder="Repita" value={c} onChange={(e) => setC(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Btn className="mt-2" disabled={a.length < 4 || b.length < 4} onClick={async () => {
        if (b !== c) { toast('Os PINs novos estão diferentes', 'erro'); return; }
        const r = await funcao('rest-acesso', { acao: 'trocar_pin', pin_atual: a, pin_novo: b });
        if (!r.ok) toast(r.mensagem, 'erro'); else { toast('PIN trocado'); setA(''); setB(''); setC(''); }
      }}>Trocar PIN</Btn>
    </Card>
  );
}

function DadosRestaurante() {
  const { rest, recarregar } = useEu();
  const [d, setD] = useState({ nome: rest.nome, cnpj: rest.cnpj ?? '', telefone: rest.telefone ?? '', endereco: rest.endereco ?? '' });
  return (
    <Card titulo="Dados do restaurante">
      <div className="grid gap-2 sm:grid-cols-2">
        <Campo rotulo="Nome"><Input value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} /></Campo>
        <Campo rotulo="CNPJ"><Input value={d.cnpj} onChange={(e) => setD({ ...d, cnpj: e.target.value })} /></Campo>
        <Campo rotulo="Telefone"><Input value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} /></Campo>
        <Campo rotulo="Endereço"><Input value={d.endereco} onChange={(e) => setD({ ...d, endereco: e.target.value })} /></Campo>
      </div>
      <div className="mt-2 text-sm text-slate-500">Código da equipe: <b className="font-mono">{rest.codigo}</b></div>
      <Btn className="mt-2" onClick={async () => { const { error } = await supabase.from('rest_restaurantes').update({ ...d, cnpj: d.cnpj.replace(/\D/g, '') || null }).eq('id', rest.id); if (error) toast(error.message, 'erro'); else { toast('Salvo'); recarregar(); } }}>Salvar</Btn>
    </Card>
  );
}

function ImportarPlanilha() {
  const [leitura, setLeitura] = useState<any>(null);
  const [arquivo, setArquivo] = useState('');
  const [importando, setImportando] = useState(false);
  const { dados: hist, recarregar } = useDados(() => q<any[]>(supabase.from('rest_importacoes').select('*').order('criado_em', { ascending: false }).limit(10)), []);
  const ler = async (arq: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await arq.arrayBuffer(), { cellDates: true, cellFormula: true });
      const r = lerPlanilhaCompras(wb, XLSX);
      if (!r.compras.length) { toast('Não encontrei compras no formato esperado (blocos com data, "LOCAL:" e MERCADORIA/QUANTIDADE/KG/VALOR).', 'erro'); return; }
      setLeitura(r); setArquivo(arq.name);
    } catch (e: any) { toast('Não consegui ler a planilha: ' + (e.message ?? e), 'erro'); }
  };
  return (
    <Card titulo={<span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" />Importar planilha de compras</span>}>
      <p className="text-sm text-slate-600">Envie a planilha no modelo “CONTROLE COMPRAS” (uma aba por semana). Cada compra vira registro pesquisável com fornecedor, produtos, quantidades e valores. Importar de novo <b>não duplica</b> e não apaga nada.</p>
      <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white"><FileSpreadsheet className="h-4 w-4" />Escolher planilha (.xlsx)<input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} /></label>
      {leitura && <div className="mt-3 space-y-2 text-sm">
        <Aviso tipo="ok"><b>{arquivo}</b>: {leitura.resumo.abas} abas · <b>{leitura.resumo.compras} compras</b> · {leitura.resumo.itens} itens · {leitura.fornecedores.length} fornecedores · {leitura.produtos.length} produtos · {dataBR(leitura.resumo.de)} a {dataBR(leitura.resumo.ate)} · total <b>{brl(leitura.resumo.total)}</b></Aviso>
        <details><summary className="cursor-pointer font-medium">Fornecedores encontrados</summary><ul className="mt-1 list-disc pl-5">{leitura.fornecedores.map((f: any) => <li key={f.chave}>{f.nome} — {f.compras} compras, {brl(f.total)}{f.grafias.length > 1 ? ` (grafias: ${f.grafias.join(', ')})` : ''}</li>)}</ul></details>
        <details><summary className="cursor-pointer font-medium">Nomes padronizados ({leitura.produtos.filter((p: any) => p.grafias.length > 1).length} produtos com grafias diferentes)</summary><ul className="mt-1 list-disc pl-5 text-xs">{leitura.produtos.filter((p: any) => p.grafias.length > 1).map((p: any) => <li key={p.chave}><b>{p.nome}</b> ← {p.grafias.join(' · ')}</li>)}</ul></details>
        {leitura.avisos.length > 0 && <details open><summary className="cursor-pointer font-medium text-amber-700">{leitura.avisos.length} pontos para conferir</summary><ul className="mt-1 list-disc pl-5 text-xs text-amber-800 dark:text-amber-300">{leitura.avisos.map((a: any, k: number) => <li key={k}>{a.msg}</li>)}</ul></details>}
        <Btn className="w-full !py-3" carregando={importando} onClick={async () => {
          setImportando(true);
          try { const r = await rpc('rest_importar_compras', { p: montarImportacao(leitura, arquivo) }); toast(`Importado: ${r.novas} compras novas${r.repetidas ? `, ${r.repetidas} já existiam (não duplicadas)` : ''}`); setLeitura(null); recarregar(); avisarMudanca(); }
          catch (e: any) { toast(e.message, 'erro'); } finally { setImportando(false); }
        }}>Importar {leitura.resumo.compras} compras</Btn>
        <p className="text-xs text-slate-500">O histórico entra como compras já recebidas e pagas na data da compra; ele não altera o saldo atual do estoque.</p>
      </div>}
      {hist && hist.length > 0 && <div className="mt-3 text-xs text-slate-500"><b>Importações anteriores:</b>{hist.map((h) => <div key={h.id}>{dataHora(h.criado_em)} · {h.arquivo} · {h.compras_novas} novas, {h.compras_repetidas} repetidas</div>)}</div>}
    </Card>
  );
}

function Backup() {
  const [gerando, setGerando] = useState(false);
  return (
    <Card titulo="Cópia de segurança">
      <p className="text-sm text-slate-600">Os dados ficam num banco na nuvem com acesso protegido. Para ter uma cópia sua, baixe tudo em Excel (uma aba por tipo de registro). Recomendado uma vez por mês.</p>
      <Btn className="mt-2" variante="secundario" carregando={gerando} onClick={async () => {
        setGerando(true);
        try {
          const XLSX = await import('xlsx'); const wb = XLSX.utils.book_new();
          for (const [t, nome] of [['rest_compras', 'Compras'], ['rest_v_itens', 'Itens comprados'], ['rest_fornecedores', 'Fornecedores'], ['rest_produtos', 'Produtos'], ['rest_estoque_movs', 'Estoque'], ['rest_notas', 'Notas'], ['rest_fechamentos', 'Fechamentos'], ['rest_vendas', 'Vendas'], ['rest_contas', 'Contas'], ['rest_solicitacoes', 'Solicitações'], ['rest_solicitacao_itens', 'Itens solicitados']]) {
            const linhas: any[] = []; for (let de = 0; ; de += 1000) { const { data, error } = await supabase.from(t).select('*').range(de, de + 999); if (error) throw error; linhas.push(...data); if (data.length < 1000) break; }
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [k, typeof v === 'object' && v !== null ? JSON.stringify(v) : v])))), nome);
          }
          await salvarArquivo(`backup-restaurante-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          toast('Cópia gerada');
        } catch (e: any) { toast(e.message, 'erro'); } finally { setGerando(false); }
      }}><Download className="h-4 w-4" />Baixar cópia completa (Excel)</Btn>
    </Card>
  );
}
