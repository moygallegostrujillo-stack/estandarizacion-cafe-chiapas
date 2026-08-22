# 🏗️ DISEÑO ESTRUCTURAL DE PLATAFORMA — Café DeChiapas

> **Sistema de Estandarización Operativa para Restaurantes Multi-sede**
> Basado en el método de 54 fichas de proceso | 7 preguntas obligatorias por ficha
> Stack: Next.js + Supabase (PostgreSQL) + Prisma + Auth.js + Vercel
> Cliente piloto: Café DeChiapas (1 restaurante demo → multi-sede)
> Testing: Vitest → Playwright → Ambos pre-deploy

---

## 1. 🎯 ALCANCE Y PROPÓSITO DEL SISTEMA

### 1.1 Visión General

El sistema automatiza y digitaliza el **método de estandarización operativa** documentado en el resumen de 54 fichas de proceso. Transforma las 7 preguntas obligatorias en un flujo de trabajo digital: el staff ejecuta checklists diarios contra las fichas, los supervisores verifican con evidencia fotográfica, y la gerencia obtiene KPIs en tiempo real.

### 1.2 Objetivos del Sistema

| # | Objetivo | Impacto |
|---|----------|---------|
| 1 | Digitalizar las 54 fichas de proceso | Consistencia operativa, 0 papeles |
| 2 | Checklist diario obligatorio por turno | Trazabilidad de cada tarea |
| 3 | Verificación con evidencia (foto) | Auditoría real, no confianza |
| 4 | Reporte de incidencias en tiempo real | Reducción de tiempo de respuesta |
| 5 | KPIs y dashboards por área y sede | Decisiones basadas en datos |
| 6 | Multi-sede desde el diseño inicial | Escalar sin reescribir |

### 1.3 ¿Qué NO hace el sistema (por ahora)?

- No es un POS (Punto de Venta)
- No es inventario en tiempo real (aunque registra mermas)
- No es app para clientes (menú digital, reservas)
- No maneja nómina

---

## 2. 👥 USUARIOS, ROLES Y PERMISOS

### 2.1 Jerarquía de Roles

```
                    ┌──────────────────────────┐
                    │     SUPER ADMIN          │
                    │  Dueño / CEO             │
                    │  Multi-sede, config global│
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │   GERENTE    │   │    RRHH      │   │   COMPRAS    │
   │   Gral. sede │   │  Personal    │   │  Proveed.    │
   │  Dashboards  │   │  Capac. y    │   │  Inventario  │
   │  Reportes    │   │   Eval.      │   │  Ctrl precios│
   └──────┬───────┘   └──────────────┘   └──────────────┘
          │
          ▼
   ┌──────────────────┐
   │  JEFE DE ÁREA    │
   │  Bar / Cocina /  │
   │  Salón / Caja    │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │   SUPERVISOR     │
   │  Verifica tareas │
   └────────┬─────────┘
            │
            ▼
   ┌──────────────────┐
   │  STAFF OPERATIVO │
   │  Ejecuta, marca, │
   │  reporta         │
   └──────────────────┘
```

### 2.2 Matriz de Roles y Permisos

| Rol | Descripción | Crear fichas | Verificar | Reportes | Gestionar usuarios |
|-----|------------|:---:|:---:|:---:|:---:|
| **SUPER_ADMIN** | Dueño / CEO | ✅ | ✅ | ✅ (global) | ✅ (global) |
| **GERENTE** | Gerente de una sede | ✅ | ✅ | ✅ (su sede) | ✅ (su sede) |
| **JEFE_AREA** | Encargado de área | ✅ | ✅ | ✅ (su área) | ❌ |
| **SUPERVISOR** | Verificador de turno | ❌ | ✅ | ✅ (lo que verifica) | ❌ |
| **STAFF** | Bartender, mesero, cocinero, cajero | ❌ | ❌ | ❌ | ❌ |
| **RRHH** | Admin de personal | ✅ (solo PER) | ❌ | ✅ (solo PER) | ✅ (solo PER) |
| **COMPRAS** | Compras e inventario | ✅ (solo COM, INV) | ❌ | ✅ (solo COM, INV) | ❌ |

### 2.3 Permisos Granulares por Área

- **Chef** → CRUD Cocina (COC-01 a COC-06)
- **Jefe de Barra** → CRUD Bar (BAR-01 a BAR-07)
- **Mesero** → Solo lectura SAL-01 a SAL-08 + marcar checklists
- **Cajero** → Solo lectura CAJ-01 a CAJ-08 + marcar checklists
- **Admin Compras** → CRUD Compras + Inventario

