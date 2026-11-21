import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, textareaCls } from "@/components/app/kit";
import { db } from "@/lib/dados";
import { cn } from "@/lib/utils";

/** Registro por voz dentro do app: fala → texto → o servidor entende criança, tipo, remédio e horário e grava no diário. */
export function FalarDiario({ familiaId, onSalvo }: { familiaId: string; onSalvo: () => void }) {
  const Rec: any = typeof window !== "undefined" ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const [ouvindo, setOuvindo] = useState(false);
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const rec = useRef<any>(null);
  useEffect(() => () => rec.current?.abort?.(), []);

  function ouvir() {
    setAberto(true);
    if (!Rec) return;
    const r = new Rec(); rec.current = r;
    r.lang = "pt-BR"; r.interimResults = true; r.continuous = false;
    r.onresult = (e: any) => setTexto(Array.from(e.results).map((x: any) => x[0].transcript).join(" "));
    r.onerror = (e: any) => { setOuvindo(false); if (e.error === "not-allowed") toast.error("Permita o uso do microfone para falar o registro."); };
    r.onend = () => setOuvindo(false);
    setTexto(""); setOuvindo(true); r.start();
  }
  async function salvar() {
    if (texto.trim().length < 3) return toast.error("Fale ou escreva o que aconteceu.");
    setEnviando(true);
    const { data, error } = await db.rpc("voz_registrar_app", { _familia: familiaId, _frase: texto });
    setEnviando(false);
    if (error) return toast.error(error.message);
    if (typeof data === "string" && data.startsWith("Registrado")) { toast.success(data); setTexto(""); setAberto(false); onSalvo(); }
    else toast.error(String(data));
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-4", aberto && "border-primary")}>
      <div className="flex items-center gap-3">
        <button onClick={ouvindo ? () => rec.current?.stop() : ouvir} aria-label={ouvindo ? "Parar de ouvir" : "Registrar falando"}
          className={cn("tap grid h-14 w-14 shrink-0 place-items-center rounded-full text-white shadow-lg", ouvindo ? "animate-pulse bg-emergency" : "bg-primary")}>
          {ouvindo ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <div className="min-w-0 flex-1">
          <b className="block text-navy">{ouvindo ? "Ouvindo… pode falar" : "Registrar falando"}</b>
          <span className="text-sm text-muted-foreground">Ex.: “Marcio tomou risperidona agora” ou “Ana teve uma crise forte por causa do barulho”.</span>
        </div>
      </div>
      {aberto && (
        <>
          {!Rec && <p className="text-xs text-muted-foreground">Este navegador não ouve a voz; use o microfone do teclado do celular para ditar.</p>}
          <label htmlFor="voz-texto" className="sr-only">O que aconteceu</label>
          <textarea id="voz-texto" className={cn(textareaCls, "min-h-20")} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que aconteceu? Diga o nome da criança." />
          <div className="flex gap-2"><Btn onClick={salvar} disabled={enviando || ouvindo}><Send className="h-4 w-4" /> {enviando ? "Registrando…" : "Registrar no diário"}</Btn><Btn v="ghost" onClick={() => { rec.current?.abort?.(); setAberto(false); setTexto(""); }}>Cancelar</Btn></div>
        </>
      )}
    </Card>
  );
}
