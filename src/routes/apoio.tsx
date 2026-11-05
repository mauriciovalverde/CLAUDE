import { createFileRoute } from "@tanstack/react-router";
import { Video, AlertTriangle, CalendarHeart, Heart, HeartHandshake, MessageCircle, Phone, Scale, Star } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { CardLink, PageHeader } from "@/components/app/kit";

export const Route = createFileRoute("/apoio")({ component: () => <AppShell><Apoio /></AppShell> });

function Apoio() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Apoio" highlight="e acolhimento" subtitle="Você não precisa passar por isso sem apoio. Escolha por onde começar." />
      <CardLink to="/consultas" icon={Video} tom="blue" title="Teleconsulta com psicólogo" subtitle="Agende atendimento online, por vídeo, pelo app" />
      <CardLink to="/rede" icon={MessageCircle} tom="green" title="Rede de apoio no WhatsApp" subtitle="Converse com outras mães e famílias atípicas" />
      <CardLink to="/rede" icon={CalendarHeart} tom="coral" title="Encontros e rodas de conversa" subtitle="Próximos encontros presenciais e online" />
      <CardLink to="/conteudo/$slug" params={{ slug: "acolhimento" }} icon={Heart} tom="coral" title="Mãe, você também importa" subtitle="Autocuidado, cansaço, culpa e saúde emocional" />
      <CardLink to="/historias" icon={Star} tom="amber" title="Histórias que inspiram" subtitle="Relatos de outras famílias — e conte a sua" />
      <CardLink to="/conteudo/$slug" params={{ slug: "direitos" }} icon={Scale} tom="blue" title="Seus direitos" subtitle="BPC, escola inclusiva, CIPTEA, passe livre e mais" />
      <CardLink to="/conteudo/$slug" params={{ slug: "crise" }} icon={AlertTriangle} tom="red" title="Momentos de crise" subtitle="O que fazer antes, durante e depois" />
      <a href="tel:188" className="card-soft flex items-center gap-4 p-4">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success-soft text-success"><HeartHandshake /></span>
        <span className="flex-1"><b className="block text-navy">CVV · ligue 188</b><span className="text-sm text-muted-foreground">Apoio emocional gratuito, 24 horas, sigiloso</span></span>
        <Phone className="h-5 w-5 text-success" />
      </a>
    </div>
  );
}
