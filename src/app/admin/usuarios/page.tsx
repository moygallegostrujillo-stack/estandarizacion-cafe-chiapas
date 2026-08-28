// ============================================================
// src/app/admin/usuarios/page.tsx — Server guard + Client UI
// ============================================================
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import UsuariosClient from "./UsuariosClient";

export default async function AdminUsuariosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.rol !== "SUPER_ADMIN") redirect("/inicio");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/inicio" className="text-sm text-gray-600 hover:text-gray-900">← Dashboard</Link>
            <h1 className="text-lg font-bold text-gray-900">Empleados / Usuarios</h1>
          </div>
          <span className="text-sm text-gray-600">{user.nombre} · {user.rol}</span>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Administración de usuarios</h2>
          <p className="text-sm text-gray-600">Solo SUPER_ADMIN. Crear, editar, resetear contraseña, activar/desactivar y asignar sede/rol.</p>
        </div>
        <UsuariosClient />
      </main>
    </div>
  );
}
