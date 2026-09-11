import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import FichasClient from "./FichasClient";
import LogoutButton from "@/components/LogoutButton";

export default async function FichasPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canEditMaster = user.rol === "SUPER_ADMIN";
  const canToggleSede = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(user.rol);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/inicio" className="text-sm text-gray-600 hover:text-gray-900">← Dashboard</Link>
            <h1 className="text-lg font-bold text-gray-900">Fichas / Procesos</h1>
            <span className="text-xs bg-gray-100 border px-2 py-1 rounded">54 procesos</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">{user.nombre} · {user.rol}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">54 fichas maestras</h2>
          <p className="text-sm text-gray-600">
            {canEditMaster
              ? "SUPER_ADMIN: edita las 7 preguntas, responsable y versiona. Jefe de área: desactiva fichas que no aplican en su sede."
              : canToggleSede
                ? "Puedes desactivar fichas que no aplican en tu sede — afecta solo tu sede, no borra el maestro."
                : "Consulta las fichas. Solo JEFE_AREA o superior puede gestionar."}
          </p>
        </div>
        <FichasClient canEditMaster={canEditMaster} canToggleSede={canToggleSede} sedeId={user.sedeId} rol={user.rol} />
      </main>
    </div>
  );
}