---

## 3. 🗄️ ARQUITECTURA DE BASE DE DATOS

### 3.1 Stack de Datos

| Componente | Tecnología | Justificación |
|-----------|-----------|---------------|
| Base de datos | Supabase (PostgreSQL) | Gratis 500MB DB + Storage incluido + Auth |
| ORM | Prisma | Tipado fuerte, migraciones, multi-DB |
| Autenticación | Auth.js con adaptador Prisma | JWT, integración Next.js |
| Archivos | Supabase Storage | Fotos de evidencia, mismo proveedor |
| Hosting | Vercel | Serverless, CI/CD desde GitHub |
| Testing | Vitest + Playwright | Unitario + E2E |

### 3.2 Diagrama Entidad-Relación

```
SEDE (1) ────┬── (N) EQUIPO ── (N) EQUIPO_MIEMBRO ── (N) USUARIO
             │
             ├── (N) AREA ── (N) PROCESO ── (N) FICHA ── (N) PREGUNTA_FICHA
             │                              │
             │                              ├── (N) FICHA_VERSION_SNAPSHOT
             │                              │
             ├── (N) TURNO ── (N) CHECKLIST ── (N) CHECKLIST_ITEM ── (N) EVIDENCIA
             │                              │
             │                              └── (N) INCIDENCIA
             │
             └── (1) CONFIG_SEDE
```

### 3.3 Schema Prisma Completo

