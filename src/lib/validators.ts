// ============================================================
// src/lib/validators.ts — Schemas Zod para validación
// ============================================================
import { z } from "zod";

// ---------- AUTH ----------
export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Contraseña mínima 8 caracteres"),
});

// ---------- USUARIO ----------
export const createUsuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  nombre: z.string().min(2, "Nombre muy corto"),
  apellido: z.string().optional(),
  telefono: z.string().optional(),
  rol: z.enum([
    "SUPER_ADMIN",
    "GERENTE",
    "JEFE_AREA",
    "SUPERVISOR",
    "STAFF",
    "RRHH",
    "COMPRAS",
  ]),
  sedeIdActiva: z.string().optional(),
  password: z.string().min(8, "Contraseña mínima 8 caracteres"),
});

export const updateUsuarioSchema = createUsuarioSchema.partial().omit({ password: true });

// ---------- SEDE ----------
export const createSedeSchema = z.object({
  nombre: z.string().min(2, "Nombre muy corto"),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

// ---------- ÁREA ----------
export const createAreaSchema = z.object({
  codigo: z.string().min(2, "Código requerido"),
  nombre: z.string().min(2, "Nombre muy corto"),
  icono: z.string().optional(),
  descripcion: z.string().optional(),
  color: z.string().optional(),
  tipo: z.enum(["SISTEMA", "PERSONALIZADA"]).default("PERSONALIZADA"),
  sedeId: z.string().optional(),
});

// ---------- PROCESO ----------
export const createProcesoSchema = z.object({
  codigo: z.string().min(2, "Código requerido"),
  nombre: z.string().min(2, "Nombre muy corto"),
  descripcion: z.string().optional(),
  areaId: z.string(),
  prioridad: z.enum(["CRITICO", "ALTA", "MEDIA", "BAJA"]).default("MEDIA"),
  frecuencia: z.enum([
    "POR_TURNO",
    "DIARIO",
    "SEMANAL",
    "MENSUAL",
    "ANUAL",
  ]).optional(),
});

// ---------- FICHA ----------
export const createFichaSchema = z.object({
  procesoId: z.string(),
  responsablePuesto: z.string().optional(),
  aprobadorPuesto: z.string().optional(),
  preguntas: z.array(z.object({
    numero: z.number().int().min(1).max(7),
    pregunta: z.string(),
    respuesta: z.string(),
  })).max(7, "Máximo 7 preguntas por ficha"),
});

// ---------- CHECKLIST ----------
export const createChecklistSchema = z.object({
  fichaId: z.string(),
  sedeId: z.string(),
  turnoId: z.string(),
  ejecutadoPor: z.string(),
  items: z.array(z.object({
    descripcion: z.string(),
    tipo: z.enum(["BOOLEAN", "NUMERO", "TEXTO", "HORA", "FOTO"]).default("BOOLEAN"),
    evidenciaRequerida: z.boolean().default(false),
    orden: z.number().int().default(0),
  })).max(7, "Máximo 7 items por checklist"),
});

// ---------- INCIDENCIA ----------
export const createIncidenciaSchema = z.object({
  checklistId: z.string().optional(),
  fichaId: z.string().optional(),
  tipo: z.enum(["FALTANTE", "FALLA_EQUIPO", "ROBO", "CADUCIDAD", "OTRO"]),
  descripcion: z.string().min(5, "Descripción muy corta"),
  gravedad: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("BAJA"),
  reportadoPor: z.string(),
});

// ---------- TURNO ----------
export const createTurnoSchema = z.object({
  sedeId: z.string(),
  nombre: z.string().min(2, "Nombre muy corto"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  orden: z.number().int().default(0),
});

// ---------- HELPER ----------
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
    };
  }
  return { success: true, data: result.data };
}
