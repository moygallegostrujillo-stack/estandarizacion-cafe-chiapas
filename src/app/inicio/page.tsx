"use client";

import { useSession } from "next-auth/react";

export default function InicioPage() {
  const { data: session } = useSession();
  const user = session?.user as any;

  if (!user) return null;

  const rol = user.rol || "STAFF";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-amber-400">Cafe DeChiapas</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.name}</span>
            <span className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-300">{rol}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm">Checklists Hoy</h3>
            <p className="text-3xl font-bold text-white mt-2">--</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm">Completados</h3>
            <p className="text-3xl font-bold text-green-400 mt-2">--</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm">Incidencias</h3>
            <p className="text-3xl font-bold text-red-400 mt-2">--</p>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Bienvenido, {user.name}</h2>
          <p className="text-zinc-400">
            {rol === "GERENTE" || rol === "SUPER_ADMIN" 
              ? "Accede a procesos, reportes y configuracion desde el menu lateral."
              : "Consulta tus checklists y tareas del dia."}
          </p>
        </div>
      </main>
    </div>
  );
}
