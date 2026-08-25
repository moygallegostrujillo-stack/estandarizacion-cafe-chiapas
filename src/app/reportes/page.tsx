"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type Reporte = {
  id: string;
  sedeId: string;
  fecha: string;
  totalChecklists: number;
  completados: number;
  verificados: number;
  incidencias: number;
  incidenciasCriticas: number;
  sede: { nombre: string };
};

export default function ReportesPage() {
  const { data: session } = useSession();
  const user = session?.user as unknown as { rol: string } | null;
  const rol = user?.rol || "STAFF";
  const puedeVer = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(rol);
  const [reportes, setReportes] = useState<Reporte[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reportes")
      .then((r) => (r.ok ? r.json() : []))
      .then(setReportes)
      .finally(() => setLoading(false));
  }, []);

  if (!puedeVer) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8">Solo GERENTE o superior puede ver reportes</div>;
  if (loading) return <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Reportes Diarios</h1>
          <a href="/inicio" className="text-sm text-zinc-400 hover:text-white">← Inicio</a>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <p className="text-sm text-zinc-400 mb-6">Generados automáticamente al cerrar turno (trigger) + respaldo cron 6am <code className="text-xs bg-zinc-800 px-1 rounded">/api/cron/reporte-diario</code></p>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-800/50 text-zinc-400">
              <tr>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Sede</th>
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">Completados</th>
                <th className="px-4 py-3 text-center">Verificados</th>
                <th className="px-4 py-3 text-center">Incidencias</th>
                <th className="px-4 py-3 text-center">Críticas</th>
              </tr>
            </thead>
            <tbody>
              {reportes.map((r) => (
                <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="px-4 py-3">{new Date(r.fecha).toLocaleDateString()}</td>
                  <td className="px-4 py-3">{r.sede.nombre}</td>
                  <td className="px-4 py-3 text-center">{r.totalChecklists}</td>
                  <td className="px-4 py-3 text-center text-green-400">{r.completados}</td>
                  <td className="px-4 py-3 text-center text-blue-400">{r.verificados}</td>
                  <td className="px-4 py-3 text-center">{r.incidencias}</td>
                  <td className="px-4 py-3 text-center text-red-400">{r.incidenciasCriticas}</td>
                </tr>
              ))}
              {reportes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">Aún no hay reportes — se generan al verificar el último checklist del turno</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
