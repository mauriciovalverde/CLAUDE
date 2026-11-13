import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Delete, Loader2, Store, UserRound } from 'lucide-react';
import { supabase } from './lib/supabase';
import { buscarEquipe, carregarContexto, criarRestaurante, Ctx, entrar, guardarAparelho, lerAparelho, sair, type Eu, type Papel, type Restaurante } from './lib/sessao';
import { podeVer } from './lib/modulos';
import { aoVoltarAoApp } from './lib/nativo';
import { avisarMudanca, Aviso, Btn, Campo, Input, Toasts } from './components/ui';
import Layout from './components/Layout';
import InstalarIPhone from './components/InstalarIPhone';

const paginas: Record<string, React.LazyExoticComponent<React.ComponentType<any>>> = {
  inicio: lazy(() => import('./pages/Inicio')),
  pedir: lazy(() => import('./pages/Pedir')),
  solicitacoes: lazy(() => import('./pages/Solicitacoes')),
  compras: lazy(() => import('./pages/Compras')),
  notas: lazy(() => import('./pages/Notas')),
  fornecedores: lazy(() => import('./pages/Fornecedores')),
  estoque: lazy(() => import('./pages/Estoque')),
  fechamento: lazy(() => import('./pages/Fechamento')),
  vendas: lazy(() => import('./pages/Vendas')),
  financeiro: lazy(() => import('./pages/Financeiro')),
  dashboard: lazy(() => import('./pages/Dashboard')),
  comparativo: lazy(() => import('./pages/Comparativo')),
  relatorios: lazy(() => import('./pages/Relatorios')),
  ia: lazy(() => import('./pages/CentralIA')),
  equipe: lazy(() => import('./pages/Equipe')),
  configuracoes: lazy(() => import('./pages/Configuracoes')),
  ajuda: lazy(() => import('./pages/Ajuda')),
  'meu-ponto': lazy(() => import('./pages/MeuPonto')),
  ponto: lazy(() => import('./pages/Ponto')),
};

