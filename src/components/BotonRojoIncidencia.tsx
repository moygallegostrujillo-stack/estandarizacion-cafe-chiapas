"use client";

import { useState } from "react";

type Props = {
  checklistId?: string;
  fichaId?: string;
};

export default function BotonRojoIncidencia({ checklistId, fichaId }: Props) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("OTRO");
  const [gravedad, setGravedad] = useState("MEDIA");
  const [descripcion, setDescripcion] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 5) return;
    setSaving(true);
    const res = await fetch("/api/incidencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, gravedad, descripcion, checklistId, fichaId }),
    });
    setSaving(false);
    if (res.ok) {
      setDone(true);
      setDescripcion("");
      setTimeout(() => {
        setDone(false);
        setOpen(false);
      }, 1500);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-3 rounded-full shadow-lg shadow-red-900/40 transition"
        aria-label="Reportar incidencia"
      >
        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        Incidencia
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submit}
            className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">🚨 Reportar incidencia</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <p className="text-xs text-zinc-500">15 segundos — se notifica al supervisor de turno</p>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-xs text-zinc-400">Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="FALTANTE">Faltante</option>
                  <option value="FALLA_EQUIPO">Falla equipo</option>
                  <option value="ROBO">Robo</option>
                  <option value="CADUCIDAD">Caducidad</option>
                  <option value="OTRO">Otro</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs text-zinc-400">Gravedad</span>
                <select value={gravedad} onChange={(e) => setGravedad(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                  <option value="CRITICA">Crítica (SLA 15m)</option>
                </select>
              </label>
            </div>

            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Descripción *</span>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Qué pasó, dónde, qué se necesita..."
                required
                minLength={5}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500"
              />
            </label>

            {done ? (
              <div className="bg-green-900/50 text-green-300 text-sm px-4 py-2 rounded-lg">✓ Incidencia reportada</div>
            ) : (
              <button type="submit" disabled={saving || descripcion.trim().length < 5} className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition">
                {saving ? "Enviando..." : "Enviar incidencia"}
              </button>
            )}
          </form>
        </div>
      )}
    </>
  );
}
