import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/app/AppShell";
import { Aviso, Btn, Campo, inputCls } from "@/components/app/kit";
import { emailValido, urlApp } from "@/lib/br";

export const Route = createFileRoute("/recuperar")({ component: Recuperar });

function Recuperar() {
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValido(email)) return setErro("Digite um e-mail válido.");
    setErro("");
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: urlApp("/redefinir-senha") });
    setOk(true);
  }
  return (
    <div className="min-h-screen">
      <TopBar publico />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-10">
        <Link to="/entrar" className="text-sm font-semibold text-primary">← Voltar</Link>
        <h1 className="font-display text-4xl font-extrabold">Recuperar senha</h1>
        {ok ? (
          <Aviso tom="green">Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha. Veja também a caixa de spam.</Aviso>
        ) : (
          <form onSubmit={enviar} className="card-soft flex flex-col gap-4 p-6" noValidate>
            <Campo id="email" label="E-mail do cadastro" obrigatorio erro={erro}>
              <input id="email" type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Campo>
            <Btn type="submit">Enviar link</Btn>
          </form>
        )}
      </main>
    </div>
  );
}
