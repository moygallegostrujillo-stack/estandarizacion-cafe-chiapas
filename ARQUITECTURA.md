# Arquitectura — Café DeChiapas (v2.1) — Refactorización

## 1. Stack
- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4
- **Backend:** Prisma 7 + Supabase PostgreSQL + Auth.js v5
- **Storage:** Supabase Storage + sharp (compresión ~200KB)
- **Validación:** Zod v4
- **Deploy:** Vercel (Hobby plan, 1 cron/día)

## 2. Modelo de datos (schema.prisma)
- **Sede** (4): Piloto, Poliforum, Cabeza Maya, Hospital
- **Area** (8×4): BAR, COCINA, LIMPIEZA, PISO, INVENTARIO, ADMIN, RECEPCION, CALIDAD por sede
- **Usuario:** `sedeIdActiva` + `areaId` (filtro por área para STAFF/JEFE_AREA)
- **Ficha** (54×4): plantillas de proceso, una por área×sede
- **FichaSedeConfig:** habilita/deshabilita ficha por sede (`@@unique([fichaId, sedeId])`)
- **Checklist:** `fechaDia` (YYYY-MM-DD America/Mexico_City), candado único `@@unique([fichaId, sedeId, turnoId, fechaDia])`
- **ChecklistItem:** 5-7 items por checklist, paloma/tache
- **Incidencia:** auto-creada al marcar NO_CUMPLE
- **Evidencia:** fotos comprimidas con sharp, retención 48h

## 3. Flujo de verificación (2 pasos)
```
STAFF/JEFE_AREA crea checklist → PENDIENTE
  ↓ (palomea items)
STAFF/JEFE_AREA marca COMPLETADO → COMPLETADO
  ↓
JEFE_AREA verifica → VERIFICADO
  ↓
GERENTE aprueba → APROBADO / rechaza → RECHAZADO
```

**Reglas:**
- JEFE_AREA puede verificar su propio checklist
- GERENTE NO puede aprobar su propio checklist (debe ser otro)
- SUPER_ADMIN puede todo (incluye auto-verificar para demos)

## 4. Permisos (src/lib/permisos.ts)
| Rol | Fichas | Checklists | Incidencias | Usuarios | Sedes |
|-----|--------|-----------|-------------|----------|-------|
| SUPER_ADMIN | CRUD + admin | CRUD + verificar + eliminar | CRUD + verificar | CRUD + admin | CRUD + admin |
| GERENTE | leer + editar | crear + leer + editar + verificar | CRUD + verificar | — | leer |
| JEFE_AREA | leer | crear + leer + editar + verificar | crear + leer + editar | — | leer |
| SUPERVISOR | leer | leer + verificar | leer + verificar | — | leer |
| STAFF | leer | crear + leer + editar | crear + leer | — | — |

## 5. Módulos lib/ (Fase 2 completada)
| Módulo | Funciones | Extrajo de |
|--------|-----------|-----------|
| `permisos.ts` | `puede()`, `requirePermiso()`, `puedeVerificar()`, `puedeAprobar()`, `puedeToggleFicha()`, `tieneFiltroArea()` | if scattered en routes |
| `fichas.ts` | `listarFichas()`, `toggleFichaPorSede()`, `editarFichaMaestro()` | `api/fichas/route.ts` |
| `checklists.ts` | `listarChecklists()`, `obtenerChecklist()`, `crearChecklist()`, `actualizarChecklist()` | `api/checklists/route.ts` + `[id]/route.ts` |
| `usuarios.ts` | `listarUsuarios()`, `crearUsuario()`, `actualizarUsuario()` | `api/usuarios/route.ts` |
| `termometro.ts` | `obtenerTermometro()`, `obtenerConteos()` | `inicio/page.tsx` |

## 6. Pendientes (routes sin extraer)
- `api/sedes/route.ts` → `lib/sedes.ts`
- `api/procesos/route.ts` → `lib/procesos.ts`
- `api/incidencias/route.ts` → `lib/incidencias.ts`
- `api/evidencias/route.ts` → `lib/evidencias.ts`
- `api/reportes/route.ts` → `lib/reportes.ts`
- `api/dashboard/route.ts` → `lib/dashboard.ts`
- Estos routes aún usan `if (rol === ...)` inline en vez de `requirePermiso()`

## 7. Theme
- **Solo modo claro** (decisión del cliente)
- `ThemeToggle` eliminado de uso
- `globals.css` override zinc→light, botones preservan contraste
