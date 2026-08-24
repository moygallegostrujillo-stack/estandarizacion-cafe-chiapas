-- ============================================================
-- SCRIPT ÚNICO DE SETUP COMPLETO — Café DeChiapas v2.1
-- Proyecto: Estandarización V2
-- ============================================================
--
-- PROPÓSITO:
-- Crear toda la base de datos desde cero en un proyecto Supabase nuevo.
-- Incluye: 21 tablas, RLS completo, políticas por sede, índices en FKs,
-- triggers, y funciones helper.
--
-- EJECUCIÓN:
-- 1. Abre tu proyecto "Estandarizacion V2" en Supabase Dashboard
-- 2. Ve a SQL Editor → New query
-- 3. Copia TODO este archivo y pégalo
-- 4. Click "Run" (Ctrl+Enter)
-- 5. Verifica que diga "Success. No rows returned"
--
-- TIEMPO: ~30 segundos
-- REVERSIBLE: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
--
-- NOTA: Este script es idempotente en su mayoría (usa IF NOT EXISTS).
-- ============================================================

-- ============================================================
-- 1. FUNCIONES HELPER (RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.rol', true), '') = 'SUPER_ADMIN';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_rrhh()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(current_setting('app.rol', true), '') = 'RRHH';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_sede_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.sede_id', true), '');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN COALESCE(current_setting('app.user_id', true), '');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. TABLAS — TENENCIA
-- ============================================================

CREATE TABLE IF NOT EXISTS "Sede" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre          TEXT NOT NULL,
  direccion       TEXT,
  telefono        TEXT,
  logoUrl         TEXT,
  activo          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ConfigSede" (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sedeId"                TEXT NOT NULL UNIQUE REFERENCES "Sede"(id) ON DELETE CASCADE,
  idioma                  TEXT NOT NULL DEFAULT 'es',
  "zonaHoraria"           TEXT NOT NULL DEFAULT 'America/Mexico_City',
  moneda                  TEXT NOT NULL DEFAULT 'MXN',
  "requiereFotoEvidencia" BOOLEAN NOT NULL DEFAULT true,
  "maxMinutosVerificacion" INTEGER NOT NULL DEFAULT 60,
  "createdAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. TABLAS — USUARIOS
-- ============================================================

CREATE TABLE IF NOT EXISTS "Usuario" (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email           TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  apellido        TEXT,
  telefono        TEXT,
  "avatarUrl"     TEXT,
  "passwordHash"  TEXT NOT NULL,
  rol             TEXT NOT NULL DEFAULT 'STAFF',  -- SUPER_ADMIN, GERENTE, JEFE_AREA, SUPERVISOR, STAFF, RRHH, COMPRAS
  "sedeIdActiva"  TEXT REFERENCES "Sede"(id),
  activo          BOOLEAN NOT NULL DEFAULT true,
  "ultimoAcceso"  TIMESTAMP,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Equipo" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  "sedeId"    TEXT NOT NULL REFERENCES "Sede"(id) ON DELETE CASCADE,
  "areaId"    TEXT,
  activo      BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "EquipoMiembro" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "equipoId"  TEXT NOT NULL REFERENCES "Equipo"(id) ON DELETE CASCADE,
  "usuarioId" TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE CASCADE,
  activo      BOOLEAN NOT NULL DEFAULT true,
  desde       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hasta       TIMESTAMP,
  UNIQUE("equipoId", "usuarioId")
);

-- ============================================================
-- 4. TABLAS — ÁREAS FLEXIBLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "Area" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  codigo      TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  icono       TEXT,
  descripcion TEXT,
  color       TEXT,
  orden       INTEGER NOT NULL DEFAULT 0,
  activo      BOOLEAN NOT NULL DEFAULT true,
  tipo        TEXT NOT NULL DEFAULT 'SISTEMA',  -- SISTEMA, PERSONALIZADA
  "sedeId"    TEXT REFERENCES "Sede"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("sedeId", codigo)
);

-- FK post-creación (Area debía existir antes que Equipo.areaId)
ALTER TABLE "Equipo"
  ADD CONSTRAINT "Equipo_areaId_fkey"
  FOREIGN KEY ("areaId") REFERENCES "Area"(id) ON DELETE SET NULL;

-- ============================================================
-- 5. TABLAS — PROCESOS Y FICHAS
-- ============================================================