```prisma
// ==================== TENENCIA ====================
model Sede {
  id              String         @id @default(cuid())
  nombre          String
  direccion       String?
  telefono        String?
  logoUrl         String?
  activo          Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  equipos         Equipo[]
  turnos          Turno[]
  checklists      Checklist[]
  reportesDiarios ReporteDiario[]
  config          ConfigSede?
  areas           Area[]
}

model ConfigSede {
  id                      String   @id @default(cuid())
  sedeId                  String   @unique
  idioma                  String   @default("es")
  zonaHoraria             String   @default("America/Mexico_City")
  moneda                  String   @default("MXN")
  requiereFotoEvidencia   Boolean  @default(true)
  maxMinutosVerificacion  Int      @default(60)
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
  sede                    Sede     @relation(fields: [sedeId], references: [id])
}

// ==================== USUARIOS ====================
model Usuario {
  id              String       @id @default(cuid())
  email           String       @unique
  nombre          String
  apellido        String?
  telefono        String?
  avatarUrl       String?
  passwordHash    String
  sedeIdActiva    String?
  activo          Boolean      @default(true)
  ultimoAcceso    DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  membresias      EquipoMiembro[]
  checklistsEjecutados  Checklist[]   @relation("ejecutor")
  checklistsVerificados Checklist[]   @relation("verificador")
  itemsCompletados      ChecklistItem[]
  incidenciasReportadas Incidencia[]   @relation("reportador")
  incidenciasAtendidas  Incidencia[]   @relation("atendedor")
}

model Equipo {
  id          String   @id @default(cuid())
  nombre      String
  descripcion String?
  sedeId      String
  areaId      String?
  activo      Boolean  @default(true)
  createdAt   DateTime @default(now())
  sede        Sede             @relation(fields: [sedeId], references: [id])
  area        Area?            @relation(fields: [areaId], references: [id])
  miembros    EquipoMiembro[]
}

model EquipoMiembro {
  id        String      @id @default(cuid())
  equipoId  String
  usuarioId String
  rol       RolUsuario
  activo    Boolean     @default(true)
  desde     DateTime    @default(now())
  hasta     DateTime?
  equipo    Equipo      @relation(fields: [equipoId], references: [id])
  usuario   Usuario     @relation(fields: [usuarioId], references: [id])
  @@unique([equipoId, usuarioId])
}

enum RolUsuario { SUPER_ADMIN GERENTE JEFE_AREA SUPERVISOR STAFF RRHH COMPRAS }

// ==================== AREAS FLEXIBLES ====================
model Area {
  id          String     @id @default(cuid())
  codigo      String
  nombre      String
  icono       String?
  descripcion String?
  color       String?
  orden       Int        @default(0)
  activo      Boolean    @default(true)
  tipo        TipoArea   @default(SISTEMA)
  sedeId      String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  procesos    Proceso[]
  equipos     Equipo[]
  sede        Sede?      @relation(fields: [sedeId], references: [id])
  @@unique([sedeId, codigo])
}

enum TipoArea { SISTEMA PERSONALIZADA }

// ==================== PROCESOS Y FICHAS ====================
model Proceso {
  id            String     @id @default(cuid())
  codigo        String
  nombre        String
  descripcion   String?
  areaId        String
  versionActual Int        @default(1)
  activo        Boolean    @default(true)
  orden         Int        @default(0)
  prioridad     Prioridad  @default(MEDIA)
  frecuencia    Frecuencia?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  area          Area       @relation(fields: [areaId], references: [id])
  fichas        Ficha[]
  @@unique([areaId, codigo])
}

enum Prioridad { CRITICO ALTA MEDIA BAJA }
enum Frecuencia { POR_TURNO DIARIO SEMANAL MENSUAL ANUAL }

model Ficha {
  id                String          @id @default(cuid())
  procesoId         String
  version           Int             @default(1)
  activo            Boolean         @default(true)
  responsablePuesto String?
  aprobadorPuesto   String?
  fechaCreacion     DateTime        @default(now())
  proximaRevision   DateTime?
  kpis              Json?
  riesgos           Json?
  docsVinculados    Json?
  historialCambios  Json?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  proceso           Proceso         @relation(fields: [procesoId], references: [id])
  preguntas         PreguntaFicha[]
  checklists        Checklist[]
  versiones         FichaVersionSnapshot[]
}

model FichaVersionSnapshot {
  id        String   @id @default(cuid())
  fichaId   String
  version   Int
  contenido Json
  creadoPor String
  createdAt DateTime @default(now())
  ficha     Ficha    @relation(fields: [fichaId], references: [id])
  @@unique([fichaId, version])
}

model PreguntaFicha {
  id        String   @id @default(cuid())
  fichaId   String
  numero    Int
  pregunta  String
  respuesta String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ficha     Ficha    @relation(fields: [fichaId], references: [id])
  @@unique([fichaId, numero])
}

// ==================== TURNOS CONFIGURABLES ====================
model Turno {
  id         String   @id @default(cuid())
  sedeId     String
  nombre     String
  horaInicio String
  horaFin    String
  activo     Boolean  @default(true)
  orden      Int      @default(0)
  createdAt  DateTime @default(now())
  sede       Sede     @relation(fields: [sedeId], references: [id])
}

// ==================== CHECKLISTS ====================
model Checklist {
  id                 String          @id @default(cuid())
  fichaId            String
  sedeId             String
  turnoId            String
  fecha              DateTime        @default(now())
  estado             EstadoChecklist @default(PENDIENTE)
  ejecutadoPor       String
  supervisorId       String?
  fechaEjecucion     DateTime?
  fechaVerificacion  DateTime?
  notas              String?
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
  ficha              Ficha           @relation(fields: [fichaId], references: [id])
  sede               Sede            @relation(fields: [sedeId], references: [id])
  turno              Turno           @relation(fields: [turnoId], references: [id])
  ejecutor           Usuario         @relation("ejecutor", fields: [ejecutadoPor], references: [id])
  verificador        Usuario?        @relation("verificador", fields: [supervisorId], references: [id])
  items              ChecklistItem[]
  incidencias        Incidencia[]
}

enum EstadoChecklist { PENDIENTE EN_PROGRESO COMPLETADO VERIFICADO RECHAZADO }

model ChecklistItem {
  id            String      @id @default(cuid())
  checklistId   String
  descripcion   String
  tipo          TipoItem    @default(BOOLEAN)
  valor         String?
  completado    Boolean     @default(false)
  evidenciaUrl  String?
  nota          String?
  orden         Int         @default(0)
  createdAt     DateTime    @default(now())
  usuarioId     String?
  checklist     Checklist   @relation(fields: [checklistId], references: [id])
  completadoPor Usuario?    @relation("itemCompletado", fields: [usuarioId], references: [id])
}

enum TipoItem { BOOLEAN NUMERO TEXTO HORA FOTO }

// ==================== INCIDENCIAS ====================
model Incidencia {
  id              String          @id @default(cuid())
  checklistId     String?
  fichaId         String?
  tipo            TipoIncidencia
  descripcion     String
  gravedad        Gravedad        @default(BAJA)
  reportadoPor    String
  atendidoPor     String?
  accionTomada    String?
  tiempoRespuesta Int?
  cerrado         Boolean         @default(false)
  cerradoEn       DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  checklist       Checklist?      @relation(fields: [checklistId], references: [id])
  ficha           Ficha?          @relation(fields: [fichaId], references: [id])
  reportador      Usuario         @relation("reportador", fields: [reportadoPor], references: [id])
  atendedor       Usuario?        @relation("atendedor", fields: [atendidoPor], references: [id])
}

enum TipoIncidencia { FALTANTE FALLA_EQUIPO ROBO CADUCIDAD OTRO }
enum Gravedad { BAJA MEDIA ALTA CRITICA }

// ==================== REPORTES ====================
model ReporteDiario {
  id                 String   @id @default(cuid())
  sedeId             String
  fecha              DateTime
  totalChecklists    Int      @default(0)
  completados        Int      @default(0)
  verificados        Int      @default(0)
  incidencias        Int      @default(0)
  incidenciasCriticas Int     @default(0)
  createdAt          DateTime @default(now())
  sede               Sede     @relation(fields: [sedeId], references: [id])
  @@unique([sedeId, fecha])
}
```

