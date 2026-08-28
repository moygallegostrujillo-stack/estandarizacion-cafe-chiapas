"use client";

import ThemeToggle from "@/components/ThemeToggle";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Pregunta = { id: string; numero: number; pregunta: string; respuesta: string };
type Ficha = { id: string; version: number; responsablePuesto: string | null; preguntas: Pregunta[] };
type Proceso = { id: string; codigo: string; nombre: string; descripcion: string | null; prioridad: string; frecuencia: string | null; fichas: Ficha[] };
type Area = { id: string; codigo: string; nombre: string; icono: string | null; color: string | null; procesos: Proceso[] };

function prioridadColor(p: string) {
  if (p === "CRITICO") return "bg-red-900/50 text-red-300";
  if (p === "ALTA") return "bg-orange-900/50 text-orange-300";
  if (p === "MEDIA") return "bg-blue-900/50 text-blue-300";
  return "bg-zinc-800 text-zinc-400";
}

export default function ProcesosPage() {
  const { data: session } = useSession();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [selectedFicha, setSelectedFicha] = useState<{ codigo: string; ficha: Ficha } | null>(null);
  const [showNuevo, setShowNuevo] = useState<string | null>(null);
  const [nCodigo, setNCodigo] = useState("");
  const [nNombre, setNNombre] = useState("");
  const [nPrioridad, setNPrioridad] = useState("MEDIA");
  const [editing, setEditing] = useState<Proceso | null>(null);

  const user = session?.user as unknown as { name?: string; rol?: string };
  const rol = (user as unknown as { rol: string } | null)?.rol || "STAFF";
  const puedeEditar = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(rol);

  useEffect(() => {
    if (!user) return;
    fetch("/api/procesos").then(r => r.json()).then(setAreas).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  async function load() {
    const r = await fetch("/api/procesos");
    if (r.ok) setAreas(await r.json());
  }

  async function onDelete(p: Proceso) {
    const msg = "Eliminar " + p.codigo + " - " + p.nombre + "? Se desactiva.";
    if (!confirm(msg)) return;
    const res = await fetch("/api/procesos?id=" + p.id, { method: "DELETE" });
    if (res.ok) {
      load();
    } else {
      const d = await res.json();
      alert(d.error);
    }
  }

  async function onCreate(areaId: string) {
    if (!nCodigo.trim() || !nNombre.trim()) return alert("Codigo y nombre requeridos");
    const res = await fetch("/api/procesos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: nCodigo, nombre: nNombre, areaId, prioridad: nPrioridad }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
    } else {
      setNCodigo("");
      setNNombre("");
      setShowNuevo(null);
      load();
    }
  }

  async function onSubmitEdit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/procesos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editing?.id, codigo: fd.get("codigo"), nombre: fd.get("nombre"), prioridad: fd.get("prioridad") }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.error);
    } else {
      setEditing(null);
      load();
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-amber-400">Cafe DeChiapas</h1>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="/inicio" className="text-zinc-400 hover:text-white transition">Inicio</a>
              <a href="/procesos" className="text-amber-400 font-medium">Procesos</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="text-sm text-zinc-400">{user.name}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-2xl font-bold">Procesos</h2>
          {puedeEditar && (
            <span className="text-xs px-3 py-1 bg-amber-900/30 border border-amber-800 text-amber-300 rounded-full">
              Edicion habilitada ({rol})
            </span>
          )}
        </div>
        <p className="text-zinc-400 mb-8">
          54 procesos organizados en 8 areas operativas{puedeEditar ? " - puedes crear, editar y eliminar" : ""}
        </p>

        {loading ? (
          <div className="text-center py-20 text-zinc-500">Cargando...</div>
        ) : editing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
            <form onClick={e => e.stopPropagation()} onSubmit={onSubmitEdit} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold">Editar proceso {editing.codigo}</h3>
              <input name="codigo" defaultValue={editing.codigo} placeholder="Codigo" required className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
              <input name="nombre" defaultValue={editing.nombre} placeholder="Nombre" required className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
              <select name="prioridad" defaultValue={editing.prioridad} className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
                <option value="CRITICO">CRITICO</option>
                <option value="ALTA">ALTA</option>
                <option value="MEDIA">MEDIA</option>
                <option value="BAJA">BAJA</option>
              </select>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-sm">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            {areas.map(area => (
              <div key={area.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <button onClick={() => setExpandedArea(expandedArea === area.codigo ? null : area.codigo)} className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/50 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{area.icono}</span>
                    <div className="text-left">
                      <h3 className="font-semibold">{area.nombre}</h3>
                      <p className="text-xs text-zinc-500">{area.codigo} - {area.procesos.length} procesos</p>
                    </div>
                  </div>
                  <svg className={"w-5 h-5 text-zinc-400 transition-transform " + (expandedArea === area.codigo ? "rotate-180" : "")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedArea === area.codigo && (
                  <div className="border-t border-zinc-800">
                    {puedeEditar && (
                      <div className="p-3 bg-zinc-800/20 border-b border-zinc-800">
                        {showNuevo !== area.id ? (
                          <button onClick={() => setShowNuevo(area.id)} className="w-full text-sm bg-zinc-800 hover:bg-zinc-700 border border-dashed border-zinc-600 rounded-lg py-2">
                            + Nuevo proceso en {area.nombre}
                          </button>
                        ) : (
                          <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <input value={nCodigo} onChange={e => setNCodigo(e.target.value)} placeholder="Codigo ej. BAR-08" className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
                              <select value={nPrioridad} onChange={e => setNPrioridad(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm">
                                <option value="CRITICO">CRITICO</option>
                                <option value="ALTA">ALTA</option>
                                <option value="MEDIA">MEDIA</option>
                                <option value="BAJA">BAJA</option>
                              </select>
                            </div>
                            <input value={nNombre} onChange={e => setNNombre(e.target.value)} placeholder="Nombre del proceso" className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm" />
                            <div className="flex gap-2">
                              <button onClick={() => setShowNuevo(null)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 py-2 rounded-lg text-sm">
                                Cancelar
                              </button>
                              <button onClick={() => onCreate(area.id)} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2 rounded-lg text-sm">
                                Crear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {area.procesos.map(p => {
                      const ficha = p.fichas[0];
                      return (
                        <div key={p.id} className="border-b border-zinc-800 last:border-b-0">
                          <div className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30">
                            <button onClick={() => setSelectedFicha(selectedFicha?.codigo === p.codigo ? null : { codigo: p.codigo, ficha })} className="flex-1 flex items-center gap-3 text-left">
                              <span className="text-xs font-mono text-zinc-500 w-16">{p.codigo}</span>
                              <span>{p.nombre}</span>
                              <span className={"ml-auto text-xs px-2 py-0.5 rounded-full " + prioridadColor(p.prioridad)}>{p.prioridad}</span>
                            </button>
                            {puedeEditar && (
                              <div className="flex gap-1 ml-3">
                                <button onClick={() => setEditing(p)} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-xs" title="Editar">
                                  Editar
                                </button>
                                <button onClick={() => onDelete(p)} className="p-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800 rounded text-xs" title="Eliminar">
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                          {selectedFicha?.codigo === p.codigo && ficha && (
                            <div className="px-5 pb-4 pt-2 bg-zinc-800/20">
                              <div className="grid gap-3">
                                {ficha.preguntas.map(q => (
                                  <div key={q.id} className="bg-zinc-800/40 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-amber-400 mb-1">{q.numero}. {q.pregunta}</p>
                                    <p className="text-sm text-zinc-300">{q.respuesta}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
