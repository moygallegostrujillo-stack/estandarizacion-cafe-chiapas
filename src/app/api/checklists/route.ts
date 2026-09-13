import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listarChecklists, crearChecklist } from "@/lib/checklists";

// GET /api/checklists?fecha=2026-08-24&estado=PENDIENTE
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);

  try {
    const data = await listarChecklists(user.id, user.rol as never, user.sedeId, {
      estado: searchParams.get("estado"),
      fichaId: searchParams.get("fichaId"),
      areaId: searchParams.get("areaId"),
      turnoId: searchParams.get("turnoId"),
      desde: searchParams.get("desde"),
      hasta: searchParams.get("hasta"),
      hoy: searchParams.get("hoy"),
    });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// POST /api/checklists - crea checklist desde ficha + turno
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user || !user.sedeId) return NextResponse.json({ error: "No autorizado o sin sede" }, { status: 401 });

  const body = await req.json();
  const { fichaId, turnoId, items } = body as {
    fichaId: string;
    turnoId: string;
    items?: { descripcion: string; evidenciaRequerida?: boolean; tipo?: string }[];
  };

  if (!fichaId || !turnoId) {
    return NextResponse.json({ error: "fichaId y turnoId requeridos" }, { status: 400 });
  }

  try {
    const created = await crearChecklist(user.id, user.rol as never, user.sedeId, { fichaId, turnoId, items });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
