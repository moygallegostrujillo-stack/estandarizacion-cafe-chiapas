import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  ayer.setHours(0, 0, 0, 0);

  const sedes = await prisma.sede.findMany({ where: { activo: true } });
  for (const sede of sedes) {
    await prisma.$executeRaw`SELECT upsert_reporte_diario(${sede.id}::text, ${ayer}::date)`;
  }

  // Limpieza fotos 48h (antes era cron aparte, ahora va aquí para no exceder Hobby 1 cron/día)
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const viejas = await prisma.evidencia.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true, url: true }, take: 200 });
  let borradas = 0;
  for (const ev of viejas) {
    try {
      const { deleteEvidencia } = await import("@/lib/storage");
      await deleteEvidencia(ev.url);
    } catch {}
    try {
      await prisma.evidencia.delete({ where: { id: ev.id } });
      borradas++;
    } catch {}
  }

  return NextResponse.json({ ok: true, sedes: sedes.length, fecha: ayer.toISOString().slice(0, 10), fotosBorradas: borradas });
}
