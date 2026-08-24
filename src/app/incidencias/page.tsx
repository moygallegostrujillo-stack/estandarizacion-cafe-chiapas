"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import BotonRojoIncidencia from "@/components/BotonRojoIncidencia";

type Incidencia = {
  id: string;
  tipo: string;
  gravedad: string;
  descripcion: string;
  cerrado: boolean;
  cerradoEn: string | null;
  createdAt: string;
  reportador: { nombre: string; email: string };
  atendedor: { nombre: string } | null;
  checklist: { id: string; ficha: { proceso: { codigo: string; nombre: string } } } | null;
};

export default function IncidenciasPage() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { rol: string } | null;
  const rol = user?.rol || "STAFF";
  const puedeCerrar = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR"].includes(rol);
  const [items, setItems] = useState<Incidencia[]>([]);
  const [filtro, setFiltro] = useState<"todas" | "abiertas" | "cerradas">("abiertas");
  const [loading, setLoading] = useState(true);

  async function load() {
    const qs = filtro === "abiertas" ? "?cerrado=false" : filtro === "cerradas" ? "?cerrado=true" : "";
    const res = await fetch(`/api/incidencias${qs}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filtro]);

  async function cerrar(id: string) {
    const accion = prompt("Acción tomada (qué hiciste para resolver):") || "";
    if (!accion.trim()) return;
    const res = await fetch("/api/incidencias", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, accionTomada: accion, cerrado: true }),
    });
    if (!res.ok) alert((await res.json()).error || "Error");
    else load();
  }

  const gravedadColor: Record<string, string> = {
    CRITICA: "bg-red-900/60 text-red-300 border-red-800",
    ALTA: "bg-orange-900/40 text-orange-300 border-orange-800",
    MEDIA: "bg-amber-900/40 text-amber-300 border-amber-800",
    BAJA: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Incidencias</h1>
          <div className="flex items-center gap-4">
            <a href="/inicio" className="text-sm text-zinc-400 hover:text-white">← Inicio</a>
            <a href="/checklists" className="text-sm text-zinc-400 hover:text-white">Checklists</a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-zinc-400">{items.length} incidencias {filtro !== "todas" ? `· ${filtro}` : ""}</p>
          <div className="flex gap-2">
            {(["abiertas", "cerradas", "todas"] as const).map((f) => (
              <button key={f} onClick={() => setFiltro(f)} className={`text-xs px-3 py-1.5 rounded-full border capitalize ${filtro === f ? "bg-amber-600 border-amber-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {items.map((inc) => (
            <div key={inc.id} className={`rounded-xl border p-4 ${inc.cerrado ? "bg-zinc-900/60 border-zinc-800 opacity-70" : "bg-zinc-900 border-zinc-800"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${gravedadColor[inc.gravedad] || gravedadColor.BAJA}`}>{inc.gravedad}</span>
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-300">{inc.tipo}</span>
                    {inc.cerrado && <span className="text-xs px-2 py-0.5 bg-green-900/40 text-green-300 rounded-full">Cerrada</span>}
                    {inc.checklist && <span className="text-xs font-mono text-zinc-500">{inc.checklist.ficha.proceso.codigo}</span>}
                  </div>
                  <p className="text-sm text-white">{inc.descripcion}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {new Date(inc.createdAt).toLocaleString()} · por {inc.reportador.nombre} ({inc.reportador.email}) {inc.atendedor ? `· atendida por ${inc.atendedor.nombre}` : ""}
                  </p>
                </div>
                {!inc.cerrado && puedeCerrar && (
                  <button onClick={() => cerrar(inc.id)} className="text-xs bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg shrink-0">✓ Cerrar</button>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">No hay incidencias {filtro}</div>}
        </div>
      </main>

      <BotonRojoIncidencia />
    </div>
  );
}