CREATE TABLE IF NOT EXISTS "Proceso" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  codigo        TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  "areaId"      TEXT NOT NULL REFERENCES "Area"(id) ON DELETE CASCADE,
  "versionActual" INTEGER NOT NULL DEFAULT 1,
  activo        BOOLEAN NOT NULL DEFAULT true,
  orden         INTEGER NOT NULL DEFAULT 0,
  prioridad     TEXT NOT NULL DEFAULT 'MEDIA',  -- CRITICO, ALTA, MEDIA, BAJA
  frecuencia    TEXT,  -- POR_TURNO, DIARIO, SEMANAL, MENSUAL, ANUAL
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("areaId", codigo)
);

CREATE TABLE IF NOT EXISTS "Ficha" (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "procesoId"       TEXT NOT NULL REFERENCES "Proceso"(id) ON DELETE CASCADE,
  version           INTEGER NOT NULL DEFAULT 1,
  activo            BOOLEAN NOT NULL DEFAULT true,
  "responsablePuesto" TEXT,
  "aprobadorPuesto" TEXT,
  "fechaCreacion"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "proximaRevision" TIMESTAMP,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FichaVersionSnapshot" (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId" TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  version   INTEGER NOT NULL,
  contenido JSONB NOT NULL,
  "creadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("fichaId", version)
);

CREATE TABLE IF NOT EXISTS "PreguntaFicha" (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId" TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  numero    INTEGER NOT NULL,
  pregunta  TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("fichaId", numero)
);

-- Tablas relacionales (reemplazan JSONs)

CREATE TABLE IF NOT EXISTS "FichaKpi" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId"   TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  formula     TEXT NOT NULL,
  meta        TEXT,
  frecuencia  TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FichaRiesgo" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId"     TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,  -- sanitario, operacional, financiero
  descripcion   TEXT NOT NULL,
  probabilidad  TEXT NOT NULL,  -- baja, media, alta
  impacto       TEXT NOT NULL,  -- bajo, medio, alto, critico
  mitigacion    TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "FichaDocumento" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId"   TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  tipo        TEXT NOT NULL,  -- manual, normativa, video
  version     TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. TABLAS — TURNOS Y CHECKLISTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "Turno" (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sedeId"    TEXT NOT NULL REFERENCES "Sede"(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  "horaInicio" TEXT NOT NULL,
  "horaFin"   TEXT NOT NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  orden       INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Checklist" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fichaId"           TEXT NOT NULL REFERENCES "Ficha"(id) ON DELETE CASCADE,
  "sedeId"            TEXT NOT NULL REFERENCES "Sede"(id) ON DELETE CASCADE,
  "turnoId"           TEXT NOT NULL REFERENCES "Turno"(id) ON DELETE CASCADE,
  fecha               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado              TEXT NOT NULL DEFAULT 'PENDIENTE',  -- PENDIENTE, EN_PROGRESO, COMPLETADO, VERIFICADO, RECHAZADO
  "ejecutadoPor"      TEXT NOT NULL REFERENCES "Usuario"(id),
  "supervisorId"      TEXT REFERENCES "Usuario"(id),
  "fechaEjecucion"    TIMESTAMP,
  "fechaVerificacion" TIMESTAMP,
  notas               TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ChecklistItem" (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "checklistId"         TEXT NOT NULL REFERENCES "Checklist"(id) ON DELETE CASCADE,
  descripcion           TEXT NOT NULL,
  tipo                  TEXT NOT NULL DEFAULT 'BOOLEAN',  -- BOOLEAN, NUMERO, TEXTO, HORA, FOTO
  valor                 TEXT,
  completado            BOOLEAN NOT NULL DEFAULT false,
  "evidenciaRequerida"  BOOLEAN NOT NULL DEFAULT false,  -- v2.1: feature flag por item
  nota                  TEXT,
  orden                 INTEGER NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completadoPor"       TEXT REFERENCES "Usuario"(id)
);

-- ============================================================
-- 7. TABLAS — EVIDENCIA (1-N fotos, v2.1)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Evidencia" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "checklistItemId"   TEXT NOT NULL REFERENCES "ChecklistItem"(id) ON DELETE CASCADE,
  url                 TEXT NOT NULL,  -- URL en Supabase Storage (bucket "evidencias")
  tipo                TEXT NOT NULL DEFAULT 'foto',  -- foto, video, documento
  size                INTEGER,  -- bytes (después de compresión sharp)
  "thumbnailUrl"     TEXT,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "subidoPor"         TEXT NOT NULL REFERENCES "Usuario"(id)
);

