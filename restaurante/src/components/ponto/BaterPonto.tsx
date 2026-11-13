import { useEffect, useRef, useState } from 'react';
import { CameraOff, CheckCircle2, Loader2, MapPin, MapPinOff, ScanFace, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { enviarPrivado } from '../../lib/arquivos';
import { capturar, carregarRosto, distancia, ler, LIMIAR, ProvaDeVida } from '../../lib/ponto/rosto';
import { NOMES_TIPO, textoMotivos } from '../../lib/ponto/dados';
import { Aviso, Btn, Campo, Modal, Textarea } from '../ui';

export const CIENCIA_VERSAO = 'ponto-v1';
export const TEXTO_CIENCIA = 'Para registrar o ponto, o app usa a câmera para confirmar que é você (reconhecimento facial e prova de vida) e o GPS para saber se você está no local de trabalho. ' +
  'Guardamos: uma selfie em cada registro, um código numérico do seu rosto (não é foto), a localização e o horário do servidor. ' +
  'Finalidade: cumprir a obrigação legal de controle de jornada (CLT art. 74 e Portaria MTP 671/2021) e evitar fraudes. ' +
  'Somente você e o administrador veem esses dados. Eles ficam guardados pelo prazo legal (5 anos) e não são usados para outra finalidade (LGPD, art. 11, II, "a" e "g"). ' +
  'Você pode pedir acesso ou correção dos seus dados ao administrador. Se a câmera ou o GPS falharem, você ainda pode registrar (vai para análise).';

type Ctx = { restId: string; funcId: string; descritorRef: number[] | null; locais: any[]; proximo: { tipo: string | null; previsto?: number | null; dentroJanela?: boolean; diferenca?: number } };

/** Localização com tempo limite; null se negar ou falhar. */
function pegarGPS(): Promise<GeolocationPosition | null> {
  return new Promise((ok) => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}
/** Endereço aproximado (OpenStreetMap). Sem internet ou erro: só as coordenadas. */
async function endereco(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&lat=${lat}&lon=${lng}`, { headers: { 'Accept-Language': 'pt-BR' } });
    const j = await r.json(); return (j.display_name as string)?.split(',').slice(0, 4).join(',') ?? '';
  } catch { return ''; }
}
const distM = (a: number, b: number, c: number, d: number) => { const R = 6371000, r = Math.PI / 180; const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// ===== fila offline (contingência sem internet) =====
const FILA = 'rest-ponto-fila';
const lerFila = (): any[] => { try { return JSON.parse(localStorage.getItem(FILA) || '[]'); } catch { return []; } };
const gravarFila = (f: any[]) => { try { localStorage.setItem(FILA, JSON.stringify(f)); } catch { /* sem espaço */ } };
export const filaPendente = () => lerFila().length;
const ehErroDeRede = (e: any) => /fetch|network|Failed to fetch|Load failed|internet/i.test(String(e?.message ?? e)) || !navigator.onLine;
/** Envia o que ficou guardado sem internet. O servidor grava o horário dele e guarda o do aparelho como informação (sempre vai para análise). */
let enviandoFila: Promise<number> | null = null;
export function enviarFila(restId: string, funcId: string) {
  // uma remessa por vez: dois avisos de "voltou a internet" não podem enviar o mesmo registro duas vezes
  enviandoFila ??= enviarFilaAgora(restId, funcId).finally(() => { enviandoFila = null; });
  return enviandoFila;
}
async function enviarFilaAgora(restId: string, funcId: string) {
  const fila = lerFila(); if (!fila.length) return 0;
  let enviados = 0; const resto: any[] = [];
  for (const item of fila) {
    if (item.funcId !== funcId) { resto.push(item); continue; }
    try {
      let selfie: string | null = null;
      if (item.selfie) { const b = await (await fetch(item.selfie)).blob(); selfie = await enviarPrivado(restId, funcId, 'selfies', b); }
      const { error } = await supabase.rpc('rest_ponto_registrar', { p: { ...item.p, selfie_path: selfie, origem: 'contingencia', horario_informado: item.horario, justificativa: [item.p.justificativa, 'Registro feito sem internet às ' + new Date(item.horario).toLocaleTimeString('pt-BR')].filter(Boolean).join(' · ') } });
      if (error) throw error; enviados++;
    } catch (e) { if (ehErroDeRede(e)) resto.push(item); /* erro de regra (ex.: já registrado): descarta e mostra no histórico do aparelho */ }
  }
  gravarFila(resto); return enviados;
}

export default function BaterPonto({ ctx, fechar, pronto }: { ctx: Ctx; fechar: () => void; pronto: (comprovante: any) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const prova = useRef(new ProvaDeVida());
  const [camera, setCamera] = useState<'abrindo' | 'ok' | 'falhou'>('abrindo');
  const [modelo, setModelo] = useState<'carregando' | 'ok' | 'falhou'>('carregando');
  const [gps, setGps] = useState<GeolocationPosition | null | undefined>(undefined);
  const [end, setEnd] = useState('');
  const [rosto, setRosto] = useState<{ visto: boolean; vivo: boolean; dist: number | null; descritor: number[] | null }>({ visto: false, vivo: false, dist: null, descritor: null });
  const [foto, setFoto] = useState<Blob | null>(null);
  const [just, setJust] = useState('');
  const [ciente, setCiente] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const cadastro = !ctx.descritorRef;

  // câmera + modelos + GPS em paralelo
  useEffect(() => {
    let stream: MediaStream | null = null; let vivo = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((s) => { if (!vivo) { s.getTracks().forEach((t) => t.stop()); return; } stream = s; if (video.current) { video.current.srcObject = s; video.current.play().catch(() => {}); } setCamera('ok'); })
      .catch(() => setCamera('falhou'));
    if (!navigator.mediaDevices) setCamera('falhou');
    carregarRosto().then(() => vivo && setModelo('ok')).catch(() => vivo && setModelo('falhou'));
    pegarGPS().then((p) => { if (!vivo) return; setGps(p); if (p) endereco(p.coords.latitude, p.coords.longitude).then((e) => vivo && setEnd(e)); });
    return () => { vivo = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  // leitura contínua do rosto até confirmar a prova de vida
  useEffect(() => {
    if (camera !== 'ok' || modelo !== 'ok' || rosto.vivo) return;
    let parar = false;
    (async () => {
      while (!parar) {
        const v = video.current;
        if (v && v.readyState >= 2) {
          const l = await ler(v).catch(() => null);
          if (parar) break;
          if (l) {
            prova.current.adicionar(l);
            const desc = Array.from(l.descritor);
            const d = ctx.descritorRef ? distancia(desc, ctx.descritorRef) : null;
            if (prova.current.ok) { const f = await capturar(v).catch(() => null); setFoto(f); setRosto({ visto: true, vivo: true, dist: d, descritor: desc }); break; }
            setRosto((r) => ({ ...r, visto: true, dist: d, descritor: desc }));
          } else setRosto((r) => ({ ...r, visto: false }));
        }
        await new Promise((r) => setTimeout(r, 180));
      }
    })();
    return () => { parar = true; };
  }, [camera, modelo, rosto.vivo, ctx.descritorRef]);

  const lat = gps?.coords.latitude, lng = gps?.coords.longitude;
  const perto = lat != null && ctx.locais.length ? ctx.locais.map((l) => ({ l, d: distM(lat, lng!, l.lat, l.lng) })).sort((a, b) => a.d - b.d)[0] : null;
  const dentro = perto ? perto.d <= perto.l.raio_m : null;
  const faceOk = rosto.dist != null && rosto.dist <= LIMIAR;
  const contingencia = camera === 'falhou' || modelo === 'falhou';
  const problemas = [
    ctx.proximo.dentroJanela === false && 'fora_janela', gps === null && 'sem_gps', dentro === false && 'fora_area',
    contingencia && 'contingencia', !contingencia && rosto.vivo && !cadastro && !faceOk && 'rosto_nao_confere',
  ].filter(Boolean) as string[];
  const podeEnviar = !enviando && gps !== undefined && (contingencia || rosto.vivo) && (!cadastro || contingencia || ciente);

  async function confirmar() {
    setEnviando(true); setErro('');
    const p: any = {
      lat, lng, precisao: gps?.coords.accuracy, endereco: end || (lat != null ? `${lat.toFixed(5)}, ${lng!.toFixed(5)}` : null),
      face_ok: cadastro ? true : faceOk, face_distancia: rosto.dist, vivacidade_ok: contingencia ? null : rosto.vivo,
      justificativa: just.trim() || null, origem: contingencia ? 'contingencia' : 'app', dispositivo: navigator.userAgent.slice(0, 180),
    };
    try {
      if (cadastro && rosto.descritor && foto) {
        const ref = await enviarPrivado(ctx.restId, ctx.funcId, 'rosto', foto);
        const { error } = await supabase.rpc('rest_ponto_cadastrar_rosto', { p_func: null, p_descritor: rosto.descritor, p_foto: ref, p_versao: CIENCIA_VERSAO });
        if (error) throw error;
      }
      if (foto) p.selfie_path = await enviarPrivado(ctx.restId, ctx.funcId, 'selfies', foto);
      const { data, error } = await supabase.rpc('rest_ponto_registrar', { p });
      if (error) throw error;
      pronto(data);
    } catch (e: any) {
      if (ehErroDeRede(e)) {
        // sem internet: guarda no aparelho e envia depois (contingência auditável)
        const selfie = foto ? await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.readAsDataURL(foto); }) : null;
        gravarFila([...lerFila(), { funcId: ctx.funcId, horario: new Date().toISOString(), p: { ...p, tipo: ctx.proximo.tipo }, selfie }]);
        pronto({ offline: true, tipo: ctx.proximo.tipo, horario_informado: new Date().toISOString() });
      } else setErro(e.message ?? String(e));
    } finally { setEnviando(false); }
  }

  const Item = ({ ok, carregando, texto, sub }: { ok: boolean | null; carregando?: boolean; texto: string; sub?: string }) => (
    <div className="flex items-start gap-2 text-sm">{carregando ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-slate-400" /> : ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}<div><div>{texto}</div>{sub && <div className="text-xs text-slate-500">{sub}</div>}</div></div>
  );

  return (
    <Modal aberto fechar={fechar} titulo={cadastro ? 'Cadastrar seu rosto e registrar' : `Registrar: ${NOMES_TIPO[ctx.proximo.tipo as keyof typeof NOMES_TIPO] ?? 'ponto'}`}>
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-900">
          {camera !== 'falhou' ? <video ref={video} playsInline muted className="h-full w-full -scale-x-100 object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300"><CameraOff className="h-10 w-10" /><span className="text-sm">Câmera indisponível — registro de contingência</span></div>}
          {camera === 'ok' && <div className={`pointer-events-none absolute inset-6 rounded-[45%] border-4 ${rosto.vivo ? 'border-emerald-400' : rosto.visto ? 'border-amber-300' : 'border-white/40'}`} />}
          {camera === 'ok' && !rosto.vivo && <div className="absolute inset-x-0 bottom-0 bg-black/60 p-2 text-center text-sm text-white">{modelo !== 'ok' ? 'Preparando o reconhecimento…' : rosto.visto ? 'Agora pisque os olhos ou vire levemente o rosto' : 'Centralize o rosto na moldura'}</div>}
        </div>
        <div className="space-y-1.5 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          {!contingencia && <Item ok={rosto.vivo} carregando={!rosto.vivo} texto={rosto.vivo ? 'Prova de vida confirmada' : 'Aguardando prova de vida'} />}
          {!contingencia && !cadastro && rosto.vivo && <Item ok={faceOk} texto={faceOk ? 'Rosto confere' : 'Rosto não confere — vai para análise'} sub={rosto.dist != null ? `distância facial ${rosto.dist.toFixed(2).replace(".", ",")} (confere até 0,50)` : undefined} />}
          {cadastro && !contingencia && <Item ok={rosto.vivo} texto="Primeiro acesso: esta foto vira o seu rosto de referência" />}
          <Item ok={gps ? dentro !== false : false} carregando={gps === undefined} texto={gps === undefined ? 'Buscando localização…' : gps === null ? 'Sem localização (GPS negado ou indisponível)' : dentro === false ? `Fora do local autorizado (${Math.round(perto!.d)} m de ${perto!.l.nome})` : dentro ? `No local: ${perto!.l.nome}` : 'Localização obtida'} sub={end || (lat != null ? `${lat.toFixed(5)}, ${lng!.toFixed(5)} · precisão ${Math.round(gps!.coords.accuracy)} m` : undefined)} />
          {ctx.proximo.dentroJanela === false && <Item ok={false} texto="Fora da janela de horário prevista" sub="O registro é aceito com o horário real e vai para análise (a lei não permite bloquear a marcação)." />}
          <div className="flex items-center gap-2 pt-1 text-xs text-slate-500">{gps ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}O horário oficial é o do servidor, gravado no momento do envio.</div>
        </div>
        {cadastro && !contingencia && <label className="flex gap-2 rounded-xl border border-slate-200 p-3 text-xs leading-relaxed dark:border-slate-700"><input type="checkbox" checked={ciente} onChange={(e) => setCiente(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Ciência sobre seus dados (LGPD).</b> {TEXTO_CIENCIA}</span></label>}
        {problemas.length > 0 && <>
          <Aviso tipo="alerta">Este registro vai para análise do administrador: {textoMotivos(problemas)}.</Aviso>
          <Campo rotulo="Justificativa (recomendado)"><Textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Ex.: entrega externa, celular sem GPS, cheguei mais cedo para receber mercadoria…" /></Campo>
        </>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="flex flex-wrap gap-2">
          <Btn className="flex-1" disabled={!podeEnviar} carregando={enviando} onClick={confirmar}><ScanFace className="h-4 w-4" />Confirmar registro</Btn>
          {camera === 'ok' && !rosto.vivo && <Btn variante="secundario" onClick={() => { setCamera('falhou'); }}>Câmera não funciona</Btn>}
        </div>
      </div>
    </Modal>
  );
}
