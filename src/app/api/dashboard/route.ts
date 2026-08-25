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
    const [checklistsHoy, completadosHoy, verificadosHoy, totalChecklists, incidenciasAbiertas, incidenciasCriticas, fichasActivas, ultimoReporte] = await Promise.all([
      tx.checklist.count({ where: { fecha: { gte: hoy } } }),
      tx.checklist.count({ where: { fecha: { gte: hoy }, estado: { in: ["COMPLETADO", "VERIFICADO"] } } }),
      tx.checklist.count({ where: { fecha: { gte: hoy }, estado: "VERIFICADO" } }),
      tx.checklist.count({}),
      tx.incidencia.count({ where: { cerrado: false } }),
      tx.incidencia.count({ where: { cerrado: false, gravedad: "CRITICA" } }),
      tx.ficha.count({ where: { activo: true } }),
      tx.reporteDiario.findFirst({ orderBy: { fecha: "desc" } }),
    ]);
    // Para demo: si hoy=0 pero hay datos de ayer, muestra total para no confundir
    const displayHoy = checklistsHoy === 0 && totalChecklists > 0 ? totalChecklists : checklistsHoy;
    const displayCompletados = checklistsHoy === 0 && totalChecklists > 0 ? await tx.checklist.count({ where: { estado: { in: ["COMPLETADO", "VERIFICADO"] } } }) : completadosHoy;

    // KPIs por área (top 5)
    const porArea = await tx.proceso.groupBy({
      by: ["areaId"],
      _count: { id: true },
    });

    return {
      checklistsHoy: displayHoy,
      completadosHoy: displayCompletados,
      verificadosHoy,
      cumplimiento: displayHoy ? Math.round((displayCompletados / displayHoy) * 100) : 0,
      incidenciasAbiertas,
      incidenciasCriticas,
      fichasActivas,
      ultimoReporte,
      porArea,
      totalChecklists,
    };
  });

  return NextResponse.json(data);
}