-- ============================================================
-- 8. TABLAS — INCIDENCIAS
-- ============================================================

CREATE TABLE IF NOT EXISTS "Incidencia" (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "checklistId"     TEXT REFERENCES "Checklist"(id) ON DELETE SET NULL,
  "fichaId"         TEXT REFERENCES "Ficha"(id) ON DELETE SET NULL,
  tipo              TEXT NOT NULL,  -- FALTANTE, FALLA_EQUIPO, ROBO, CADUCIDAD, OTRO
  descripcion       TEXT NOT NULL,
  gravedad          TEXT NOT NULL DEFAULT 'BAJA',  -- BAJA, MEDIA, ALTA, CRITICA
  "reportadoPor"    TEXT NOT NULL REFERENCES "Usuario"(id),
  "atendidoPor"     TEXT REFERENCES "Usuario"(id),
  "accionTomada"    TEXT,
  "tiempoRespuesta" INTEGER,
  cerrado           BOOLEAN NOT NULL DEFAULT false,
  "cerradoEn"       TIMESTAMP,
  "createdAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 9. TABLAS — AUDIT LOG (trazabilidad global, v2.1)
-- ============================================================

CREATE TABLE IF NOT EXISTS "AuditLog" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "entityType"  TEXT NOT NULL,  -- Usuario, Ficha, Checklist, etc.
  "entityId"    TEXT NOT NULL,
  action        TEXT NOT NULL,  -- CREATE, UPDATE, DELETE, ACTIVATE, DEACTIVATE
  "fieldName"   TEXT,
  "oldValue"    JSONB,
  "newValue"    JSONB,
  "userId"      TEXT NOT NULL REFERENCES "Usuario"(id),
  "ipAddress"   TEXT,
  "userAgent"   TEXT,
  metadata      JSONB,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 10. TABLAS — SESSION (revocación JWT, v2.1)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Session" (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  jti           TEXT NOT NULL UNIQUE,
  "usuarioId"   TEXT NOT NULL REFERENCES "Usuario"(id) ON DELETE CASCADE,
  "revokedAt"   TIMESTAMP,
  "expiresAt"   TIMESTAMP NOT NULL,
  ip            TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 11. TABLAS — REPORTES
-- ============================================================

CREATE TABLE IF NOT EXISTS "ReporteDiario" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "sedeId"            TEXT NOT NULL REFERENCES "Sede"(id) ON DELETE CASCADE,
  fecha               TIMESTAMP NOT NULL,
  "totalChecklists"   INTEGER NOT NULL DEFAULT 0,
  completados         INTEGER NOT NULL DEFAULT 0,
  verificados         INTEGER NOT NULL DEFAULT 0,
  incidencias         INTEGER NOT NULL DEFAULT 0,
  "incidenciasCriticas" INTEGER NOT NULL DEFAULT 0,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("sedeId", fecha)
);

-- ============================================================
-- 12. HABILITAR RLS EN TODAS LAS TABLAS
-- ============================================================

ALTER TABLE "Sede" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConfigSede" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EquipoMiembro" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Area" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Proceso" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Ficha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichaVersionSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PreguntaFicha" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichaKpi" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichaRiesgo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FichaDocumento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Turno" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Checklist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChecklistItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evidencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Incidencia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReporteDiario" ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 13. POLÍTICAS RLS POR TABLA
-- ============================================================

-- ---------- SEDE ----------
CREATE POLICY sede_select_own ON "Sede" FOR SELECT
  USING (id = current_sede_id() OR is_super_admin());

CREATE POLICY sede_modify_admin ON "Sede" FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ---------- CONFIG_SEDE ----------
CREATE POLICY config_sede_select_own ON "ConfigSede" FOR SELECT
  USING ("sedeId" = current_sede_id() OR is_super_admin());

CREATE POLICY config_sede_modify_own ON "ConfigSede" FOR UPDATE
  USING ("sedeId" = current_sede_id() OR is_super_admin())
  WITH CHECK ("sedeId" = current_sede_id() OR is_super_admin());

