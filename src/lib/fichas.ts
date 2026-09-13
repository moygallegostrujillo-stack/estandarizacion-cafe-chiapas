// ============================================================
// src/lib/fichas.ts — Lógica de negocio para Fichas
// ============================================================
// Extrae la lógica de route.ts en funciones puras reutilizables.
// route.ts solo orquesta: auth → service → response.

import { prisma } from "./prisma";
import { withUserContext } from "./db-session";
import type { Role } from "./auth";
import { tieneFiltroArea, puedeToggleFicha, puedeEditarMaestro } from "./permisos";

// ---------- Types ----------
export type FichaConConfigs = Awaited<ReturnType<typeof prisma.ficha.findMany>>[number] & {
  sedeConfigs: { sedeId: string; activo: boolean }[];
  activoEfectivo?: boolean;
};

export type FichaListItem = {
  id: string;
  procesoId: string;
  version: number;
  activo: boolean;
  activoEfectivo: boolean;
  responsablePuesto: string | null;
  aprobadorPuesto: string | null;
  fechaCreacion: Date;
  proximaRevision: Date | null;
  createdAt: Date;
  updatedAt: Date;
  proceso: { id: string; codigo: string; nombre: string; areaId: string; area: { id: string; nombre: string; codigo: string; icono: string | null; color: string | null } };
  preguntas: { id: string; numero: number; pregunta: string; respuesta: string }[];
};

// ---------- GET /api/fichas — listar fichas con activoEfectivo por sede ----------
export async function listarFichas(
  userId: string,
  rol: Role,
  sedeId: string | null
): Promise<FichaListItem[]> {
  // Obtener areaId si el usuario tiene filtro por área
  let areaIdFiltro: string | null = null;
  if (tieneFiltroArea(rol)) {
    const u = await prisma.usuario.findUnique({ where: { id: userId }, select: { areaId: true } });
    areaIdFiltro = u?.areaId || null;
  }

  try {
    const data = await withUserContext(userId, rol, sedeId, async (tx) => {
      const whereArea = areaIdFiltro ? { proceso: { areaId: areaIdFiltro } } : {};
      return tx.ficha.findMany({
        where: whereArea as never,
        include: {
          proceso: { include: { area: true } },
          preguntas: { orderBy: { numero: "asc" } },
          sedeConfigs: true,
        },
        orderBy: [{ proceso: { area: { orden: "asc" } } }, { proceso: { orden: "asc" } }],
      });
    });

    return data.map((f) => {
      const cfg = (f.sedeConfigs as unknown as { sedeId: string; activo: boolean }[]).find((c) => c.sedeId === sedeId);
      const activoEfectivo = f.activo && (cfg ? cfg.activo : true);
      return { ...f, activoEfectivo, sedeConfigs: undefined } as FichaListItem;
    });
  } catch {
    // Fallback si tabla FichaSedeConfig aún no existe
    const data = await withUserContext(userId, rol, sedeId, async (tx) => {
      return tx.ficha.findMany({
        include: {
          proceso: { include: { area: true } },
          preguntas: { orderBy: { numero: "asc" } },
        },
        orderBy: [{ proceso: { area: { orden: "asc" } } }, { proceso: { orden: "asc" } }],
      });
    });
    return (data as unknown as { id: string; activo: boolean }[]).map((f) => ({
      ...f,
      activoEfectivo: (f as unknown as { activo: boolean }).activo,
    })) as FichaListItem[];
  }
}

// ---------- PATCH toggle ficha por sede ----------
export async function toggleFichaPorSede(
  userId: string,
  rol: Role,
  userSedeId: string | null,
  fichaId: string,
  sedeId: string,
  activo: boolean
) {
  if (!puedeToggleFicha(rol, userSedeId, sedeId)) {
    throw new Error("FORBIDDEN");
  }

  const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
  if (!sede) throw new Error("Sede no encontrada");

  let cfg;
  try {
    cfg = await prisma.fichaSedeConfig.upsert({
      where: { fichaId_sedeId: { fichaId, sedeId } },
      update: { activo },
      create: { fichaId, sedeId, activo },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("no existe") || msg.includes("FichaSedeConfig")) {
      // Auto-crea tabla si no existe
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "FichaSedeConfig" (
          id TEXT PRIMARY KEY,
          "fichaId" TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
          "sedeId" TEXT NOT NULL REFERENCES "Sede"(id) ON DELETE CASCADE,
          activo BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE("fichaId", "sedeId")
        );
        CREATE INDEX IF NOT EXISTS "FichaSedeConfig_fichaId_idx" ON "FichaSedeConfig"("fichaId");
        CREATE INDEX IF NOT EXISTS "FichaSedeConfig_sedeId_idx" ON "FichaSedeConfig"("sedeId");
      `);
      cfg = await prisma.fichaSedeConfig.upsert({
        where: { fichaId_sedeId: { fichaId, sedeId } },
        update: { activo },
        create: { fichaId, sedeId, activo },
      });
    } else throw e;
  }

  // Audit log (best effort)
  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Ficha",
        entityId: fichaId,
        action: activo ? "ACTIVAR_SEDE" : "DESACTIVAR_SEDE",
        newValue: { sedeId, activo } as never,
        userId,
      },
    });
  } catch {}

  return cfg;
}

// ---------- PATCH editar maestro (solo SUPER_ADMIN) ----------
export async function editarFichaMaestro(
  userId: string,
  rol: Role,
  sedeId: string | null,
  fichaId: string,
  data: {
    responsablePuesto?: string;
    aprobadorPuesto?: string;
    preguntas?: { numero: number; pregunta: string; respuesta: string }[];
  }
) {
  if (!puedeEditarMaestro(rol)) throw new Error("FORBIDDEN");
  if (data.preguntas && data.preguntas.length > 7) throw new Error("Máximo 7 preguntas");

  return withUserContext(userId, rol, sedeId, async (tx) => {
    const ficha = await tx.ficha.findUnique({ where: { id: fichaId }, include: { preguntas: true } });
    if (!ficha) throw new Error("Ficha no encontrada");

    // Snapshot version anterior
    await tx.fichaVersionSnapshot.create({
      data: {
        fichaId,
        version: ficha.version,
        contenido: { preguntas: ficha.preguntas, responsablePuesto: ficha.responsablePuesto } as never,
        creadoPor: userId,
      },
    });

    const updateData: Record<string, unknown> = { version: { increment: 1 } };
    if (data.responsablePuesto !== undefined) updateData.responsablePuesto = data.responsablePuesto;
    if (data.aprobadorPuesto !== undefined) updateData.aprobadorPuesto = data.aprobadorPuesto;

    await tx.ficha.update({ where: { id: fichaId }, data: updateData as never });

    if (Array.isArray(data.preguntas)) {
      await tx.preguntaFicha.deleteMany({ where: { fichaId } });
      for (const p of data.preguntas) {
        await tx.preguntaFicha.create({
          data: { fichaId, numero: p.numero, pregunta: p.pregunta, respuesta: p.respuesta },
        });
      }
    }

    return tx.ficha.findUnique({
      where: { id: fichaId },
      include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } },
    });
  });
}
