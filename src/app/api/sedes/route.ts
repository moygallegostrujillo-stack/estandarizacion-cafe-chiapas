import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withUserContext, withAdminContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

// GET /api/sedes - lista sedes (SUPER_ADMIN ve todas, resto solo su sede)
export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sedes = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.sede.findMany({
      include: { _count: { select: { usuarios: true, areas: true } }, config: true },
      orderBy: { createdAt: "asc" },
    });
  });
  // Filtra si no es SUPER_ADMIN
  if (user.rol !== "SUPER_ADMIN") {
    return NextResponse.json(sedes.filter((s) => s.id === user.sedeId));
  }
  return NextResponse.json(sedes);
}

// POST /api/sedes - SUPER_ADMIN crea nueva sede clonando 54 fichas de demo-sede-001
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (user.rol !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo SUPER_ADMIN puede crear sedes" }, { status: 403 });

  const body = await req.json() as { nombre: string; direccion?: string; telefono?: string };
  if (!body.nombre || body.nombre.trim().length < 2) return NextResponse.json({ error: "nombre requerido" }, { status: 400 });

  const sourceSedeId = "demo-sede-001";

    let resultado;
    try {
      resultado = await withAdminContext(async (tx) => {
        const sourceSede = await tx.sede.findUnique({ where: { id: sourceSedeId } });
        if (!sourceSede) throw new Error("__SEDE_ORIGEN__");

      const sedeNueva = await tx.sede.create({
        data: { nombre: body.nombre.trim(), direccion: body.direccion?.trim() || null, telefono: body.telefono?.trim() || null, activo: true },
      });

      // Clona config
      const sourceConfig = await tx.configSede.findUnique({ where: { sedeId: sourceSedeId } });
      if (sourceConfig) {
        await tx.configSede.create({
          data: { sedeId: sedeNueva.id, idioma: sourceConfig.idioma, zonaHoraria: sourceConfig.zonaHoraria, moneda: sourceConfig.moneda, requiereFotoEvidencia: sourceConfig.requiereFotoEvidencia, maxMinutosVerificacion: sourceConfig.maxMinutosVerificacion },
        });
      }

      // Clona turnos
      const turnos = await tx.turno.findMany({ where: { sedeId: sourceSedeId } });
      for (const t of turnos) {
        await tx.turno.create({ data: { sedeId: sedeNueva.id, nombre: t.nombre, horaInicio: t.horaInicio, horaFin: t.horaFin, orden: t.orden, activo: t.activo } });
      }

      // Clona áreas + procesos + fichas + preguntas + kpi/riesgo
      const areas = await tx.area.findMany({ where: { sedeId: sourceSedeId }, include: { procesos: { include: { fichas: { include: { preguntas: true, kpis: true, riesgos: true } } } } } });
      let totalFichas = 0;
      for (const area of areas) {
        const newArea = await tx.area.create({
          data: { codigo: area.codigo, nombre: area.nombre, icono: area.icono, descripcion: area.descripcion, color: area.color, orden: area.orden, tipo: area.tipo, sedeId: sedeNueva.id, activo: area.activo },
        });
        for (const proc of area.procesos) {
          const newProc = await tx.proceso.create({
            data: { codigo: proc.codigo, nombre: proc.nombre, descripcion: proc.descripcion, areaId: newArea.id, versionActual: proc.versionActual, prioridad: proc.prioridad, frecuencia: proc.frecuencia, orden: proc.orden, activo: proc.activo },
          });
          for (const ficha of proc.fichas) {
            const newFicha = await tx.ficha.create({
              data: { procesoId: newProc.id, version: ficha.version, activo: ficha.activo, responsablePuesto: ficha.responsablePuesto, aprobadorPuesto: ficha.aprobadorPuesto, fechaCreacion: new Date(), proximaRevision: ficha.proximaRevision },
            });
            for (const p of ficha.preguntas) {
              await tx.preguntaFicha.create({ data: { fichaId: newFicha.id, numero: p.numero, pregunta: p.pregunta, respuesta: p.respuesta } });
            }
            for (const k of ficha.kpis) {
              await tx.fichaKpi.create({ data: { fichaId: newFicha.id, nombre: k.nombre, formula: k.formula, meta: k.meta || null, frecuencia: k.frecuencia || null } });
            }
            for (const r of ficha.riesgos) {
              await tx.fichaRiesgo.create({ data: { fichaId: newFicha.id, tipo: r.tipo, descripcion: r.descripcion, probabilidad: r.probabilidad, impacto: r.impacto, mitigacion: r.mitigacion || null } });
            }
            totalFichas++;
          }
        }
      }

      return { sede: sedeNueva, totalFichas };
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("__SEDE_ORIGEN__")) {
        return NextResponse.json({ error: "Sede origen demo no encontrada" }, { status: 500 });
      }
      throw e;
    }

    await prisma.auditLog.create({ data: { entityType: "Sede", entityId: resultado.sede.id, action: "CREATE", userId: user.id, newValue: { nombre: resultado.sede.nombre, clonadaDe: sourceSedeId, totalFichas: resultado.totalFichas } as never } });

    return NextResponse.json({ id: resultado.sede.id, nombre: resultado.sede.nombre, totalFichas: resultado.totalFichas }, { status: 201 });
  }

export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string } | null;
  if (!user || user.rol !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  const body = await req.json() as { id: string; nombre?: string; direccion?: string; telefono?: string; activo?: boolean };
  if (!body.id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  const sede = await withAdminContext(async (tx) => {
    return tx.sede.update({
      where: { id: body.id },
      data: {
        nombre: body.nombre?.trim(),
        direccion: body.direccion !== undefined ? body.direccion?.trim() || null : undefined,
        telefono: body.telefono !== undefined ? body.telefono?.trim() || null : undefined,
        activo: body.activo,
      },
    });
  });
  await prisma.auditLog.create({ data: { entityType: "Sede", entityId: sede.id, action: "UPDATE", userId: user.id, newValue: body as never } });
  return NextResponse.json(sede);
}

export async function DELETE(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string } | null;
  if (!user || user.rol !== "SUPER_ADMIN") return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
  if (id === "demo-sede-001") return NextResponse.json({ error: "No se puede eliminar la sede demo principal" }, { status: 400 });
  try {
    await withAdminContext(async (tx) => {
      const count = await tx.sede.count({ where: { id } });
      if (!count) throw new Error("__NO_ENCONTRADA__");
      return tx.sede.delete({ where: { id } });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("__NO_ENCONTRADA__")) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    throw e;
  }
  await prisma.auditLog.create({ data: { entityType: "Sede", entityId: id, action: "DELETE", userId: user.id } });
  return NextResponse.json({ ok: true });
}
