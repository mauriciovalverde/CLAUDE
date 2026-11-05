import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Info, X, type LucideIcon } from "lucide-react";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 font-display font-extrabold text-navy">
      <svg viewBox="0 0 24 24" className="h-8 w-8 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-7.5-10.4A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.4-7.5 10.4z" />
        <path d="M9 12.5c1.6 1.6 4.4 1.6 6 0" className="text-coral" stroke="var(--color-coral)" />
      </svg>
      {!compact && (
        <span className="text-lg leading-none">
          Centro de <span className="text-primary">Acolhimento</span>
        </span>
      )}
    </span>
  );
}

export const btn = {
  base: "tap inline-flex items-center justify-center gap-2 rounded-full px-5 font-semibold transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-float",
  soft: "bg-primary-soft text-primary hover:bg-primary-soft/80",
  outline: "border border-border bg-card text-navy hover:border-primary",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "bg-emergency text-emergency-foreground hover:bg-emergency/90",
  wa: "bg-success text-success-foreground hover:bg-success/90",
};
export function Btn({ v = "primary", className, ...p }: ComponentProps<"button"> & { v?: keyof typeof btn }) {
  return <button className={cn(btn.base, btn[v], className)} {...p} />;
}

export function PageHeader({ title, highlight, subtitle, back, right }: { title: string; highlight?: string; subtitle?: string; back?: { to: string; label?: string }; right?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-col gap-2">
      {back && (
        <Link to={back.to} className="tap -ml-2 inline-flex w-fit items-center gap-1 rounded-full px-2 text-sm font-semibold text-primary">
          ← {back.label ?? "Voltar"}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-[1.9rem] font-extrabold leading-tight sm:text-4xl">
          {title} {highlight && <span className="text-primary">{highlight}</span>}
        </h1>
        {right}
      </div>
      {subtitle && <p className="max-w-2xl text-muted-foreground">{subtitle}</p>}
    </header>
  );
}

const TONS: Record<string, string> = {
  blue: "bg-primary-soft text-primary", coral: "bg-coral-soft text-coral", green: "bg-success-soft text-success",
  red: "bg-emergency-soft text-emergency", amber: "bg-warning-soft text-warning", navy: "bg-secondary text-navy",
};
export function IconBox({ icon: I, tom = "blue", size = "md" }: { icon: LucideIcon; tom?: string; size?: "md" | "lg" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl", TONS[tom], size === "lg" ? "h-14 w-14" : "h-12 w-12")}>
      <I className={size === "lg" ? "h-7 w-7" : "h-6 w-6"} aria-hidden="true" />
    </span>
  );
}

export function CardLink({ to, params, icon, tom, title, subtitle, onClick }: { to?: string; params?: Record<string, string>; icon: LucideIcon; tom?: string; title: string; subtitle?: string; onClick?: () => void }) {
  const inner = (
    <>
      <IconBox icon={icon} tom={tom} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block font-display text-[1.02rem] font-bold text-navy">{title}</span>
        {subtitle && <span className="block text-sm text-muted-foreground">{subtitle}</span>}
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );
  const cls = "card-soft flex w-full items-center gap-4 p-4 transition hover:border-primary";
  if (to) return <Link to={to as any} params={params as any} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div className={cn("card-soft p-5", className)} {...p} />;
}

export function Chip({ children, tom = "navy", className }: { children: ReactNode; tom?: string; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", TONS[tom], className)}>{children}</span>;
}

export function Verificado() {
  return <BadgeCheck className="inline h-5 w-5 fill-primary text-white" aria-label="Verificado pela equipe" />;
}

export function Aviso({ children, tom = "navy" }: { children: ReactNode; tom?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl p-4 text-sm", TONS[tom])}>
      <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="text-foreground">{children}</div>
    </div>
  );
}

export function Vazio({ icon: I, titulo, texto, children }: { icon: LucideIcon; titulo: string; texto?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-border px-6 py-10 text-center">
      <I className="h-9 w-9 text-primary" aria-hidden="true" />
      <h3 className="font-display text-lg font-bold">{titulo}</h3>
      {texto && <p className="max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {children}
    </div>
  );
}

export function Campo({ id, label, obrigatorio, dica, erro, children }: { id: string; label: string; obrigatorio?: boolean; dica?: string; erro?: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-navy">
        {label}{obrigatorio ? <span className="text-emergency"> *</span> : <span className="font-normal text-muted-foreground"> (opcional)</span>}
      </label>
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
      {children}
      {erro && <span className="text-sm font-semibold text-emergency" role="alert">{erro}</span>}
    </div>
  );
}
export const inputCls = "tap w-full rounded-xl border border-input bg-card px-4 text-base text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-emergency";
export const textareaCls = "min-h-28 w-full rounded-xl border border-input bg-card p-4 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";

export function Opcoes({ valores, valor, onChange, multi = false, nome }: { valores: string[]; valor: string | string[]; onChange: (v: any) => void; multi?: boolean; nome: string }) {
  const sel = (o: string) => (multi ? (valor as string[]).includes(o) : valor === o);
  return (
    <div className="flex flex-wrap gap-2" role={multi ? "group" : "radiogroup"} aria-label={nome}>
      {valores.map((o) => (
        <button key={o} type="button" role={multi ? "checkbox" : "radio"} aria-checked={sel(o)}
          onClick={() => multi ? onChange(sel(o) ? (valor as string[]).filter((x) => x !== o) : [...(valor as string[]), o]) : onChange(sel(o) ? "" : o)}
          className={cn("tap rounded-full border px-4 text-sm font-semibold transition", sel(o) ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-navy hover:border-primary")}>
          {sel(o) && "✓ "}{o}
        </button>
      ))}
    </div>
  );
}

export function Carregando() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}
    </div>
  );
}

/** Janela sobreposta: folha de baixo no celular, caixa central no computador. Fecha com X, Esc ou toque fora. */
export function Modal({ titulo, onFechar, children, largura = "max-w-xl" }: { titulo: ReactNode; onFechar: () => void; children: ReactNode; largura?: string }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = o; };
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onFechar} role="dialog" aria-modal="true">
      <div className={cn("flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-card shadow-2xl sm:rounded-3xl", largura)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1 font-display text-xl font-bold text-navy">{titulo}</div>
          <button onClick={onFechar} className="tap grid min-w-12 place-items-center rounded-full bg-muted" aria-label="Fechar"><X className="h-5 w-5" /></button>
        </div>
        <div className="overflow-y-auto p-5" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}
