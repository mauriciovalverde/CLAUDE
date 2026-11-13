import { useState } from 'react';
import { Bot, ExternalLink } from 'lucide-react';
import { funcao } from '../lib/supabase';
import { lerCfgIA, salvarCfgIA } from '../lib/ia/agente';
import { Btn, Card, Input, toast } from './ui';

/** Liga a Central IA: chave gratuita do Ollama (guardada cifrada no servidor, ligada ao seu acesso). */
export default function ConfigIA() {
  const [chave, setChave] = useState('');
  const [testando, setTestando] = useState(false);
  const [ok, setOk] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState(lerCfgIA());
  const salvar = async () => {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'salvar_chave', provedor: 'ollama_cloud', chave: chave.trim() });
    setTestando(false);
    if (!r.ok) { setOk(false); toast(r.mensagem ?? 'Não deu certo', 'erro'); return; }
    salvarCfgIA({ provedor: 'ollama_cloud', modelo: r.modelo }); setCfg(lerCfgIA()); setChave(''); setOk(true);
    toast(`IA funcionando ✅ (modelo ${r.modelo})`);
  };
  const testar = async () => {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'testar', provedor: cfg.provedor, modelo: cfg.modelo });
    setTestando(false); setOk(!!r.ok); toast(r.mensagem ?? (r.ok ? 'Funcionando' : 'Não funcionou'), r.ok ? 'ok' : 'erro');
    if (r.ok && r.modelo) { salvarCfgIA({ modelo: r.modelo }); setCfg(lerCfgIA()); }
  };
  return (
    <Card titulo={<span className="flex items-center gap-2"><Bot className="h-4 w-4" />Inteligência artificial (Central IA)</span>}>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Crie uma conta grátis em <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href="https://ollama.com/signup" target="_blank" rel="noreferrer">ollama.com <ExternalLink className="h-3 w-3" /></a> (pode entrar com Google).</li>
        <li>Abra <a className="inline-flex items-center gap-1 font-medium text-brand-700 underline" href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Settings → Keys <ExternalLink className="h-3 w-3" /></a>, toque em <b>Add API Key</b> e copie a chave.</li>
        <li>Cole aqui e toque em “Salvar e testar”.</li>
      </ol>
      <div className="mt-2 flex gap-2"><Input type="password" placeholder="cole a chave do Ollama" value={chave} onChange={(e) => setChave(e.target.value)} /><Btn carregando={testando} disabled={chave.trim().length < 10} onClick={salvar}>Salvar e testar</Btn></div>
      <div className="mt-2 flex items-center gap-2 text-sm">{ok === true && <span className="font-medium text-emerald-600">✅ Funcionando{cfg.modelo ? ` (${cfg.modelo})` : ''}</span>}{ok === false && <span className="text-rose-600">Não está funcionando</span>}<Btn variante="fantasma" className="!py-1 text-xs" carregando={testando} onClick={testar}>Testar a IA</Btn></div>
      <p className="mt-2 text-xs text-slate-500">Grátis com limite diário. A chave fica guardada cifrada no servidor e só é usada pelo seu acesso de administrador. As perguntas usam os dados do restaurante para responder; nada é inventado.</p>
    </Card>
  );
}
