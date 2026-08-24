import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

// GET /api/checklists/[id] - detalle con items + evidencias
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.checklist.findUnique({
      where: { id },
      include: {
        ficha: { include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } } },
        turno: true,
        items: { include: { evidencias: true }, orderBy: { orden: "asc" } },
        ejecutor: { select: { nombre: true, email: true } },
        verificador: { select: { nombre: true } },
      },
    });
  });

  if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

// PATCH /api/checklists/[id] - actualiza items (completar, valor, nota) y estado
// Body: { items?: [{id, completado, valor, nota}], estado?: "EN_PROGRESO"|"COMPLETADO", notas?: string }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  try {
    const updated = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    const checklist = await tx.checklist.findUnique({ where: { id }, include: { items: true } });
    if (!checklist) throw new Error("Checklist no encontrado");

    const isManager = ["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR"].includes(user.rol);
    const isExecutor = checklist.ejecutadoPor === user.id;
    const nextEstadoEarly = body.estado as string | undefined;

    // Verificación (VERIFICADO/RECHAZADO) solo managers/supervisores
    // Demo: SUPER_ADMIN puede auto-verificar para probar flujo con un solo usuario; resto no
    if (nextEstadoEarly === "VERIFICADO" || nextEstadoEarly === "RECHAZADO") {
      if (!isManager) throw new Error("Solo SUPERVISOR o superior puede verificar");
      if (isExecutor && user.rol !== "SUPER_ADMIN") throw new Error("No puedes verificar tu propio checklist — entra como supervisor@cafe.com");
      if (checklist.estado !== "COMPLETADO") throw new Error("Solo checklists COMPLETADO pueden verificarse");
    } else {
      // Edición normal solo ejecutor o manager
      if (!isExecutor && !isManager) {
        throw new Error("Solo el ejecutor o un manager puede editar");
      }
    }

    // Actualizar items si vienen
    if (Array.isArray(body.items)) {
      for (const it of body.items as { id: string; completado?: boolean; valor?: string; nota?: string }[]) {
        if (!it.id) continue;
        await tx.checklistItem.update({
          where: { id: it.id },
          data: {
            completado: it.completado,
            valor: it.valor,
            nota: it.nota,
            completadoPor: it.completado ? user.id : null,
          },
        });
      }
    }

    // Transición de estado con validaciones
    let nextEstado = body.estado as string | undefined;
    if (nextEstado === "COMPLETADO") {
      const items = await tx.checklistItem.findMany({ where: { checklistId: id } });
      const pendientes = items.filter((i) => !i.completado);
      if (pendientes.length > 0) {
        throw new Error(`Faltan ${pendientes.length} items por completar`);
      }
      const faltaEvidencia = items.filter((i) => i.evidenciaRequerida && i.completado);
      // Validar que items con evidenciaRequerida tengan al menos 1 evidencia
      for (const it of faltaEvidencia) {
        const evCount = await tx.evidencia.count({ where: { checklistItemId: it.id } });
        if (evCount === 0) {
          throw new Error(`Item "${it.descripcion.slice(0, 30)}..." requiere foto`);
        }
      }
    }

    const data: Record<string, unknown> = {};
    if (nextEstado) {
      data.estado = nextEstado;
      if (nextEstado === "COMPLETADO") data.fechaEjecucion = new Date();
      if (nextEstado === "VERIFICADO") {
        data.fechaVerificacion = new Date();
        data.supervisorId = user.id;
      }
      if (nextEstado === "RECHAZADO") {
        data.fechaVerificacion = new Date();
        data.supervisorId = user.id;
        if (typeof body.motivo === "string" && body.motivo.trim()) data.notas = `RECHAZADO: ${body.motivo}`;
      }
    }
    if (typeof body.notas === "string") data.notas = body.notas;

    if (Object.keys(data).length === 0) {
      return tx.checklist.findUnique({ where: { id }, include: { items: true } });
    }

    return tx.checklist.update({
      where: { id },
      data: data as never,
      include: { items: { include: { evidencias: true } }, ficha: { include: { proceso: true } } },
    });
    });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error actualizando checklist";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
