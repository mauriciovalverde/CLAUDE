import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/app/AppShell";
import { TERMOS_VERSAO } from "@/lib/br";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de uso · Centro de Acolhimento à Família Atípica" }] }),
  component: Termos,
});

const ITENS: [string, string][] = [
  ["O que é o aplicativo", "Um espaço de informação, organização e acolhimento para mães e famílias de crianças atípicas, mantido pelo Centro de Acolhimento à Família Atípica."],
  ["Não substitui profissionais", "As orientações têm caráter informativo. Elas não substituem consulta médica, psicológica, jurídica ou atendimento de emergência. Em risco imediato, ligue 192, 193 ou 190."],
  ["Cadastro", "Você se compromete a informar dados verdadeiros. Cada cadastro é confirmado pela equipe antes de liberar recursos como a rede de apoio. A equipe pode recusar cadastros incompletos ou indevidos."],
  ["Conta e senha", "Sua senha é pessoal. Avise a equipe se suspeitar de uso indevido da sua conta."],
  ["Rede de apoio e histórias", "Seja respeitosa. Não compartilhe dados de outras famílias, não faça propaganda ou venda e não publique conteúdo ofensivo. Histórias passam por revisão antes de serem publicadas."],
  ["Diretório de profissionais", "Os profissionais são validados pela equipe quanto ao registro em conselho, mas a escolha e a contratação são de responsabilidade da família."],
  ["Diário e compartilhamento", "Você decide quem pode ver e registrar no diário. Cuidadores convidados e escolas podem ter o acesso encerrado a qualquer momento."],
  ["Mudanças", "Estes termos podem ser atualizados. Avisaremos pelo aplicativo quando houver mudanças relevantes."],
];

function Termos() {
  return (
    <div className="min-h-screen bg-background">
      <TopBar publico />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <h1 className="font-display text-3xl font-extrabold">Termos <span className="text-primary">de uso</span></h1>
        <p className="text-sm text-muted-foreground">Versão {TERMOS_VERSAO}</p>
        <ol className="flex list-decimal flex-col gap-4 pl-5">
          {ITENS.map(([t, d]) => <li key={t}><b>{t}.</b> {d}</li>)}
        </ol>
      </main>
    </div>
  );
}
