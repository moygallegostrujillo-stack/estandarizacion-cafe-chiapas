// ============================================================
// src/app/inicio/page.tsx — Dashboard principal
// ============================================================
import { getCurrentUser } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Cargar datos con contexto RLS
  const data = await withUserContext(
    user.id,
    user.rol,
    user.sedeId,
    async (tx) => {
      // Conteos básicos para el dashboard
      const [checklistsHoy, incidenciasAbiertas, fichasActivas] = await Promise.all([
        tx.checklist.count({
          where: {
            sedeId: user.sedeId || "",
            fecha: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
        tx.incidencia.count({
          where: { cerrado: false },
        }),
        tx.ficha.count({
          where: { activo: true },
        }),
      ]);

      return { checklistsHoy, incidenciasAbiertas, fichasActivas };
    }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">Café DeChiapas</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.nombre} · <span className="font-medium">{user.rol}</span>
            </span>
            <ThemeToggle />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            title="Checklists de hoy"
            value={data.checklistsHoy}
            href="/checklists"
            color="orange"
          />
          <StatCard
            title="Incidencias abiertas"
            value={data.incidenciasAbiertas}
            href="/incidencias"
            color="red"
          />
          <StatCard
            title="Fichas activas"
            value={data.fichasActivas}
            href="/fichas"
            color="blue"
          />
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Accesos rápidos</h3>
            <div className="space-y-2">
              <Link href="/checklists" className="block text-orange-600 hover:underline">
                → Ver y ejecutar checklists
              </Link>
              <Link href="/incidencias" className="block text-orange-600 hover:underline">
                → Reportar incidencia
              </Link>
              <Link href="/fichas" className="block text-orange-600 hover:underline">
                → Consultar fichas de proceso
              </Link>
              {["GERENTE", "SUPER_ADMIN", "JEFE_AREA"].includes(user.rol) && (
                <Link href="/reportes" className="block text-orange-600 hover:underline">
                  → Ver reportes y KPIs
                </Link>
              )}
              {user.rol === "SUPER_ADMIN" && (
                <Link href="/admin/usuarios" className="block text-orange-600 hover:underline">
                  → Administrar empleados / usuarios
                </Link>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Información del sistema</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-600">Versión:</dt>
                <dd className="font-medium">2.1.0</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Usuario:</dt>
                <dd className="font-medium">{user.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Rol:</dt>
                <dd className="font-medium">{user.rol}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-600">Sede:</dt>
                <dd className="font-medium">{user.sedeId ? "Asignada" : "Sin sede"}</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  href,
  color,
}: {
  title: string;
  value: number;
  href: string;
  color: "orange" | "red" | "blue";
}) {
  const colorClasses = {
    orange: "bg-orange-50 border-orange-200 text-orange-700",
    red: "bg-red-50 border-red-200 text-red-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  };

  return (
    <Link
      href={href}
      className={`block rounded-lg border p-6 hover:shadow-md transition-shadow ${colorClasses[color]}`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </Link>
  );
}
