// ============================================================
// src/lib/usuarios.ts — Lógica de negocio para Usuarios
// ============================================================

import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { createUsuarioSchema } from "./validators";
import { z } from "zod";
import { puedeAdministrarUsuarios } from "./permisos";
import type { Role } from "./auth";

function omitPasswordHash<T extends { passwordHash?: string }>(u: T): Omit<T, "passwordHash"> {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

// ---------- GET — listar usuarios + sedes + areas ----------
export async function listarUsuarios(rol: Role) {
  if (!puedeAdministrarUsuarios(rol)) throw new Error("FORBIDDEN");

  async function fetchAll() {
    const [usuarios, sedes, areas] = await Promise.all([
      prisma.usuario.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          sede: { select: { id: true, nombre: true } },
          area: { select: { id: true, nombre: true, codigo: true } },
        } as never,
      }),
      prisma.sede.findMany({ select: { id: true, nombre: true, activo: true }, orderBy: { nombre: "asc" } }),
      prisma.area.findMany({ where: { activo: true }, select: { id: true, nombre: true, codigo: true }, orderBy: { orden: "asc" } }),
    ]);
    return { usuarios, sedes, areas };
  }

  try {
    const { usuarios, sedes, areas } = await fetchAll();
    return { usuarios: usuarios.map(omitPasswordHash), sedes, areas };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("areaId") || msg.includes("area")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL; CREATE INDEX IF NOT EXISTS "Usuario_areaId_idx" ON "Usuario"("areaId");`);
      const { usuarios, sedes, areas } = await fetchAll();
      return { usuarios: usuarios.map(omitPasswordHash), sedes, areas };
    }
    throw e;
  }
}

// ---------- POST — crear usuario ----------
export async function crearUsuario(
  actorId: string,
  actorRol: Role,
  body: Record<string, unknown>
) {
  if (!puedeAdministrarUsuarios(actorRol)) throw new Error("FORBIDDEN");

  const parsed = createUsuarioSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; "));
  }
  const data = parsed.data;

  if (data.sedeIdActiva) {
    const sede = await prisma.sede.findUnique({ where: { id: data.sedeIdActiva } });
    if (!sede) throw new Error("Sede no encontrada");
  }
  const areaId = body.areaId as string | undefined;
  if (areaId) {
    const area = await prisma.area.findUnique({ where: { id: areaId } });
    if (!area) throw new Error("Área no encontrada");
  }

  const exists = await prisma.usuario.findUnique({ where: { email: data.email } });
  if (exists) throw new Error("Email ya registrado");

  const passwordHash = await bcrypt.hash(data.password, 10);

  let created;
  try {
    created = await prisma.usuario.create({
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("areaId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL;`);
      created = await prisma.usuario.create({
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
    } else throw e;
  }

  // Audit log (best effort)
  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Usuario",
        entityId: created.id,
        action: "CREATE",
        newValue: { email: created.email, rol: created.rol } as never,
        userId: actorId,
      },
    });
  } catch {}

  return omitPasswordHash(created);
}

// ---------- PATCH — editar / reset password / activar-desactivar ----------
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
  password: z.string().min(8).optional(),
});

export async function actualizarUsuario(
  actorId: string,
  actorRol: Role,
  body: Record<string, unknown>
) {
  if (!puedeAdministrarUsuarios(actorRol)) throw new Error("FORBIDDEN");

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; "));
  }
  const { id, password, ...rest } = parsed.data;

  const target = await prisma.usuario.findUnique({ where: { id } });
  if (!target) throw new Error("Usuario no encontrado");

  if (id === actorId && rest.activo === false) {
    throw new Error("No puedes desactivar tu propio usuario");
  }

  if (rest.email && rest.email !== target.email) {
    const dup = await prisma.usuario.findUnique({ where: { email: rest.email } });
    if (dup) throw new Error("Email ya registrado");
  }

  if (rest.sedeIdActiva) {
    const sede = await prisma.sede.findUnique({ where: { id: rest.sedeIdActiva } });
    if (!sede) throw new Error("Sede no encontrada");
  }
  if ((rest as Record<string, unknown>).areaId) {
    const area = await prisma.area.findUnique({ where: { id: (rest as Record<string, unknown>).areaId as string } });
    if (!area) throw new Error("Área no encontrada");
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) data[k] = v;
  }
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (Object.keys(data).length === 0) {
    throw new Error("Sin cambios");
  }

  let updated;
  try {
    updated = await prisma.usuario.update({ where: { id }, data } as never);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("areaId")) {
      await prisma.$executeRawUnsafe(`ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "areaId" TEXT REFERENCES "Area"(id) ON DELETE SET NULL;`);
      updated = await prisma.usuario.update({ where: { id }, data } as never);
    } else throw e;
  }

  // Audit log (best effort)
  try {
    await prisma.auditLog.create({
      data: {
        entityType: "Usuario",
        entityId: id,
        action: password ? "RESET_PASSWORD" : "UPDATE",
        oldValue: { email: target.email, rol: target.rol, activo: target.activo } as never,
        newValue: data as never,
        userId: actorId,
      },
    });
  } catch {}

  return omitPasswordHash(updated);
}
