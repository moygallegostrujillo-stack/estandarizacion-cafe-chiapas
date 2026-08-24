// ============================================================
// src/lib/db-session.ts — Helper para RLS (Row Level Security)
// ============================================================
// Establece el contexto de usuario (rol, sedeId) en PostgreSQL
// antes de ejecutar queries, para que las políticas RLS funcionen.
//
// Uso:
//   import { withUserContext } from "@/lib/db-session";
//
//   await withUserContext(user.id, user.rol, user.sedeId, async () => {
//     // Cualquier query Prisma aquí se ejecuta con RLS filtrando por sedeId
//     const checklists = await prisma.checklist.findMany();
//     return checklists;
//   });

import { prisma } from "./prisma";
import type { Role } from "./auth";

type PrismaTransaction = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Ejecuta una función dentro de una transacción Prisma con el contexto
 * de usuario configurado para que RLS funcione correctamente.
 */
export async function withUserContext<T>(
  userId: string,
  rol: Role,
  sedeId: string | null,
  fn: (tx: PrismaTransaction) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    // Establecer variables de sesión que leen las políticas RLS
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.rol', ${rol}, true)`;
    await tx.$executeRaw`SELECT set_config('app.sede_id', ${sedeId || ""}, true)`;

    return fn(tx as unknown as PrismaTransaction);
  });
}

/**
 * Versión simplificada que usa el usuario actual de la sesión.
 * Para uso en Server Components y API routes.
 */
export async function withCurrentUserContext<T>(
  fn: (tx: PrismaTransaction) => Promise<T>
): Promise<T> {
  const { getCurrentUser } = await import("./auth");
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return withUserContext(user.id, user.rol, user.sedeId, fn);
}

/**
 * Helper para SUPER_ADMIN: contexto sin filtro de sede.
 */
export async function withAdminContext<T>(
  fn: (tx: PrismaTransaction) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.rol', 'SUPER_ADMIN', true)`;
    return fn(tx as unknown as PrismaTransaction);
  });
}