-- ---------- USUARIO ----------
CREATE POLICY usuario_select_own_sede ON "Usuario" FOR SELECT
  USING (
    "sedeIdActiva" = current_sede_id()
    OR is_super_admin()
    OR is_rrhh()
  );

CREATE POLICY usuario_modify_admin ON "Usuario" FOR UPDATE
  USING (is_super_admin() OR is_rrhh())
  WITH CHECK (is_super_admin() OR is_rrhh());

CREATE POLICY usuario_insert_admin ON "Usuario" FOR INSERT
  WITH CHECK (is_super_admin() OR is_rrhh());

-- ---------- EQUIPO ----------
CREATE POLICY equipo_select_own ON "Equipo" FOR SELECT
  USING ("sedeId" = current_sede_id() OR is_super_admin());

CREATE POLICY equipo_modify_own ON "Equipo" FOR ALL
  USING ("sedeId" = current_sede_id() OR is_super_admin())
  WITH CHECK ("sedeId" = current_sede_id() OR is_super_admin());

-- ---------- EQUIPO_MIEMBRO ----------
CREATE POLICY equipo_miembro_select_own ON "EquipoMiembro" FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM "Equipo" e WHERE e.id = "EquipoMiembro"."equipoId" AND e."sedeId" = current_sede_id())
    OR is_super_admin()
  );

CREATE POLICY equipo_miembro_modify_own ON "EquipoMiembro" FOR ALL
  USING (
    EXISTS (SELECT 1 FROM "Equipo" e WHERE e.id = "EquipoMiembro"."equipoId" AND e."sedeId" = current_sede_id())
    OR is_super_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM "Equipo" e WHERE e.id = "EquipoMiembro"."equipoId" AND e."sedeId" = current_sede_id())
    OR is_super_admin()
  );

-- ---------- AREA ----------
CREATE POLICY area_select_own ON "Area" FOR SELECT
  USING (
    "sedeId" IS NULL
    OR "sedeId" = current_sede_id()
    OR is_super_admin()
  );

CREATE POLICY area_modify_own ON "Area" FOR ALL
  USING ("sedeId" = current_sede_id() OR is_super_admin())
  WITH CHECK ("sedeId" = current_sede_id() OR is_super_admin());

-- ---------- PROCESO ----------
CREATE POLICY proceso_select_own ON "Proceso" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Area" a
      WHERE a.id = "Proceso"."areaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

CREATE POLICY proceso_modify_own ON "Proceso" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Area" a
      WHERE a.id = "Proceso"."areaId" AND a."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Area" a
      WHERE a.id = "Proceso"."areaId" AND a."sedeId" = current_sede_id()
    )
  );

-- ---------- FICHA ----------
CREATE POLICY ficha_select_own ON "Ficha" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Proceso" p
      JOIN "Area" a ON a.id = p."areaId"
      WHERE p.id = "Ficha"."procesoId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

CREATE POLICY ficha_modify_own ON "Ficha" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Proceso" p
      JOIN "Area" a ON a.id = p."areaId"
      WHERE p.id = "Ficha"."procesoId" AND a."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Proceso" p
      JOIN "Area" a ON a.id = p."areaId"
      WHERE p.id = "Ficha"."procesoId" AND a."sedeId" = current_sede_id()
    )
  );

-- ---------- FICHA_VERSION_SNAPSHOT ----------
CREATE POLICY ficha_version_snapshot_select_own ON "FichaVersionSnapshot" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaVersionSnapshot"."fichaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

-- ---------- PREGUNTA_FICHA ----------
CREATE POLICY pregunta_ficha_select_own ON "PreguntaFicha" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "PreguntaFicha"."fichaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

-- ---------- FICHA_KPI / FICHA_RIESGO / FICHA_DOCUMENTO ----------
CREATE POLICY ficha_kpi_select_own ON "FichaKpi" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaKpi"."fichaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

CREATE POLICY ficha_kpi_modify_own ON "FichaKpi" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaKpi"."fichaId" AND a."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaKpi"."fichaId" AND a."sedeId" = current_sede_id()
    )
  );

CREATE POLICY ficha_riesgo_select_own ON "FichaRiesgo" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaRiesgo"."fichaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

CREATE POLICY ficha_riesgo_modify_own ON "FichaRiesgo" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaRiesgo"."fichaId" AND a."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaRiesgo"."fichaId" AND a."sedeId" = current_sede_id()
    )
  );

