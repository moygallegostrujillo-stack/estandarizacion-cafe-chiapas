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

  const where: Record<string, unknown> = {};
  if (estado) where.estado = estado;
  if (fichaId) where.fichaId = fichaId;

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
      include: { preguntas: { orderBy: { numero: "asc" } } },
    });
    if (!ficha) throw new Error("Ficha no encontrada");

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

    const checklist = await tx.checklist.create({
      data: {
        fichaId,
        sedeId: user.sedeId!,
        turnoId,
        ejecutadoPor: user.id,
        estado: "PENDIENTE",
        items: { create: itemsToCreate },
      },
      include: { items: true, ficha: { include: { proceso: true } }, turno: true },
    });

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
