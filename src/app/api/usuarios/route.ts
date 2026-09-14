// ============================================================
// src/app/api/usuarios/route.ts — CRUD usuarios solo SUPER_ADMIN
// ADITIVO: no modifica auth ni RLS existente
// ============================================================
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withAdminContext, type PrismaTransaction } from "@/lib/db-session";
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

  async function fetchAll(tx: PrismaTransaction) {
    const [usuarios, sedes, areas] = await Promise.all([
      tx.usuario.findMany({
        orderBy: { createdAt: "desc" },
        include: { sede: { select: { id: true, nombre: true } }, area: { select: { id: true, nombre: true, codigo: true } } } as never,
      }),
      tx.sede.findMany({ select: { id: true, nombre: true, activo: true }, orderBy: { nombre: "asc" } }),
      tx.area.findMany({ where: { activo: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { orden: "asc" } }),
    ]);
    return { usuarios, sedes, areas };
  }

  try {
    const { usuarios, sedes, areas } = await withAdminContext(async (tx) => {
      const { usuarios, sedes, areas } = await fetchAll(tx);
      return { usuarios, sedes, areas };
    });
    return NextResponse.json({ usuarios: usuarios.map(omitPasswordHash), sedes, areas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("areaId") || msg.includes("area")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS "Usuario_areaId_idx" ON "Usuario"("areaId");`);
      const { usuarios, sedes, areas } = await withAdminContext(async (tx) => {
        const { usuarios, sedes, areas } = await fetchAll(tx);
        return { usuarios, sedes, areas };
      });
      return NextResponse.json({ usuarios: usuarios.map(omitPasswordHash), sedes, areas });
    }
    throw e;
  }
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

  let created;
  try {
    created = await withAdminContext(async (tx) => {
      // Validar sede si se envía
      if (data.sedeIdActiva) {
        const sede = await tx.sede.findUnique({ where: { id: data.sedeIdActiva } });
        if (!sede) throw new Error("Sede no encontrada");
      }
      // Validar area si se envía (solo para JEFE_AREA)
      const areaId = (body as Record<string, unknown>).areaId as string | undefined;
      if (areaId) {
        const area = await tx.area.findUnique({ where: { id: areaId } });
        if (!area) throw new Error("Área no encontrada");
      }

      const exists = await tx.usuario.findUnique({ where: { email: data.email } });
      if (exists) throw new Error("__EMAIL_DUP__");

      const passwordHash = await bcrypt.hash(data.password, 10);

      return tx.usuario.create({
        data: {
          email: data.email,
          nombre: data.nombre,
          apellido: data.apellido || null,
          telefono: data.telefono || null,
          rol: data.rol,
          sedeIdActiva: data.sedeIdActiva || null,
          areaId: areaId || null,
          passwordHash,
        } as never,
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "__EMAIL_DUP__") return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    if (msg.includes("Sede no encontrada")) return NextResponse.json({ error: "Sede no encontrada" }, { status: 400 });
    if (msg.includes("Área no encontrada")) return NextResponse.json({ error: "Área no encontrada" }, { status: 400 });
    if (msg.includes("areaId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL;`);
      created = await withAdminContext(async (tx) => {
        const areaId = (body as Record<string, unknown>).areaId as string | undefined;
        return tx.usuario.create({
          data: {
            email: data.email,
            nombre: data.nombre,
            apellido: data.apellido || null,
            telefono: data.telefono || null,
            rol: data.rol,
            sedeIdActiva: data.sedeIdActiva || null,
            areaId: areaId || null,
            passwordHash: await bcrypt.hash(data.password, 10),
          } as never,
        });
      });
    } else throw e;
  }

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
  areaId: z.string().nullable().optional(),
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

  // Pre-cargar target dentro de contexto admin
  let prepared;
  try {
    prepared = await withAdminContext(async (tx) => {
      const target = await tx.usuario.findUnique({ where: { id } });
      if (!target) throw new Error("__USUARIO_NO_ENCONTRADO__");
      return target;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("__USUARIO_NO_ENCONTRADO__")) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    throw e;
  }

  // Evitar que SUPER_ADMIN se desactive a sí mismo
  if (id === user.id && rest.activo === false) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
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

  let updated;
  try {
    updated = await withAdminContext(async (tx) => {
      // Si cambia email, validar único
      if (rest.email && rest.email !== prepared.email) {
        const dup = await tx.usuario.findUnique({ where: { email: rest.email } });
        if (dup) throw new Error("__EMAIL_DUP__");
      }
      // Si cambia sede, validar existe
      if (rest.sedeIdActiva) {
        const sede = await tx.sede.findUnique({ where: { id: rest.sedeIdActiva } });
        if (!sede) throw new Error("Sede no encontrada");
      }
      if ((rest as Record<string, unknown>).areaId) {
        const area = await tx.area.findUnique({ where: { id: (rest as Record<string, unknown>).areaId as string } });
        if (!area) throw new Error("Área no encontrada");
      }

      return tx.usuario.update({ where: { id }, data } as never);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "__USUARIO_NO_ENCONTRADO__") return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    if (msg === "__EMAIL_DUP__") return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    if (msg.includes("Sede no encontrada")) return NextResponse.json({ error: "Sede no encontrada" }, { status: 400 });
    if (msg.includes("Área no encontrada")) return NextResponse.json({ error: "Área no encontrada" }, { status: 400 });
    if (msg.includes("areaId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL;`);
      updated = await withAdminContext(async (tx) => {
        return tx.usuario.update({ where: { id }, data } as never);
      });
    } else throw e;
  }

  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Usuario",
        entityId: id,
        action: password ? "RESET_PASSWORD" : "UPDATE",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        oldValue: { email: prepared.email, rol: prepared.rol, activo: prepared.activo } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        newValue: data as any,
        userId: user.id,
      },
    });
  } catch {}

  return NextResponse.json(omitPasswordHash(updated));
}
