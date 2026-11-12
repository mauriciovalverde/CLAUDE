import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2, Smartphone } from 'lucide-react';
import { supabase } from './lib/supabase';
import { garantirAcesso, lerAcesso, restaurarComCodigo } from './lib/acesso';
import { aoVoltarAoApp } from './lib/nativo';
import { avisarMudanca, Aviso, Btn, Campo, Textarea, Toasts } from './components/ui';
import Layout from './components/Layout';
import InstalarIPhone from './components/InstalarIPhone';

const paginas: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  inicio: lazy(() => import('./pages/Inicio')),
  contas: lazy(() => import('./pages/Contas')),
  cartao: lazy(() => import('./pages/Cartao')),
  sonhos: lazy(() => import('./pages/Sonhos')),
  configuracoes: lazy(() => import('./pages/Configuracoes')),
  ajuda: lazy(() => import('./pages/Ajuda')),
};

export function useRota() {
  const ler = () => { const [c, qs] = window.location.hash.replace(/^#\/?/, '').split('?'); return { pagina: c.split('/')[0] || 'inicio', params: new URLSearchParams(qs ?? '') }; };
  const [rota, setRota] = useState(ler);
  useEffect(() => { const h = () => setRota(ler()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return rota;
}

function Entrada() {
  const [estado, setEstado] = useState<'carregando' | 'opcoes' | 'codigo' | 'erro'>(lerAcesso() ? 'carregando' : 'opcoes');
  const [erro, setErro] = useState('');
  const [codigo, setCodigo] = useState('');
  const entrar = async () => { setEstado('carregando'); setErro(''); try { await garantirAcesso(); } catch (e: any) { setErro(e.message); setEstado('erro'); } };
  useEffect(() => { if (lerAcesso()) entrar(); }, []);
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-teal-50 p-4 dark:from-slate-950 dark:to-slate-900">
      <div className="w-full max-w-sm pb-40 text-center sm:pb-0">
        <img src="./icone.svg" className="mx-auto mb-3 h-16 w-16" alt="" />
        <h1 className="text-2xl font-bold">Planejador Financeiro</h1>
        <p className="mb-6 text-sm text-slate-500">Seu ano inteiro planejado: contas, cartão e sonhos</p>
        {estado === 'carregando' && <div className="flex items-center justify-center gap-2 text-slate-600"><Loader2 className="h-5 w-5 animate-spin text-teal-700" />Abrindo seus dados…</div>}
        {estado === 'erro' && <div className="space-y-3"><Aviso tipo="erro">{erro}</Aviso><Btn className="w-full" onClick={entrar}>Tentar de novo</Btn></div>}
        {estado === 'opcoes' && <div className="space-y-3">
          <Btn className="w-full !py-3 text-base" onClick={entrar}>Começar a usar</Btn>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200" onClick={() => setEstado('codigo')}><Smartphone className="h-4 w-4" />Troquei de celular (tenho meu código)</button>
          <p className="text-xs text-slate-500">Não precisa criar conta. Seus dados ficam protegidos e só você vê.</p>
        </div>}
        {estado === 'codigo' && <div className="space-y-3 text-left">
          <Campo rotulo="Código de transferência" dica="Está no celular antigo em Configurações (começa com GF1-)"><Textarea rows={3} value={codigo} onChange={(e) => setCodigo(e.target.value)} className="font-mono text-xs" placeholder="GF1-..." /></Campo>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Btn className="w-full" disabled={!codigo.trim()} onClick={async () => { try { await restaurarComCodigo(codigo); } catch (e: any) { setErro(e.message); } }}>Abrir meus dados</Btn>
          <p className="text-center"><button className="text-sm text-teal-700" onClick={() => { setEstado('opcoes'); setErro(''); }}>← Voltar</button></p>
        </div>}
      </div>
    </div>
  );
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const rota = useRota();
  useEffect(() => {
    try { const t = localStorage.getItem('plan-tema'); document.documentElement.classList.toggle('dark', t ? t === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches); } catch { /* ignore */ }
    aoVoltarAoApp(() => avisarMudanca());
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (sessao === undefined) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>;
  if (!sessao) return <><Toasts /><Entrada /><InstalarIPhone rodape /></>;
  const Pagina = paginas[rota.pagina] ?? paginas.inicio;
  return (
    <>
      <Toasts />
      <InstalarIPhone />
      <Layout rota={rota.pagina}>
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>}><Pagina params={rota.params} /></Suspense>
      </Layout>
    </>
  );
}
