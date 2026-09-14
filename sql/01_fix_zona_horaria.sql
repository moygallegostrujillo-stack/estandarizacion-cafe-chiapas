-- ============================================================
-- 01_fix_zona_horaria.sql — Corrección de zona horaria México
-- ============================================================
-- Solo recrea las DOS funciones afectadas (idempotente).
-- Los triggers ya apuntan a estas funciones por nombre; no se
-- tocan. Se puede ejecutar cuantas veces sea necesario.
--
-- Cambio: era  DATE(c.fecha) = p_fecha  (fecha en UTC del servidor)
-- Ahora:    ((c.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
--           = fecha del día en Tuxtla (UTC-6 fijo desde 2022)
-- ============================================================

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
    AND ((c.fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date = p_fecha
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
    SELECT "turnoId", "sedeId", ((fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date
    INTO v_turno_id, v_sede_id, v_fecha
    FROM "Checklist" WHERE id = NEW.id;

    SELECT COUNT(*) INTO v_pendientes
    FROM "Checklist"
    WHERE "sedeId" = v_sede_id
      AND "turnoId" = v_turno_id
      AND ((fecha AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date = v_fecha
      AND estado NOT IN ('VERIFICADO', 'RECHAZADO');

    IF v_pendientes = 0 THEN
      PERFORM upsert_reporte_diario(v_sede_id, v_fecha);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;