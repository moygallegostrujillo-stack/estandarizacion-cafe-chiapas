import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { createIncidenciaSchema, validateInput } from "@/lib/validators";
import { NextResponse } from "next/server";

// GET /api/incidencias?cerrado=false&gravedad=CRITICA
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cerrado = searchParams.get("cerrado");
  const gravedad = searchParams.get("gravedad");

  const where: Record<string, unknown> = {};
  if (cerrado !== null) where.cerrado = cerrado === "true";
  if (gravedad) where.gravedad = gravedad;

  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.incidencia.findMany({
      where: where as never,
      include: {
        checklist: { select: { id: true, ficha: { select: { proceso: { select: { codigo: true, nombre: true } } } } } },
        ficha: { select: { proceso: { select: { codigo: true } } } },
        reportador: { select: { nombre: true, email: true } },
        atendedor: { select: { nombre: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  return NextResponse.json(data);
}

// POST /api/incidencias - botón rojo 15s
// Body: { tipo, descripcion, gravedad, checklistId?, fichaId? }
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const validation = validateInput(createIncidenciaSchema, {
    ...body,
    reportadoPor: user.id,
  });

  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const data = validation.data as {
    tipo: string;
    descripcion: string;
    gravedad: string;
    checklistId?: string;
    fichaId?: string;
    reportadoPor: string;
  };

  // SLA: tiempoRespuesta estimado según gravedad
  const slaMinutos: Record<string, number> = {
    CRITICA: 15,
    ALTA: 60,
    MEDIA: 240,
    BAJA: 1440,
  };

  const created = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    const incidencia = await tx.incidencia.create({
      data: {
        tipo: data.tipo,
        descripcion: data.descripcion,
        gravedad: data.gravedad,
        checklistId: data.checklistId || null,
        fichaId: data.fichaId || null,
        reportadoPor: user.id,
        tiempoRespuesta: slaMinutos[data.gravedad] ?? null,
      },
      include: { reportador: { select: { nombre: true } } },
    });

    await tx.auditLog.create({
      data: {
        entityType: "Incidencia",
        entityId: incidencia.id,
        action: "CREATE",
        userId: user.id,
        newValue: { tipo: data.tipo, gravedad: data.gravedad } as never,
        metadata: { via: "boton_rojo", checklistId: data.checklistId } as never,
      },
    });

    return incidencia;
  });

  return NextResponse.json(created, { status: 201 });
}

// PATCH /api/incidencias - cerrar/atender
export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json() as { id: string; accionTomada?: string; cerrado?: boolean };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });

  const updated = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.incidencia.update({
      where: { id: body.id },
      data: {
        accionTomada: body.accionTomada,
        atendidoPor: user.id,
        cerrado: body.cerrado ?? false,
        cerradoEn: body.cerrado ? new Date() : null,
      },
    });
  });

  return NextResponse.json(updated);
}
