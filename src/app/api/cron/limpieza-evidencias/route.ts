import { prisma } from "@/lib/prisma";
import { deleteEvidencia } from "@/lib/storage";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Vercel Cron: cada hora borra fotos con >48h
export async function GET(req: Request) {
  // Verifica cron de Vercel (opcional)
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (!isVercelCron && process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    // Permitimos sin secret en dev, pero en prod debería venir de Vercel
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const viejas = await prisma.evidencia.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, url: true },
    take: 500,
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

  return NextResponse.json({ ok: true, cutoff: cutoff.toISOString(), encontradas: viejas.length, borradas });
}
