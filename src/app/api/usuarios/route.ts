// ============================================================
// src/app/api/usuarios/route.ts — CRUD usuarios solo SUPER_ADMIN
// ADITIVO: no modifica auth ni RLS existente
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createUsuarioSchema } from "@/lib/validators";
import { z } from "zod";

function isSuperAdmin(rol: string) {
  return rol === "SUPER_ADMIN";
}

function omitPasswordHash<T extends { passwordHash?: string }>(u: T): Omit<T, "passwordHash"> {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

// GET /api/usuarios — listar todos (solo SUPER_ADMIN)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isSuperAdmin(user.rol)) return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });

  const [usuarios, sedes] = await Promise.all([
    prisma.usuario.findMany({
      orderBy: { createdAt: "desc" },
      include: { sede: { select: { id: true, nombre: true } } },
    }),
    prisma.sede.findMany({ select: { id: true, nombre: true, activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return NextResponse.json({
    usuarios: usuarios.map(omitPasswordHash),
    sedes,
  });
}

// POST /api/usuarios — crear usuario (solo SUPER_ADMIN)
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isSuperAdmin(user.rol)) return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });

  const body = await req.json();
  const parsed = createUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ") }, { status: 400 });
  }
  const data = parsed.data;

  // Validar sede si se envía
  if (data.sedeIdActiva) {
    const sede = await prisma.sede.findUnique({ where: { id: data.sedeIdActiva } });
    if (!sede) return NextResponse.json({ error: "Sede no encontrada" }, { status: 400 });
  }

  const exists = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (exists) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });

  const passwordHash = await bcrypt.hash(data.password, 10);

  const created = await prisma.usuario.create({
    data: {
      email: data.email,
      nombre: data.nombre,
      apellido: data.apellido || null,
      telefono: data.telefono || null,
      rol: data.rol,
      sedeIdActiva: data.sedeIdActiva || null,
      passwordHash,
    },
  });

  // AuditLog aditivo — no bloquea si falla
  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Usuario",
        entityId: created.id,
        action: "CREATE",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: { email: created.email, rol: created.rol } as any,
        userId: user.id,
      },
    });
  } catch {}

  return NextResponse.json(omitPasswordHash(created), { status: 201 });
}

// PATCH /api/usuarios — editar usuario / reset password / activar-desactivar
const patchSchema = z.object({
  id: z.string(),
  email: z.string().email().optional(),
  nombre: z.string().min(2).optional(),
  apellido: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  rol: z.enum(["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR", "STAFF", "RRHH", "COMPRAS"]).optional(),
  sedeIdActiva: z.string().nullable().optional(),
  activo: z.boolean().optional(),
  password: z.string().min(8).optional(), // reset
});

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isSuperAdmin(user.rol)) return NextResponse.json({ error: "Solo SUPER_ADMIN" }, { status: 403 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ") }, { status: 400 });
  }
  const { id, password, ...rest } = parsed.data;

  const target = await prisma.usuario.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  // Evitar que SUPER_ADMIN se desactive a sí mismo
  if (id === user.id && rest.activo === false) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }

  // Si cambia email, validar único
  if (rest.email && rest.email !== target.email) {
    const dup = await prisma.usuario.findUnique({ where: { email: rest.email } });
    if (dup) return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
  }

  // Si cambia sede, validar existe
  if (rest.sedeIdActiva) {
    const sede = await prisma.sede.findUnique({ where: { id: rest.sedeIdActiva } });
    if (!sede) return NextResponse.json({ error: "Sede no encontrada" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Sin cambios" }, { status: 400 });
  }

  const updated = await prisma.usuario.update({ where: { id }, data });

  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Usuario",
        entityId: id,
        action: password ? "RESET_PASSWORD" : "UPDATE",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oldValue: { email: target.email, rol: target.rol, activo: target.activo } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: data as any,
        userId: user.id,
      },
    });
  } catch {}

  return NextResponse.json(omitPasswordHash(updated));
}
