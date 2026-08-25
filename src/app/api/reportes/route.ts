import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!["SUPER_ADMIN", "GERENTE", "JEFE_AREA"].includes(user.rol)) {
    return NextResponse.json({ error: "Solo gerente o superior" }, { status: 403 });
  }

  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.reporteDiario.findMany({
      include: { sede: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
      take: 30,
    });
  });

  return NextResponse.json(data);
}
