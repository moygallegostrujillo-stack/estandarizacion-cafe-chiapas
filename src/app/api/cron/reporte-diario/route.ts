import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ayerMexico, rangoDelDiaMexico } from "@/lib/fechas";
import { deleteEvidencia } from "@/lib/storage";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // El reporte diario se genera para el día de AYER en México (no UTC).
  // Corre a las 6:00 de Tuxtla y reporta el día que terminó a medianoche.
  const diaReporte = ayerMexico();

  const sedes = await prisma.sede.findMany({ where: { activo: true } });
  for (const sede of sedes) {
    // La función SQL compara por hora México (fix aplicado en Supabase).
    await prisma.$executeRaw`SELECT upsert_reporte_diario(${sede.id}::text, ${diaReporte}::date)`;
  }

  // Limpieza de fotos — REGLA DEL DUEÑO: solo importa HOY y AYER.
  // Corte = inicio del día de AYER en hora México. Todo lo creado ANTES de ese
  // instante pertenece a anteayer o anterior → se borra. Así siempre se conservan
  // las evidencias de hoy y de ayer completos, y lo más viejo se elimina.
  const { inicio: corteFotos } = rangoDelDiaMexico(ayerMexico());
  const viejas = await prisma.evidencia.findMany({
    where: { createdAt: { lt: corteFotos } },
    select: { id: true, url: true },
    take: 200,
  });
  let borradas = 0;
  for (const ev of viejas) {
    try {
      await deleteEvidencia(ev.url);
    } catch {}
    try {
      await prisma.evidencia.delete({ where: { id: ev.id } });
      borradas++;
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    sedes: sedes.length,
    fecha: diaReporte,
    fotosBorradas: borradas,
  });
}