import { ReactNode, useEffect, useState } from 'react';
import { CalendarRange, CreditCard, HelpCircle, Menu, Moon, Receipt, Settings, Sparkles, Sun, X } from 'lucide-react';

const MENU = [
  { id: 'inicio', t: 'Meu ano', i: CalendarRange },
  { id: 'contas', t: 'Contas', i: Receipt },
  { id: 'cartao', t: 'Cartão', i: CreditCard },
  { id: 'sonhos', t: 'Sonhos', i: Sparkles },
  { id: 'configuracoes', t: 'Configurações', i: Settings },
  { id: 'ajuda', t: 'Ajuda', i: HelpCircle },
];
const INFERIOR = ['inicio', 'contas', 'cartao', 'sonhos'];

export default function Layout({ children, rota }: { children: ReactNode; rota: string }) {
  const [menu, setMenu] = useState(false);
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
  const alternarTema = () => { const n = !escuro; setEscuro(n); document.documentElement.classList.toggle('dark', n); try { localStorage.setItem('plan-tema', n ? 'escuro' : 'claro'); } catch { /* ignore */ } };
  useEffect(() => setMenu(false), [rota]);
  const Nav = () => (
    <nav className="space-y-0.5">{MENU.map((m) => (
      <a key={m.id} href={`#/${m.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${rota === m.id ? 'bg-teal-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><m.i className="h-4 w-4" />{m.t}</a>
    ))}</nav>
  );
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <a href="#/inicio" className="mb-4 flex items-center gap-2 px-2 py-1"><img src="./icone.svg" className="h-8 w-8" alt="" /><div className="leading-tight"><div className="text-sm font-bold">Planejador</div><div className="text-[11px] text-slate-500">Financeiro</div></div></a>
        <div className="flex-1"><Nav /></div>
        <button onClick={alternarTema} className="flex items-center gap-2 rounded-lg p-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Tema</button>
      </aside>
      {menu && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMenu(false)}>
        <div className="h-full w-72 bg-white p-3 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between px-2"><span className="font-bold">Menu</span><button onClick={() => setMenu(false)}><X className="h-5 w-5" /></button></div>
          <Nav />
          <button onClick={alternarTema} className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Tema</button>
        </div>
      </div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-5 lg:hidden">
          <button className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <span className="font-semibold">{MENU.find((m) => m.id === rota)?.t ?? 'Planejador'}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-24 pt-4 sm:px-5 lg:pb-8">{children}</main>
      </div>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:hidden">
        {MENU.filter((m) => INFERIOR.includes(m.id)).map((m) => (
          <a key={m.id} href={`#/${m.id}`} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${rota === m.id ? 'text-teal-700 dark:text-teal-400' : 'text-slate-500'}`}><m.i className="h-5 w-5" />{m.t}</a>
        ))}
        <button onClick={() => setMenu(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-slate-500"><Menu className="h-5 w-5" />Mais</button>
      </nav>
    </div>
  );
}
