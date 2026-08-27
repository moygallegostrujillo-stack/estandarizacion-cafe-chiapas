"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Sede = { id: string; nombre: string; direccion: string | null; telefono: string | null; activo: boolean; _count: { usuarios: number; areas: number } };

export default function SedesAdminPage() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { rol: string } | null;
  const rol = user?.rol || "STAFF";
  const esSuper = rol === "SUPER_ADMIN";
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Sede | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDireccion, setEditDireccion] = useState("");
  const [editTelefono, setEditTelefono] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/sedes");
    if (res.ok) setSedes(await res.json());
  }
  useEffect(() => { load(); }, []);

  function openEdit(s: Sede) {
    setEditing(s);
    setEditNombre(s.nombre);
    setEditDireccion(s.direccion || "");
    setEditTelefono(s.telefono || "");
    setEditActivo(s.activo);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setCreating(true);
    setMsg(null);
    const res = await fetch("/api/sedes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, direccion, telefono }),
    });
    const data = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) setMsg(data.error || "Error creando sede");
    else {
      setMsg(`✓ ${data.nombre} creada con ${data.totalFichas} fichas clonadas`);
      setNombre(""); setDireccion(""); setTelefono("");
      load();
    }
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const res = await fetch("/api/sedes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing.id, nombre: editNombre, direccion: editDireccion, telefono: editTelefono, activo: editActivo }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) alert(data.error || "Error guardando");
    else {
      setEditing(null);
      load();
    }
  }

  if (!esSuper) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8 text-center">Solo SUPER_ADMIN (admin@cafe.com) puede gestionar sedes. Tu rol: {rol}</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Admin — Sucursales</h1>
          <a href="/inicio" className="text-sm text-zinc-400 hover:text-white">← Inicio</a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 className="font-semibold mb-4">Nueva sucursal (clona 54 fichas de demo-sede-001)</h2>
          <form onSubmit={crear} className="space-y-3">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre ej. Café DeChiapas — Centro" required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección (opcional)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            <button type="submit" disabled={creating} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">{creating ? "Clonando 54 fichas..." : "Crear sucursal"}</button>
            {msg && <p className={`text-sm px-3 py-2 rounded-lg ${msg.startsWith("✓") ? "bg-green-900/30 text-green-300" : "bg-red-900/30 text-red-300"}`}>{msg}</p>}
          </form>
          <p className="text-xs text-zinc-500 mt-3">Clona: config, 3 turnos, 8 áreas, 54 procesos, fichas, preguntas, KPIs y riesgos. ~2s.</p>
        </div>

        <div className="space-y-3">
          <h2 className="font-semibold">Sucursales ({sedes.length}) — máx 3 para demo</h2>
          {sedes.map((s) => (
            <div key={s.id} className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{s.nombre}</p>
                  <p className="text-xs font-mono text-zinc-500">{s.id} · {s.activo ? "Activa" : "Inactiva"}</p>
                  <p className="text-xs text-zinc-400">{s.direccion || "Sin dirección"} · {s.telefono || "Sin teléfono"}</p>
                  <p className="text-xs text-zinc-500 mt-1">{s._count.areas} áreas · {s._count.usuarios} usuarios</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(s)} className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg">✏️ Editar</button>
                  {s.id !== "demo-sede-001" && (
                    <button onClick={async () => {
                      if (!confirm(`¿Eliminar ${s.nombre}? Borra áreas, procesos, fichas y checklists de esta sede (no se puede deshacer)`)) return;
                      const res = await fetch(`/api/sedes?id=${s.id}`, { method: "DELETE" });
                      if (res.ok) load(); else alert((await res.json()).error);
                    }} className="text-xs px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 border border-red-800 text-red-300 rounded-lg">🗑️ Eliminar</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {sedes.length === 0 && <p className="text-sm text-zinc-500 text-center py-8">Sin sedes</p>}
          {sedes.length >= 3 && <p className="text-xs text-amber-400 text-center">Demo limitado a 3 sucursales</p>}
        </div>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={guardarEdicion} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white">✏️ Editar sucursal</h3>
            <p className="text-xs font-mono text-zinc-500">{editing.id}</p>
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Nombre *</span>
              <input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} required className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Dirección</span>
              <input value={editDireccion} onChange={(e) => setEditDireccion(e.target.value)} placeholder="Av. Principal 123" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Teléfono</span>
              <input value={editTelefono} onChange={(e) => setEditTelefono(e.target.value)} placeholder="+52 961 123 4567" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editActivo} onChange={(e) => setEditActivo(e.target.checked)} className="accent-amber-600" />
              Activa
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white py-2 rounded-lg text-sm">Cancelar</button>
              <button type="submit" disabled={saving} className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg text-sm">{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
