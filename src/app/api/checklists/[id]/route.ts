import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { obtenerChecklist, actualizarChecklist } from "@/lib/checklists";

// GET /api/checklists/[id] - detalle con items + evidencias
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const data = await obtenerChecklist(user.id, user.rol as never, user.sedeId, id);
    if (!data) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// PATCH /api/checklists/[id] - actualiza items y estado
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  try {
    const updated = await actualizarChecklist(user.id, user.rol as never, user.sedeId, id, body);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error actualizando checklist";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
