import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { createProcesoSchema, validateInput } from "@/lib/validators";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { sedeId: string | null };
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const areas = await prisma.area.findMany({
    where: { activo: true, OR: [{ sedeId: user.sedeId }, { sedeId: null }] },
    include: {
      procesos: {
        where: { activo: true },
        include: {
          fichas: {
            where: { activo: true },
            include: { preguntas: { orderBy: { numero: "asc" } } },
            take: 1,
            orderBy: { version: "desc" },
          },
        },
        orderBy: { orden: "asc" },
      },
    },
    orderBy: { orden: "asc" },
  });

  return NextResponse.json(areas);
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(user.rol)) return NextResponse.json({ error: "Solo GERENTE o superior" }, { status: 403 });
  const body = await req.json();
  const v = validateInput(createProcesoSchema, body);
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 });
  const data = v.data as { codigo: string; nombre: string; descripcion?: string; areaId: string; prioridad: string; frecuencia?: string };
  try {
    const proceso = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      const area = await tx.area.findUnique({ where: { id: data.areaId } });
      if (!area) throw new Error("Área no encontrada");
      const count = await tx.proceso.count({ where: { areaId: data.areaId } });
      const nuevo = await tx.proceso.create({
        data: { codigo: data.codigo.toUpperCase().trim(), nombre: data.nombre.trim(), descripcion: data.descripcion?.trim() || null, areaId: data.areaId, prioridad: data.prioridad, frecuencia: data.frecuencia || null, orden: count + 1, activo: true },
      });
      // Crea ficha vacía con 7 preguntas placeholder para que el checklist funcione
      const ficha = await tx.ficha.create({ data: { procesoId: nuevo.id, version: 1, activo: true, responsablePuesto: "Por asignar", aprobadorPuesto: "Gerente" } });
      for (let i = 1; i <= 7; i++) {
        await tx.preguntaFicha.create({ data: { fichaId: ficha.id, numero: i, pregunta: `Pregunta ${i}`, respuesta: "Por definir" } });
      }
      await tx.fichaKpi.create({ data: { fichaId: ficha.id, nombre: "Cumplimiento", formula: "completados / total", meta: "100%", frecuencia: data.frecuencia || "DIARIO" } });
      await tx.auditLog.create({ data: { entityType: "Proceso", entityId: nuevo.id, action: "CREATE", userId: user.id, newValue: data as never } });
      return nuevo;
    });
    return NextResponse.json(proceso, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error creando proceso";
    if (msg.includes("Unique")) return NextResponse.json({ error: "Código ya existe en esa área" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(user.rol)) return NextResponse.json({ error: "Solo GERENTE o superior" }, { status: 403 });
  const body = await req.json() as { id: string; codigo?: string; nombre?: string; descripcion?: string; prioridad?: string; frecuencia?: string };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    const updated = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      return tx.proceso.update({ where: { id: body.id }, data: { codigo: body.codigo?.toUpperCase().trim(), nombre: body.nombre?.trim(), descripcion: body.descripcion?.trim() || null, prioridad: body.prioridad, frecuencia: body.frecuencia } });
    });
    await prisma.auditLog.create({ data: { entityType: "Proceso", entityId: updated.id, action: "UPDATE", userId: user.id, newValue: body as never } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["SUPER_ADMIN", "GERENTE"].includes(user.rol)) return NextResponse.json({ error: "Solo GERENTE o SUPER_ADMIN puede eliminar" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  try {
    await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
      await tx.proceso.update({ where: { id }, data: { activo: false } });
    });
    await prisma.auditLog.create({ data: { entityType: "Proceso", entityId: id, action: "DELETE", userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 400 });
  }
}