CREATE POLICY ficha_documento_select_own ON "FichaDocumento" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaDocumento"."fichaId"
        AND (a."sedeId" IS NULL OR a."sedeId" = current_sede_id())
    ) OR is_super_admin()
  );

CREATE POLICY ficha_documento_modify_own ON "FichaDocumento" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaDocumento"."fichaId" AND a."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "FichaDocumento"."fichaId" AND a."sedeId" = current_sede_id()
    )
  );

-- ---------- TURNO ----------
CREATE POLICY turno_select_own ON "Turno" FOR SELECT
  USING ("sedeId" = current_sede_id() OR is_super_admin());

CREATE POLICY turno_modify_own ON "Turno" FOR ALL
  USING ("sedeId" = current_sede_id() OR is_super_admin())
  WITH CHECK ("sedeId" = current_sede_id() OR is_super_admin());

-- ---------- CHECKLIST ----------
CREATE POLICY checklist_select_own ON "Checklist" FOR SELECT
  USING ("sedeId" = current_sede_id() OR is_super_admin());

CREATE POLICY checklist_modify_own ON "Checklist" FOR ALL
  USING ("sedeId" = current_sede_id() OR is_super_admin())
  WITH CHECK ("sedeId" = current_sede_id() OR is_super_admin());

-- ---------- CHECKLIST_ITEM ----------
CREATE POLICY checklist_item_select_own ON "ChecklistItem" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "ChecklistItem"."checklistId" AND c."sedeId" = current_sede_id()
    ) OR is_super_admin()
  );

CREATE POLICY checklist_item_modify_own ON "ChecklistItem" FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "ChecklistItem"."checklistId" AND c."sedeId" = current_sede_id()
    ) OR is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "ChecklistItem"."checklistId" AND c."sedeId" = current_sede_id()
    ) OR is_super_admin()
  );

-- ---------- EVIDENCIA ----------
CREATE POLICY evidencia_select_own ON "Evidencia" FOR SELECT
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "ChecklistItem" ci
      JOIN "Checklist" c ON c.id = ci."checklistId"
      WHERE ci.id = "Evidencia"."checklistItemId" AND c."sedeId" = current_sede_id()
    )
  );

CREATE POLICY evidencia_modify_own ON "Evidencia" FOR ALL
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "ChecklistItem" ci
      JOIN "Checklist" c ON c.id = ci."checklistId"
      WHERE ci.id = "Evidencia"."checklistItemId" AND c."sedeId" = current_sede_id()
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM "ChecklistItem" ci
      JOIN "Checklist" c ON c.id = ci."checklistId"
      WHERE ci.id = "Evidencia"."checklistItemId" AND c."sedeId" = current_sede_id()
    )
  );

-- ---------- INCIDENCIA ----------
CREATE POLICY incidencia_select_own ON "Incidencia" FOR SELECT
  USING (
    is_super_admin()
    OR ("checklistId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "Incidencia"."checklistId" AND c."sedeId" = current_sede_id()
    ))
    OR ("checklistId" IS NULL AND "fichaId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "Ficha" f
      JOIN "Proceso" p ON p.id = f."procesoId"
      JOIN "Area" a ON a.id = p."areaId"
      WHERE f.id = "Incidencia"."fichaId" AND a."sedeId" = current_sede_id()
    ))
  );

CREATE POLICY incidencia_modify_own ON "Incidencia" FOR ALL
  USING (
    is_super_admin()
    OR ("checklistId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "Incidencia"."checklistId" AND c."sedeId" = current_sede_id()
    ))
  )
  WITH CHECK (
    is_super_admin()
    OR ("checklistId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "Checklist" c
      WHERE c.id = "Incidencia"."checklistId" AND c."sedeId" = current_sede_id()
    ))
  );

-- ---------- AUDIT_LOG ----------
CREATE POLICY audit_log_select_own ON "AuditLog" FOR SELECT
  USING ("userId" = current_user_id() OR is_super_admin() OR is_rrhh());

CREATE POLICY audit_log_insert_authenticated ON "AuditLog" FOR INSERT
  WITH CHECK (true);

-- ---------- SESSION ----------
CREATE POLICY session_select_own ON "Session" FOR SELECT
  USING ("usuarioId" = current_user_id() OR is_super_admin() OR is_rrhh());

CREATE POLICY session_modify_admin ON "Session" FOR UPDATE
  USING (is_super_admin() OR is_rrhh())
  WITH CHECK (is_super_admin() OR is_rrhh());

