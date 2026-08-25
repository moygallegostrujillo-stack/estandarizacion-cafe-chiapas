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

  return NextResponse.json({ ok: true, sedes: sedes.length, fecha: ayer.toISOString().slice(0, 10) });
}
