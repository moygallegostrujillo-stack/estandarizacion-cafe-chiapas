"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Pregunta = {
  id: string;
  numero: number;
  pregunta: string;
  respuesta: string;
};

type Ficha = {
  id: string;
  version: number;
  responsablePuesto: string | null;
  preguntas: Pregunta[];
};

type Proceso = {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  prioridad: string;
  frecuencia: string | null;
  fichas: Ficha[];
};

type Area = {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
  color: string | null;
  procesos: Proceso[];
};

export default function ProcesosPage() {
  const { data: session } = useSession();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArea, setExpandedArea] = useState<string | null>(null);
  const [selectedFicha, setSelectedFicha] = useState<{ codigo: string; ficha: Ficha } | null>(null);
  const user = session?.user as any;

  useEffect(() => {
    if (!user) return;
    fetch("/api/procesos")
      .then((r) => r.json())
      .then((data) => {
        setAreas(data);
        if (data.length > 0) setExpandedArea(data[0].codigo);
      })
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  const prioridadColor = (p: string) => {
    const colores: Record<string, string> = {
      CRITICO: "bg-red-900/50 text-red-300",
      ALTA: "bg-orange-900/50 text-orange-300",
      MEDIA: "bg-blue-900/50 text-blue-300",
    };
    return colores[p] || "bg-zinc-800 text-zinc-400";
  };

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
          <span className="text-sm text-zinc-400">{user.name}</span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold mb-2">Procesos</h2>
        <p className="text-zinc-400 mb-8">54 procesos organizados en 8 areas operativas</p>

        {loading ? (
          <div className="text-center py-20 text-zinc-500">Cargando...</div>
        ) : (
          <div className="space-y-4">
            {areas.map((area) => (
              <div key={area.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                <button
                  onClick={() => setExpandedArea(expandedArea === area.codigo ? null : area.codigo)}
                  className="w-full flex items-center justify-between p-5 hover:bg-zinc-800/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{area.icono}</span>
                    <div className="text-left">
                      <h3 className="font-semibold">{area.nombre}</h3>
                      <p className="text-xs text-zinc-500">{area.codigo} · {area.procesos.length} procesos</p>
                    </div>
                  </div>
                  <svg className={`w-5 h-5 text-zinc-400 transition-transform ${expandedArea === area.codigo ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedArea === area.codigo && (
                  <div className="border-t border-zinc-800">
                    {area.procesos.map((proceso) => {
                      const ficha = proceso.fichas[0];
                      return (
                        <div key={proceso.id} className="border-b border-zinc-800 last:border-b-0">
                          <button
                            onClick={() => setSelectedFicha(
                              selectedFicha?.codigo === proceso.codigo ? null : { codigo: proceso.codigo, ficha }
                            )}
                            className="w-full flex items-center justify-between px-5 py-3 hover:bg-zinc-800/30 transition"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-zinc-500 w-16">{proceso.codigo}</span>
                              <span>{proceso.nombre}</span>
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${prioridadColor(proceso.prioridad)}`}>
                              {proceso.prioridad}
                            </span>
                          </button>

                          {selectedFicha?.codigo === proceso.codigo && ficha && (
                            <div className="px-5 pb-4 pt-2 bg-zinc-800/20">
                              <div className="grid gap-3">
                                {ficha.preguntas.map((p) => (
                                  <div key={p.id} className="bg-zinc-800/40 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-amber-400 mb-1">
                                      {p.numero}. {p.pregunta}
                                    </p>
                                    <p className="text-sm text-zinc-300">{p.respuesta}</p>
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
