// ============================================================
// src/app/inicio/page.tsx — Dashboard principal
// ============================================================
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LogoutButton from "@/components/LogoutButton";

// Cache 30s para que volver al home sea instantáneo
export const revalidate = 30;

export default async function InicioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Conteos sin transacción RLS (filtramos manual por sedeId, 3x más rápido al volver)
  const gteHoy = new Date(new Date().setHours(0, 0, 0, 0));
  const [checklistsHoy, incidenciasAbiertas, fichasActivas] = user.sedeId
    ? await Promise.all([
        prisma.checklist.count({ where: { sedeId: user.sedeId, fecha: { gte: gteHoy } } }),
        prisma.incidencia.count({ where: { cerrado: false, checklist: { sedeId: user.sedeId } } }),
        prisma.ficha.count({ where: { activo: true } }),
      ])
    : await Promise.all([
        prisma.checklist.count({ where: { fecha: { gte: gteHoy } } }),
        prisma.incidencia.count({ where: { cerrado: false } }),
        prisma.ficha.count({ where: { activo: true } }),
      ]);
  const data = { checklistsHoy, incidenciasAbiertas, fichasActivas };

  // Semáforo por área para GERENTE/SUPER_ADMIN (Julie/Erika/Fredy/Manolo) — verde/amarillo/rojo del día
  let semaforo: { id: string; codigo: string; nombre: string; icono: string | null; color: string | null; estado: "verde" | "amarillo" | "rojo" | "pendiente"; total: number; verificados: number }[] = [];
  if (user.sedeId && ["GERENTE", "SUPER_ADMIN"].includes(user.rol)) {
    const areas = await prisma.area.findMany({ where: { sedeId: user.sedeId, activo: true }, orderBy: { orden: "asc" } });
    semaforo = await Promise.all(
      areas.map(async (area) => {
        const checks = await prisma.checklist.findMany({
          where: { sedeId: user.sedeId!, fecha: { gte: gteHoy }, ficha: { proceso: { areaId: area.id } } },
          include: { incidencias: true, items: { select: { valor: true } } },
        });
        const total = checks.length;
        if (total === 0) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, color: area.color, estado: "rojo" as const, total, verificados: 0 };
        const conIncidencia = checks.some((c) => c.incidencias.length > 0 || c.items.some((i) => i.valor === "NO_CUMPLE") || c.estado === "RECHAZADO");
        if (conIncidencia) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, color: area.color, estado: "amarillo" as const, total, verificados: checks.filter((c) => c.estado === "VERIFICADO").length };
        const todosVerificados = checks.every((c) => c.estado === "VERIFICADO");
        if (todosVerificados) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, color: area.color, estado: "verde" as const, total, verificados: total };
        return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, color: area.color, estado: "pendiente" as const, total, verificados: checks.filter((c) => c.estado === "VERIFICADO").length };
      })
    );
  }

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

        {semaforo.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-gray-900 mb-3">Termómetro del día — por área {user.sedeId && `(${semaforo.length} áreas)`}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {semaforo.map((s) => (
                <Link
                  key={s.id}
                  href={`/historial?areaId=${s.id}`}
                  className={`rounded-lg border p-4 flex items-center gap-3 hover:shadow-md transition ${
                    s.estado === "verde"
                      ? "bg-green-50 border-green-200"
                      : s.estado === "amarillo"
                        ? "bg-amber-50 border-amber-200"
                        : s.estado === "rojo"
                          ? "bg-red-50 border-red-200"
                          : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <span className="text-2xl">{s.icono || "•"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.codigo} — {s.nombre}</p>
                    <p className="text-xs text-gray-600">{s.total === 0 ? "Sin checklist hoy" : `${s.verificados}/${s.total} verificados`}</p>
                  </div>
                  <span className={`w-3 h-3 rounded-full shrink-0 ${s.estado === "verde" ? "bg-green-500" : s.estado === "amarillo" ? "bg-amber-400" : s.estado === "rojo" ? "bg-red-500" : "bg-blue-400"}`} title={s.estado} />
                </Link>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">🟢 Verde: todo verificado sin incidencia · 🟡 Amarillo: con incidencia/rechazo · 🔴 Rojo: no se hizo hoy · 🔵 Pendiente de verificación</p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Accesos rápidos</h3>
            <div className="space-y-2">
              <Link href="/checklists" className="block text-orange-600 hover:underline">
                → Ver y ejecutar checklists (hoy)
              </Link>
              <Link href="/historial" className="block text-orange-600 hover:underline">
                → Historial por turno y por área
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
