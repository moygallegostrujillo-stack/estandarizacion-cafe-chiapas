"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import BotonRojoIncidencia from "@/components/BotonRojoIncidencia";

type Checklist = {
  id: string;
  estado: string;
  fecha: string;
  ficha: { proceso: { codigo: string; nombre: string; area: { nombre: string; color: string | null } } };
  turno: { nombre: string };
  items: { id: string; descripcion: string; completado: boolean; evidenciaRequerida: boolean; valor: string | null; evidencias: { id: string; url: string }[] }[];
};

type AreaOpt = { id: string; codigo: string; nombre: string; procesos: { id: string; codigo: string; nombre: string; fichas: { id: string }[] }[] };
type TurnoOpt = { id: string; nombre: string };

export default function ChecklistsPage() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { id: string } | null;
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [turnos, setTurnos] = useState<TurnoOpt[]>([]);
  const [fichaId, setFichaId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [selected, setSelected] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  async function loadChecklists() {
    const res = await fetch("/api/checklists");
    if (res.ok) setChecklists(await res.json());
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetch("/api/checklists").then((r) => r.json()).then(setChecklists),
      fetch("/api/procesos").then((r) => r.json()).then(setAreas),
      fetch("/api/turnos").then((r) => r.json()).then(setTurnos).catch(() => setTurnos([])),
    ]).finally(() => setLoading(false));
  }, [user]);

  async function crear() {
    if (!fichaId || !turnoId) return alert("Selecciona ficha y turno");
    setCreating(true);
    const res = await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fichaId, turnoId }),
    });
    setCreating(false);
    if (!res.ok) return alert((await res.json()).error || "Error");
    const nuevo = await res.json();
    setChecklists((p) => [nuevo, ...p]);
    setFichaId("");
    setTurnoId("");
  }

  async function toggleItem(itemId: string, completado: boolean) {
    if (!selected) return;
    await fetch(`/api/checklists/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: itemId, completado }] }),
    });
    // optimista
    setSelected((s) => s ? { ...s, items: s.items.map((it) => it.id === itemId ? { ...it, completado } : it) } : null);
  }

  async function subirFoto(itemId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("checklistItemId", itemId);
    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    if (!res.ok) alert((await res.json()).error);
    else {
      // recargar detalle
      const r = await fetch(`/api/checklists/${selected!.id}`);
      if (r.ok) setSelected(await r.json());
    }
  }

  async function completar() {
    if (!selected) return;
    const res = await fetch(`/api/checklists/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "COMPLETADO" }),
    });
    if (!res.ok) alert((await res.json()).error || (await res.text()));
    else {
      const data = await res.json();
      setSelected(data);
      loadChecklists();
    }
  }

  if (!user) return null;
  if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Checklists</h1>
          <a href="/inicio" className="text-sm text-zinc-400 hover:text-white">← Inicio</a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Izquierda: crear + lista */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
            <h3 className="font-semibold mb-3">Nuevo checklist</h3>
            <div className="space-y-3">
              <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Ficha (54 procesos)</option>
                {areas.flatMap((a) => a.procesos.map((p) => (
                  <option key={p.fichas[0]?.id} value={p.fichas[0]?.id}>{p.codigo} — {p.nombre}</option>
                )))}
              </select>
              <select value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Turno</option>
                {turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                {turnos.length === 0 && <><option value="mat">Matutino</option><option value="ves">Vespertino</option></>}
              </select>
              <button onClick={crear} disabled={creating} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                {creating ? "Creando..." : "Crear checklist (7 items)"}
              </button>
              <p className="text-xs text-zinc-500">Se generan 7 items desde las preguntas de la ficha. Item 5 (COMPRUEBO) requiere foto.</p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-zinc-300">Mis checklists ({checklists.length})</h3>
            {checklists.map((c) => (
              <button key={c.id} onClick={async () => {
                const r = await fetch(`/api/checklists/${c.id}`);
                if (r.ok) setSelected(await r.json());
                else setSelected(c);
              }} className={`w-full text-left bg-zinc-900 border rounded-xl p-4 hover:bg-zinc-800/80 ${selected?.id === c.id ? "border-amber-600" : "border-zinc-800"}`}>
                <p className="text-xs font-mono text-zinc-500">{c.ficha.proceso.codigo} · {c.turno.nombre}</p>
                <p className="font-medium text-sm">{c.ficha.proceso.nombre}</p>
                <p className="text-xs text-zinc-400">{new Date(c.fecha).toLocaleDateString()} · <span className={c.estado === "COMPLETADO" ? "text-green-400" : c.estado === "PENDIENTE" ? "text-amber-400" : "text-zinc-400"}>{c.estado}</span> · {c.items.filter((i) => i.completado).length}/{c.items.length}</p>
              </button>
            ))}
            {checklists.length === 0 && <p className="text-sm text-zinc-500 text-center py-6">No hay checklists — crea el primero</p>}
          </div>
        </div>

        {/* Derecha: ejecutar */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">Selecciona un checklist para ejecutar</div>
          ) : (
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-mono text-zinc-500">{selected.ficha.proceso.codigo} · {selected.turno.nombre}</p>
                  <h2 className="text-lg font-bold">{selected.ficha.proceso.nombre}</h2>
                  <p className="text-xs text-zinc-400">Estado: {selected.estado}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-zinc-800 rounded-full">{selected.items.filter((i) => i.completado).length}/{selected.items.length}</span>
              </div>

              <div className="space-y-3">
                {selected.items.map((it) => (
                  <div key={it.id} className={`rounded-lg border p-4 ${it.completado ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-900 border-zinc-800"}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={it.completado} onChange={(e) => toggleItem(it.id, e.target.checked)} className="mt-1 w-4 h-4 accent-amber-600" />
                      <div className="flex-1">
                        <p className={`text-sm ${it.completado ? "line-through text-zinc-500" : "text-white"}`}>{it.descripcion}</p>
                        {it.evidenciaRequerida && <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded">Foto requerida</span>}
                        {it.evidencias.length > 0 && <p className="text-xs text-green-400 mt-1">✓ {it.evidencias.length} foto(s)</p>}
                      </div>
                    </label>
                    {it.evidenciaRequerida && (
                      <div className="mt-3">
                        <label className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer inline-block">
                          📷 Subir foto
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) subirFoto(it.id, f);
                          }} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={completar} disabled={selected.estado === "COMPLETADO"} className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-3 rounded-lg">
                {selected.estado === "COMPLETADO" ? "✓ Completado" : "Marcar como completado"}
              </button>
              <p className="text-xs text-zinc-500 text-center">Validación: todos los items completados y fotos requeridas presentes (trigger DB limita a 7 items).</p>
            </div>
          )}
        </div>
      </main>

      <BotonRojoIncidencia checklistId={selected?.id} />
    </div>
  );
}
