import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/app/AppShell";
import { Btn, Campo, inputCls } from "@/components/app/kit";
import { emailValido } from "@/lib/br";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/entrar")({
  validateSearch: (s: Record<string, unknown>) => ({ volta: typeof s.volta === "string" ? s.volta : undefined }) as { volta?: string },
  component: Entrar,
});

function Entrar() {
  const { volta } = Route.useSearch();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!emailValido(email)) return setErro("Digite um e-mail válido.");
    if (!senha) return setErro("Digite sua senha.");
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
    setEnviando(false);
    if (error) {
      setErro(/confirm/i.test(error.message) ? "Confirme seu e-mail antes de entrar. Veja a mensagem que enviamos para sua caixa de entrada." : "E-mail ou senha não conferem. Confira e tente de novo.");
      return;
    }
    await refresh();
    toast.success("Que bom ter você de volta!");
    nav({ to: (volta && volta.startsWith("/") ? volta : "/inicio") as any });
  }

  return (
    <div className="min-h-screen">
      <TopBar publico />
      <main id="conteudo" className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="font-display text-4xl font-extrabold">Entrar</h1>
          <p className="mt-1 text-muted-foreground">Que bom ter você de volta.</p>
        </div>
        <form onSubmit={entrar} className="card-soft flex flex-col gap-4 p-6" noValidate>
          <Campo id="email" label="E-mail" obrigatorio>
            <input id="email" type="email" autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
          <Campo id="senha" label="Senha" obrigatorio>
            <input id="senha" type="password" autoComplete="current-password" className={inputCls} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </Campo>
          {erro && <p className="text-sm font-semibold text-emergency" role="alert">{erro}</p>}
          <Btn type="submit" disabled={enviando} className="min-h-14 text-lg">{enviando ? "Entrando…" : "Entrar"}</Btn>
          <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold">
            <Link to="/recuperar" className="text-primary">Esqueci minha senha</Link>
            <Link to="/cadastro" className="text-primary">Fazer cadastro</Link>
          </div>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          É profissional da saúde ou educação? <Link to="/cadastro" search={{ tipo: "profissional" } as any} className="font-semibold text-primary">Cadastre seu perfil</Link>
        </p>
      </main>
    </div>
  );
}