CREATE POLICY session_insert_authenticated ON "Session" FOR INSERT
  WITH CHECK (true);

-- ---------- REPORTE_DIARIO ----------
CREATE POLICY reporte_diario_select_own ON "ReporteDiario" FOR SELECT
  USING ("sedeId" = current_sede_id() OR is_super_admin());

CREATE POLICY reporte_diario_update_own ON "ReporteDiario" FOR UPDATE
  USING ("sedeId" = current_sede_id() OR is_super_admin());

-- ============================================================
-- 14. ÍNDICES EN FOREIGN KEYS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sede_activo ON "Sede"(activo);
CREATE INDEX IF NOT EXISTS idx_usuario_sedeIdActiva ON "Usuario"("sedeIdActiva");
CREATE INDEX IF NOT EXISTS idx_usuario_rol ON "Usuario"(rol);
CREATE INDEX IF NOT EXISTS idx_usuario_activo ON "Usuario"(activo);
CREATE INDEX IF NOT EXISTS idx_usuario_ultimoAcceso ON "Usuario"("ultimoAcceso");
CREATE INDEX IF NOT EXISTS idx_equipo_sedeId ON "Equipo"("sedeId");
CREATE INDEX IF NOT EXISTS idx_equipo_areaId ON "Equipo"("areaId");
CREATE INDEX IF NOT EXISTS idx_equipo_activo ON "Equipo"(activo);
CREATE INDEX IF NOT EXISTS idx_equipo_miembro_equipoId ON "EquipoMiembro"("equipoId");
CREATE INDEX IF NOT EXISTS idx_equipo_miembro_usuarioId ON "EquipoMiembro"("usuarioId");
CREATE INDEX IF NOT EXISTS idx_equipo_miembro_activo ON "EquipoMiembro"(activo);
CREATE INDEX IF NOT EXISTS idx_area_sedeId ON "Area"("sedeId");
CREATE INDEX IF NOT EXISTS idx_area_activo ON "Area"(activo);
CREATE INDEX IF NOT EXISTS idx_area_orden ON "Area"(orden);
CREATE INDEX IF NOT EXISTS idx_proceso_areaId ON "Proceso"("areaId");
CREATE INDEX IF NOT EXISTS idx_proceso_activo ON "Proceso"(activo);
CREATE INDEX IF NOT EXISTS idx_proceso_orden ON "Proceso"(orden);
CREATE INDEX IF NOT EXISTS idx_proceso_prioridad ON "Proceso"(prioridad);
CREATE INDEX IF NOT EXISTS idx_ficha_procesoId ON "Ficha"("procesoId");
CREATE INDEX IF NOT EXISTS idx_ficha_activo ON "Ficha"(activo);
CREATE INDEX IF NOT EXISTS idx_ficha_version ON "Ficha"(version);
CREATE INDEX IF NOT EXISTS idx_ficha_version_snapshot_fichaId ON "FichaVersionSnapshot"("fichaId");
CREATE INDEX IF NOT EXISTS idx_ficha_version_snapshot_version ON "FichaVersionSnapshot"(version);
CREATE INDEX IF NOT EXISTS idx_pregunta_ficha_fichaId ON "PreguntaFicha"("fichaId");
CREATE INDEX IF NOT EXISTS idx_pregunta_ficha_numero ON "PreguntaFicha"(numero);
CREATE INDEX IF NOT EXISTS idx_ficha_kpi_fichaId ON "FichaKpi"("fichaId");
CREATE INDEX IF NOT EXISTS idx_ficha_riesgo_fichaId ON "FichaRiesgo"("fichaId");
CREATE INDEX IF NOT EXISTS idx_ficha_riesgo_tipo ON "FichaRiesgo"(tipo);
CREATE INDEX IF NOT EXISTS idx_ficha_documento_fichaId ON "FichaDocumento"("fichaId");
CREATE INDEX IF NOT EXISTS idx_turno_sedeId ON "Turno"("sedeId");
CREATE INDEX IF NOT EXISTS idx_turno_activo ON "Turno"(activo);
CREATE INDEX IF NOT EXISTS idx_checklist_fichaId ON "Checklist"("fichaId");
CREATE INDEX IF NOT EXISTS idx_checklist_sedeId ON "Checklist"("sedeId");
CREATE INDEX IF NOT EXISTS idx_checklist_turnoId ON "Checklist"("turnoId");
CREATE INDEX IF NOT EXISTS idx_checklist_ejecutadoPor ON "Checklist"("ejecutadoPor");
CREATE INDEX IF NOT EXISTS idx_checklist_supervisorId ON "Checklist"("supervisorId");
CREATE INDEX IF NOT EXISTS idx_checklist_estado ON "Checklist"(estado);
CREATE INDEX IF NOT EXISTS idx_checklist_fecha ON "Checklist"(fecha);
CREATE INDEX IF NOT EXISTS idx_checklist_item_checklistId ON "ChecklistItem"("checklistId");
CREATE INDEX IF NOT EXISTS idx_checklist_item_completadoPor ON "ChecklistItem"("completadoPor");
CREATE INDEX IF NOT EXISTS idx_checklist_item_completado ON "ChecklistItem"(completado);
CREATE INDEX IF NOT EXISTS idx_checklist_item_evidenciaRequerida ON "ChecklistItem"("evidenciaRequerida");
CREATE INDEX IF NOT EXISTS idx_checklist_item_orden ON "ChecklistItem"(orden);
CREATE INDEX IF NOT EXISTS idx_evidencia_checklistItemId ON "Evidencia"("checklistItemId");
CREATE INDEX IF NOT EXISTS idx_evidencia_subidoPor ON "Evidencia"("subidoPor");
CREATE INDEX IF NOT EXISTS idx_evidencia_createdAt ON "Evidencia"("createdAt");
CREATE INDEX IF NOT EXISTS idx_incidencia_checklistId ON "Incidencia"("checklistId");
CREATE INDEX IF NOT EXISTS idx_incidencia_fichaId ON "Incidencia"("fichaId");
CREATE INDEX IF NOT EXISTS idx_incidencia_reportadoPor ON "Incidencia"("reportadoPor");
CREATE INDEX IF NOT EXISTS idx_incidencia_atendidoPor ON "Incidencia"("atendidoPor");
CREATE INDEX IF NOT EXISTS idx_incidencia_gravedad ON "Incidencia"(gravedad);
CREATE INDEX IF NOT EXISTS idx_incidencia_cerrado ON "Incidencia"(cerrado);
CREATE INDEX IF NOT EXISTS idx_incidencia_createdAt ON "Incidencia"("createdAt");
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS idx_audit_log_createdAt ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON "AuditLog"(action);
CREATE INDEX IF NOT EXISTS idx_session_usuarioId ON "Session"("usuarioId");
CREATE INDEX IF NOT EXISTS idx_session_revokedAt ON "Session"("revokedAt");
CREATE INDEX IF NOT EXISTS idx_session_expiresAt ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS idx_reporte_diario_fecha ON "ReporteDiario"(fecha);