---

## 4. 🔄 FLUJO OPERATIVO DIARIO

### 4.1 Ciclo del Staff en la App

**Paso 1 — Check-in grupal (5 min antes del turno):**
- El jefe de área abre la app y hace "pase de lista digital"
- Todo el equipo ve los checklists del día
- Se asignan tareas colectivas (no duplicadas)

**Paso 2 — Ejecutar checklist:**
- Staff abre su checklist asignado (máximo 7 items por checklist)
- Marca items con checkboxes rápidos
- Toma foto SOLO si el item lo requiere (temperaturas, stock crítico)
- Si encuentra algo mal → reporte rápido (15 seg)

**Paso 3 — Reporte rápido de incidencias:**
- Botón rojo grande → dicta/escribe 1 frase → foto opcional → se envía
- El supervisor enriquece el reporte después si es necesario

**Paso 4 — Supervisor verifica:**
- Tiene ventana hasta el inicio del siguiente turno
- Aprueba o rechaza con justificación escrita
- Si no verifica a tiempo, se cierra automáticamente

**Paso 5 — Cierre de turno:**
- Staff marca checklists de cierre
- Reporte diario se genera y queda disponible para el gerente

### 4.2 Estados del Checklist

```
PENDIENTE ──> EN_PROGRESO ──> COMPLETADO ──> VERIFICADO
                                │                 │
                                v                 v
                            RECHAZADO         (Fin)
                                │
                                v
                            EN_PROGRESO (reintento)
```

### 4.3 Notificaciones

| Evento | Canal | Destinatarios | ¿En qué horario? |
|--------|-------|---------------|:---:|
| Checklist completado | Push app | Supervisor área | Solo horario laboral |
| Checklist verificado | Push/Email | Staff + Jefe área | Solo horario laboral |
| Incidencia CRITICA | Push + Email | Gerente + Jefe área | Siempre (es crítica) |
| Checklist próximo a vencer | Push | Staff asignado | Solo horario laboral |
| Reporte diario | Email / App | Gerente | Fin del turno |

---

## 5. 📁 ESTRUCTURA DEL PROYECTO (App única)

```
cafe-chiapas/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Login, registro
│   │   ├── (admin)/            # Layout para SUPER_ADMIN, GERENTE, JEFE_AREA
│   │   │   ├── inicio/         # Dashboard principal
│   │   │   ├── procesos/       # CRUD fichas
│   │   │   ├── checklists/     # Ver y verificar
│   │   │   ├── reportes/       # KPIs
│   │   │   ├── equipo/         # Gestión usuarios
│   │   │   └── config/         # Configuración sede
│   │   ├── (staff)/            # Layout para STAFF, SUPERVISOR
│   │   │   ├── inicio/         # Dashboard del día
│   │   │   ├── fichas/         # Consultar fichas
│   │   │   ├── checklists/     # Ejecutar
│   │   │   ├── incidencias/    # Reportar
│   │   │   └── perfil/
│   │   ├── (public)/           # Landing page
│   │   └── api/                # API Routes
│   │       ├── auth/
│   │       ├── sedes/
│   │       ├── areas/
│   │       ├── procesos/
│   │       ├── fichas/
│   │       ├── checklists/
│   │       └── incidencias/
│   │
│   ├── components/             # Componentes React
│   │   ├── ui/                 # shadcn/ui (Button, Card, Dialog, etc.)
│   │   └── domain/             # Componentes de dominio (FichaCard, ChecklistTable)
│   │
│   ├── lib/                    # Utilidades
│   │   ├── prisma.ts           # Cliente Prisma singleton
│   │   ├── auth.ts             # Config Auth.js
│   │   └── validators.ts       # Schemas Zod
│   │
│   ├── middleware.ts           # Auth + tenencia
│   │
│   └── styles/                 # Tailwind CSS
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts                 # Datos demo Café DeChiapas (54 fichas)
│   └── migrations/
│
├── tests/
│   ├── unit/                   # Vitest
│   └── e2e/                    # Playwright
│
├── public/                     # Assets estáticos
├── .env.local
├── next.config.ts
├── package.json
├── vitest.config.ts
└── playwright.config.ts
```

