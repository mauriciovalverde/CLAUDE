import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/app/AppShell";
import { TERMOS_VERSAO } from "@/lib/br";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de privacidade · Centro de Acolhimento à Família Atípica" }] }),
  component: Privacidade,
});

const SECOES: [string, string[]][] = [
  ["Quem cuida dos seus dados", ["O Centro de Acolhimento à Família Atípica é o controlador dos dados tratados neste aplicativo, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018 – LGPD)."]],
  ["Quais dados coletamos", [
    "Cadastro: nome, data de nascimento, CPF, telefone, e-mail, endereço e dados do segundo responsável.",
    "Filhos: nome, data de nascimento e, somente com o seu consentimento específico, informações de saúde (diagnóstico, terapias, medicações, escola, BPC).",
    "Uso do app: registros do diário, agenda, remédios, checklists, favoritos e preferências de aviso.",
  ]],
  ["Para que usamos", [
    "Confirmar o cadastro e oferecer acolhimento, orientação e encaminhamentos.",
    "Enviar comunicados e lembretes que você escolheu receber.",
    "Gerar estatísticas anônimas e agregadas (por exemplo, número de famílias por cidade) para planejar ações.",
  ]],
  ["Dados sensíveis e de crianças", [
    "Dados de saúde são dados sensíveis (art. 11) e só são guardados com consentimento específico, que pode ser revogado a qualquer momento. Ao revogar, a ficha de saúde é apagada.",
    "Dados de crianças são tratados no seu melhor interesse e com consentimento do responsável (art. 14).",
    "CPFs e dados de saúde ficam separados do restante do cadastro. A equipe vê apenas o CPF mascarado; somente a administração vê o dado completo, e todo acesso fica registrado.",
  ]],
  ["Com quem compartilhamos", [
    "Não vendemos nem cedemos seus dados.",
    "Cuidadores e escolas só acessam o diário quando você convida ou cria um link, e você pode encerrar o acesso a qualquer momento.",
    "Usamos provedores de hospedagem e banco de dados com criptografia em trânsito e controle de acesso por linha.",
  ]],
  ["Seus direitos", [
    "Confirmar, acessar, corrigir e baixar seus dados (Perfil → Baixar meus dados).",
    "Revogar consentimentos e excluir sua conta e todos os dados da família (Perfil → Excluir minha conta).",
    "Para dúvidas ou pedidos, fale com a equipe pelo WhatsApp do Centro.",
  ]],
  ["Por quanto tempo guardamos", ["Enquanto sua conta estiver ativa. Após a exclusão, os dados são apagados, exceto registros que a lei obrigue a manter."]],
];

function Privacidade() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar publico />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <h1 className="font-display text-3xl font-extrabold">Política de <span className="text-primary">privacidade</span></h1>
        <p className="text-sm text-muted-foreground">Versão {TERMOS_VERSAO}</p>
        {SECOES.map(([t, ps]) => (
          <section key={t} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-bold">{t}</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">{ps.map((p) => <li key={p}>{p}</li>)}</ul>
          </section>
        ))}
      </main>
    </div>
  );
}
