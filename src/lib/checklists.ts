// ============================================================
// src/lib/checklists.ts — Lógica de negocio para Checklists
// ============================================================
// Extrae la lógica de candado, creación, PATCH palomita, verificación.

import { prisma } from "./prisma";
import { withUserContext } from "./db-session";
import type { Role } from "./auth";
import { tieneFiltroArea, puedeVerificar } from "./permisos";

// ---------- GET /api/checklists — listar checklists ----------
export async function listarChecklists(
  userId: string,
  rol: Role,
  sedeId: string | null,
  filtros: {
    estado?: string | null;
    fichaId?: string | null;
    areaId?: string | null;
    turnoId?: string | null;
    desde?: string | null;
    hasta?: string | null;
    hoy?: string | null;
  }
) {
  // Filtro de área para JEFE_AREA/STAFF
  let areaIdFiltro: string | null = null;
  if (tieneFiltroArea(rol)) {
    try {
      const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { areaId: true } as never });
      areaIdFiltro = (u as unknown as { areaId: string | null })?.areaId || null;
    } catch {}
  }

  const where: Record<string, unknown> = {};
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.fichaId) where.fichaId = filtros.fichaId;
  if (filtros.turnoId) where.turnoId = filtros.turnoId;
  if (areaIdFiltro) where.ficha = { proceso: { areaId: areaIdFiltro } };

  if (filtros.hoy === "1") {
    const gte = new Date(new Date().setHours(0, 0, 0, 0));
    where.fecha = { gte };
  } else if (filtros.desde || filtros.hasta) {
    const f: Record<string, Date> = {};
    if (filtros.desde) f.gte = new Date(filtros.desde + "T00:00:00");
    if (filtros.hasta) f.lte = new Date(filtros.hasta + "T23:59:59");
    where.fecha = f;
  }

  return withUserContext(userId, rol, sedeId, async (tx) => {
    return tx.checklist.findMany({
      where: where as never,
      include: {
        ficha: { include: { proceso: { include: { area: true } }, preguntas: true } },
        turno: true,
        ejecutor: { select: { nombre: true, email: true } },
        items: { include: { evidencias: true }, orderBy: { orden: "asc" } },
        _count: { select: { incidencias: true } },
      },
      orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
  });
}

// ---------- GET /api/checklists/[id] — detalle ----------
export async function obtenerChecklist(userId: string, rol: Role, sedeId: string | null, checklistId: string) {
  const data = await withUserContext(userId, rol, sedeId, async (tx) => {
    return tx.checklist.findUnique({
      where: { id: checklistId },
      include: {
        ficha: { include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } } },
        turno: true,
        items: { include: { evidencias: true }, orderBy: { orden: "asc" } },
        ejecutor: { select: { nombre: true, email: true } },
        verificador: { select: { nombre: true } },
      },
    });
  });

  if (!data) return null;

  // Añade signedUrl para fotos privadas
  try {
    const { getSignedUrl } = await import("./storage");
    for (const it of data.items) {
      for (const ev of it.evidencias as unknown as { url: string; signedUrl?: string }[]) {
        try { ev.signedUrl = await getSignedUrl(ev.url, 3600); } catch {}
      }
    }
  } catch {}

  return data;
}