---

## 6. 🗓️ PLAN DE IMPLEMENTACIÓN

### Fase 0: Fundación (Semanas 1-2)
- [ ] Repositorio GitHub + Next.js + Prisma + Supabase
- [ ] Schema completo + migración inicial
- [ ] Seed con 54 fichas de Café DeChiapas
- [ ] Auth.js + Login + Layouts por rol
- [ ] Vitest configurado

### Fase 1: Core — Fichas y Checklists (Semanas 3-6)
- [ ] Vitest: pruebas unitarias de lógica y utilidades
- [ ] CRUD de Áreas y Procesos
- [ ] Editor de Fichas (7 preguntas)
- [ ] Visor de Fichas para staff
- [ ] Checklists: ejecutar items, marcar, subir foto a Supabase Storage
- [ ] Dashboard simple del día
- [ ] Incidencias: reporte rápido

### Fase 2: Supervisión (Semanas 7-9)
- [ ] Playwright: pruebas E2E de flujos completos
- [ ] Flujo de verificación: supervisor aprueba/rechaza
- [ ] Dashboard de gerencia (KPIs por área)
- [ ] Reporte diario automático
- [ ] Historial de versiones de fichas (snapshots)

### Fase 3: Multi-sede y Reportes (Semanas 10-12)
- [ ] Vitest + Playwright: nuevas funciones + regresiones
- [ ] Multi-sede operativo
- [ ] Reportes comparativos entre sedes
- [ ] Exportar fichas a PDF
- [ ] Calendario de estandarización
- [ ] Capacitaciones

### Fase 4: Producción (Semanas 13-16)
- [ ] Playwright + pruebas de seguridad: sistema completo
- [ ] Modo offline (Service Worker + IndexedDB)
- [ ] PWA instalable
- [ ] Tests completos pre-deploy
- [ ] Despliegue Vercel + Supabase
- [ ] Documentación

### Antes de cada despliegue
- [ ] Vitest (unitario) + Playwright (E2E) — verificar que nada se rompió

---

## 7. 📊 KPIs Y MÉTRICAS

| KPI | Formula | Para quien |
|-----|---------|------------|
| % Checklists completados | Completados / Asignados del dia | Gerente, Jefe Area |
| % Checklists verificados | Verificados / Completados | Gerente |
| Tiempo promedio verificacion | (Verificado - Completado) / N | Gerente |
| Incidencias por tipo | Conteo agrupado | Gerente, Jefe Area |
| Tiempo respuesta incidencias | (Atendido - Reportado) / N | Gerente |
| % Fichas con ultima version | Version = latest / Total | Super Admin |
| Checklists por turno | Conteo | Gerente |
| Staff con >90% cumplimiento | % staff con checklists al dia | Gerente, RRHH |

---

## 8. ✅ CORRECCIONES INCORPORADAS (Post-auditoría)

| # | Corrección | De quién | Impacto |
|---|-----------|----------|---------|
| 1 | Modo offline desde Fase 1 (no Fase 4) | UX + Arquitectura | Crítico |
| 2 | Turnos configurables por sede (sin enum fijo) | Arquitectura | Alto |
| 3 | Areas activables/desactivables y personalizables | Arquitectura | Alto |
| 4 | Versionado de fichas con snapshot | Arquitectura | Medio |
| 5 | ChecklistItem con tipo de valor (BOOLEAN, NUMERO, etc.) | Arquitectura | Medio |
| 6 | KPIs, riesgos y docs como JSONB (no texto libre) | Arquitectura | Medio |
| 7 | Español mexicano en interfaz (sin anglicismos) | UX | Medio |
| 8 | Maximo 7 items por checklist, 3 min de ejecucion | UX | Critico |
| 9 | Check-in grupal al inicio del turno | UX | Alto |
| 10 | Foto obligatoria SOLO para items criticos | UX + Dueño | Alto |
| 11 | Notificaciones solo en horario laboral | UX | Alto |
| 12 | Reporte rapido de incidencias (menos de 15 seg) | UX | Medio |
| 13 | Onboarding presencial de 15 min + modo entrenamiento | UX | Critico |
| 14 | App unica (no Turborepo con 3 apps) | Arquitectura | Alto |
| 15 | Testing: Vitest F1, Playwright F2, ambos pre-deploy | Estrategia + Dueño | Alto |
