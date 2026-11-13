import { useState } from 'react';
import { Bot, Check, Cloud, ExternalLink, Sparkles } from 'lucide-react';
import { funcao } from '../lib/supabase';
import { lerCfgIA, salvarCfgIA, type ProvedorIA } from '../lib/ia/agente';
import { Btn, Card, Input, toast } from './ui';

const OPCOES: { id: ProvedorIA; t: string; d: string; i: any; tag?: string }[] = [
  { id: 'local', t: 'Assistente embutido', d: 'Grátis, sem chave e sem cadastro. Funciona no Android, iPhone e computador. Entende as frases do dia a dia (compras, gastos, faturamento, preços, contas, estoque).', i: Bot, tag: 'Pronto para usar' },
  { id: 'gemini', t: 'Google Gemini (grátis)', d: 'IA completa, conversa livre. Precisa de uma chave gratuita do Google (1 minuto). Funciona no celular.', i: Sparkles, tag: 'Recomendado' },
  { id: 'ollama_cloud', t: 'Ollama na nuvem', d: 'Alternativa com chave do Ollama. Atenção: contas gratuitas às vezes ficam sem modelo liberado.', i: Cloud },
];

/** Escolha da IA da Central. Se a IA externa falhar, o assistente embutido responde no lugar. */
export default function ConfigIA() {
  const [cfg, setCfg] = useState(lerCfgIA());
  const [chave, setChave] = useState('');
  const [testando, setTestando] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);
  const escolher = (p: ProvedorIA) => { salvarCfgIA({ provedor: p, modelo: '' }); setCfg(lerCfgIA()); setOk(null); setChave(''); if (p === 'local') toast('Assistente embutido ativado ✅'); };
  const salvar = async () => {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'salvar_chave', provedor: cfg.provedor, chave: chave.trim() });
    setTestando(false);
    if (!r.ok) { setOk(false); toast(r.mensagem ?? 'Não deu certo', 'erro'); return; }
    salvarCfgIA({ modelo: r.modelo }); setCfg(lerCfgIA()); setChave(''); setOk(true);
    toast(`IA funcionando ✅ (${r.modelo})`);
  };
  const testar = async () => {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'testar', provedor: cfg.provedor, modelo: cfg.modelo });
    setTestando(false); setOk(!!r.ok); toast(r.mensagem ?? (r.ok ? 'Funcionando' : 'Não funcionou'), r.ok ? 'ok' : 'erro');
    if (r.ok && r.modelo) { salvarCfgIA({ modelo: r.modelo }); setCfg(lerCfgIA()); }
  };
  return (
    <Card titulo={<span className="flex items-center gap-2"><Bot className="h-4 w-4" />Inteligência artificial (Central IA)</span>}>
      <div className="space-y-2">
        {OPCOES.map((o) => (
          <button key={o.id} onClick={() => escolher(o.id)} className={`w-full rounded-2xl border p-3 text-left transition ${cfg.provedor === o.id ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20 dark:bg-brand-950/30' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-center gap-2 font-semibold"><o.i className="h-4 w-4 text-brand-700" />{o.t}{cfg.provedor === o.id && <Check className="h-4 w-4 text-emerald-600" />}{o.tag && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{o.tag}</span>}</div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{o.d}</p>
          </button>
        ))}
      </div>
      {cfg.provedor === 'gemini' && <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Abra <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey <ExternalLink className="h-3 w-3" /></a> e entre com sua conta Google.</li>
        <li>Toque em <b>Create API key</b> (Criar chave de API) e copie a chave (começa com <b>AIza</b>).</li>
        <li>Cole aqui e toque em “Salvar e testar”.</li>
      </ol>}
      {cfg.provedor === 'ollama_cloud' && <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
        <li>Crie uma conta grátis em <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href="https://ollama.com/signup" target="_blank" rel="noreferrer">ollama.com <ExternalLink className="h-3 w-3" /></a>.</li>
        <li>Abra <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Settings → Keys <ExternalLink className="h-3 w-3" /></a>, toque em <b>Add API Key</b> e copie.</li>
        <li>Cole aqui e toque em “Salvar e testar”.</li>
      </ol>}
      {cfg.provedor !== 'local' && <>
        <div className="mt-2 flex gap-2"><Input type="password" placeholder={cfg.provedor === 'gemini' ? 'cole a chave do Gemini (AIza...)' : 'cole a chave do Ollama'} value={chave} onChange={(e) => setChave(e.target.value)} /><Btn carregando={testando} disabled={chave.trim().length < 10} onClick={salvar}>Salvar e testar</Btn></div>
        <div className="mt-2 flex items-center gap-2 text-sm">{ok === true && <span className="font-medium text-emerald-600">✅ Funcionando{cfg.modelo ? ` (${cfg.modelo})` : ''}</span>}{ok === false && <span className="text-rose-600">Não está funcionando</span>}<Btn variante="fantasma" className="!py-1 text-xs" carregando={testando} onClick={testar}>Testar a IA</Btn></div>
      </>}
      <p className="mt-2 text-xs text-slate-500">A chave fica guardada cifrada no servidor e só é usada pelo seu acesso. Se a IA externa não responder (sem chave, limite do dia), o assistente embutido responde no lugar. Nada é inventado: as respostas vêm dos dados do restaurante.</p>
    </Card>
  );
}
