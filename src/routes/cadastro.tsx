import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/app/AppShell";
import { Btn, Campo, inputCls } from "@/components/app/kit";
import { digits, emailValido, fmtTel, telValido, urlApp } from "@/lib/br";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/cadastro")({
  validateSearch: (s: Record<string, unknown>) => ({ tipo: s.tipo === "profissional" ? "profissional" : undefined }) as { tipo?: "profissional" },
  component: Cadastro,
});

function Cadastro() {
  const { tipo } = Route.useSearch();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [f, setF] = useState({ nome: "", email: "", tel: "", senha: "", senha2: "" });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: k === "tel" ? fmtTel(e.target.value) : e.target.value });

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.nome.trim().length < 2) er.nome = "Informe como gostaria de ser chamada(o).";
    if (!emailValido(f.email)) er.email = "Digite um e-mail válido, por exemplo nome@email.com.";
    if (!telValido(f.tel)) er.tel = "Digite o telefone com DDD, por exemplo (73) 99999-0000.";
    if (f.senha.length < 8 || !/[a-zA-Z]/.test(f.senha) || !/\d/.test(f.senha)) er.senha = "Mínimo de 8 caracteres, com letras e números.";
    if (f.senha2 !== f.senha) er.senha2 = "As senhas não são iguais.";
    setErros(er);
    if (Object.keys(er).length) return;
    setEnviando(true);
    const destino = tipo === "profissional" ? "/sou-profissional" : "/completar-cadastro";
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim().toLowerCase(),
      password: f.senha,
      options: {
        data: { nome_chamada: f.nome.trim(), telefone: digits(f.tel) },
        emailRedirectTo: urlApp(destino),
      },
    });
    setEnviando(false);
    if (error) {
      setErros({ geral: /registered|exists/i.test(error.message) ? "Já existe uma conta com esse e-mail. Tente entrar." : "Não foi possível criar a conta: " + error.message });
      return;
    }
    if (data.session) { await refresh(); nav({ to: destino as any }); return; }
    setConfirmar(true);
  }

  if (confirmar) {
    return (
      <div className="min-h-screen">
        <TopBar publico />
        <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-14 text-center">
          <MailCheck className="h-14 w-14 text-primary" />
          <h1 className="font-display text-3xl font-extrabold">Confirme seu e-mail</h1>
          <p className="text-muted-foreground">Enviamos um link para <b className="text-navy">{f.email}</b>. Toque nele para ativar a conta e continuar o cadastro da sua família.</p>
          <p className="text-sm text-muted-foreground">Não chegou? Veja a caixa de spam ou promoções.</p>
          <Link to="/entrar" className="font-semibold text-primary">Já confirmei, quero entrar</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar publico />
      <main id="conteudo" className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold text-primary">Etapa 1 de 5 · Sua conta</p>
          <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/5 rounded-full bg-primary" /></div>
          <h1 className="mt-2 font-display text-4xl font-extrabold">{tipo === "profissional" ? "Cadastro de profissional" : "Cadastro da família"}</h1>
          <p className="text-muted-foreground">Leva cerca de 5 minutos. Depois de confirmar o e-mail, você completa os dados.</p>
        </div>
        <form onSubmit={enviar} className="card-soft flex flex-col gap-4 p-6" noValidate>
          <Campo id="nome" label="Como você gostaria de ser chamada(o)?" obrigatorio erro={erros.nome}>
            <input id="nome" className={inputCls} value={f.nome} onChange={set("nome")} autoComplete="nickname" aria-invalid={!!erros.nome} />
          </Campo>
          <Campo id="email" label="E-mail" obrigatorio erro={erros.email}>
            <input id="email" type="email" className={inputCls} value={f.email} onChange={set("email")} autoComplete="email" aria-invalid={!!erros.email} />
          </Campo>
          <Campo id="tel" label="Telefone / WhatsApp" obrigatorio dica="Com DDD." erro={erros.tel}>
            <input id="tel" type="tel" inputMode="tel" className={inputCls} value={f.tel} onChange={set("tel")} autoComplete="tel" aria-invalid={!!erros.tel} />
          </Campo>
          <Campo id="senha" label="Crie uma senha" obrigatorio dica="Mínimo de 8 caracteres, com letras e números." erro={erros.senha}>
            <input id="senha" type="password" className={inputCls} value={f.senha} onChange={set("senha")} autoComplete="new-password" aria-invalid={!!erros.senha} />
          </Campo>
          <Campo id="senha2" label="Confirme a senha" obrigatorio erro={erros.senha2}>
            <input id="senha2" type="password" className={inputCls} value={f.senha2} onChange={set("senha2")} autoComplete="new-password" aria-invalid={!!erros.senha2} />
          </Campo>
          {erros.geral && <p className="text-sm font-semibold text-emergency" role="alert">{erros.geral}</p>}
          <Btn type="submit" disabled={enviando} className="min-h-14 text-lg">{enviando ? "Criando conta…" : "Continuar"}</Btn>
          <Link to="/entrar" className="text-center text-sm font-semibold text-primary">Já tenho cadastro</Link>
        </form>
      </main>
    </div>
  );
}
