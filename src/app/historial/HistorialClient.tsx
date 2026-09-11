"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Checklist = {
  id: string;
  fecha: string;
  estado: string;
  ficha: { proceso: { codigo: string; nombre: string; area: { nombre: string; codigo: string } } };
  turno: { nombre: string };
  ejecutor: { nombre: string };
  items: { descripcion: string; completado: boolean; valor: string | null }[];
};

export default function HistorialClient({ rol }: { rol: string }) {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [areas, setAreas] = useState<{ id: string; codigo: string; nombre: string }[]>([]);
  const [turnos, setTurnos] = useState<{ id: string; nombre: string }[]>([]);
  const [desde, setDesde] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [areaId, setAreaId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [estado, setEstado] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/fichas").then((r) => r.json()).then((fichas: { proceso: { area: { id: string; codigo: string; nombre: string } } }[]) => {
      const map = new Map<string, { id: string; codigo: string; nombre: string }>();
      for (const f of fichas) map.set(f.proceso.area.id, f.proceso.area);
      setAreas(Array.from(map.values()));
    }).catch(() => {});
    fetch("/api/turnos").then((r) => r.json()).then(setTurnos).catch(() => {});
  }, []);

  async function buscar() {
    setLoading(true);
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (areaId) params.set("areaId", areaId);
    if (turnoId) params.set("turnoId", turnoId);
    if (estado) params.set("estado", estado);
    const res = await fetch(`/api/checklists?${params.toString()}`);
    if (res.ok) setChecklists(await res.json());
    setLoading(false);
  }

  useEffect(() => { buscar(); }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/inicio" className="text-sm text-zinc-400 hover:text-white">← Inicio</Link>
          <h1 className="text-lg font-bold">Historial de checklists</h1>
          <span className="text-xs bg-zinc-800 border border-zinc-700 px-2 py-1 rounded">Por turno y por área</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          <div><label className="text-xs text-zinc-400">Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-zinc-400">Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm" /></div>
          <div><label className="text-xs text-zinc-400">Área</label><select value={areaId} onChange={(e) => setAreaId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"><option value="">Todas</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.codigo} — {a.nombre}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400">Turno</label><select value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"><option value="">Todos</option>{turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
          <div><label className="text-xs text-zinc-400">Estado</label><select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-sm"><option value="">Todos</option><option value="PENDIENTE">PENDIENTE</option><option value="COMPLETADO">COMPLETADO</option><option value="VERIFICADO">VERIFICADO</option><option value="RECHAZADO">RECHAZADO</option></select></div>
          <div className="flex items-end"><button onClick={buscar} className="w-full bg-amber-600 hover:bg-amber-500 text-white py-1.5 rounded text-sm">{loading ? "Buscando..." : "Buscar"}</button></div>
        </div>

        <p className="text-xs text-zinc-500">{checklists.length} checklist(s) en el rango — guardados por día, no se borran</p>

        <div className="space-y-3">
          {checklists.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-zinc-400">{c.ficha.proceso.codigo} — {c.ficha.proceso.area.codigo} · {c.turno.nombre}</p>
                  <p className="font-medium">{c.ficha.proceso.nombre}</p>
                  <p className="text-xs text-zinc-500">{new Date(c.fecha).toLocaleDateString()} · {c.estado} · por {c.ejecutor.nombre} · {c.items.filter((i) => i.completado || i.valor === "NO_CUMPLE").length}/{c.items.length} evaluados</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded border ${c.estado === "VERIFICADO" ? "bg-green-900/30 border-green-800 text-green-400" : c.estado === "COMPLETADO" ? "bg-blue-900/30 border-blue-800 text-blue-400" : c.estado === "RECHAZADO" ? "bg-red-900/30 border-red-800 text-red-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`}>{c.estado}</span>
              </div>
              <div className="mt-3 grid gap-1">
                {c.items.map((it, idx) => (
                  <div key={idx} className={`text-xs px-2 py-1 rounded ${it.completado ? "bg-green-900/20 text-green-300" : it.valor === "NO_CUMPLE" ? "bg-red-900/20 text-red-300 line-through" : "bg-zinc-800 text-zinc-500"}`}>
                    {idx + 1}. {it.descripcion} — {it.completado ? "CUMPLE" : it.valor === "NO_CUMPLE" ? "NO CUMPLE" : "pendiente"}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {checklists.length === 0 && !loading && <p className="text-sm text-zinc-500 text-center py-8">Sin resultados en ese rango</p>}
        </div>
      </main>
    </div>
  );
}
