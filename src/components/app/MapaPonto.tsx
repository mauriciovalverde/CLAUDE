import { useEffect, useRef } from "react";

const PINO = '<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;background:#F06A55;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div>';

/**
 * Mapa com um ponto. Editável: tocar no mapa ou arrastar o pino muda o ponto (onMudar).
 * Somente leitura: mostra o ponto e um círculo de precisão, se houver.
 */
export function MapaPonto({ ponto, precisao, editavel = false, onMudar, altura = 280 }: {
  ponto: [number, number] | null; precisao?: number | null; editavel?: boolean; onMudar?: (lat: number, lng: number) => void; altura?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const marcador = useRef<any>(null);
  const circulo = useRef<any>(null);
  const cb = useRef(onMudar);
  cb.current = onMudar;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !ref.current) return;
      if (!mapa.current) {
        mapa.current = L.map(ref.current, { scrollWheelZoom: false, tap: true } as any).setView(ponto ?? [-13.86, -40.08], ponto ? 17 : 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 }).addTo(mapa.current);
        if (editavel) mapa.current.on("click", (e: any) => cb.current?.(e.latlng.lat, e.latlng.lng));
      }
      const icon = L.divIcon({ className: "", html: PINO, iconSize: [34, 34], iconAnchor: [17, 34] });
      if (ponto) {
        if (!marcador.current) {
          marcador.current = L.marker(ponto, { icon, draggable: editavel, title: "Local da ocorrência" }).addTo(mapa.current);
          if (editavel) marcador.current.on("dragend", () => { const p = marcador.current.getLatLng(); cb.current?.(p.lat, p.lng); });
        } else marcador.current.setLatLng(ponto);
        circulo.current?.remove(); circulo.current = null;
        if (precisao && precisao > 0) circulo.current = L.circle(ponto, { radius: precisao, color: "#1F5BFF", weight: 1, fillOpacity: 0.08 }).addTo(mapa.current);
        const z = mapa.current.getZoom();
        mapa.current.setView(ponto, z < 15 ? 17 : z);
      } else { marcador.current?.remove(); marcador.current = null; circulo.current?.remove(); circulo.current = null; }
    })();
    return () => { vivo = false; };
  }, [ponto?.[0], ponto?.[1], precisao, editavel]);

  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; marcador.current = null; }, []);

  return <div ref={ref} style={{ height: altura }} className="relative z-0 w-full overflow-hidden rounded-2xl border border-border" role="region" aria-label="Mapa do local da ocorrência" />;
}

export const linkMapa = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
