"use client";
import { useEffect, useState } from "react";

type Pregunta = { id: string; numero: number; pregunta: string; respuesta: string };
type Ficha = {
  id: string;
  procesoId: string;
  version: number;
  activo: boolean;
  activoEfectivo: boolean;
  responsablePuesto: string | null;
  proceso: { codigo: string; nombre: string; area: { nombre: string; codigo: string; sedeId: string | null; sede?: { id: string; nombre: string } | null } };
  preguntas: Pregunta[];
};

export default function FichasClient({
  canEditMaster,
  canToggleSede,
  sedeId,
  rol,
}: {
  canEditMaster: boolean;
  canToggleSede: boolean;
  sedeId: string | null;
  rol: string;
}) {
  const [fichas, setFichas] = useState<Ficha[]>([]);
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([]);
  const [sedeFiltro, setSedeFiltro] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Ficha | null>(null);
  const [formPreguntas, setFormPreguntas] = useState<{ numero: number; pregunta: string; respuesta: string }[]>([]);
  const [filter, setFilter] = useState("");

  async function load() {
    setLoading(true);
    const [resFichas, resSedes] = await Promise.all([fetch("/api/fichas"), fetch("/api/usuarios")]);
    if (resFichas.ok) setFichas(await resFichas.json());
    else setMsg("Error cargando fichas");
    if (resSedes.ok) {
      const d = await resSedes.json();
      if (d.sedes) setSedes(d.sedes);
      // Por defecto SUPER_ADMIN ve su sede, JEFE ve solo la suya (ya filtrado por API)
      if (sedeId && !sedeFiltro) setSedeFiltro(sedeId);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) setFormPreguntas(editing.preguntas.map((p) => ({ numero: p.numero, pregunta: p.pregunta, respuesta: p.respuesta })));
  }, [editing]);

  async function toggleSede(f: Ficha) {
    // Para SUPER_ADMIN usa la sede de la ficha, para JEFE usa su sede
    const targetSedeId = rol === "SUPER_ADMIN" ? (f.proceso.area.sedeId || sedeId) : sedeId;
    if (!targetSedeId) return alert("Sin sede asignada");
    const next = !f.activoEfectivo;
    const res = await fetch("/api/fichas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: f.id, sedeId: targetSedeId, activo: next }),
    });
    if (!res.ok) alert((await res.json()).error || "Error");
    else load();
  }

  async function saveMaster(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (formPreguntas.length > 7) return alert("Máximo 7");
    const res = await fetch("/api/fichas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, preguntas: formPreguntas }),
    });
    if (!res.ok) alert((await res.json()).error || "Error");
    else { setEditing(null); load(); setMsg("Ficha actualizada (v" + (editing.version + 1) + ")"); }
  }

  const filtered = fichas.filter((f) => {
    if (sedeFiltro && f.proceso.area.sedeId !== sedeFiltro) return false;
    if (!filter) return true;
    return `${f.proceso.codigo} ${f.proceso.nombre} ${f.proceso.area.nombre}`.toLowerCase().includes(filter.toLowerCase());
  });

  // Agrupa por área
  const byArea = filtered.reduce((acc, f) => {
    const k = f.proceso.area.nombre;
    if (!acc[k]) acc[k] = [];
    acc[k].push(f);
    return acc;
  }, {} as Record<string, Ficha[]>);

  if (loading) return <p className="text-sm text-gray-500 py-10 text-center">Cargando 54 fichas...</p>;

  return (
    <div className="space-y-4">
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded">{msg}</div>}
      <div className="flex gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar: BAR, COM, apertura..." className="flex-1 border rounded px-3 py-2 text-sm" />
        {rol === "SUPER_ADMIN" && sedes.length > 0 && (
          <select value={sedeFiltro} onChange={(e) => setSedeFiltro(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="">Todas las sedes ({fichas.length})</option>
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {filtered.length} fichas {sedeFiltro ? `en ${sedes.find((s) => s.id === sedeFiltro)?.nombre || "sede"}` : ""} {filter && `(filtradas)`} — verde = activa{sedeFiltro ? ` en ${sedes.find((s) => s.id === sedeFiltro)?.nombre || "sede"}` : " en tu sede"}, gris = desactivada
      </p>

      <div className="space-y-6">
        {Object.entries(byArea).map(([area, list]) => (
          <div key={area} className="bg-white border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b font-semibold text-sm">{area} — {list.length} procesos</div>
            <div className="divide-y">
              {list.map((f) => (
                <div key={f.id} className={`p-3 flex items-start justify-between gap-3 ${!f.activoEfectivo ? "bg-gray-50 opacity-70" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono bg-gray-100 border px-1.5 py-0.5 rounded">{f.proceso.codigo}</span>
                      <span className="font-medium text-sm">{f.proceso.nombre}</span>
                      {rol === "SUPER_ADMIN" && f.proceso.area.sedeId && <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-1.5 py-0.5 rounded">{sedes.find((s) => s.id === f.proceso.area.sedeId)?.nombre || f.proceso.area.sedeId}</span>}
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${f.activoEfectivo ? "bg-green-50 border-green-200 text-green-700" : "bg-zinc-100 border-zinc-300 text-zinc-500"}`}>
                        {f.activoEfectivo ? "Activa" : "Oculta"}
                      </span>
                      <span className="text-xs text-gray-400">v{f.version}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {f.preguntas.slice(0, 3).map((p) => (
                        <li key={p.id} className="text-xs text-gray-600 truncate">{p.numero}. {p.pregunta}</li>
                      ))}
                      {f.preguntas.length > 3 && <li className="text-xs text-gray-400">+{f.preguntas.length - 3} más</li>}
                    </ul>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canToggleSede && (
                      <button
                        onClick={() => toggleSede(f)}
                        title={rol === "SUPER_ADMIN" ? `Afecta a ${sedes.find((s) => s.id === f.proceso.area.sedeId)?.nombre || f.proceso.area.sedeId}` : "Afecta a tu sede"}
                        className={`text-xs border px-2 py-1 rounded ${f.activoEfectivo ? "hover:bg-red-50" : "hover:bg-green-50"}`}
                      >
                        {f.activoEfectivo ? (rol === "SUPER_ADMIN" ? `Quitar de ${sedes.find((s) => s.id === f.proceso.area.sedeId)?.nombre?.split(" - ").pop() || "sede"}` : "Quitar de mi sede") : "Reactivar"}
                      </button>
                    )}
                    {canEditMaster && (
                      <button onClick={() => setEditing(f)} className="text-xs border px-2 py-1 rounded hover:bg-white">Editar 7</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveMaster} className="bg-white rounded-lg p-5 w-full max-w-2xl space-y-3 max-h-[85vh] overflow-auto">
            <h3 className="font-semibold">Editar {editing.proceso.codigo} — {editing.proceso.nombre} (solo SUPER_ADMIN)</h3>
            <p className="text-xs text-gray-500">Máximo 7 preguntas. Se versiona automáticamente.</p>
            {formPreguntas.map((p, i) => (
              <div key={i} className="border rounded p-2 space-y-1">
                <div className="flex gap-2">
                  <span className="text-xs font-mono bg-gray-100 px-1 py-1 rounded">#{p.numero}</span>
                  <button type="button" onClick={() => setFormPreguntas((prev) => prev.filter((_, j) => j !== i))} className="ml-auto text-xs text-red-600">Quitar</button>
                </div>
                <input value={p.pregunta} onChange={(e) => setFormPreguntas((prev) => prev.map((x, j) => (j === i ? { ...x, pregunta: e.target.value } : x)))} placeholder="Pregunta" className="w-full border rounded px-2 py-1 text-sm" />
                <textarea value={p.respuesta} onChange={(e) => setFormPreguntas((prev) => prev.map((x, j) => (j === i ? { ...x, respuesta: e.target.value } : x)))} placeholder="Respuesta esperada" className="w-full border rounded px-2 py-1 text-sm" rows={2} />
              </div>
            ))}
            {formPreguntas.length < 7 && (
              <button type="button" onClick={() => setFormPreguntas((prev) => [...prev, { numero: prev.length + 1, pregunta: "", respuesta: "" }])} className="text-xs border px-3 py-1 rounded">+ Agregar pregunta</button>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 border py-2 rounded text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded text-sm">Guardar (nueva versión)</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
