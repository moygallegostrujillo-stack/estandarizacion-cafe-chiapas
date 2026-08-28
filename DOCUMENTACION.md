# Café DeChiapas — Documentación Viva

> Actualizada: 2026-08-25 · Repo: `moygallegostrujillo-stack/estandarizacion-cafe-chiapas` · Vercel: `estandarizacion-cafe-chiapas.vercel.app` · Supabase: `pqxbwsvgvdvdjuqichdg`

## 1. Visión
Plataforma multi-sede para estandarizar 54 procesos de restaurante (8 áreas) con 7 preguntas por ficha, checklists diarios 5-7 tareas medibles, evidencia fotográfica comprimida, incidencias en 15s y verificación por supervisor.

## 2. Stack
- **Framework:** Next.js 16.3.2 + React 19 + Tailwind 4
- **DB:** Supabase Postgres 15 + Prisma 7.9.1 (`src/generated/prisma`) + `@prisma/adapter-pg`
- **Auth:** Auth.js v5 + `@auth/prisma-adapter` + `bcryptjs` + JWT 8h (`src/lib/auth.ts`)
- **Storage:** Supabase Storage bucket `evidencias` (privado) + `sharp` 200KB max (`src/lib/storage.ts`)
- **Hosting:** Vercel + `vercel.json` cron 6am
- **PWA:** `public/manifest.json` + `public/sw.js` + `src/app/layout.tsx`

## 3. Esquema DB (21 tablas) `prisma/schema.prisma`
- **Tenencia:** `Sede`, `ConfigSede`
- **Usuarios:** `Usuario` (rol único: SUPER_ADMIN, GERENTE, JEFE_AREA, SUPERVISOR, STAFF, RRHH, COMPRAS), `Equipo`, `EquipoMiembro`
- **Áreas/Procesos:** `Area` (8), `Proceso` (54), `Ficha` (54), `PreguntaFicha` (378), `FichaKpi`, `FichaRiesgo`, `FichaDocumento`, `FichaVersionSnapshot`
- **Operación:** `Turno` (3), `Checklist` (estado: PENDIENTE→COMPLETADO→VERIFICADO/RECHAZADO), `ChecklistItem` (5-7, evidenciaRequerida), `Evidencia` (1-N fotos), `Incidencia`, `ReporteDiario`, `AuditLog`, `Session`
- **RLS:** `sql/00_setup_completo.sql` habilita RLS 42 policies + 3 triggers (`max 7 items`, `ReporteDiario` al cerrar turno)
- **Índices:** 50+ en FKs

## 4. Auth y RLS
- `src/lib/auth.ts` (singleton `src/lib/prisma.ts`) — Credentials, `authorize` busca `Usuario` por email, `bcrypt.compare`, `ultimoAcceso`, JWT `uid/rol/sedeId`
- `src/lib/auth-edge.ts` — versión ligera para Edge (middleware)
- `src/proxy.ts` (ex-`middleware.ts`) — protege rutas, redirige a `/auth/login`
- `src/lib/db-session.ts` — `withUserContext(userId, rol, sedeId, fn)` hace `SELECT set_config('app.*')` para que RLS filtre por sede

## 5. APIs
- `POST /api/auth/[...nextauth]` — Auth.js
- `GET /api/procesos` — áreas→procesos→fichas→preguntas (filtro `sedeId` OR null) `src/app/api/procesos/route.ts`
- `GET/POST /api/checklists` — lista/crea (clona 5-7 items, demo flexible) `src/app/api/checklists/route.ts`
- `GET/PATCH /api/checklists/[id]` — detalle, toggle `CUMPLE/NO_CUMPLE`, completar, verificar/rechazar (bloquea auto-verificación) `src/app/api/checklists/[id]/route.ts`
- `POST /api/evidencias` — `formData(file, checklistItemId)`, `sharp` comprime, sube a `evidencias`, crea `Evidencia` `src/app/api/evidencias/route.ts`
- `GET/POST/PATCH /api/incidencias` — botón rojo 15s, SLA por gravedad `src/app/api/incidencias/route.ts`
- `GET /api/turnos` — turnos por sede `src/app/api/turnos/route.ts`
- `GET /api/dashboard` — KPIs hoy/completados/incidencias `src/app/api/dashboard/route.ts`
- `GET /api/reportes` — 30 últimos `ReporteDiario` `src/app/api/reportes/route.ts`
- `GET /api/cron/reporte-diario` — cron 6am `src/app/api/cron/reporte-diario/route.ts` (requiere `CRON_SECRET`)
- `GET/PATCH/DELETE /api/sedes` — CRUD multi-sede (solo SUPER_ADMIN, clona 54 fichas) `src/app/api/sedes/route.ts`

