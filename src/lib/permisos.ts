// ============================================================
// src/lib/permisos.ts — Matriz Rol × Recurso → Acciones
// ============================================================
// Reemplaza los `if (rol === ...)` dispersos en route.ts
// Centraliza la lógica de permisos en un solo lugar.

import type { Role } from "./auth";

type Accion = "crear" | "leer" | "editar" | "verificar" | "eliminar" | "administrar";
type Recurso = "fichas" | "checklists" | "incidencias" | "usuarios" | "sedes" | "reportes" | "evidencias";

const matriz: Record<Role, Partial<Record<Recurso, Accion[]>>> = {
  SUPER_ADMIN: {
    fichas:       ["crear", "leer", "editar", "administrar"],
    checklists:   ["crear", "leer", "editar", "verificar", "eliminar"],
    incidencias:  ["crear", "leer", "editar", "verificar"],
    usuarios:     ["crear", "leer", "editar", "eliminar", "administrar"],
    sedes:        ["crear", "leer", "editar", "administrar"],
    reportes:     ["leer"],
    evidencias:   ["crear", "leer", "eliminar"],
  },
  GERENTE: {
    fichas:       ["leer", "editar"],
    checklists:   ["crear", "leer", "editar", "verificar"],
    incidencias:  ["crear", "leer", "editar", "verificar"],
    usuarios:     [],
    sedes:        ["leer"],
    reportes:     ["leer"],
    evidencias:   ["crear", "leer"],
  },
  JEFE_AREA: {
    fichas:       ["leer"],
    checklists:   ["crear", "leer", "editar", "verificar"],
    incidencias:  ["crear", "leer", "editar"],
    usuarios:     [],
    sedes:        ["leer"],
    reportes:     ["leer"],
    evidencias:   ["crear", "leer"],
  },
  SUPERVISOR: {
    fichas:       ["leer"],
    checklists:   ["leer", "verificar"],
    incidencias:  ["leer", "verificar"],
    usuarios:     [],
    sedes:        ["leer"],
    reportes:     ["leer"],
    evidencias:   ["leer"],
  },
  STAFF: {
    fichas:       ["leer"],
    checklists:   ["crear", "leer", "editar"],
    incidencias:  ["crear", "leer"],
    usuarios:     [],
    sedes:        [],
    reportes:     [],
    evidencias:   ["crear", "leer"],
  },
  RRHH: {
    fichas:       ["leer"],
    checklists:   ["leer"],
    incidencias:  ["leer"],
    usuarios:     ["leer"],
    sedes:        ["leer"],
    reportes:     ["leer"],
    evidencias:   [],
  },
  COMPRAS: {
    fichas:       ["leer"],
    checklists:   ["leer"],
    incidencias:  ["leer"],
    usuarios:     [],
    sedes:        ["leer"],
    reportes:     ["leer"],
    evidencias:   [],
  },
};

export function puede(rol: Role, recurso: Recurso, accion: Accion): boolean {
  return matriz[rol]?.[recurso]?.includes(accion) ?? false;
}

export function requirePermiso(rol: Role, recurso: Recurso, accion: Accion): void {
  if (!puede(rol, recurso, accion)) {
    throw new Error("FORBIDDEN");
  }
}

/** Verifica si el usuario puede verificar checklists (solo SUPERVISOR o superior) */
export function puedeVerificar(rol: Role): boolean {
  return ["SUPER_ADMIN", "GERENTE", "JEFE_AREA", "SUPERVISOR"].includes(rol);
}

/** Verifica si el usuario puede aprobar/rechazar checklists (solo GERENTE o SUPER_ADMIN) */
export function puedeAprobar(rol: Role): boolean {
  return ["SUPER_ADMIN", "GERENTE"].includes(rol);
}

/** Verifica si el usuario puede editar fichas maestras */
export function puedeEditarMaestro(rol: Role): boolean {
  return rol === "SUPER_ADMIN";
}

/** Verifica si el usuario puede administrar usuarios */
export function puedeAdministrarUsuarios(rol: Role): boolean {
  return rol === "SUPER_ADMIN";
}

/** Verifica si el usuario puede activar/desactivar fichas por sede */
export function puedeToggleFicha(rol: Role, userSedeId: string | null, fichaSedeId: string): boolean {
  if (rol === "SUPER_ADMIN") return true;
  if (["GERENTE", "JEFE_AREA"].includes(rol) && userSedeId === fichaSedeId) return true;
  return false;
}

/** Determina si el usuario tiene filtro de área (solo ve su área) */
export function tieneFiltroArea(rol: Role): boolean {
  return ["JEFE_AREA", "STAFF"].includes(rol);
}
