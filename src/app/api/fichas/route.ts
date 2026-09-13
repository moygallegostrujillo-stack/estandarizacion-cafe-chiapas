import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { listarFichas, toggleFichaPorSede, editarFichaMaestro } from "@/lib/fichas";

// GET /api/fichas — lista 54 fichas con preguntas + activo por sede
export async function GET() {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const enriched = await listarFichas(user.id, user.rol as never, user.sedeId);
    return NextResponse.json(enriched);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}

// PATCH /api/fichas — dos modos:
// 1) Editar maestro (SUPER_ADMIN): { id, responsablePuesto, preguntas }
// 2) Toggle por sede: { id, sedeId, activo }
export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user as unknown as { id: string; rol: string; sedeId: string | null } | null;
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();

  try {
    // Modo 2: toggle por sede
    if (body.sedeId !== undefined) {
      const { id, sedeId, activo } = body as { id: string; sedeId: string; activo: boolean };
      if (!id || !sedeId) return NextResponse.json({ error: "id y sedeId requeridos" }, { status: 400 });
      const cfg = await toggleFichaPorSede(user.id, user.rol as never, user.sedeId, id, sedeId, activo);
      return NextResponse.json(cfg);
    }

    // Modo 1: editar maestro
    const { id, responsablePuesto, aprobadorPuesto, preguntas } = body;
    if (!id) return NextResponse.json({ error: "id requerido" }, { status: 400 });
    const updated = await editarFichaMaestro(user.id, user.rol as never, user.sedeId, id, { responsablePuesto, aprobadorPuesto, preguntas });
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
