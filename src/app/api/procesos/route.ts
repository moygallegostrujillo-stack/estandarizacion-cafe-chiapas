import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
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
