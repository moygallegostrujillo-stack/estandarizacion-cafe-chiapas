-- ============================================================
-- TAREA 2.2 — Crear rol app_user para activar RLS
-- ============================================================
-- EJECUCIÓN: En Supabase SQL Editor (proyecto "Estandarizacion V2")
-- 1. Copia TODO este archivo y pégalo
-- 2. Run (Ctrl+Enter)
-- 3. Anota la contraseña que generes para app_user
-- 4. Añade a Vercel: DATABASE_URL_APP_USER=postgresql://app_user:PASSWORD@db.xxx.supabase.co:5432/postgres
--
-- NOTA: Este script es idempotente (usa IF NOT EXISTS / DROP IF EXISTS).
-- ============================================================

-- 1. Crear rol app_user (sin login por defecto; se habilita después)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

-- 2. Dar permisos de uso en schema public
GRANT USAGE ON SCHEMA public TO app_user;

-- 3. Permisos SELECT/INSERT/UPDATE/DELETE en todas las tablas de la app
-- (RLS decidirá qué filas ve/modifica cada usuario)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- 4. Permisos en secuencias (para IDs auto-generados si los hubiera)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 5. Permisos en funciones helper (las que leen current_setting)
GRANT EXECUTE ON FUNCTION is_super_admin() TO app_user;
GRANT EXECUTE ON FUNCTION is_rrhh() TO app_user;
GRANT EXECUTE ON FUNCTION current_sede_id() TO app_user;
GRANT EXECUTE ON FUNCTION current_user_id() TO app_user;
GRANT EXECUTE ON FUNCTION update_updated_at() TO app_user;
GRANT EXECUTE ON FUNCTION enforce_max_items_per_checklist() TO app_user;
GRANT EXECUTE ON FUNCTION upsert_reporte_diario(TEXT, DATE) TO app_user;

-- 6. IMPORTANTE: app_user NO es superuser, NO puede BYPASSRLS
--    Las políticas RLS se aplicarán automáticamente cuando la app
--    establezca app.rol, app.sede_id, app.user_id via withUserContext

-- 7. Opcional: revocar permisos del público (buena práctica)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- 8. Verificar que RLS está habilitado en todas las tablas
-- (debería decir "rls_enabled = true" para todas)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'Sede','ConfigSede','Usuario','Equipo','EquipoMiembro',
    'Area','Proceso','Ficha','FichaVersionSnapshot',
    'PreguntaFicha','FichaKpi','FichaRiesgo','FichaDocumento',
    'Turno','Checklist','ChecklistItem','Evidencia',
    'Incidencia','AuditLog','Session','ReporteDiario','FichaSedeConfig','LoginAttempt'
  )
ORDER BY tablename;

-- ============================================================
-- DESPUÉS DE EJECUTAR ESTE SCRIPT:
-- ============================================================
-- 1. En Supabase Dashboard → Settings → Database → Connection pooling
--    Copia la "Connection string" (transaction pooler, puerto 6543)
--    Formato: postgresql://postgres:PASSWORD@db.xxx.supabase.co:6543/postgres
--
-- 2. Crea la contraseña para app_user:
--    ALTER ROLE app_user WITH LOGIN PASSWORD 'TU_PASSWORD_SEGURA_AQUI';
--    (Ejecuta esto en SQL Editor; usa una contraseña fuerte)
--
-- 3. Construye la DATABASE_URL_APP_USER:
--    postgresql://app_user:TU_PASSWORD_SEGURA_AQUI@db.xxx.supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
--
-- 4. En Vercel → Settings → Environment Variables:
--    Añade: DATABASE_URL_APP_USER = <la string de arriba>
--    (NO borres la DATABASE_URL original; la app usa ambas)
--
-- 5. En el código (src/lib/prisma.ts o similar), crea un segundo cliente:
--    import { PrismaClient } from '@prisma/client';
--    export const prismaAppUser = new PrismaClient({
--      datasources: { db: { url: process.env.DATABASE_URL_APP_USER } },
--    });
--
-- 6. Cambia db-session.ts para usar prismaAppUser en withUserContext:
--    import { prismaAppUser } from './prisma';
--    // ... en withUserContext: return prismaAppUser.$transaction(...)
--
-- 7. Deploy a Vercel (después del jueves, como acordamos).
-- ============================================================