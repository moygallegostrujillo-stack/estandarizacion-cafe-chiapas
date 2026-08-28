// ============================================================
// src/app/admin/usuarios/UsuariosClient.tsx — Client UI
// Solo SUPER_ADMIN (ya validado en server + middleware + API)
// ============================================================
"use client";

import { useEffect, useState } from "react";

type Sede = { id: string; nombre: string; activo: boolean };
type Usuario = {
  id: string;
  email: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  rol: string;
  sedeIdActiva: string | null;
  activo: boolean;
  sede: { id: string; nombre: string } | null;
  createdAt: string;
};

const ROLES = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR", "STAFF", "RRHH", "COMPRAS"] as const;

export default function UsuariosClient() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);

  // Form states
  const [form, setForm] = useState({ email: "", nombre: "", apellido: "", telefono: "", rol: "STAFF", sedeIdActiva: "", password: "" });
  const [editForm, setEditForm] = useState({ nombre: "", apellido: "", telefono: "", rol: "STAFF", sedeIdActiva: "", activo: true, password: "" });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/usuarios");
    if (!res.ok) {
      setMsg((await res.json()).error || "Error cargando usuarios");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setUsuarios(data.usuarios);
    setSedes(data.sedes);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (editing) {
      setEditForm({
        nombre: editing.nombre,
        apellido: editing.apellido || "",
        telefono: editing.telefono || "",
        rol: editing.rol,
        sedeIdActiva: editing.sedeIdActiva || "",
        activo: editing.activo,
        password: "",
      });
    }
  }, [editing]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const body: Record<string, string> = {
      email: form.email,
      nombre: form.nombre,
      rol: form.rol,
      password: form.password,
    };
    if (form.apellido) body.apellido = form.apellido;
    if (form.telefono) body.telefono = form.telefono;
    if (form.sedeIdActiva) body.sedeIdActiva = form.sedeIdActiva;

    const res = await fetch("/api/usuarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setMsg((await res.json()).error); return; }
    setMsg("Usuario creado");
    setForm({ email: "", nombre: "", apellido: "", telefono: "", rol: "STAFF", sedeIdActiva: "", password: "" });
    setShowCreate(false);
    load();
  }

  async function onEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setMsg(null);
    const body: Record<string, unknown> = { id: editing.id };
    if (editForm.nombre !== editing.nombre) body.nombre = editForm.nombre;
    if ((editForm.apellido || null) !== editing.apellido) body.apellido = editForm.apellido || null;
    if ((editForm.telefono || null) !== editing.telefono) body.telefono = editForm.telefono || null;
    if (editForm.rol !== editing.rol) body.rol = editForm.rol;
    if ((editForm.sedeIdActiva || null) !== editing.sedeIdActiva) body.sedeIdActiva = editForm.sedeIdActiva || null;
    if (editForm.activo !== editing.activo) body.activo = editForm.activo;
    if (editForm.password) body.password = editForm.password;

    if (Object.keys(body).length === 1) { setMsg("Sin cambios"); return; }

    const res = await fetch("/api/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { setMsg((await res.json()).error); return; }
    setMsg(editForm.password ? "Usuario actualizado + contraseña reseteada" : "Usuario actualizado");
    setEditing(null);
    load();
  }

  async function toggleActivo(u: Usuario) {
    const res = await fetch("/api/usuarios", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, activo: !u.activo }) });
    if (!res.ok) { setMsg((await res.json()).error); return; }
    load();
  }

  if (loading) return <p className="text-sm text-gray-500 py-10 text-center">Cargando usuarios...</p>;

  return (
    <div className="space-y-4">
      {msg && <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-2 rounded">{msg}</div>}

      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{usuarios.length} usuario(s) — solo SUPER_ADMIN puede gestionar</p>
        <button onClick={() => setShowCreate(!showCreate)} className="bg-gray-900 text-white text-sm px-4 py-2 rounded hover:bg-black">
          {showCreate ? "Cancelar" : "+ Nuevo usuario"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={onCreate} className="bg-white border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <input required placeholder="Email *" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input required placeholder="Nombre *" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Apellido" value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <input placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="border rounded px-3 py-2 text-sm" />
          <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="border rounded px-3 py-2 text-sm">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={form.sedeIdActiva} onChange={e => setForm({ ...form, sedeIdActiva: e.target.value })} className="border rounded px-3 py-2 text-sm">
            <option value="">Sin sede</option>
            {sedes.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <input required type="password" placeholder="Contraseña inicial (min 8) *" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="border rounded px-3 py-2 text-sm md:col-span-2" />
          <button type="submit" className="md:col-span-2 bg-orange-600 text-white py-2 rounded text-sm hover:bg-orange-700">Crear usuario</button>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Usuario</th>
                <th className="px-3 py-2 font-medium">Rol</th>
                <th className="px-3 py-2 font-medium">Sede</th>
                <th className="px-3 py-2 font-medium">Estado</th>
                <th className="px-3 py-2 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{u.nombre} {u.apellido || ""}</div>
                    <div className="text-xs text-gray-500">{u.email} {u.telefono ? `· ${u.telefono}` : ""}</div>
                  </td>
                  <td className="px-3 py-2"><span className="bg-gray-100 border px-2 py-0.5 rounded text-xs">{u.rol}</span></td>
                  <td className="px-3 py-2 text-xs">{u.sede?.nombre || <span className="text-gray-400">Sin sede</span>}</td>
                  <td className="px-3 py-2"><span className={`text-xs px-2 py-0.5 rounded border ${u.activo ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>{u.activo ? "Activo" : "Inactivo"}</span></td>
                  <td className="px-3 py-2 text-right space-x-1">
                    <button onClick={() => setEditing(u)} className="text-xs border px-2 py-1 rounded hover:bg-white">Editar</button>
                    <button onClick={() => toggleActivo(u)} className={`text-xs border px-2 py-1 rounded ${u.activo ? "hover:bg-red-50" : "hover:bg-green-50"}`}>{u.activo ? "Desactivar" : "Activar"}</button>
                  </td>
                </tr>
              ))}
              {usuarios.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin usuarios</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={() => setEditing(null)}>
          <form onClick={e => e.stopPropagation()} onSubmit={onEdit} className="bg-white rounded-lg p-5 w-full max-w-lg space-y-3">
            <h3 className="font-semibold">Editar: {editing.email}</h3>
            <input required value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Nombre" className="w-full border rounded px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input value={editForm.apellido} onChange={e => setEditForm({ ...editForm, apellido: e.target.value })} placeholder="Apellido" className="border rounded px-3 py-2 text-sm" />
              <input value={editForm.telefono} onChange={e => setEditForm({ ...editForm, telefono: e.target.value })} placeholder="Teléfono" className="border rounded px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={editForm.rol} onChange={e => setEditForm({ ...editForm, rol: e.target.value })} className="border rounded px-3 py-2 text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <select value={editForm.sedeIdActiva} onChange={e => setEditForm({ ...editForm, sedeIdActiva: e.target.value })} className="border rounded px-3 py-2 text-sm">
                <option value="">Sin sede</option>
                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}{!s.activo ? " (inactiva)" : ""}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editForm.activo} onChange={e => setEditForm({ ...editForm, activo: e.target.checked })} /> Activo</label>
            <input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Nueva contraseña (dejar vacío para no cambiar, min 8)" className="w-full border rounded px-3 py-2 text-sm" />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 border py-2 rounded text-sm">Cancelar</button>
              <button type="submit" className="flex-1 bg-gray-900 text-white py-2 rounded text-sm hover:bg-black">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
