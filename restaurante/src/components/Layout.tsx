import { ReactNode, useEffect, useState } from 'react';
import { Home, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { MODULOS, podeVer } from '../lib/modulos';
import { sair, useEu, PAPEIS } from '../lib/sessao';
import { contadores, meusComunicados } from '../lib/comunicados';
import { AtivarNotificacoes } from '../pages/Comunicados';

export default function Layout({ children, rota }: { children: ReactNode; rota: string }) {
  const { eu, rest, pode } = useEu();
  const [menu, setMenu] = useState(false);
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains('dark'));
  const alternarTema = () => { const n = !escuro; setEscuro(n); document.documentElement.classList.toggle('dark', n); try { localStorage.setItem('rest-tema', n ? 'escuro' : 'claro'); } catch { /* ignore */ } };
  useEffect(() => setMenu(false), [rota]);
  // contador de comunicados pendentes no menu
  const [pend, setPend] = useState(0);
  useEffect(() => {
    const ler = () => meusComunicados(eu.id).then((l) => setPend(contadores(l).pendentes)).catch(() => {});
    ler(); const t = setInterval(ler, 60000); window.addEventListener('gfi:mudou', ler);
    return () => { clearInterval(t); window.removeEventListener('gfi:mudou', ler); };
  }, [eu.id]);
  const itens = MODULOS.filter((m) => podeVer(m.id, pode));
  const funcoes = eu.papeis.map((p) => PAPEIS.find((x) => x.id === p)?.nome).join(', ');
  const Nav = () => (
    <nav className="space-y-0.5">
      <a href="#/inicio" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${rota === 'inicio' ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><Home className="h-4 w-4" />Início</a>
      {itens.map((m) => (
        <a key={m.id} href={`#/${m.id}`} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${rota === m.id ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}><m.i className="h-4 w-4" />{m.t}{m.id === 'comunicados' && pend > 0 && <span className="ml-auto rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">{pend}</span>}</a>
      ))}
    </nav>
  );
  const Rodape = () => (
    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
      <div className="px-2 text-xs"><div className="font-semibold text-slate-700 dark:text-slate-200">{eu.nome}</div><div className="text-slate-500">{funcoes}</div></div>
      <div className="mt-2 flex gap-1">
        <button onClick={alternarTema} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg p-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">{escuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Tema</button>
        <button onClick={() => sair()} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg p-2 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><LogOut className="h-4 w-4" />Sair</button>
      </div>
    </div>
  );
  const titulo = rota === 'inicio' ? rest.nome : MODULOS.find((m) => m.id === rota)?.t ?? rest.nome;
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <a href="#/inicio" className="mb-3 flex items-center gap-2 px-2 py-1"><img src="./icone-192.png" className="h-9 w-9 rounded-lg" alt="" /><div className="min-w-0 leading-tight"><div className="truncate text-sm font-bold">{rest.nome}</div><div className="text-[11px] text-slate-500">Gestão inteligente</div></div></a>
        <div className="flex-1 overflow-y-auto"><Nav /></div>
        <Rodape />
      </aside>
      {menu && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMenu(false)}>
        <div className="flex h-full w-72 flex-col bg-white p-3 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between px-2"><span className="font-bold">Menu</span><button onClick={() => setMenu(false)} aria-label="Fechar"><X className="h-5 w-5" /></button></div>
          <div className="flex-1 overflow-y-auto"><Nav /></div>
          <Rodape />
        </div>
      </div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white/90 px-3 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-5 lg:hidden">
          <button className="relative rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setMenu(true)} aria-label="Menu"><Menu className="h-5 w-5" />{pend > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-600" />}</button>
          {rota !== 'inicio' && <a href="#/inicio" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Início"><Home className="h-5 w-5" /></a>}
          <span className="truncate font-semibold">{titulo}</span>
          <span className="ml-auto truncate text-xs text-slate-500">{eu.nome.split(' ')[0]}</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 pb-10 pt-4 sm:px-5">{rota === 'inicio' && <div className="mb-3"><AtivarNotificacoes compacto /></div>}{children}</main>
      </div>
    </div>
  );
}
