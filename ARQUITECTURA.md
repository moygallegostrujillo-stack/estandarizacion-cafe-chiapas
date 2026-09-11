# Arquitectura — Café DeChiapas (v2.1) — Refactorización

## 1. Estado actual (main @ da7a509)
- **Stack:** Next.js 16 (App Router) + Prisma 7 + Supabase PG + Auth.js v5 + Tailwind 4
- **Multi-sede:** `Sede` (4), `Area` por sede (8×4), `Usuario.sedeIdActiva + areaId`, RLS vía `withUserContext` + `set_config`
- **Dominio:** `Ficha (54×4)` → `Checklist (hoy) + ChecklistItem (5-7)` → `Incidencia` + `Evidencia` (Storage)
- **Parches detectados:**
  - `Usuario.areaId` y `FichaSedeConfig` creados con `ALTER IF NOT EXISTS` en runtime (`src/app/api/usuarios/route.ts:40`, `src/app/api/fichas/route.ts:77`)
  - `GET /api/fichas` con fallback si tabla no existe, `GET /api/checklists?hoy=1` con filtro cliente `fichasVisibles`
  - `globals.css` con 57 líneas de parches `html.light` / `html:not(.light)` para contraste
  - `inicio` sin RLS para cache, `checklists` con 3 fetches paralelos + optimistic patch

## 2. Objetivo refactorización (branch refactor/arquitectura)
- **Solo modo claro** — elimina `ThemeToggle` y parches, unifica a `bg-gray-50/bg-white` (gusto del cliente)
- **Dominio por módulos:** `src/lib/fichas`, `src/lib/checklists`, `src/lib/usuarios`, `src/lib/sedes` con Zod + tests, `route.ts` solo orquesta
- **Migraciones versionadas:** `prisma/migrations` con SQL revisado (no `ALTER` en runtime), `prisma generate` en CI
- **Permisos únicos:** `src/lib/permisos.ts` matriz `Rol × Recurso → acción` (reemplaza `if (rol === ...)` en 6 routes)
- **Staging:** `main` (prod) + `refactor/arquitectura` (preview) con DB staging

## 3. Fases
- **Fase 1 (esta):** Solo claro + limpieza `globals.css` + quitar `ThemeToggle` — sin tocar DB
- **Fase 2:** Mover lógica de `route.ts` a `lib/*` + tests
- **Fase 3:** Migraciones formales + `staging` DB
- **Fase 4:** Semáforo/termómetro como servicio `lib/termometro` (ya prototipo en `inicio`)

## 4. Contraste — decisión
- Se elimina `ThemeToggle.tsx` y todo `html.light`/`html:not(.light)` — todo queda claro con `bg-gray-50/#f8fafc` y `bg-white/#ffffff`, textos `#18181b/#71717a`
- Botones oscuros (`bg-gray-900`, `bg-orange-600`) mantienen `color: #fafafa !important` para no perder contraste

## 5. Próximos pasos
- Validar Fase 1 en preview, luego merge a `main`
- Definir matriz de permisos con cliente (quién verifica a quién en 3 niveles: Julie→Fredy→Manolo)