// ---------- POST /api/checklists — crear checklist desde ficha ----------
export async function crearChecklist(
  userId: string,
  rol: Role,
  sedeId: string,
  input: {
    fichaId: string;
    turnoId: string;
    items?: { descripcion: string; evidenciaRequerida?: boolean; tipo?: string }[];
  }
) {
  return withUserContext(userId, rol, sedeId, async (tx) => {
    // Validar ficha existe y turno pertenece a sede
    const ficha = await tx.ficha.findUnique({
      where: { id: input.fichaId },
      include: { preguntas: { orderBy: { numero: "asc" } }, proceso: { include: { area: true } } },
    });
    if (!ficha) throw new Error("Ficha no encontrada");

    // Si es JEFE_AREA/STAFF con área asignada, solo puede crear de su área
    if (tieneFiltroArea(rol)) {
      try {
        const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { areaId: true } as never });
        const areaId = (u as unknown as { areaId: string | null })?.areaId;
        if (areaId && ficha.proceso.areaId !== areaId) throw new Error("Solo puedes crear checklists de tu área asignada");
      } catch (e) {
        if (e instanceof Error && e.message.includes("Solo puedes crear")) throw e;
      }
    }

    // Candado: fechaDia (YYYY-MM-DD America/Mexico_City) + unique DB
    const fechaDia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    const yaExiste = await tx.checklist.findFirst({
      where: { fichaId: input.fichaId, sedeId, turnoId: input.turnoId, fechaDia },
    });
    if (yaExiste) throw new Error("Ya creaste esta ficha, no puedes crearla nuevamente.");

    const turno = await tx.turno.findFirst({ where: { id: input.turnoId, sedeId } });
    if (!turno) throw new Error("Turno no válido para esta sede");

    let itemsToCreate: { descripcion: string; evidenciaRequerida: boolean; tipo: string; orden: number }[];
    if (input.items && input.items.length > 0) {
      if (input.items.length > 7) throw new Error("Máximo 7 items por checklist");
      itemsToCreate = input.items.map((it, i) => ({
        descripcion: it.descripcion,
        evidenciaRequerida: it.evidenciaRequerida ?? false,
        tipo: it.tipo ?? "BOOLEAN",
        orden: i,
      }));
    } else {
      // Generar desde las 7 preguntas de la ficha (modo estándar)
      itemsToCreate = ficha.preguntas.slice(0, 7).map((p, i) => ({
        descripcion: `${p.numero}. ${p.pregunta}: ${p.respuesta.slice(0, 80)}`,
        evidenciaRequerida: p.numero === 5,
        tipo: p.numero === 5 ? "FOTO" : "BOOLEAN",
        orden: i,
      }));
      if (itemsToCreate.length === 0) {
        itemsToCreate = [{ descripcion: ficha.procesoId, evidenciaRequerida: false, tipo: "BOOLEAN", orden: 0 }];
      }
    }

    let checklist;
    try {
      checklist = await tx.checklist.create({
        data: {
          fichaId: input.fichaId,
          sedeId,
          turnoId: input.turnoId,
          fechaDia,
          ejecutadoPor: userId,
          estado: "PENDIENTE",
          items: { create: itemsToCreate },
        } as never,
        include: { items: true, ficha: { include: { proceso: true } }, turno: true },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") || msg.includes("unique") || msg.includes("P2002") || msg.includes("fechaDia")) {
        throw new Error("Ya creaste esta ficha, no puedes crearla nuevamente.");
      }
      throw e;
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        entityType: "Checklist",
        entityId: checklist.id,
        action: "CREATE",
        userId,
        newValue: { fichaId: input.fichaId, turnoId: input.turnoId } as never,
      },
    });

    return checklist;
  });
}

