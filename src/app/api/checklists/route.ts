import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

// GET /api/checklists?fecha=2026-08-24&estado=PENDIENTE
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const estado = searchParams.get("estado");
  const fichaId = searchParams.get("fichaId");
  const areaId = searchParams.get("areaId");
  const turnoId = searchParams.get("turnoId");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const hoy = searchParams.get("hoy");

  // JEFE_AREA y STAFF con área asignada solo ven su área
  let areaIdFiltro: string | null = null;
  if (["JEFE_AREA", "STAFF"].includes(user.rol)) {
    try {
      const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: { areaId: true } as never });
      areaIdFiltro = (u as unknown as { areaId: string | null })?.areaId || null;
    } catch {}
  }

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (fichaId) where.fichaId = fichaId;
  if (turnoId) where.turnoId = turnoId;
  if (areaIdFiltro) where.ficha = { proceso: { areaId: areaIdFiltro } };
  // Filtro fecha: hoy = solo hoy 00:00, o rango desde/hasta
  if (hoy === "1") {
    const gte = new Date(new Date().setHours(0, 0, 0, 0));
    where.fecha = { gte };
  } else if (desde || hasta) {
    const f: Record<string, Date> = {};
    if (desde) f.gte = new Date(desde + "T00:00:00");
    if (hasta) f.lte = new Date(hasta + "T23:59:59");
    where.fecha = f;
  }

  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
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

  return NextResponse.json(data);
}

// POST /api/checklists - crea checklist desde ficha + turno
// Body: { fichaId, turnoId, items?: [{descripcion, evidenciaRequerida}] }
// Si no se pasan items, se generan 7 desde PreguntaFicha
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user || !user.sedeId) return NextResponse.json({ error: "No autorizado o sin sede" }, { status: 401 });

  const body = await req.json();
  const { fichaId, turnoId, items: customItems } = body as {
    fichaId: string;
    turnoId: string;
    items?: { descripcion: string; evidenciaRequerida?: boolean; tipo?: string }[];
  };

  if (!fichaId || !turnoId) {
    return NextResponse.json({ error: "fichaId y turnoId requeridos" }, { status: 400 });
  }

  const created = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    // Validar ficha existe y turno pertenece a sede
    const ficha = await tx.ficha.findUnique({
      where: { id: fichaId },
      include: { preguntas: { orderBy: { numero: "asc" } }, proceso: { include: { area: true } } },
    });
    if (!ficha) throw new Error("Ficha no encontrada");

    // Si es JEFE_AREA/STAFF con área asignada, solo puede crear de su área
    if (["JEFE_AREA", "STAFF"].includes(user.rol)) {
      try {
        const u = await prisma.usuario.findUnique({ where: { id: user.id }, select: { areaId: true } as never });
        const areaId = (u as unknown as { areaId: string | null })?.areaId;
        if (areaId && ficha.proceso.areaId !== areaId) throw new Error("Solo puedes crear checklists de tu área asignada");
      } catch (e) {
        if (e instanceof Error && e.message.includes("Solo puedes crear")) throw e;
      }
    }

    // Candado robusto: fechaDia (YYYY-MM-DD America/Mexico_City) + unique DB
    const fechaDia = new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
    // App check (rápido)
    const yaExiste = await tx.checklist.findFirst({
      where: { fichaId, sedeId: user.sedeId!, turnoId, fechaDia },
    });
    if (yaExiste) throw new Error(`Ya creaste esta ficha, no puedes crearla nuevamente.`);

    const turno = await tx.turno.findFirst({ where: { id: turnoId, sedeId: user.sedeId! } });
    if (!turno) throw new Error("Turno no válido para esta sede");

    let itemsToCreate: { descripcion: string; evidenciaRequerida: boolean; tipo: string; orden: number }[];
    if (customItems && customItems.length > 0) {
      if (customItems.length > 7) throw new Error("Máximo 7 items por checklist");
      itemsToCreate = customItems.map((it, i) => ({
        descripcion: it.descripcion,
        evidenciaRequerida: it.evidenciaRequerida ?? false,
        tipo: it.tipo ?? "BOOLEAN",
        orden: i,
      }));
    } else {
      // Generar desde las 7 preguntas de la ficha (modo estándar)
      itemsToCreate = ficha.preguntas.slice(0, 7).map((p, i) => ({
        descripcion: `${p.numero}. ${p.pregunta}: ${p.respuesta.slice(0, 80)}`,
        evidenciaRequerida: p.numero === 5, // "COMO COMPRUEBO" suele requerir foto
        tipo: p.numero === 5 ? "FOTO" : "BOOLEAN",
        orden: i,
      }));
      // Fallback si ficha no tiene preguntas (no debería pasar con seed 54)
      if (itemsToCreate.length === 0) {
        itemsToCreate = [{ descripcion: ficha.procesoId, evidenciaRequerida: false, tipo: "BOOLEAN", orden: 0 }];
      }
    }

    let checklist;
    try {
      checklist = await tx.checklist.create({
        data: {
          fichaId,
          sedeId: user.sedeId!,
          turnoId,
          fechaDia,
          ejecutadoPor: user.id,
          estado: "PENDIENTE",
          items: { create: itemsToCreate },
        } as never,
        include: { items: true, ficha: { include: { proceso: true } }, turno: true },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Unique constraint") || msg.includes("unique") || msg.includes("P2002") || msg.includes("fechaDia")) {
        throw new Error(`Ya creaste esta ficha, no puedes crearla nuevamente.`);
      }
      throw e;
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        entityType: "Checklist",
        entityId: checklist.id,
        action: "CREATE",
        userId: user.id,
        newValue: { fichaId, turnoId } as never,
      },
    });

    return checklist;
  });

  return NextResponse.json(created, { status: 201 });
}
