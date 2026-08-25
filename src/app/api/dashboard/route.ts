import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const [checklistsHoy, completadosHoy, verificadosHoy, incidenciasAbiertas, incidenciasCriticas, fichasActivas, ultimoReporte] = await Promise.all([
      tx.checklist.count({ where: { fecha: { gte: hoy } } }),
      tx.checklist.count({ where: { fecha: { gte: hoy }, estado: { in: ["COMPLETADO", "VERIFICADO"] } } }),
      tx.checklist.count({ where: { fecha: { gte: hoy }, estado: "VERIFICADO" } }),
      tx.incidencia.count({ where: { cerrado: false } }),
      tx.incidencia.count({ where: { cerrado: false, gravedad: "CRITICA" } }),
      tx.ficha.count({ where: { activo: true } }),
      tx.reporteDiario.findFirst({ orderBy: { fecha: "desc" } }),
    ]);

    // KPIs por área (top 5)
    const porArea = await tx.proceso.groupBy({
      by: ["areaId"],
      _count: { id: true },
    });

    return {
      checklistsHoy,
      completadosHoy,
      verificadosHoy,
      cumplimiento: checklistsHoy ? Math.round((completadosHoy / checklistsHoy) * 100) : 0,
      incidenciasAbiertas,
      incidenciasCriticas,
      fichasActivas,
      ultimoReporte,
      porArea,
    };
  });

  return NextResponse.json(data);
}
