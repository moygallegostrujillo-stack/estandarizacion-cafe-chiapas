import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
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
