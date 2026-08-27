import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/sedes - lista sedes (SUPER_ADMIN ve todas, resto solo su sede)
export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const sedes = await prisma.sede.findMany({
    include: { _count: { select: { usuarios: true, areas: true } }, config: true },
    orderBy: { createdAt: "asc" },
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
  const sourceSede = await prisma.sede.findUnique({ where: { id: sourceSedeId } });
  if (!sourceSede) return NextResponse.json({ error: "Sede origen demo no encontrada" }, { status: 500 });

  const nueva = await prisma.sede.create({
    data: { nombre: body.nombre.trim(), direccion: body.direccion?.trim() || null, telefono: body.telefono?.trim() || null, activo: true },
  });

  // Clona config
  const sourceConfig = await prisma.configSede.findUnique({ where: { sedeId: sourceSedeId } });
  if (sourceConfig) {
    await prisma.configSede.create({
      data: { sedeId: nueva.id, idioma: sourceConfig.idioma, zonaHoraria: sourceConfig.zonaHoraria, moneda: sourceConfig.moneda, requiereFotoEvidencia: sourceConfig.requiereFotoEvidencia, maxMinutosVerificacion: sourceConfig.maxMinutosVerificacion },
    });
  }

  // Clona turnos
  const turnos = await prisma.turno.findMany({ where: { sedeId: sourceSedeId } });
  for (const t of turnos) {
    await prisma.turno.create({ data: { sedeId: nueva.id, nombre: t.nombre, horaInicio: t.horaInicio, horaFin: t.horaFin, orden: t.orden, activo: t.activo } });
  }

  // Clona áreas + procesos + fichas + preguntas + kpi/riesgo
  const areas = await prisma.area.findMany({ where: { sedeId: sourceSedeId }, include: { procesos: { include: { fichas: { include: { preguntas: true, kpis: true, riesgos: true } } } } } });
  let totalFichas = 0;
  for (const area of areas) {
    const newArea = await prisma.area.create({
      data: { codigo: area.codigo, nombre: area.nombre, icono: area.icono, descripcion: area.descripcion, color: area.color, orden: area.orden, tipo: area.tipo, sedeId: nueva.id, activo: area.activo },
    });
    for (const proc of area.procesos) {
      const newProc = await prisma.proceso.create({
        data: { codigo: proc.codigo, nombre: proc.nombre, descripcion: proc.descripcion, areaId: newArea.id, versionActual: proc.versionActual, prioridad: proc.prioridad, frecuencia: proc.frecuencia, orden: proc.orden, activo: proc.activo },
      });
      for (const ficha of proc.fichas) {
        const newFicha = await prisma.ficha.create({
          data: { procesoId: newProc.id, version: ficha.version, activo: ficha.activo, responsablePuesto: ficha.responsablePuesto, aprobadorPuesto: ficha.aprobadorPuesto, fechaCreacion: new Date(), proximaRevision: ficha.proximaRevision },
        });
        for (const p of ficha.preguntas) {
          await prisma.preguntaFicha.create({ data: { fichaId: newFicha.id, numero: p.numero, pregunta: p.pregunta, respuesta: p.respuesta } });
        }
        for (const k of ficha.kpis) {
          await prisma.fichaKpi.create({ data: { fichaId: newFicha.id, nombre: k.nombre, formula: k.formula, meta: k.meta || null, frecuencia: k.frecuencia || null } });
        }
        for (const r of ficha.riesgos) {
          await prisma.fichaRiesgo.create({ data: { fichaId: newFicha.id, tipo: r.tipo, descripcion: r.descripcion, probabilidad: r.probabilidad, impacto: r.impacto, mitigacion: r.mitigacion || null } });
        }
        totalFichas++;
      }
    }
  }

  await prisma.auditLog.create({ data: { entityType: "Sede", entityId: nueva.id, action: "CREATE", userId: user.id, newValue: { nombre: nueva.nombre, clonadaDe: sourceSedeId, totalFichas } as never } });

  return NextResponse.json({ id: nueva.id, nombre: nueva.nombre, totalFichas }, { status: 201 });
}
