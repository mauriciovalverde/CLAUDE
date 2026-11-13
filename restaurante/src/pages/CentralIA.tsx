import { useEffect, useRef, useState } from 'react';
import { Send, Settings, Wrench } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEu } from '../lib/sessao';
import { conversar } from '../lib/ia/agente';
import { avisarMudanca, Btn, Cabecalho, Textarea } from '../components/ui';

const EXEMPLOS = ['Comprei 15 kg de carne por R$ 32 o quilo no Açougue Ventura Master, paguei no PIX', 'Hoje gastamos R$ 280 com hortaliças na Hortfrut', 'O fornecedor Centro Sul entregou a compra de hoje', 'Quanto gastamos com carnes este mês?', 'Qual foi nosso faturamento ontem?', 'Compare as despesas de outubro e novembro', 'Qual foi o custo da batata nos últimos três meses?', 'Qual produto teve maior aumento de preço?', 'Quanto compramos no Centro Sul em outubro?', 'Qual fornecedor recebeu mais pagamentos?'];
const ROTULO: Record<string, string> = { buscar_produto: 'procurou produto', buscar_fornecedor: 'procurou fornecedor', registrar_compra: 'registrou compra', registrar_despesa: 'lançou despesa', marcar_compra_recebida: 'deu entrada no estoque', consultar_gastos: 'consultou compras', faturamento: 'consultou vendas', comparar_periodos: 'comparou períodos', preco_produto: 'consultou preços', maiores_aumentos: 'comparou preços', contas: 'consultou contas', pagamentos_por_fornecedor: 'consultou pagamentos', estoque: 'consultou estoque' };

function Texto({ t }: { t: string }) {
  return <>{t.split('\n').map((l, i) => <p key={i} className="min-h-[0.5rem]">{l.split(/(\*\*[^*]+\*\*)/g).map((p, j) => p.startsWith('**') ? <b key={j}>{p.slice(2, -2)}</b> : p)}</p>)}</>;
}

export default function CentralIA() {
  const { eu, rest } = useEu();
  const [msgs, setMsgs] = useState<{ papel: string; texto: string; ferramentas?: any[] }[]>([]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => { supabase.from('rest_chat').select('papel,texto,ferramentas').order('criado_em', { ascending: false }).limit(30).then(({ data }) => setMsgs((data ?? []).reverse())); }, [eu.id]);
  useEffect(() => { fim.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, pensando]);
  const enviar = async (t = texto) => {
    if (!t.trim() || pensando) return;
    setTexto(''); setMsgs((m) => [...m, { papel: 'user', texto: t }]); setPensando(true);
    const r = await conversar(t, msgs, rest.nome);
    setMsgs((m) => [...m, { papel: 'assistant', texto: r.resposta, ferramentas: r.ferramentas }]); setPensando(false);
    if (r.ferramentas.some((f) => /registrar|marcar/.test(f.nome) && f.ok)) avisarMudanca();
  };
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col lg:h-[calc(100vh-3rem)]">
      <Cabecalho titulo="Central IA" sub="Escreva como falaria com uma pessoa: a IA consulta e registra no sistema" acoes={<a href="#/configuracoes" className="inline-flex items-center gap-1 text-sm text-slate-500"><Settings className="h-4 w-4" />Ligar a IA</a>} />
      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        {!msgs.length && <div className="space-y-2"><p className="text-sm text-slate-500">Exemplos (toque para usar):</p><div className="flex flex-wrap gap-2">{EXEMPLOS.map((e) => <button key={e} onClick={() => setTexto(e)} className="rounded-full bg-slate-100 px-3 py-1.5 text-left text-xs hover:bg-slate-200 dark:bg-slate-800">{e}</button>)}</div></div>}
        {msgs.map((m, i) => (
          <div key={i} className={`flex ${m.papel === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.papel === 'user' ? 'bg-brand-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Texto t={m.texto} />
              {!!m.ferramentas?.length && <div className="mt-1.5 flex flex-wrap gap-1 border-t border-slate-200 pt-1.5 dark:border-slate-700">{m.ferramentas.map((f: any, k: number) => <span key={k} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${f.ok === false || f.saida?.ok === false ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}><Wrench className="h-2.5 w-2.5" />{ROTULO[f.nome] ?? f.nome}</span>)}</div>}
            </div>
          </div>
        ))}
        {pensando && <div className="flex gap-1 p-2"><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:.3s]" /></div>}
        <div ref={fim} />
      </div>
      <div className="mt-2 flex gap-2">
        <Textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ex.: Comprei 10 kg de tomate a R$ 5,99 na Hortfrut, vou pagar dia 20" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }} />
        <Btn className="!px-4" carregando={pensando} disabled={!texto.trim()} onClick={() => enviar()} aria-label="Enviar"><Send className="h-5 w-5" /></Btn>
      </div>
    </div>
  );
}