export function useRota() {
  const ler = () => { const [c, qs] = window.location.hash.replace(/^#\/?/, '').split('?'); return { pagina: c.split('/')[0] || 'inicio', params: new URLSearchParams(qs ?? '') }; };
  const [rota, setRota] = useState(ler);
  useEffect(() => { const h = () => setRota(ler()); window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h); }, []);
  return rota;
}

function Fundo({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-gradient-to-br from-[#F9B04A] via-[#F79F31] to-[#EE8A1C] p-4">
      {/* bolhas de luz ao fundo */}
      <div aria-hidden className="anim-bolha pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
      <div aria-hidden className="anim-bolha pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-[#A3141B]/15 blur-2xl" style={{ animationDelay: '-6s' }} />
      <div aria-hidden className="anim-bolha pointer-events-none absolute right-10 top-1/4 h-32 w-32 rounded-full bg-white/15 blur-xl" style={{ animationDelay: '-3s' }} />
      <div className="anim-surgir relative w-full max-w-sm rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur dark:bg-slate-900/95">
        <div className="relative mx-auto -mt-16 mb-3 h-28 w-28">
          {/* vapor saindo do prato */}
          <span aria-hidden className="anim-vapor absolute -top-3 left-9 h-6 w-1.5 rounded-full bg-white/80" />
          <span aria-hidden className="anim-vapor absolute -top-4 left-[3.3rem] h-7 w-1.5 rounded-full bg-white/80" style={{ animationDelay: '.8s' }} />
          <span aria-hidden className="anim-vapor absolute -top-3 left-[4.3rem] h-6 w-1.5 rounded-full bg-white/80" style={{ animationDelay: '1.6s' }} />
          <img src="./logo.jpg" alt="Cantinho do Sabor" className="anim-logo h-28 w-28 rounded-3xl object-cover shadow-lg ring-4 ring-white" />
        </div>
        {children}
      </div>
    </div>
  );
}

/** Teclado numérico grande para o PIN. */
function TecladoPin({ aoConfirmar, carregando }: { aoConfirmar: (pin: string) => void; carregando: boolean }) {
  const [pin, setPin] = useState('');
  const tecla = (d: string) => setPin((p) => (p.length < 6 ? p + d : p));
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (/^\d$/.test(e.key)) tecla(e.key); if (e.key === 'Backspace') setPin((p) => p.slice(0, -1)); if (e.key === 'Enter' && pin.length >= 4) aoConfirmar(pin); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [pin, aoConfirmar]);
  return (
    <div>
      <div className="mb-4 flex justify-center gap-2" aria-label="PIN digitado">{Array.from({ length: Math.max(4, pin.length) }).map((_, i) => <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-brand-700' : 'bg-slate-200 dark:bg-slate-700'}`} />)}</div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} onClick={() => tecla(d)} className="rounded-2xl bg-slate-100 py-4 text-2xl font-semibold active:bg-slate-200 dark:bg-slate-800">{d}</button>)}
        <button onClick={() => setPin((p) => p.slice(0, -1))} className="flex items-center justify-center rounded-2xl py-4 text-slate-500" aria-label="Apagar"><Delete className="h-6 w-6" /></button>
        <button onClick={() => tecla('0')} className="rounded-2xl bg-slate-100 py-4 text-2xl font-semibold active:bg-slate-200 dark:bg-slate-800">0</button>
        <button disabled={pin.length < 4 || carregando} onClick={() => aoConfirmar(pin)} className="flex items-center justify-center rounded-2xl bg-brand-700 py-4 text-lg font-semibold text-white disabled:opacity-40">{carregando ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Entrar'}</button>
      </div>
    </div>
  );
}

function Entrada() {
  const ap = lerAparelho();
  const [tela, setTela] = useState<'equipe' | 'pin' | 'codigo' | 'criar' | 'inicio'>(ap ? 'equipe' : 'inicio');
  const [codigo, setCodigo] = useState(ap?.codigo ?? '');
  const [equipe, setEquipe] = useState<{ restaurante: { nome: string }; equipe: { id: string; nome: string }[] } | null>(null);
  const [quem, setQuem] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [f, setF] = useState({ nome: 'Cantinho do Sabor', adminNome: '', pin: '', pin2: '' });

  const abrirEquipe = useCallback(async (cod: string) => {
    setCarregando(true); setErro('');
    try { const r = await buscarEquipe(cod); setEquipe(r); guardarAparelho({ codigo: r.restaurante.codigo, nome: r.restaurante.nome, ultimo: lerAparelho()?.ultimo }); setTela('equipe'); }
    catch (e: any) { setErro(e.message); if (!lerAparelho()) setTela('codigo'); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { if (ap) abrirEquipe(ap.codigo); }, []);

  const confirmarPin = useCallback(async (pin: string) => {
    if (!quem) return;
    setCarregando(true); setErro('');
    try { await entrar(codigo || lerAparelho()!.codigo, quem.id, pin); guardarAparelho({ ...lerAparelho()!, ultimo: quem.id }); }
    catch (e: any) { setErro(e.message); setCarregando(false); }
  }, [quem, codigo]);

  if (tela === 'inicio') {
    const h = new Date().getHours();
    return (
      <Fundo>
        <p className="anim-surgir text-center text-sm font-medium text-brand-700" style={{ animationDelay: '.15s' }}>{h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}! 👋</p>
        <h1 className="anim-surgir mt-1 text-center text-2xl font-bold" style={{ animationDelay: '.25s' }}>Bem-vindo ao seu restaurante</h1>
        <p className="anim-surgir mb-6 mt-1 text-center text-sm text-slate-500" style={{ animationDelay: '.35s' }}>Compras, estoque, caixa e financeiro num só lugar, simples como deve ser.</p>
        <div className="space-y-2">
          <div className="anim-surgir" style={{ animationDelay: '.5s' }}><Btn className="w-full !rounded-2xl !py-3.5 text-base shadow-md shadow-brand-700/20 transition active:scale-[.98]" onClick={() => { setTela('codigo'); setErro(''); }}><UserRound className="h-5 w-5" />Entrar na equipe</Btn></div>
          <div className="anim-surgir" style={{ animationDelay: '.62s' }}><Btn variante="secundario" className="w-full !rounded-2xl !py-3.5 transition active:scale-[.98]" onClick={() => { setTela('criar'); setErro(''); }}><Store className="h-5 w-5" />Cadastrar meu restaurante</Btn></div>
        </div>
        <p className="anim-surgir mt-5 text-center text-xs text-slate-400" style={{ animationDelay: '.75s' }}>Já tem o código? Peça ao responsável e entre com o seu PIN.</p>
      </Fundo>
    );
  }

  if (tela === 'codigo') return (
    <Fundo>
      <h1 className="mb-1 text-center text-lg font-bold">Código do restaurante</h1>
      <p className="mb-4 text-center text-sm text-slate-500">Peça ao responsável. Exemplo: SABOR-7K3P</p>
      <Input autoFocus value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="CÓDIGO" className="text-center font-mono text-lg tracking-widest" onKeyDown={(e) => e.key === 'Enter' && codigo.trim() && abrirEquipe(codigo)} />
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <Btn className="mt-3 w-full !py-3" carregando={carregando} disabled={codigo.trim().length < 4} onClick={() => abrirEquipe(codigo)}>Continuar</Btn>
      <button className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-slate-500" onClick={() => setTela('inicio')}><ArrowLeft className="h-4 w-4" />Voltar</button>
    </Fundo>
  );

  if (tela === 'criar') return (
    <Fundo>
      <h1 className="mb-3 text-center text-lg font-bold">Cadastrar restaurante</h1>
      <div className="space-y-3">
        <Campo rotulo="Nome do restaurante"><Input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Campo>
        <Campo rotulo="Seu nome (administrador)"><Input value={f.adminNome} onChange={(e) => setF({ ...f, adminNome: e.target.value })} placeholder="Ex.: Maurício" /></Campo>
        <div className="grid grid-cols-2 gap-2">
          <Campo rotulo="Crie um PIN" dica="4 a 6 números"><Input type="password" inputMode="numeric" maxLength={6} value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, '') })} /></Campo>
          <Campo rotulo="Repita o PIN"><Input type="password" inputMode="numeric" maxLength={6} value={f.pin2} onChange={(e) => setF({ ...f, pin2: e.target.value.replace(/\D/g, '') })} /></Campo>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <Btn className="w-full !py-3" carregando={carregando} disabled={f.nome.trim().length < 2 || f.adminNome.trim().length < 2 || f.pin.length < 4}
          onClick={async () => {
            if (f.pin !== f.pin2) { setErro('Os dois PINs estão diferentes.'); return; }
            setCarregando(true); setErro('');
            try { await criarRestaurante(f.nome.trim(), f.adminNome.trim(), f.pin); } catch (e: any) { setErro(e.message); setCarregando(false); }
          }}>Criar e entrar</Btn>
        <button className="flex w-full items-center justify-center gap-1 text-sm text-slate-500" onClick={() => setTela('inicio')}><ArrowLeft className="h-4 w-4" />Voltar</button>
      </div>
    </Fundo>
  );

  if (tela === 'pin' && quem) return (
    <Fundo>
      <p className="text-center text-sm text-slate-500">{equipe?.restaurante.nome}</p>
      <h1 className="mb-4 text-center text-xl font-bold">Olá, {quem.nome.split(' ')[0]}! Digite seu PIN</h1>
      <TecladoPin aoConfirmar={confirmarPin} carregando={carregando} />
      {erro && <div className="mt-3"><Aviso tipo="erro">{erro}</Aviso></div>}
      <button className="mt-3 flex w-full items-center justify-center gap-1 text-sm text-slate-500" onClick={() => { setTela('equipe'); setErro(''); }}><ArrowLeft className="h-4 w-4" />Não sou {quem.nome.split(' ')[0]}</button>
    </Fundo>
  );

  // tela 'equipe': quem vai usar agora?
  const ultimo = lerAparelho()?.ultimo;
  const lista = [...(equipe?.equipe ?? [])].sort((a, b) => (a.id === ultimo ? -1 : b.id === ultimo ? 1 : 0));
  return (
    <Fundo>
      <h1 className="text-center text-lg font-bold">{equipe?.restaurante.nome ?? lerAparelho()?.nome}</h1>
      <p className="mb-4 text-center text-sm text-slate-500">Toque no seu nome</p>
      {carregando && !equipe && <div className="flex justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-brand-700" /></div>}
      {erro && !equipe && <div className="space-y-2"><Aviso tipo="erro">{erro}</Aviso><Btn className="w-full" onClick={() => abrirEquipe(codigo)}>Tentar de novo</Btn></div>}
      <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto">
        {lista.map((p) => <button key={p.id} onClick={() => { setQuem(p); setTela('pin'); setErro(''); }} className={`rounded-2xl border p-3 text-left text-sm font-semibold active:scale-[.98] ${p.id === ultimo ? 'border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/40' : 'border-slate-200 dark:border-slate-700'}`}><UserRound className="mb-1 h-5 w-5 text-brand-700" />{p.nome}</button>)}
      </div>
      <button className="mt-4 w-full text-center text-xs text-slate-500" onClick={() => { guardarAparelho(null); setEquipe(null); setCodigo(''); setTela('inicio'); }}>Usar outro restaurante neste aparelho</button>
    </Fundo>
  );
}

export default function App() {
  const [sessao, setSessao] = useState<Session | null | undefined>(undefined);
  const [ctx, setCtx] = useState<{ eu: Eu; rest: Restaurante } | null | undefined>(undefined);
  const rota = useRota();
  const recarregar = useCallback(() => { carregarContexto().then(setCtx).catch(() => setCtx(null)); }, []);
  useEffect(() => {
    try { const t = localStorage.getItem('rest-tema'); document.documentElement.classList.toggle('dark', t === 'escuro'); } catch { /* ignore */ }
    aoVoltarAoApp(() => avisarMudanca());
    supabase.auth.getSession().then(({ data }) => setSessao(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => { setSessao(s); if (ev === 'SIGNED_OUT') setCtx(undefined); });
    return () => sub.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (sessao) recarregar(); }, [sessao?.user.id]);
  // sai sozinho após 12 h sem uso (aparelho compartilhado da equipe)
  useEffect(() => {
    const k = 'rest-ultimo-uso';
    try { const u = Number(localStorage.getItem(k) ?? 0); if (sessao && u && Date.now() - u > 12 * 3600_000) sair(); localStorage.setItem(k, String(Date.now())); } catch { /* ignore */ }
  }, [sessao, rota.pagina]);

  const carregandoTela = <div className="flex h-screen items-center justify-center bg-[#F79F31]"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>;
  if (sessao === undefined) return carregandoTela;
  if (!sessao) return <><Toasts /><Entrada /><InstalarIPhone rodape /></>;
  if (ctx === undefined) return carregandoTela;
  if (ctx === null) return (
    <div className="flex min-h-screen items-center justify-center p-4"><div className="max-w-sm space-y-3 text-center"><Aviso tipo="erro">Seu acesso foi desativado ou não foi encontrado. Fale com o responsável pelo restaurante.</Aviso><Btn onClick={() => sair()}>Voltar</Btn></div></div>
  );
  const pode = (p: Papel) => ctx.eu.papeis.includes('admin') || ctx.eu.papeis.includes(p);
  const id = podeVer(rota.pagina, pode) && paginas[rota.pagina] ? rota.pagina : 'inicio';
  const Pagina = paginas[id];
  return (
    <Ctx.Provider value={{ ...ctx, pode, recarregar }}>
      <Toasts />
      <InstalarIPhone />
      <Layout rota={id}>
        <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-brand-700" /></div>}><Pagina params={rota.params} /></Suspense>
      </Layout>
    </Ctx.Provider>
  );
}
