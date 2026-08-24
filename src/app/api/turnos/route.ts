import { auth } from "@/lib/auth";
import { withUserContext } from "@/lib/db-session";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user || !user.sedeId) return NextResponse.json([], { status: 200 });
  const data = await withUserContext(user.id, user.rol as never, user.sedeId, async (tx) => {
    return tx.turno.findMany({ where: { sedeId: user.sedeId!, activo: true }, orderBy: { orden: "asc" } });
  });
  return NextResponse.json(data);
}
