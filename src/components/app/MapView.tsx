import { useEffect, useRef } from "react";

type Ponto = { id: string; nome: string; lat: number; lng: number; sub?: string };

/** Mapa OpenStreetMap carregado só no navegador (Leaflet não roda no servidor). */
export function MapView({ pontos, centro, onSelect }: { pontos: Ponto[]; centro?: [number, number] | null; onSelect?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import("leaflet")).default;
      if (!vivo || !ref.current) return;
      if (!mapRef.current) {
        mapRef.current = L.map(ref.current, { scrollWheelZoom: false }).setView(centro ?? [-13.85, -40.08], centro ? 12 : 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap", maxZoom: 18,
        }).addTo(mapRef.current);
      }
      layerRef.current?.remove();
      const grupo = L.layerGroup();
      const icone = L.divIcon({
        className: "",
        html: '<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;background:#1F5BFF;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25)"></div>',
        iconSize: [30, 30], iconAnchor: [15, 30],
      });
      pontos.forEach((p) => {
        const mk = L.marker([p.lat, p.lng], { icon: icone, title: p.nome });
        const div = document.createElement("div");
        const b = document.createElement("b"); b.textContent = p.nome; div.appendChild(b);
        if (p.sub) { const s = document.createElement("div"); s.textContent = p.sub; div.appendChild(s); }
        mk.bindPopup(div);
        mk.on("click", () => onSelect?.(p.id));
        grupo.addLayer(mk);
      });
      grupo.addTo(mapRef.current);
      layerRef.current = grupo;
      if (pontos.length) {
        const b = L.latLngBounds(pontos.map((p) => [p.lat, p.lng] as [number, number]));
        mapRef.current.fitBounds(b.pad(0.25), { maxZoom: 14 });
      } else if (centro) mapRef.current.setView(centro, 12);
    })();
    return () => { vivo = false; };
  }, [pontos, centro, onSelect]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  return <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-3xl border border-border" role="region" aria-label="Mapa de especialistas e serviços" />;
}
