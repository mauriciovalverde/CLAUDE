import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, HeartHandshake, XCircle } from "lucide-react";
import { Aviso, Btn, Card, Carregando, Logo, Vazio } from "@/components/app/kit";
import { db } from "@/lib/dados";

export const Route = createFileRoute("/confirmar-anjo/$token")({
  head: () => ({ meta: [{ title: "Convite Número Anjo · AMPARO" }] }),
  component: Confirmar,
});

function Confirmar() {
  const { token } = Route.useParams();
  const [info, setInfo] = useState<{ quem: string; contato: string; confirmado: boolean } | null | undefined>(undefined);
  const [fim, setFim] = useState<"" | "sim" | "nao">("");
  useEffect(() => { db.rpc("anjo_convite", { _token: token }).then(({ data }: any) => setInfo(data?.[0] ?? null)); }, [token]);
  async function responder(sim: boolean) { const { data } = await db.rpc("anjo_confirmar", { _token: token, _aceito: sim }); if (data) setFim(sim ? "sim" : "nao"); }
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col gap-5 px-4 py-6">
      <Logo />
      {info === undefined ? <Carregando /> : info === null && !fim ? (
        <Vazio icon={HeartHandshake} titulo="Convite não encontrado" texto="O link pode ter sido cancelado. Peça um novo convite para quem enviou." />
      ) : fim === "sim" || info?.confirmado ? (
        <Card className="flex flex-col items-center gap-3 text-center"><CheckCircle2 className="h-14 w-14 text-success" /><h1 className="font-display text-2xl font-extrabold">Obrigado por ser Número Anjo</h1>
          <p>Quando {info?.quem ?? "a pessoa"} precisar de apoio, você vai receber uma mensagem. Entre em contato com ela e, se houver risco imediato, ligue 192 (SAMU) ou 190 (Polícia).</p></Card>
      ) : fim === "nao" ? (
        <Card className="flex flex-col items-center gap-3 text-center"><XCircle className="h-14 w-14 text-muted-foreground" /><h1 className="font-display text-xl font-bold">Tudo bem</h1><p>Avisamos que você preferiu não participar. Nenhum dado seu foi mantido.</p></Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <HeartHandshake className="h-12 w-12 text-emergency" />
          <h1 className="font-display text-2xl font-extrabold">Olá, {info!.contato}! {info!.quem} quer você como Número Anjo</h1>
          <p>O AMPARO é um app de apoio a famílias atípicas. Número Anjo é a pessoa de confiança que recebe um aviso quando a família pede ajuda num momento de crise.</p>
          <ul className="list-disc pl-5 text-sm"><li>Você recebe uma mensagem com o nome de quem pediu apoio, o horário e, se a pessoa autorizar, a localização.</li><li>Não é preciso instalar nada.</li><li>Você pode sair quando quiser, pedindo para a pessoa remover seu número.</li></ul>
          <Aviso tom="red">O Número Anjo não substitui SAMU (192), Bombeiros (193) ou Polícia (190).</Aviso>
          <div className="flex flex-wrap gap-2"><Btn v="wa" onClick={() => responder(true)}>Aceito ser Número Anjo</Btn><Btn v="outline" onClick={() => responder(false)}>Não quero</Btn></div>
        </Card>
      )}
    </div>
  );
}
