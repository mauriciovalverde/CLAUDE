import { ReactNode, useEffect, useState } from 'react';
import {
  Bot, LayoutDashboard, Receipt, Users, ShoppingCart, Truck, Package, HandCoins, Home, BadgeDollarSign,
  TrendingUp, FileText, Settings, HelpCircle, Menu, X, CalendarCheck, CalendarClock, CalendarX, LogOut, Moon, Sun, MessageCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { lerAcesso } from '../lib/acesso';
import { calcularPeriodo, usePeriodo } from '../lib/periodo';
import { Input, Select } from './ui';
import ChatPainel from './ChatPainel';

const MENU = [
  { id: 'chat', t: 'Central IA', i: Bot },
  { id: 'dashboard', t: 'Dashboard', i: LayoutDashboard },
  { id: 'contas', t: 'Contas', i: Receipt },
  { id: 'clientes', t: 'Clientes', i: Users },
  { id: 'vendas', t: 'Vendas', i: ShoppingCart },
  { id: 'compras', t: 'Compras', i: Truck },
  { id: 'estoque', t: 'Estoque', i: Package },
  { id: 'emprestimos', t: 'Empréstimos', i: HandCoins },
  { id: 'pessoal', t: 'Pessoal', i: Home },
  { id: 'salario', t: 'Salário PM', i: BadgeDollarSign },
  { id: 'comparativo', t: 'Comparativo', i: TrendingUp },
  { id: 'relatorios', t: 'Relatórios', i: FileText },
  { id: 'configuracoes', t: 'Configurações', i: Settings },
  { id: 'ajuda', t: 'Ajuda', i: HelpCircle },
];
const INFERIOR = ['chat', 'dashboard', 'contas', 'clientes'];

function IndicadorAgenda() {
  const [st, setSt] = useState<{ status: string; pendentes: number } | null>(null);
  useEffect(() => {
    const carregar = async () => {
      const { data: i } = await supabase.from('v_integracoes').select('status').maybeSingle();
      const { count } = await supabase.from('agenda_sync_fila').select('id', { count: 'exact', head: true }).is('processado_em', null);
      setSt({ status: i?.status ?? 'desconectado', pendentes: count ?? 0 });
    };
    carregar();
    const h = () => setTimeout(carregar, 1500);
    window.addEventListener('gfi:mudou', h);
    const t = setInterval(carregar, 60000);
    return () => { window.removeEventListener('gfi:mudou', h); clearInterval(t); };
  }, []);
  if (!st) return null;
  const ok = st.status === 'conectado' && st.pendentes === 0;
  const desconectado = st.status !== 'conectado';
  const Icone = ok ? CalendarCheck : desconectado ? CalendarX : CalendarClock;
  const txt = ok ? 'Agenda sincronizada' : desconectado ? (st.pendentes ? `Agenda desconectada · ${st.pendentes} pendentes` : 'Conectar agenda') : `${st.pendentes} pendentes`;
  return (
    <a href="#/configuracoes" title={txt} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${ok ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : desconectado ? 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
      <Icone className="h-3.5 w-3.5" /><span className="hidden sm:inline">{txt}</span>
    </a>
  );
}

function SeletorPeriodo() {
  const { periodo, setPeriodo } = usePeriodo();
  return (
    <div className="flex items-center gap-1.5">
      <Select value={periodo.tipo} onChange={(e) => e.target.value === 'personalizado' ? setPeriodo({ ...periodo, tipo: 'personalizado' }) : setPeriodo(calcularPeriodo(e.target.value))} className="!w-auto !py-1.5 text-xs">
        <option value="mes">Mês</option><option value="trimestre">Trimestre</option><option value="semestre">Semestre</option>
        <option value="ano">Ano</option><option value="12meses">12 meses</option><option value="personalizado">Personalizado</option>
      </Select>
      {periodo.tipo === 'personalizado' && <>
        <Input type="date" value={periodo.de} onChange={(e) => setPeriodo({ ...periodo, de: e.target.value })} className="!w-auto !py-1 text-xs" />
        <Input type="date" value={periodo.ate} onChange={(e) => setPeriodo({ ...periodo, ate: e.target.value })} className="!w-auto !py-1 text-xs" />
      </>}
    </div>
  );
}

export default function Layout({ children, rota, email }: { children: ReactNode; rota: string; email: string }) {
  const [menu, setMenu] = useState(false);
  const [chat, setChat] = useState(false);
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
  const alternarTema = () => { const n = !escuro; setEscuro(n); document.documentElement.classList.toggle('dark', n); try { localStorage.setItem('gfi-tema', n ? 'escuro' : 'claro'); } catch { /* ignore */ } };
  useEffect(() => { setMenu(false); }, [rota]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setChat((c) => !c); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, []);

  const Nav = () => (
    <nav className="space-y-0.5">
      {MENU.map((m) => (
        <a key={m.id} href={`#/${m.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${rota === m.id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
          <m.i className="h-4 w-4" />{m.t}
        </a>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <a href="#/chat" className="mb-4 flex items-center gap-2 px-2 py-1"><img src="./icone.svg" className="h-8 w-8" alt="" /><div className="leading-tight"><div className="text-sm font-bold">Gestor Financeiro</div><div className="text-[11px] text-slate-500">Inteligente</div></div></a>
        <div className="flex-1 overflow-y-auto"><Nav /></div>
        <div className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-800">
          <div className="truncate px-2">{lerAcesso() ? 'Neste celular' : email}</div>
          <div className="mt-1 flex gap-1"><button onClick={alternarTema} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Tema">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
            {!lerAcesso() && <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-1 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut className="h-4 w-4" />Sair</button>}</div>
        </div>
      </aside>

      {menu && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMenu(false)}>
        <div className="h-full w-72 overflow-y-auto bg-white p-3 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between px-2"><span className="font-bold">Menu</span><button onClick={() => setMenu(false)}><X className="h-5 w-5" /></button></div>
          <Nav />
          <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <button onClick={alternarTema} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Tema</button>
            {!lerAcesso() && <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut className="h-4 w-4" />Sair</button>}
          </div>
        </div>
      </div>}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-5">
          <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold lg:hidden">{MENU.find((m) => m.id === rota)?.t ?? 'Gestor'}</span>
          <div className="ml-auto flex items-center gap-2">{rota !== 'chat' && <SeletorPeriodo />}<IndicadorAgenda /></div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-3 pb-24 pt-4 sm:px-5 lg:pb-8">{children}</main>
      </div>

      {rota !== 'chat' && <>
        <button onClick={() => setChat(true)} className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-teal-700 text-white shadow-lg hover:bg-teal-800 lg:bottom-6" aria-label="Abrir chat da IA" title="Chat da IA (Ctrl+K)">
          <MessageCircle className="h-6 w-6" />
        </button>
        {chat && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onClick={() => setChat(false)}>
          <div className="flex h-full w-full flex-col bg-slate-50 shadow-xl dark:bg-slate-950 sm:max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"><span className="flex items-center gap-2 font-semibold"><Bot className="h-5 w-5 text-teal-700" />Central IA</span><button onClick={() => setChat(false)}><X className="h-5 w-5" /></button></div>
            <ChatPainel compacto />
          </div>
        </div>}
      </>}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {MENU.filter((m) => INFERIOR.includes(m.id)).map((m) => (
          <a key={m.id} href={`#/${m.id}`} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${rota === m.id ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}`}><m.i className="h-5 w-5" />{m.t}</a>
        ))}
        <button onClick={() => setMenu(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><Menu className="h-5 w-5" />Mais</button>
      </nav>
    </div>
  );
}
