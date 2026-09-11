import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

// GET /api/fichas — lista 54 fichas con preguntas + activo por sede
export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // JEFE_AREA y STAFF con área asignada solo ven su área
  let areaIdFiltro: string | null = null;
  if (["JEFE_AREA", "STAFF"].includes(user.rol)) {
    try {
      const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: { areaId: true } as never });
      areaIdFiltro = (u as unknown as { areaId: string | null })?.areaId || null;
    } catch {}
  }

  try {
    const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      const whereArea = areaIdFiltro ? { proceso: { areaId: areaIdFiltro } } : {};
      const fichas = await tx.ficha.findMany({
        where: whereArea as never,
        include: {
          proceso: { include: { area: true } },
          preguntas: { orderBy: { numero: "asc" } },
          sedeConfigs: true,
        },
        orderBy: [{ proceso: { area: { orden: "asc" } } }, { proceso: { orden: "asc" } }],
      });
      return fichas;
    });

    const enriched = data.map((f: typeof data[number]) => {
      const cfg = (f.sedeConfigs as unknown as { sedeId: string; activo: boolean }[]).find((c) => c.sedeId === user.sedeId);
      const activoEfectivo = f.activo && (cfg ? cfg.activo : true);
      return { ...f, activoEfectivo, sedeConfigs: undefined };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    // Fallback si tabla FichaSedeConfig aún no existe (migración pendiente)
    const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      return tx.ficha.findMany({
        include: {
          proceso: { include: { area: true } },
          preguntas: { orderBy: { numero: "asc" } },
        },
        orderBy: [{ proceso: { area: { orden: "asc" } } }, { proceso: { orden: "asc" } }],
      });
    });
    const enriched = (data as unknown as { id: string; activo: boolean }[]).map((f) => ({ ...f, activoEfectivo: (f as unknown as { activo: boolean }).activo }));
    return NextResponse.json(enriched);
  }
}

// PATCH /api/fichas — dos modos:
// 1) Editar maestro (SUPER_ADMIN): { id, responsablePuesto, preguntas: [{numero, pregunta, respuesta}] }
// 2) Toggle por sede (JEFE_AREA para su sede, SUPER_ADMIN para cualquiera): { id, sedeId, activo }
export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  // Modo 2: toggle por sede
  if (body.sedeId !== undefined) {
    const { id, sedeId, activo } = body as { id: string; sedeId: string; activo: boolean };
    if (!id || !sedeId) return NextResponse.json({ error: "id y sedeId requeridos" }, { status: 400 });
    const canToggle =
      user.rol === "SUPER_ADMIN" || (["GERENTE", "JEFE_AREA"].includes(user.rol) && user.sedeId === sedeId);
    if (!canToggle) return NextResponse.json({ error: "No autorizado para esta sede" }, { status: 403 });

    const sede = await prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) return NextResponse.json({ error: "Sede no encontrada" }, { status: 400 });

    let cfg;
    try {
      cfg = await prisma.fichaSedeConfig.upsert({
        where: { fichaId_sedeId: { fichaId: id, sedeId } },
        update: { activo },
        create: { fichaId: id, sedeId, activo },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("does not exist") || msg.includes("no existe") || msg.includes("FichaSedeConfig")) {
        // Auto-crea tabla si no existe (evita migración manual)
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
          where: { fichaId_sedeId: { fichaId: id, sedeId } },
          update: { activo },
          create: { fichaId: id, sedeId, activo },
        });
      } else throw e;
    }

    try {
      await prisma.auditLog.create({
        data: {
          entityType: "Ficha",
          entityId: id,
          action: activo ? "ACTIVAR_SEDE" : "DESACTIVAR_SEDE",
          newValue: { sedeId, activo } as never,
          userId: user.id,
        },
      });
    } catch {}

    return NextResponse.json(cfg);
  }

  // Modo 1: editar maestro
  if (user.rol !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo SUPER_ADMIN edita maestros" }, { status: 403 });

  const { id, responsablePuesto, aprobadorPuesto, preguntas } = body as {
    id: string;
    responsablePuesto?: string;
    aprobadorPuesto?: string;
    preguntas?: { numero: number; pregunta: string; respuesta: string }[];
  };
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (preguntas && preguntas.length > 7) return NextResponse.json({ error: "Máximo 7 preguntas" }, { status: 400 });

  const updated = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    const ficha = await tx.ficha.findUnique({ where: { id }, include: { preguntas: true } });
    if (!ficha) throw new Error("Ficha no encontrada");

    // Snapshot version anterior
    await tx.fichaVersionSnapshot.create({
      data: {
        fichaId: id,
        version: ficha.version,
        contenido: { preguntas: ficha.preguntas, responsablePuesto: ficha.responsablePuesto } as never,
        creadoPor: user.id,
      },
    });

    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (responsablePuesto !== undefined) data.responsablePuesto = responsablePuesto;
    if (aprobadorPuesto !== undefined) data.aprobadorPuesto = aprobadorPuesto;

    await tx.ficha.update({ where: { id }, data: data as never });

    if (Array.isArray(preguntas)) {
      await tx.preguntaFicha.deleteMany({ where: { fichaId: id } });
      for (const p of preguntas) {
        await tx.preguntaFicha.create({
          data: { fichaId: id, numero: p.numero, pregunta: p.pregunta, respuesta: p.respuesta },
        });
      }
    }

    return tx.ficha.findUnique({
      where: { id },
      include: { proceso: { include: { area: true } }, preguntas: { orderBy: { numero: "asc" } } },
    });
  });

  return NextResponse.json(updated);
}
