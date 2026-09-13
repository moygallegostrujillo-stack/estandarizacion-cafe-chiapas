// ============================================================
// src/lib/termometro.ts — Servicio de semáforo/termómetro
// ============================================================
// Extrae la lógica de inicio/page.tsx en una función reutilizable.
// GERENTE ve por área de su sede, SUPER_ADMIN ve por sucursal.

import { prisma } from "./prisma";
import type { Role } from "./auth";

export type EstadoSem = "verde" | "amarillo" | "rojo" | "pendiente";

export type TermometroItem = {
  id: string;
  codigo: string;
  nombre: string;
  icono: string | null;
  estado: EstadoSem;
  total: number;
  verificados: number;
  completadas?: number;
};

// ---------- GET termómetro por área (GERENTE) ----------
async function termometroPorArea(sedeId: string, gteHoy: Date): Promise<TermometroItem[]> {
  const areas = await prisma.area.findMany({ where: { sedeId, activo: true }, orderBy: { orden: "asc" } });

  return Promise.all(
    areas.map(async (area) => {
      const checks = await prisma.checklist.findMany({
        where: { sedeId, fecha: { gte: gteHoy }, ficha: { proceso: { areaId: area.id } } },
        include: { incidencias: true, items: { select: { valor: true } } },
      });
      const total = checks.length;
      if (total === 0) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, estado: "rojo" as const, total, verificados: 0 };
      const conIncidencia = checks.some((c) => c.incidencias.length > 0 || c.items.some((i) => i.valor === "NO_CUMPLE") || c.estado === "RECHAZADO");
      if (conIncidencia) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, estado: "amarillo" as const, total, verificados: checks.filter((c) => c.estado === "VERIFICADO").length };
      const todosVerificados = checks.every((c) => c.estado === "VERIFICADO");
      if (todosVerificados) return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, estado: "verde" as const, total, verificados: total };
      return { id: area.id, codigo: area.codigo, nombre: area.nombre, icono: area.icono, estado: "pendiente" as const, total, verificados: checks.filter((c) => c.estado === "VERIFICADO").length };
    })
  );
}

// ---------- GET termómetro por sede (SUPER_ADMIN) ----------
async function termometroPorSede(gteHoy: Date): Promise<TermometroItem[]> {
  const sedes = await prisma.sede.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } });

  return Promise.all(
    sedes.map(async (sede) => {
      const totalFichas = await prisma.ficha.count({
        where: {
          activo: true,
          proceso: { area: { sedeId: sede.id, activo: true } },
          sedeConfigs: { none: { sedeId: sede.id, activo: false } },
        },
      });
      const checks = await prisma.checklist.findMany({
        where: { sedeId: sede.id, fecha: { gte: gteHoy } },
        include: { incidencias: true, items: { select: { valor: true } } },
      });
      const completadas = checks.filter((c) => c.estado === "COMPLETADO" || c.estado === "VERIFICADO").length;
      const total = totalFichas;
      const verificados = checks.filter((c) => c.estado === "VERIFICADO").length;
      const codigo = sede.nombre.split(" - ").pop() || sede.nombre;

      if (total === 0 || completadas === 0) {
        return { id: sede.id, codigo, nombre: sede.nombre, icono: "🏢", estado: "rojo" as const, total, verificados, completadas };
      }
      const conIncidencia = checks.some((c) => c.incidencias.length > 0 || c.items.some((i) => i.valor === "NO_CUMPLE") || c.estado === "RECHAZADO");
      if (conIncidencia) return { id: sede.id, codigo, nombre: sede.nombre, icono: "🏢", estado: "amarillo" as const, total, verificados, completadas };
      if (completadas === total && verificados === total) return { id: sede.id, codigo, nombre: sede.nombre, icono: "🏢", estado: "verde" as const, total, verificados, completadas };
      if (verificados === completadas && completadas > 0) return { id: sede.id, codigo, nombre: sede.nombre, icono: "🏢", estado: "verde" as const, total, verificados, completadas };
      return { id: sede.id, codigo, nombre: sede.nombre, icono: "🏢", estado: "pendiente" as const, total, verificados, completadas };
    })
  );
}

// ---------- API pública ----------
export async function obtenerTermometro(
  rol: Role,
  sedeId: string | null
): Promise<{ items: TermometroItem[]; tipo: "area" | "sede" }> {
  const gteHoy = new Date(new Date().setHours(0, 0, 0, 0));

  if (rol === "GERENTE" && sedeId) {
    return { items: await termometroPorArea(sedeId, gteHoy), tipo: "area" };
  }
  if (rol === "SUPER_ADMIN") {
    return { items: await termometroPorSede(gteHoy), tipo: "sede" };
  }
  return { items: [], tipo: "area" };
}

// ---------- Conteos del dashboard ----------
export async function obtenerConteos(sedeId: string | null) {
  const gteHoy = new Date(new Date().setHours(0, 0, 0, 0));

  if (sedeId) {
    const [checklistsHoy, incidenciasAbiertas, fichasActivas] = await Promise.all([
      prisma.checklist.count({ where: { sedeId, fecha: { gte: gteHoy } } }),
      prisma.incidencia.count({ where: { cerrado: false, checklist: { sedeId } } }),
      prisma.ficha.count({ where: { activo: true } }),
    ]);
    return { checklistsHoy, incidenciasAbiertas, fichasActivas };
  }

  const [checklistsHoy, incidenciasAbiertas, fichasActivas] = await Promise.all([
    prisma.checklist.count({ where: { fecha: { gte: gteHoy } } }),
    prisma.incidencia.count({ where: { cerrado: false } }),
    prisma.ficha.count({ where: { activo: true } }),
  ]);
  return { checklistsHoy, incidenciasAbiertas, fichasActivas };
}
