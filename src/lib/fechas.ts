// ============================================================
// src/lib/fechas.ts — Zona horaria única: América/Mexico_City
// ============================================================
// Todo el sistema habla en hora de México (Tuxtla). El servidor
// (Vercel, UTC) NO decide qué día es "hoy": aquí se calcula.
// Uso: donde antes iba `new Date()` para "hoy", usa estas funciones.
//
// Nota: México eliminó el horario de verano en 2022, por lo que
// America/Mexico_City es fijo UTC-6. Estas funciones valen para
// servidor (Node) y cliente (navegador): solo usan Intl/Date.
// ============================================================

export const ZONA_MEXICO = "America/Mexico_City";

/** Fecha de HOY en México como "YYYY-MM-DD" (mismo día que ve el staff). */
export function hoyMexico(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_MEXICO });
}

/** Fecha de AYER en México como "YYYY-MM-DD". */
export function ayerMexico(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_MEXICO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(partes.find((p) => p.type === "year")!.value);
  const m = Number(partes.find((p) => p.type === "month")!.value);
  const d = Number(partes.find((p) => p.type === "day")!.value);
  // Restar un día usando UTC evita problemas de fin de mes
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * Convierte un día "YYYY-MM-DD" (en México) a un rango de instantes
 * [inicio, fin) en UTC para consultas a la base.
 * Ej: "2026-09-14" → [2026-09-14T06:00:00Z, 2026-09-15T06:00:00Z)
 * (medianoche de México = 06:00 UTC; UTC-6 fijo desde 2022).
 */
export function rangoDelDiaMexico(dia: string): { inicio: Date; fin: Date } {
  const [y, m, d] = dia.split("-").map(Number);
  return {
    inicio: new Date(Date.UTC(y, m - 1, d, 6, 0, 0)),
    fin: new Date(Date.UTC(y, m - 1, d + 1, 6, 0, 0)),
  };
}

/** Dado un momento (Date), devuelve "YYYY-MM-DD" en México. */
export function diaDeFechaMexico(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: ZONA_MEXICO });
}