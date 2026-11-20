import { useState } from "react";
import { Apple, Download, Share, ShieldCheck, Smartphone, SquarePlus } from "lucide-react";
import { Modal } from "./kit";
import { cn } from "@/lib/utils";

export const APK_URL = "https://github.com/mauriciovalverde/CLAUDE/releases/download/app-android/amparo.apk";
const SITE = "familiaamparo.com.br";

const ehIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1));

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-white">{n}</span>
      <span className="pt-0.5 text-[15px] leading-relaxed text-navy">{children}</span>
    </li>
  );
}

/** Já está dentro do app (APK ou ícone na Tela de Início)? Então não mostra o botão. */
const dentroDoApp = () => typeof window !== "undefined" && (!!(window as any).Capacitor || window.matchMedia?.("(display-mode: standalone)").matches || (navigator as any).standalone === true);

/** Botão em destaque "Baixar o app" + janela com instruções para Android (APK) e iPhone (Tela de Início). */
export function BaixarApp({ className, variante = "cheio" }: { className?: string; variante?: "cheio" | "faixa" }) {
  const [aberto, setAberto] = useState(false);
  const ios = ehIOS();
  const [aba, setAba] = useState<"android" | "ios">(ios ? "ios" : "android");
  if (dentroDoApp()) return null;

  return (
    <>
      {variante === "faixa" ? (
        <button onClick={() => setAberto(true)} className={cn("flex w-full items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#00A35B,#16A34A)] px-4 py-3 text-left text-white shadow-float", className)}>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20"><Smartphone className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold">Baixe o app AMPARO</span>
            <span className="block text-xs text-white/90">Grátis · Android e iPhone</span>
          </span>
          <Download className="h-6 w-6 shrink-0" />
        </button>
      ) : (
        <button onClick={() => setAberto(true)}
          className={cn("tap relative inline-flex min-h-16 w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#00A35B,#16A34A)] px-6 font-display text-lg font-extrabold text-white shadow-float transition hover:brightness-105", className)}>
          <Download className="h-6 w-6" /> BAIXAR O APP
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold tracking-wide">GRÁTIS</span>
        </button>
      )}

      {aberto && (
        <Modal titulo="Baixar o app AMPARO" onFechar={() => setAberto(false)}>
          <div className="flex flex-col gap-4 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1" role="tablist">
              {([["android", "Android", Smartphone], ["ios", "iPhone", Apple]] as const).map(([k, l, I]) => (
                <button key={k} role="tab" aria-selected={aba === k} onClick={() => setAba(k)}
                  className={cn("tap inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold", aba === k ? "bg-card text-primary shadow-card" : "text-muted-foreground")}>
                  <I className="h-4 w-4" /> {l}
                </button>
              ))}
            </div>

            {aba === "android" ? (
              <>
                <div className="rounded-2xl border border-success/30 bg-success-soft p-4">
                  <p className="font-display text-base font-bold text-navy">Este app é para celulares <b>Android</b>.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Samsung, Motorola, Xiaomi, LG e outros. Se o seu celular é iPhone, toque na aba <b>iPhone</b> acima.</p>
                </div>
                <ol className="flex flex-col gap-3">
                  <Passo n={1}>Toque em <b>Baixar APK</b> logo abaixo e aguarde o download terminar.</Passo>
                  <Passo n={2}>Abra o arquivo <b>amparo.apk</b> (na notificação ou na pasta <b>Downloads</b>).</Passo>
                  <Passo n={3}>Se aparecer “instalação bloqueada”, toque em <b>Configurações</b> e ative <b>Permitir desta fonte</b>. Depois volte.</Passo>
                  <Passo n={4}>Toque em <b>Instalar</b>. O ícone do AMPARO aparece na tela do celular.</Passo>
                </ol>
                <a href={APK_URL} className="tap inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-success px-6 font-display text-lg font-extrabold text-white shadow-float">
                  <Download className="h-6 w-6" /> BAIXAR APK
                </a>
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  App oficial do AMPARO, distribuído direto por este site. O Android pede a confirmação porque ele ainda não está na Play Store.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-primary/30 bg-primary-soft p-4">
                  <p className="font-display text-base font-bold text-navy">No <b>iPhone</b> não precisa baixar arquivo.</p>
                  <p className="mt-1 text-sm text-muted-foreground">O arquivo APK é só para Android. No iPhone, o AMPARO vira um app na sua tela em 3 passos, pelo Safari.</p>
                </div>
                <ol className="flex flex-col gap-3">
                  <Passo n={1}>Abra <b>{SITE}</b> no <b>Safari</b> (o navegador da bússola azul).</Passo>
                  <Passo n={2}>Toque no botão <b>Compartilhar</b> <Share className="inline h-4 w-4 align-[-2px] text-primary" /> (o quadrado com a seta para cima, na barra de baixo).</Passo>
                  <Passo n={3}>Role e toque em <b>Adicionar à Tela de Início</b> <SquarePlus className="inline h-4 w-4 align-[-2px] text-primary" />, depois em <b>Adicionar</b>.</Passo>
                </ol>
                <p className="rounded-2xl bg-muted p-3 text-sm text-navy">
                  Pronto: o ícone do AMPARO fica na tela do iPhone e abre em tela cheia, como um app.
                </p>
                <button onClick={() => { const t = `Instale o app AMPARO no iPhone: abra https://${SITE} no Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".`; if (navigator.share) navigator.share({ text: t }).catch(() => {}); else window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, "_blank"); }}
                  className="tap inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 text-sm font-bold text-navy">
                  <Share className="h-4 w-4" /> Enviar estas instruções para alguém com iPhone
                </button>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
