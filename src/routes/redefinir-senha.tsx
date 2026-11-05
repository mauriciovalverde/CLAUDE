import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/app/AppShell";
import { Btn, Campo, inputCls } from "@/components/app/kit";

export const Route = createFileRoute("/redefinir-senha")({ component: Redefinir });

function Redefinir() {
  const nav = useNavigate();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8 || !/[a-zA-Z]/.test(senha) || !/\d/.test(senha)) return setErro("Mínimo de 8 caracteres, com letras e números.");
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) return setErro("O link expirou ou é inválido. Peça um novo em “Esqueci minha senha”.");
    toast.success("Senha alterada.");
    nav({ to: "/inicio" });
  }
  return (
    <div className="min-h-screen">
      <TopBar publico />
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-10">
        <h1 className="font-display text-4xl font-extrabold">Nova senha</h1>
        <form onSubmit={salvar} className="card-soft flex flex-col gap-4 p-6" noValidate>
          <Campo id="senha" label="Nova senha" obrigatorio erro={erro}>
            <input id="senha" type="password" className={inputCls} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          </Campo>
          <Btn type="submit">Salvar nova senha</Btn>
        </form>
      </main>
    </div>
  );
}