// ---------- PATCH /api/checklists/[id] — actualizar items y estado ----------
export async function actualizarChecklist(
  userId: string,
  rol: Role,
  sedeId: string | null,
  checklistId: string,
  body: {
    items?: { id: string; completado?: boolean; valor?: string; nota?: string }[];
    estado?: string;
    notas?: string;
    motivo?: string;
  }
) {
  return withUserContext(userId, rol, sedeId, async (tx) => {
    const checklist = await tx.checklist.findUnique({ where: { id: checklistId }, include: { items: true } });
    if (!checklist) throw new Error("Checklist no encontrado");

    const isManager = puedeVerificar(rol);
    const isExecutor = checklist.ejecutadoPor === userId;
    const nextEstadoEarly = body.estado;

    // Verificación (VERIFICADO/RECHAZADO) solo managers/supervisores
    if (nextEstadoEarly === "VERIFICADO" || nextEstadoEarly === "RECHAZADO") {
      if (!isManager) throw new Error("Solo SUPERVISOR o superior puede verificar");
      if (isExecutor && rol !== "SUPER_ADMIN") throw new Error("No puedes verificar tu propio checklist — entra como supervisor@cafe.com");
      if (checklist.estado !== "COMPLETADO") throw new Error("Solo checklists COMPLETADO pueden verificarse");
    } else {
      if (!isExecutor && !isManager) {
        throw new Error("Solo el ejecutor o un manager puede editar");
      }
    }

    // Actualizar items si vienen — soporta paloma/tache
    if (Array.isArray(body.items)) {
      for (const it of body.items) {
        if (!it.id) continue;
        const isNoCumple = it.valor === "NO_CUMPLE";
        await tx.checklistItem.update({
          where: { id: it.id },
          data: {
            completado: isNoCumple ? false : it.completado,
            valor: it.valor ?? (it.completado ? "CUMPLE" : null),
            nota: it.nota,
            completadoPor: it.completado || isNoCumple ? userId : null,
          },
        });
      }
    }

    // Transición de estado con validaciones
    let nextEstado = body.estado;
    if (nextEstado === "COMPLETADO") {
      const items = await tx.checklistItem.findMany({ where: { checklistId } });
      const pendientes = items.filter((i) => !i.completado && i.valor !== "NO_CUMPLE");
      if (pendientes.length > 0) {
        throw new Error(`Faltan ${pendientes.length} items por evaluar (marca ✅ o ❌)`);
      }
      // Auto-crea incidencias para los taches
      for (const it of items.filter((i) => i.valor === "NO_CUMPLE")) {
        const ya = await tx.incidencia.findFirst({ where: { checklistId, descripcion: { contains: it.descripcion.slice(0, 20) } } });
        if (!ya) {
          await tx.incidencia.create({
            data: {
              checklistId,
              tipo: "OTRO",
              descripcion: `No cumple: ${it.descripcion} — ${it.nota || "sin motivo"}`,
              gravedad: "MEDIA",
              reportadoPor: userId,
            },
          });
        }
      }
      // Validar fotos
      const faltaEvidencia = items.filter((i) => i.evidenciaRequerida && i.completado);
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
        data.supervisorId = userId;
      }
      if (nextEstado === "RECHAZADO") {
        data.fechaVerificacion = new Date();
        data.supervisorId = userId;
        if (typeof body.motivo === "string" && body.motivo.trim()) data.notas = `RECHAZADO: ${body.motivo}`;
      }
    }
    if (typeof body.notas === "string") data.notas = body.notas;

    // Si no hay cambios de estado, retorna checklist actual
    if (Object.keys(data).length === 0) {
      return tx.checklist.findUnique({
        where: { id: checklistId },
        include: {
          ficha: { include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } } },
          turno: true,
          items: { include: { evidencias: true }, orderBy: { orden: "asc" } },
          ejecutor: { select: { nombre: true, email: true } },
          verificador: { select: { nombre: true } },
        },
      });
    }

    const updated = await tx.checklist.update({
      where: { id: checklistId },
      data: data as never,
      include: {
        ficha: { include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } } },
        turno: true,
        items: { include: { evidencias: true }, orderBy: { orden: "asc" } },
        ejecutor: { select: { nombre: true, email: true } },
        verificador: { select: { nombre: true } },
      },
    });

    // Añade signedUrl para fotos
    if (updated) {
      try {
        const { getSignedUrl } = await import("./storage");
        for (const it of (updated as unknown as { items: { evidencias: { url: string; signedUrl?: string }[] }[] }).items) {
          for (const ev of it.evidencias) {
            try { ev.signedUrl = await getSignedUrl(ev.url, 3600); } catch {}
          }
        }
      } catch {}
    }

    return updated;
  });
}