-- ============================================================
-- 15. TRIGGERS
-- ============================================================

-- 15.1 Función para actualizar updatedAt automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 15.2 Aplicar trigger updatedAt a todas las tablas con ese campo
CREATE TRIGGER trg_updated_at_sede BEFORE UPDATE ON "Sede" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_config_sede BEFORE UPDATE ON "ConfigSede" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_usuario BEFORE UPDATE ON "Usuario" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_equipo BEFORE UPDATE ON "Equipo" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_area BEFORE UPDATE ON "Area" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_proceso BEFORE UPDATE ON "Proceso" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_ficha BEFORE UPDATE ON "Ficha" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_pregunta_ficha BEFORE UPDATE ON "PreguntaFicha" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_checklist BEFORE UPDATE ON "Checklist" FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_updated_at_incidencia BEFORE UPDATE ON "Incidencia" FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 15.3 Trigger: máximo 7 items por checklist
CREATE OR REPLACE FUNCTION enforce_max_items_per_checklist()
RETURNS TRIGGER AS $$
DECLARE
  item_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO item_count
  FROM "ChecklistItem"
  WHERE "checklistId" = NEW."checklistId";

  IF item_count >= 7 THEN
    RAISE EXCEPTION 'Un checklist no puede tener más de 7 items (límite UX). ChecklistId: %, items actuales: %',
      NEW."checklistId", item_count;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_max_checklist_items
BEFORE INSERT ON "ChecklistItem"
FOR EACH ROW EXECUTE FUNCTION enforce_max_items_per_checklist();

