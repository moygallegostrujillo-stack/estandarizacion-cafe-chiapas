-- ============================================================
-- 02_login_attempt.sql — Tabla de rate-limit de login (anti fuerza bruta)
-- ============================================================
-- Idempotente: solo crea la tabla si no existe. No toca ninguna tabla existente.
-- La app (Prisma) lee/escribe esta tabla. Los registros se limpian solos al
-- iniciar sesión o al vencer la ventana de 15 minutos (borrado en la app).

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email     TEXT NOT NULL DEFAULT '',
  ip        TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LoginAttempt_email_createdAt_idx"
  ON "LoginAttempt" ("email", "createdAt");

CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_createdAt_idx"
  ON "LoginAttempt" ("ip", "createdAt");

CREATE INDEX IF NOT EXISTS "LoginAttempt_createdAt_idx"
  ON "LoginAttempt" ("createdAt");