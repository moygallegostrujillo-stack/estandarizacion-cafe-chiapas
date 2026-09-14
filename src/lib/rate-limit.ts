// ============================================================
// src/lib/rate-limit.ts — Anti fuerza bruta en login
// ============================================================
// Reservado en BASE DE DATOS (no memoria): Vercel es serverless y
// la RAM se pierde entre peticiones; un contador en memoria no
// frenaría un ataque real. Se registran SOLO los fallos; un login
// exitoso limpia el historial de ese email.
//
// Dos redes:
//  1. Por email: 5 fallos en 15 min → bloqueado (red principal).
//  2. Por IP:   20 fallos en 15 min → bloqueado (red secundaria, alta
//     a propósito para no tumbar a un restaurante entero que comparte WiFi).
// ============================================================
import { prisma } from "./prisma";

const VENTANA_MS = 15 * 60 * 1000; // 15 minutos
const MAX_POR_EMAIL = 5;
const MAX_POR_IP = 20;

/** Normaliza el email para que "Admin@Correo.com" y "admin@correo.com" sean lo mismo. */
function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Extrae la IP real del request (Vercel manda x-forwarded-for). */
export function obtenerIp(request?: Request): string {
  if (!request) return "::1";
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "desconocida";
}

/**
 * Cuenta los fallos recientes del email y de la IP.
 * Devuelve true si hay que bloquear (se superó algún límite).
 */
export async function estaBloqueado(email: string, ip: string): Promise<boolean> {
  const desde = new Date(Date.now() - VENTANA_MS);
  const [fallosEmail, fallosIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { email: normalizarEmail(email), createdAt: { gte: desde } } }),
    prisma.loginAttempt.count({ where: { ip, createdAt: { gte: desde } } }),
  ]);
  return fallosEmail >= MAX_POR_EMAIL || fallosIp >= MAX_POR_IP;
}

/** Registra un intento fallido. */
export async function registrarFallo(email: string, ip: string): Promise<void> {
  await prisma.loginAttempt.create({
    data: { email: normalizarEmail(email), ip },
  });
  // Limpieza oportunista: borra registros ya vencidos para no crecer sin fin.
  await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - VENTANA_MS) } },
  });
}

/** Al iniciar sesión con éxito, limpia el histórico de fallos de ese email. */
export async function limpiarHistorial(email: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { email: normalizarEmail(email) } });
}