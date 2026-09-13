// ============================================================
// src/app/api/usuarios/route.ts — CRUD usuarios solo SUPER_ADMIN
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listarUsuarios, crearUsuario, actualizarUsuario } from "@/lib/usuarios";

// GET /api/usuarios — listar todos (solo SUPER_ADMIN)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  try {
    const data = await listarUsuarios(user.rol);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// POST /api/usuarios — crear usuario (solo SUPER_ADMIN)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  try {
    const created = await crearUsuario(user.id, user.rol, body);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "FORBIDDEN" ? 403 : msg.includes("ya registrado") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

// PATCH /api/usuarios — editar usuario / reset password / activar-desactivar
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  try {
    const updated = await actualizarUsuario(user.id, user.rol, body);
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    const status = msg === "FORBIDDEN" ? 403 : msg.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
