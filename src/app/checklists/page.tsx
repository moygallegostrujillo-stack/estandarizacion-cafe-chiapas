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
  items: { id: string; descripcion: string; completado: boolean; evidenciaRequerida: boolean; tipo: string; valor: string | null; evidencias: { id: string; url: string }[] }[];
};

type AreaOpt = {
  id: string;
  codigo: string;
  nombre: string;
  procesos: { id: string; codigo: string; nombre: string; fichas: { id: string; preguntas: { numero: number; pregunta: string; respuesta: string }[] }[] }[];
};
type TurnoOpt = { id: string; nombre: string };
type DraftItem = { descripcion: string; evidenciaRequerida: boolean; tipo: string };

export default function ChecklistsPage() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { id: string; rol: string } | null;
  const rol = (user as unknown as { rol: string } | null)?.rol || "STAFF";
  const esSupervisor = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR"].includes(rol);
  const puedeEditarDemo = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(rol);

  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [areas, setAreas] = useState<AreaOpt[]>([]);
  const [turnos, setTurnos] = useState<TurnoOpt[]>([]);
  const [fichaId, setFichaId] = useState("");
  const [turnoId, setTurnoId] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [selected, setSelected] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Cuando cambia ficha, precargar draft desde sus 7 preguntas
  useEffect(() => {
    if (!fichaId) { setDraftItems([]); return; }
    const ficha = areas.flatMap((a) => a.procesos).find((p) => p.fichas[0]?.id === fichaId)?.fichas[0];
    if (ficha?.preguntas?.length) {
      setDraftItems(
        ficha.preguntas.slice(0, 7).map((p) => ({
          descripcion: `${p.numero}. ${p.pregunta}: ${p.respuesta.slice(0, 90)}`,
          evidenciaRequerida: p.numero === 5,
          tipo: p.numero === 5 ? "FOTO" : "BOOLEAN",
        }))
      );
    } else {
      setDraftItems([{ descripcion: "", evidenciaRequerida: false, tipo: "BOOLEAN" }]);
    }
  }, [fichaId, areas]);

  async function crear() {
    if (!fichaId || !turnoId) return alert("Selecciona ficha y turno");
    const items = draftItems.filter((d) => d.descripcion.trim().length > 0);
    if (items.length === 0) return alert("Añade al menos 1 pregunta");
    if (items.length > 7) return alert("Máximo 7 items");
    if (!puedeEditarDemo && items.length !== 7) return alert("STAFF debe usar 7 items de la ficha");
    setCreating(true);
    const res = await fetch("/api/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fichaId, turnoId, items }),
    });
    setCreating(false);
    if (!res.ok) return alert((await res.json()).error || "Error");
    const nuevo = await res.json();
    setChecklists((p) => [nuevo, ...p]);
    setFichaId("");
    setTurnoId("");
    setDraftItems([]);
  }

  async function toggleItem(itemId: string, completado: boolean) {
    if (!selected) return;
    await fetch(`/api/checklists/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ id: itemId, completado }] }),
    });
    setSelected((s) => (s ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, completado } : it)) } : null));
  }

  async function subirFoto(itemId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("checklistItemId", itemId);
    const res = await fetch("/api/evidencias", { method: "POST", body: fd });
    if (!res.ok) alert((await res.json()).error);
    else {
      const r = await fetch(`/api/checklists/${selected!.id}`);
      if (r.ok) setSelected(await r.json());
    }
  }

  async function completar() {
    if (!selected) return;
    setErrorMsg(null);
    // Validación local antes de llamar API: muestra por qué no deja completar
    const faltaFoto = selected.items.filter((it) => it.evidenciaRequerida && it.completado && it.evidencias.length === 0);
    if (faltaFoto.length > 0) {
      setErrorMsg(`Falta foto en: ${faltaFoto.map((f) => f.descripcion.slice(0, 35)).join(", ")} — sube foto con 📷`);
      return;
    }
    const res = await fetch(`/api/checklists/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "COMPLETADO" }),
    });
    if (!res.ok) {
      let data: { error?: string } = {};
      try { data = await res.json(); } catch { data = { error: "Error al completar" }; }
      setErrorMsg(data.error || "Error al completar");
    } else {
      const data = await res.json();
      setSelected(data);
      loadChecklists();
    }
  }

  async function verificar(estado: "VERIFICADO" | "RECHAZADO") {
    if (!selected) return;
    let motivo: string | undefined;
    if (estado === "RECHAZADO") {
      motivo = prompt("Motivo del rechazo:") || "";
      if (!motivo.trim()) return;
    }
    const res = await fetch(`/api/checklists/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, motivo }),
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
            <h3 className="font-semibold mb-3">Nuevo checklist {puedeEditarDemo ? <span className="text-xs font-normal text-amber-400">(editable demo)</span> : null}</h3>
            <div className="space-y-3">
              <select value={fichaId} onChange={(e) => setFichaId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Ficha (54 procesos)</option>
                {areas.flatMap((a) => a.procesos.map((p) => <option key={p.fichas[0]?.id} value={p.fichas[0]?.id}>{p.codigo} — {p.nombre}</option>))}
              </select>
              <select value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm">
                <option value="">Turno</option>
                {turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                {turnos.length === 0 && (
                  <>
                    <option value="">—</option>
                  </>
                )}
              </select>

              {/* Editor flexible demo 5-7 */}
              {fichaId && (
                <div className="space-y-2 border-t border-zinc-800 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">✏️ Preguntas editables ({draftItems.length}/7)</p>
                    {puedeEditarDemo && <span className="text-xs px-2 py-0.5 bg-amber-900/30 border border-amber-800 text-amber-300 rounded-full">Demo flexible</span>}
                  </div>
                  {!puedeEditarDemo && <p className="text-xs text-zinc-500">STAFF usa las 7 preguntas fijas de la ficha</p>}
                  {draftItems.map((it, idx) => (
                    <div key={idx} className="bg-zinc-800/60 rounded-lg p-2 space-y-2 border border-transparent hover:border-zinc-700 transition">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-zinc-500 mt-2 w-4">{idx + 1}.</span>
                        <textarea
                          value={it.descripcion}
                          onChange={(e) => setDraftItems((prev) => prev.map((p, i) => (i === idx ? { ...p, descripcion: e.target.value } : p)))}
                          placeholder={`✏️ Escribe la pregunta ${idx + 1}... (ej. ¿Temperatura del refri?)`}
                          rows={2}
                          disabled={!puedeEditarDemo}
                          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm disabled:opacity-60 focus:border-amber-600 focus:outline-none"
                        />
                        {puedeEditarDemo && (
                          <button onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== idx))} title="Borrar esta pregunta" className="mt-1 p-1.5 bg-zinc-900 hover:bg-red-900/50 border border-zinc-700 hover:border-red-700 rounded text-zinc-400 hover:text-red-300">
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between pl-6">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input type="checkbox" checked={it.evidenciaRequerida} onChange={(e) => setDraftItems((prev) => prev.map((p, i) => (i === idx ? { ...p, evidenciaRequerida: e.target.checked } : p)))} disabled={!puedeEditarDemo} className="accent-amber-600" />
                          📷 Foto obligatoria
                        </label>
                        {puedeEditarDemo && <span className="text-xs text-zinc-500">✏️ editable</span>}
                      </div>
                    </div>
                  ))}
                  {puedeEditarDemo && draftItems.length < 7 && (
                    <button onClick={() => setDraftItems((prev) => [...prev, { descripcion: "", evidenciaRequerida: false, tipo: "BOOLEAN" }])} className="w-full text-xs bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 rounded-lg py-2">+ Añadir pregunta ({draftItems.length}/7)</button>
                  )}
                  {puedeEditarDemo && draftItems.length >= 5 && draftItems.length <= 7 && <p className="text-xs text-green-400 text-center">✓ {draftItems.length} preguntas — listo para demo (5-7)</p>}
                  {draftItems.length === 7 && <p className="text-xs text-amber-400 text-center">Máximo 7 alcanzado (trigger DB)</p>}
                  <p className="text-xs text-zinc-500 text-center">💡 Borra con 🗑️ la pregunta que no aplique y escribe la tuya con ✏️</p>
                </div>
              )}

              <button onClick={crear} disabled={creating || !fichaId || !turnoId} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">
                {creating ? "Creando..." : `Crear checklist (${draftItems.filter((d) => d.descripcion.trim()).length || 7} items)`}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-zinc-300">Mis checklists ({checklists.length})</h3>
            {checklists.map((c) => (
              <button
                key={c.id}
                onClick={async () => {
                  const r = await fetch(`/api/checklists/${c.id}`);
                  if (r.ok) setSelected(await r.json());
                  else setSelected(c);
                }}
                className={`w-full text-left bg-zinc-900 border rounded-xl p-4 hover:bg-zinc-800/80 ${selected?.id === c.id ? "border-amber-600" : "border-zinc-800"}`}
              >
                <p className="text-xs font-mono text-zinc-500">{c.ficha.proceso.codigo} · {c.turno.nombre}</p>
                <p className="font-medium text-sm">{c.ficha.proceso.nombre}</p>
                <p className="text-xs text-zinc-400">
                  {new Date(c.fecha).toLocaleDateString()} · <span className={c.estado === "COMPLETADO" ? "text-green-400" : c.estado === "PENDIENTE" ? "text-amber-400" : c.estado === "VERIFICADO" ? "text-blue-400" : "text-zinc-400"}>{c.estado}</span> · {c.items.filter((i) => i.completado).length}/{c.items.length}
                </p>
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
                  <p className="text-xs text-zinc-400">Estado: {selected.estado} · {selected.items.length} preguntas</p>
                </div>
                <span className="text-xs px-2 py-1 bg-zinc-800 rounded-full">{selected.items.filter((i) => i.completado).length}/{selected.items.length}</span>
              </div>

              <div className="space-y-3">
                {selected.items.map((it) => (
                  <div key={it.id} className={`rounded-lg border p-4 ${it.completado ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-900 border-zinc-800"}`}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input type="checkbox" checked={it.completado} onChange={(e) => toggleItem(it.id, e.target.checked)} className="mt-1 w-4 h-4 accent-amber-600" disabled={selected.estado !== "PENDIENTE" && selected.estado !== "EN_PROGRESO"} />
                      <div className="flex-1">
                        <p className={`text-sm ${it.completado ? "line-through text-zinc-500" : "text-white"}`}>{it.descripcion}</p>
                        {it.evidenciaRequerida && <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-amber-900/40 text-amber-300 rounded">Foto requerida</span>}
                        {it.evidencias.length > 0 && <p className="text-xs text-green-400 mt-1">✓ {it.evidencias.length} foto(s)</p>}
                      </div>
                    </label>
                    {it.evidenciaRequerida && (selected.estado === "PENDIENTE" || selected.estado === "EN_PROGRESO") && (
                      <div className="mt-3">
                        <label className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-1.5 rounded-lg cursor-pointer inline-block">
                          📷 Subir foto
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subirFoto(it.id, f); }} />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {selected.estado === "PENDIENTE" || selected.estado === "EN_PROGRESO" ? (
                <>
                  {(() => {
                    const faltaFoto = selected.items.filter((it) => it.evidenciaRequerida && it.completado && it.evidencias.length === 0);
                    const todosCompletados = selected.items.every((it) => it.completado);
                    const bloqueado = faltaFoto.length > 0 || !todosCompletados;
                    return (
                      <>
                        <button
                          onClick={completar}
                          disabled={bloqueado}
                          className={`w-full font-semibold py-3 rounded-lg transition ${bloqueado ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700" : "bg-green-600 hover:bg-green-500 text-white"}`}
                        >
                          {bloqueado ? (faltaFoto.length > 0 ? `Falta foto (${faltaFoto.length})` : "Marca todos los items") : "Marcar como completado ✓"}
                        </button>
                        {errorMsg && <div className="bg-red-900/40 border border-red-800 text-red-300 text-sm px-4 py-2 rounded-lg">{errorMsg}</div>}
                        <p className="text-xs text-zinc-500 text-center">Demo flexible: {selected.items.length} items (5-7). Validación: todos completados + fotos requeridas.</p>
                      </>
                    );
                  })()}
                </>
              ) : selected.estado === "COMPLETADO" ? (
                esSupervisor ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => verificar("VERIFICADO")} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg">✓ Aprobar</button>
                    <button onClick={() => verificar("RECHAZADO")} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-3 rounded-lg">✕ Rechazar</button>
                  </div>
                ) : (
                  <div className="bg-amber-900/30 border border-amber-800 text-amber-300 text-sm px-4 py-3 rounded-lg text-center">Esperando verificación de supervisor</div>
                )
              ) : (
                <div className={`text-center text-sm px-4 py-3 rounded-lg border ${selected.estado === "VERIFICADO" ? "bg-green-900/30 border-green-800 text-green-300" : "bg-red-900/30 border-red-800 text-red-300"}`}>{selected.estado === "VERIFICADO" ? "✓ Verificado por supervisor" : "✕ Rechazado — ver notas"}</div>
              )}
            </div>
          )}
        </div>
      </main>

      <BotonRojoIncidencia checklistId={selected?.id} />
    </div>
  );
}
