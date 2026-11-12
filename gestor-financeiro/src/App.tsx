import { lazy, Suspense, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';
import { supabase, sincronizarAgenda } from './lib/supabase';
import { PeriodoProvider } from './lib/periodo';
import { Toasts } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding from './components/Onboarding';
import { aoVoltarAoApp } from './lib/nativo';
import { avisarMudanca } from './components/ui';

const paginas: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  chat: lazy(() => import('./pages/Chat')),
  dashboard: lazy(() => import('./pages/Dashboard')),
  contas: lazy(() => import('./pages/Contas')),
  clientes: lazy(() => import('./pages/Clientes')),
  vendas: lazy(() => import('./pages/Vendas')),
  compras: lazy(() => import('./pages/Compras')),
  estoque: lazy(() => import('./pages/Estoque')),
  emprestimos: lazy(() => import('./pages/Emprestimos')),
  pessoal: lazy(() => import('./pages/Pessoal')),
  salario: lazy(() => import('./pages/Salario')),
  comparativo: lazy(() => import('./pages/Comparativo')),
  relatorios: lazy(() => import('./pages/Relatorios')),
  configuracoes: lazy(() => import('./pages/Configuracoes')),
  ajuda: lazy(() => import('./pages/Ajuda')),
};

export function useRota() {
  const ler = () => {
    const h = window.location.hash.replace(/^#\/?/, '');
    const [caminho, qs] = h.split('?');
    const [pagina, id] = caminho.split('/');
    return { pagina: pagina || 'chat', id, params: new URLSearchParams(qs ?? '') };
  };
  const [rota, setRota] = useState(ler);
  useEffect(() => { const h = () => setRota(ler()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return rota;
}
export const ir = (caminho: string) => { window.location.hash = '/' + caminho; };

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const rota = useRota();
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    try {
      const t = localStorage.getItem('gfi-tema');
      const escuro = t ? t === 'escuro' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', escuro);
    } catch { /* ignore */ }
    aoVoltarAoApp(() => avisarMudanca());
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSessao(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessao) return;
    supabase.rpc('inicializar_usuario').then(async () => {
      const { data } = await supabase.from('configuracoes').select('onboarding_concluido').maybeSingle();
      setOnboarding(data ? !data.onboarding_concluido : false);
      sincronizarAgenda();
    });
  }, [sessao?.user.id]);

  // Retorno do Google quando a conexão foi iniciada pelo aplicativo Android (abre no navegador do celular)
  if (rota.pagina === 'conectado') return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center"><div><img src="./icone.svg" className="mx-auto mb-4 h-14 w-14" alt="" />
      <h1 className="text-xl font-bold">{rota.params.get('google') === 'conectado' ? '✅ Conta Google conectada!' : '❌ Não foi possível conectar'}</h1>
      <p className="mt-2 text-slate-600">{rota.params.get('google') === 'conectado' ? 'Pode fechar esta página e voltar para o aplicativo Gestor Financeiro.' : 'Volte ao aplicativo e tente de novo em Configurações.'}</p></div></div>
  );
  if (sessao === undefined) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>;
  if (!sessao) return <><Toasts /><Login /></>;

  const Pagina = paginas[rota.pagina] ?? paginas.chat;
  return (
    <PeriodoProvider>
      <Toasts />
      {onboarding && <Onboarding aoTerminar={() => { setOnboarding(false); window.location.hash = '/chat'; }} />}
      <Layout rota={rota.pagina} email={sessao.user.email ?? ''}>
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-teal-700" /></div>}>
          <Pagina id={rota.id} params={rota.params} />
        </Suspense>
      </Layout>
    </PeriodoProvider>
  );
}