## 6. Páginas
- `/auth/login` — `signIn("credentials")` `src/app/auth/login/page.tsx`
- `/inicio` — dashboard KPIs reales + badge incidencias `src/app/inicio/page.tsx`
- `/procesos` — 8 áreas colapsables, 54 procesos, ficha con 7 preguntas `src/app/procesos/page.tsx`
- `/checklists` — crear (selector ficha+turno+editor 5-7 con ✏️/🗑️/Foto), ejecutar (✓/✕ con motivo, foto, completar), verificar `src/app/checklists/page.tsx`
- `/incidencias` — filtros abiertas/cerradas, cerrar con acción `src/app/incidencias/page.tsx`
- `/reportes` — tabla ReporteDiario `src/app/reportes/page.tsx`
- `/admin/sedes` — CRUD sucursales (solo SUPER_ADMIN) `src/app/admin/sedes/page.tsx`
- `public/manifest.json` + `public/sw.js` — PWA instalable

## 7. Storage y compresión
- `src/lib/storage.ts` — `compressImage` 1280×960 JPEG 75% ~200KB, `uploadEvidencia` genera `checklistItemId/timestamp.jpg`, `getSignedUrl` 1h, bucket `evidencias` privado. Rechaza AVIF/HEIC con mensaje claro, acepta jpeg/png/webp.

## 8. Checklist templates realistas
- `src/lib/checklist-templates.ts` — 54 entradas `CHECKLIST_TEMPLATES[CODIGO]` con 5-7 tareas observables (ej. BAR-01 temp refri + foto, COC-03 0-4°C). `src/app/checklists/page.tsx` precarga desde aquí, no desde las 7 preguntas genéricas.

## 9. Roles y permisos
| Rol | Crear ficha | Verificar | Reportes | Sedes |
|---|---|---|---|---|
| SUPER_ADMIN | ✅ | ✅ | ✅ global | ✅ |
| GERENTE | ✅ | ✅ | ✅ su sede | ❌ |
| JEFE_AREA | ✅ | ✅ | ✅ su área | ❌ |
| SUPERVISOR | ❌ | ✅ | ✅ lo que verifica | ❌ |
| STAFF | ❌ | ❌ | ❌ | ❌ |

- Verificación bloquea auto-aprobación (ejecutor ≠ verificador, salvo SUPER_ADMIN en demo)

## 10. Paloma/Tache
- Por item: **✓ CUMPLE** (`completado=true, valor=CUMPLE`) o **✕ NO_CUMPLE** (`valor=NO_CUMPLE, nota=motivo`) `src/app/checklists/page.tsx`. `NO_CUMPLE` auto-crea `Incidencia` MEDIA al completar.

## 11. PWA y Tema
- `public/manifest.json` (192/512), `public/sw.js` network-first, `src/app/layout.tsx` registra SW, `src/components/ThemeToggle.tsx` (☀️/🌙) con `localStorage` + `html.light` overrides en `src/app/globals.css`

## 12. Usuarios demo (sede demo-sede-001)
- admin@cafe.com / admin123 SUPER_ADMIN
- gerente@cafe.com / gerente123 GERENTE
- supervisor@cafe.com / supervisor123 SUPERVISOR
- staff@cafe.com / staff123 STAFF

## 13. Env vars (Vercel)
- `DATABASE_URL` (6543), `DIRECT_URL` (5432), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`

## 14. Cronograma (Diseño Técnico v2.1)
- **Fase 0-1 (Hecho):** Repo, schema, Auth, 54 fichas, checklists, evidencias, incidencias
- **Fase 2 (Hecho parcial):** Verificación, dashboard, ReporteDiario
- **Fase 3 (Siguiente):** Multi-sede comparativo
- **Fase 4a (Hecho):** PWA
- **Fase 4b (Pendiente):** Perf (lag), Sentry, AuditLog auto

## 15. Próximos pasos
- Optimizar lag (pooler + cache)
- Multi-sede comparativo en `/reportes`
- `AuditLog` extensión Prisma
- Rotar `service_role` y revocar PATs

## 16. Comandos
```bash
npm run db:generate # prisma generate
npm run db:seed # tsx prisma/seed.ts (54 procesos)
npm run dev # localhost:3000
npm run build # next build
```
- SQL inicial: `sql/00_setup_completo.sql` en Supabase SQL Editor
- Bucket: Storage → New bucket `evidencias` privado