-- 15.4 Trigger: generación automática de ReporteDiario
CREATE OR REPLACE FUNCTION upsert_reporte_diario(
  p_sede_id TEXT,
  p_fecha DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO "ReporteDiario" (
    id, "sedeId", fecha,
    "totalChecklists", completados, verificados,
    incidencias, "incidenciasCriticas", "createdAt"
  )
  SELECT
    gen_random_uuid()::text,
    p_sede_id,
    p_fecha,
    COUNT(DISTINCT c.id),
    COUNT(DISTINCT c.id) FILTER (WHERE c.estado IN ('COMPLETADO','VERIFICADO')),
    COUNT(DISTINCT c.id) FILTER (WHERE c.estado = 'VERIFICADO'),
    COUNT(DISTINCT i.id),
    COUNT(DISTINCT i.id) FILTER (WHERE i.gravedad = 'CRITICA'),
    NOW()
  FROM "Checklist" c
  LEFT JOIN "Incidencia" i ON i."checklistId" = c.id
  WHERE c."sedeId" = p_sede_id
    AND DATE(c.fecha) = p_fecha
  ON CONFLICT ("sedeId", fecha)
  DO UPDATE SET
    "totalChecklists" = EXCLUDED."totalChecklists",
    completados = EXCLUDED.completados,
    verificados = EXCLUDED.verificados,
    incidencias = EXCLUDED.incidencias,
    "incidenciasCriticas" = EXCLUDED."incidenciasCriticas";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_turno_completado()
RETURNS TRIGGER AS $$
DECLARE
  v_turno_id TEXT;
  v_sede_id TEXT;
  v_fecha DATE;
  v_pendientes INTEGER;
BEGIN
  IF NEW.estado = 'VERIFICADO' AND (OLD IS NULL OR OLD.estado <> 'VERIFICADO') THEN
    SELECT "turnoId", "sedeId", DATE(fecha)
    INTO v_turno_id, v_sede_id, v_fecha
    FROM "Checklist" WHERE id = NEW.id;

    SELECT COUNT(*) INTO v_pendientes
    FROM "Checklist"
    WHERE "sedeId" = v_sede_id
      AND "turnoId" = v_turno_id
      AND DATE(fecha) = v_fecha
      AND estado NOT IN ('VERIFICADO', 'RECHAZADO');

    IF v_pendientes = 0 THEN
      PERFORM upsert_reporte_diario(v_sede_id, v_fecha);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_turno_completado
AFTER UPDATE OF estado ON "Checklist"
FOR EACH ROW EXECUTE FUNCTION check_turno_completado();

-- ============================================================
-- 16. COMENTARIOS DE DOCUMENTACIÓN
-- ============================================================

COMMENT ON TABLE "Sede" IS 'Sedes del restaurante (multi-tenant). Cada sede tiene sus propios usuarios, áreas, checklists.';
COMMENT ON TABLE "Usuario" IS 'Usuarios del sistema con rol único global (v2.1). Un usuario = un rol.';
COMMENT ON COLUMN "Usuario".rol IS 'SUPER_ADMIN, GERENTE, JEFE_AREA, SUPERVISOR, STAFF, RRHH, COMPRAS';
COMMENT ON TABLE "Evidencia" IS 'Fotos/videos 1-N por ChecklistItem (v2.1). URL apunta a Supabase Storage bucket "evidencias".';
COMMENT ON COLUMN "ChecklistItem"."evidenciaRequerida" IS 'Si true, el item requiere foto obligatoria. Si false, checkbox basta.';
COMMENT ON TABLE "AuditLog" IS 'Trazabilidad global de cambios (CREATE/UPDATE/DELETE) en cualquier entidad.';
COMMENT ON TABLE "Session" IS 'Sesiones JWT para revocación inmediata (e.g., al despedir empleado).';

-- ============================================================
-- 17. VERIFICACIÓN FINAL
-- ============================================================
-- Ejecuta estos queries para confirmar que todo se creó correctamente:

-- Verificar tablas creadas (deben ser 21):
-- SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';

-- Verificar RLS habilitado (todas con true):
-- SELECT relname, relrowsecurity FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace AND relkind = 'r' AND relname NOT LIKE '_prisma%';

-- Verificar políticas creadas:
-- SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public';

-- Verificar índices creados:
-- SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';

-- Verificar triggers creados:
-- SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public';

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
