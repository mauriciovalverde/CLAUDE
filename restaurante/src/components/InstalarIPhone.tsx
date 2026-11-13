import { useState } from 'react';
import { Share, X } from 'lucide-react';

// No iPhone, ensina a instalar o app pelo Safari ("Adicionar à Tela de Início"). Some depois de instalado.
export const ehIPhone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as any).Capacitor?.isNativePlatform?.();
const instalado = () => (navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

export default function InstalarIPhone({ rodape = false }: { rodape?: boolean }) {
  const [fechado, setFechado] = useState(() => { try { return localStorage.getItem('rest-ios-aviso') === '1'; } catch { return false; } });
  if (!ehIPhone() || instalado() || fechado) return null;
  const fechar = () => { setFechado(true); try { localStorage.setItem('rest-ios-aviso', '1'); } catch { /* ignore */ } };
  return (
    <div className={`fixed inset-x-3 ${rodape ? "bottom-3" : "bottom-20"} z-40 rounded-2xl border border-brand-200 bg-white p-4 shadow-xl dark:border-brand-900 dark:bg-slate-900`}>
      <button onClick={fechar} className="absolute right-2 top-2 rounded-lg p-1 text-slate-400" aria-label="Fechar"><X className="h-4 w-4" /></button>
      <div className="flex gap-3">
        <img src="./apple-touch-icon.png" className="h-12 w-12 rounded-xl" alt="" />
        <div className="text-sm">
          <p className="font-semibold">Instale no seu iPhone</p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">No Safari, toque em <Share className="inline h-4 w-4 align-text-bottom text-sky-600" /> <b>Compartilhar</b> e depois em <b>“Adicionar à Tela de Início”</b>. O app fica com ícone e abre em tela cheia.</p>
          <p className="mt-1 text-xs text-slate-500">Use o <b>Safari</b> (no Chrome do iPhone a opção pode não aparecer).</p>
        </div>
      </div>
    </div>
  );
}
