"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function InicioPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user as unknown as { name?: string; rol: string };

  if (!user) return null;

  const rol = (user as unknown as { rol: string }).rol || "STAFF";
  const esAdmin = rol === "SUPER_ADMIN" || rol === "GERENTE" || rol === "JEFE_AREA";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold text-amber-400">Cafe DeChiapas</h1>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <a href="/inicio" className="text-amber-400 font-medium">Inicio</a>
              {esAdmin && (
                <a href="/procesos" className="text-zinc-400 hover:text-white transition">Procesos</a>
              )}
              <a href="/checklists" className="text-zinc-400 hover:text-white transition">Checklists</a>
              {esAdmin && (
                <a href="/reportes" className="text-zinc-400 hover:text-white transition">Reportes</a>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-400">{user.name}</span>
            <span className="text-xs px-2 py-1 bg-zinc-800 rounded-full text-zinc-300">{rol}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="text-xs px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-red-300 rounded-lg transition"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-medium">Checklists Hoy</h3>
            <p className="text-3xl font-bold text-white mt-2">0</p>
            <p className="text-xs text-zinc-500 mt-1">Ninguno asignado aun</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-medium">Completados</h3>
            <p className="text-3xl font-bold text-green-400 mt-2">0</p>
            <p className="text-xs text-zinc-500 mt-1">0% de cumplimiento</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
            <h3 className="text-zinc-400 text-sm font-medium">Incidencias</h3>
            <p className="text-3xl font-bold text-amber-400 mt-2">0</p>
            <p className="text-xs text-zinc-500 mt-1">Sin reportes hoy</p>
          </div>
        </div>

        {/* Welcome card */}
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-2">
            Bienvenido, {user.name}
          </h2>
          <p className="text-zinc-400">
            {esAdmin
              ? "Accede a procesos, reportes y configuracion desde el menu superior."
              : "Revisa tus checklists y tareas del dia."}
          </p>
        </div>
      </main>
    </div>
  );
}
