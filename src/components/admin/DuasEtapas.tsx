import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Btn, Card, Chip, inputCls } from "@/components/app/kit";

/** Precisa digitar o código do aplicativo autenticador nesta sessão? */
export async function precisaSegundaEtapa() {
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  } catch { return false; } // sem 2 etapas configurada; o banco continua exigindo aal2 de quem cadastrou
}

/** Tela de código de 6 dígitos (login e painel administrativo). */
export function DesafioDuasEtapas({ onOk, onSair }: { onOk: () => void; onSair?: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { data: f } = await supabase.auth.mfa.listFactors();
    const fator = f?.totp?.find((x) => x.status === "verified");
    if (!fator) { setEnviando(false); return onOk(); }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() });
    setEnviando(false);
    if (error) return toast.error("Código inválido ou expirado. Confira no aplicativo autenticador.");
    onOk();
  }
  return (
    <form onSubmit={verificar} className="card-soft mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <KeyRound className="h-10 w-10 text-primary" />
      <h2 className="font-display text-2xl font-extrabold">Verificação em duas etapas</h2>
      <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador (Google Authenticator, Microsoft Authenticator etc.).</p>
      <input className={inputCls + " text-center font-mono text-2xl tracking-[0.4em]"} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} aria-label="Código de 6 dígitos" autoFocus />
      <Btn type="submit" disabled={codigo.length !== 6 || enviando} className="min-h-14 text-lg">{enviando ? "Verificando…" : "Verificar"}</Btn>
      {onSair && <button type="button" onClick={onSair} className="text-sm font-semibold text-primary">Sair</button>}
    </form>
  );
}

/** Cartão de configuração da verificação em duas etapas para administradores. */
export function DuasEtapas() {
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [cadastro, setCadastro] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  async function carregar() {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) return setAtivo(false);
    setAtivo(!!data?.totp?.some((x) => x.status === "verified"));
  }
  useEffect(() => { carregar(); }, []);
  async function iniciar() {
    const { data: f } = await supabase.auth.mfa.listFactors();
    for (const x of f?.all ?? []) if (x.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: x.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "AMPARO" });
    if (error || !data) return toast.error("A verificação em duas etapas não está habilitada no servidor de autenticação: " + (error?.message ?? ""));
    setCadastro({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }
  async function confirmar() {
    if (!cadastro) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: cadastro.id, code: codigo.trim() });
    if (error) return toast.error("Código inválido. Tente o próximo código do aplicativo.");
    toast.success("Verificação em duas etapas ativada."); setCadastro(null); setCodigo(""); carregar();
  }
  return (
    <Card className="mb-4 flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> Verificação em duas etapas {ativo != null && <Chip tom={ativo ? "green" : "amber"}>{ativo ? "Ativa" : "Desligada"}</Chip>}</h2>
      <p className="text-sm text-muted-foreground">Com ela ativa, dados pessoais completos, LGPD, logs, notificações e acesso clínico só abrem depois do código do aplicativo autenticador. Recomendado para toda a administração.</p>
      {!ativo && !cadastro && <Btn onClick={iniciar} className="self-start">Ativar agora</Btn>}
      {cadastro && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm">1. Abra o Google Authenticator (ou outro) e leia o QR Code:</p>
          <img src={cadastro.qr} alt="QR Code da verificação em duas etapas" className="h-48 w-48 rounded-xl border bg-white p-2" />
          <p className="text-xs text-muted-foreground">Sem câmera? Digite a chave: <span className="font-mono">{cadastro.secret}</span></p>
          <p className="text-sm">2. Digite o código de 6 dígitos que aparece:</p>
          <div className="flex gap-2"><input className={inputCls + " w-40 text-center font-mono text-xl"} inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} aria-label="Código" /><Btn onClick={confirmar} disabled={codigo.length !== 6}>Confirmar</Btn></div>
        </div>
      )}
    </Card>
  );
}
