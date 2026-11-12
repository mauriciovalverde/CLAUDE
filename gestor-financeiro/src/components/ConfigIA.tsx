import { useEffect, useState } from 'react';
import { Check, Cloud, Copy, Cpu, Download, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { funcao, supabase } from '../lib/supabase';
import { MODELO_PADRAO, ollamaBaixar, ollamaLocalStatus, Provedor } from '../lib/ia/agente';
import { Aviso, Btn, Campo, Input, Select, toast } from './ui';

const ORIGEM = typeof window !== 'undefined' ? window.location.origin : '';
const MODELOS_LOCAIS = [
  ['qwen3:4b', 'Leve (2,5 GB) – computadores simples'],
  ['qwen3:8b', 'Recomendado (5 GB) – melhor qualidade'],
  ['llama3.1:8b', 'Alternativa (4,9 GB)'],
];

function Passo({ n, children, feito }: { n: number; children: React.ReactNode; feito?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${feito ? 'bg-emerald-600 text-white' : 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200'}`}>{feito ? <Check className="h-4 w-4" /> : n}</span>
      <div className="flex-1 pt-0.5 text-sm">{children}</div>
    </li>
  );
}

function Copiar({ texto }: { texto: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 rounded-lg bg-slate-900 p-2 font-mono text-xs text-slate-100">
      <code className="flex-1 break-all">{texto}</code>
      <button onClick={() => { navigator.clipboard.writeText(texto); toast('Copiado!', 'info'); }} className="rounded bg-slate-700 p-1.5 hover:bg-slate-600" title="Copiar"><Copy className="h-3.5 w-3.5" /></button>
    </div>
  );
}

export default function ConfigIA({ aoConcluir }: { aoConcluir?: () => void }) {
  const [cfg, setCfg] = useState<any>(null);
  const [prov, setProv] = useState<Provedor>('ollama_cloud');
  const [chave, setChave] = useState('');
  const [modelos, setModelos] = useState<string[]>([]);
  const [modelo, setModelo] = useState('');
  const [testando, setTestando] = useState(false);
  const [statusOk, setStatusOk] = useState<boolean | null>(null);
  const [baixando, setBaixando] = useState<{ p: number; s: string } | null>(null);
  const [so, setSo] = useState<'windows' | 'mac'>(/Mac/.test(navigator.userAgent) ? 'mac' : 'windows');
  const celular = /Android|iPhone|iPad/.test(navigator.userAgent);

  useEffect(() => {
    supabase.from('configuracoes').select('*').maybeSingle().then(({ data }) => {
      setCfg(data); setProv(data?.ia_provedor ?? 'ollama_cloud'); setModelo(data?.ia_ollama_modelo ?? '');
    });
  }, []);
  const url = cfg?.ia_ollama_url ?? 'http://localhost:11434';

  async function salvar(p: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('configuracoes').update(p).eq('user_id', user!.id);
    if (error) toast(error.message, 'erro'); else setCfg((c: any) => ({ ...c, ...p }));
  }

  async function testar() {
    setTestando(true); setStatusOk(null);
    try {
      if (prov === 'ollama_local') {
        const s = await ollamaLocalStatus(url);
        setModelos(s.modelos); setStatusOk(s.ok);
        if (!s.ok) toast('Não encontrei o Ollama. Siga os passos 1 e 2 e tente de novo.', 'erro');
        else if (!s.modelos.length) toast('Ollama encontrado! Agora baixe um modelo (passo 3).', 'info');
        else toast('Ollama conectado! ✅');
      } else {
        const r = await funcao('ia-modelo', { acao: 'testar', provedor: prov, modelo });
        setModelos(r.modelos ?? []); setStatusOk(!!r.ok); toast(r.mensagem ?? (r.ok ? 'Conectado!' : 'Falhou'), r.ok ? 'ok' : 'erro');
        if (r.ok && r.modelo && r.modelo !== modelo) { setModelo(r.modelo); await salvar({ ia_ollama_modelo: r.modelo }); }
      }
    } finally { setTestando(false); }
  }

  async function salvarChave() {
    setTestando(true);
    const r = await funcao('ia-modelo', { acao: 'salvar_chave', provedor: 'ollama_cloud', chave });
    setTestando(false);
    if (!r.ok) { toast(r.mensagem, 'erro'); setStatusOk(false); return; }
    setChave(''); setModelos(r.modelos ?? []); setStatusOk(true);
    const m = r.modelo || MODELO_PADRAO.ollama_cloud;
    setModelo(m); await salvar({ ia_provedor: 'ollama_cloud', ia_ollama_modelo: m });
    toast(`Funcionando ✅ A IA respondeu de verdade (modelo ${m}).`);
  }

  async function baixar(m: string) {
    setBaixando({ p: 0, s: 'iniciando' });
    try {
      await ollamaBaixar(url, m, (p, s) => setBaixando({ p, s }));
      toast('Modelo baixado! ✅'); setModelo(m); await salvar({ ia_provedor: 'ollama_local', ia_ollama_modelo: m }); await testar();
    } catch (e: any) { toast(e.message, 'erro'); } finally { setBaixando(null); }
  }

  const escolher = async (p: Provedor) => { setProv(p); setStatusOk(null); setModelos([]); await salvar({ ia_provedor: p, ia_ollama_modelo: null }); setModelo(''); };
  if (!cfg) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;

  const OPC: { id: Provedor; t: string; d: string; i: any; tag?: string }[] = [
    { id: 'ollama_cloud', t: 'Ollama na nuvem', d: 'Grátis (com limite diário). Funciona no celular e no computador. Só precisa colar uma chave.', i: Cloud, tag: 'Mais fácil' },
    { id: 'ollama_local', t: 'Ollama no meu computador', d: 'Grátis e sem limite. Seus dados não saem do computador. Só funciona no PC/Mac onde instalar.', i: Cpu },
    { id: 'claude', t: 'Claude (premium)', d: 'IA mais precisa. Disponível se o administrador do app ativou.', i: Sparkles },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {OPC.map((o) => (
          <button key={o.id} onClick={() => escolher(o.id)} className={`rounded-2xl border p-3 text-left transition ${prov === o.id ? 'border-teal-600 bg-teal-50 ring-2 ring-teal-600/20 dark:bg-teal-950/30' : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'}`}>
            <div className="flex items-center gap-2 font-semibold"><o.i className="h-4 w-4 text-teal-700" />{o.t}{o.tag && <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{o.tag}</span>}</div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{o.d}</p>
          </button>
        ))}
      </div>

      {prov === 'ollama_cloud' && (
        <ol className="space-y-3">
          <Passo n={1}>Crie uma conta grátis no Ollama: <a className="inline-flex items-center gap-1 font-medium text-teal-700 underline" href="https://ollama.com/signup" target="_blank" rel="noreferrer">abrir ollama.com <ExternalLink className="h-3 w-3" /></a> (pode entrar com sua conta Google).</Passo>
          <Passo n={2}>Depois de entrar, abra <a className="inline-flex items-center gap-1 font-medium text-teal-700 underline" href="https://ollama.com/settings/keys" target="_blank" rel="noreferrer">Settings → Keys <ExternalLink className="h-3 w-3" /></a>, clique em <b>Add API Key</b>, dê um nome (ex.: “gestor”) e copie a chave.</Passo>
          <Passo n={3} feito={statusOk === true}>Cole a chave aqui e clique em salvar:
            <div className="mt-2 flex gap-2"><Input type="password" placeholder="cole a chave aqui" value={chave} onChange={(e) => setChave(e.target.value)} /><Btn onClick={salvarChave} carregando={testando} disabled={!chave.trim()}>Salvar e testar</Btn></div>
            <p className="mt-1 text-xs text-slate-500">Ao salvar, o app faz um teste de verdade e escolhe sozinho um modelo gratuito que funcione na sua conta. A chave fica guardada cifrada no servidor.</p>
            {statusOk === true && <div className="mt-2 flex items-center gap-2"><span className="text-sm font-medium text-emerald-600">✅ Funcionando{modelo ? ` (${modelo})` : ''}</span><Btn variante="fantasma" className="!py-1 text-xs" onClick={testar} carregando={testando}>Testar de novo</Btn></div>}
          </Passo>
        </ol>
      )}

      {prov === 'ollama_local' && (
        <>
          {celular && <Aviso tipo="alerta">Você está no celular. O Ollama no computador só funciona abrindo o app <b>no próprio computador</b>. No celular, use “Ollama na nuvem”.</Aviso>}
          <ol className="space-y-3">
            <Passo n={1}>Baixe e instale o Ollama (é como instalar qualquer programa): <a className="inline-flex items-center gap-1 font-medium text-teal-700 underline" href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download <ExternalLink className="h-3 w-3" /></a>. Depois de instalar, ele fica aberto perto do relógio.</Passo>
            <Passo n={2}>Autorize este site a conversar com o Ollama. Escolha seu sistema e siga:
              <div className="mt-2 flex gap-1"><Btn variante={so === 'windows' ? 'primario' : 'secundario'} className="!py-1 text-xs" onClick={() => setSo('windows')}>Windows</Btn><Btn variante={so === 'mac' ? 'primario' : 'secundario'} className="!py-1 text-xs" onClick={() => setSo('mac')}>Mac</Btn></div>
              {so === 'windows' ? <div className="mt-2 space-y-1 text-xs">
                <p>a) Aperte as teclas <b>Windows + R</b>, digite <b>cmd</b> e aperte Enter.</p>
                <p>b) Copie a linha abaixo, cole na janela preta (botão direito do mouse) e aperte Enter:</p>
                <Copiar texto={`setx OLLAMA_ORIGINS "${ORIGEM}"`} />
                <p>c) Feche o Ollama (clique com o botão direito no ícone perto do relógio → <b>Quit</b>) e abra de novo pelo menu Iniciar.</p>
              </div> : <div className="mt-2 space-y-1 text-xs">
                <p>a) Abra o <b>Terminal</b> (Cmd + Espaço, digite “Terminal”, Enter).</p>
                <p>b) Copie a linha abaixo, cole no Terminal (Cmd + V) e aperte Enter:</p>
                <Copiar texto={`launchctl setenv OLLAMA_ORIGINS "${ORIGEM}" && osascript -e 'quit app "Ollama"' && sleep 2 && open -a Ollama`} />
              </div>}
              <p className="mt-2 text-xs text-slate-500">Se o navegador perguntar se este site pode acessar “dispositivos na rede local”, clique em <b>Permitir</b>.</p>
              <div className="mt-2"><Btn variante="secundario" onClick={testar} carregando={testando}>Testar conexão</Btn>{statusOk === true && <span className="ml-2 text-sm font-medium text-emerald-600">✅ Ollama encontrado</span>}{statusOk === false && <span className="ml-2 text-sm text-rose-600">Não encontrado ainda</span>}</div>
            </Passo>
            <Passo n={3} feito={!!modelo && modelos.includes(modelo)}>Baixe o “cérebro” da IA (uma vez só):
              <div className="mt-2 space-y-1.5">{MODELOS_LOCAIS.map(([m, d]) => (
                <div key={m} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
                  <span><b>{m}</b> · {d}</span>
                  {modelos.includes(m) ? <Btn variante={modelo === m ? 'primario' : 'secundario'} className="!py-1 text-xs" onClick={async () => { setModelo(m); await salvar({ ia_provedor: 'ollama_local', ia_ollama_modelo: m }); toast(`Usando ${m}`); }}>{modelo === m ? 'Em uso ✅' : 'Usar'}</Btn>
                    : <Btn variante="secundario" className="!py-1 text-xs" disabled={!statusOk || !!baixando} onClick={() => baixar(m)}><Download className="h-3.5 w-3.5" />Baixar</Btn>}
                </div>))}</div>
              {baixando && <div className="mt-2"><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-teal-600 transition-all" style={{ width: `${baixando.p}%` }} /></div><p className="mt-1 text-xs text-slate-500">{baixando.p}% · {baixando.s} (pode levar alguns minutos; não feche esta página)</p></div>}
            </Passo>
          </ol>
          <details className="text-xs text-slate-500"><summary className="cursor-pointer">Avançado: endereço do Ollama</summary><Input className="mt-1" value={url} onChange={(e) => setCfg({ ...cfg, ia_ollama_url: e.target.value })} onBlur={(e) => salvar({ ia_ollama_url: e.target.value })} /></details>
        </>
      )}

      {prov === 'claude' && <div className="space-y-2"><Btn variante="secundario" onClick={testar} carregando={testando}>Verificar disponibilidade</Btn>{statusOk === false && <Aviso tipo="alerta">O Claude não está ativado neste servidor. Use o Ollama (grátis) ou peça ao administrador.</Aviso>}</div>}

      {prov !== 'ollama_local' && modelos.length > 0 && prov === 'ollama_cloud' && (
        <Campo rotulo="Modelo" dica="O padrão funciona bem. Troque só se o Ollama avisar limite."><Select value={modelo} onChange={async (e) => { setModelo(e.target.value); await salvar({ ia_ollama_modelo: e.target.value }); }}>{modelos.map((m) => <option key={m} value={m}>{m}</option>)}</Select></Campo>
      )}
      {statusOk && aoConcluir && <Btn onClick={aoConcluir}>Continuar</Btn>}
    </div>
  );
}
