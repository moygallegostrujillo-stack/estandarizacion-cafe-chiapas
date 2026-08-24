# Estandarización V2 — Café DeChiapas

Plataforma de estandarización operativa multi-sede para restaurantes.

## 🚀 Setup inicial (15 minutos)

### Paso 1: Ejecutar script SQL en Supabase (1 minuto)

1. Abre tu proyecto **"Estandarizacion V2"** en https://supabase.com/dashboard
2. Ve a **SQL Editor** → **New query**
3. Abre el archivo `sql/00_setup_completo.sql` de esta carpeta
4. Copia TODO su contenido y pégalo en el SQL Editor
5. Click **Run** (Ctrl+Enter)
6. Verifica que diga "Success. No rows returned"

**Resultado:** 21 tablas + RLS completo + 40+ políticas + 50+ índices + 3 triggers creados.

### Paso 2: Crear bucket de Storage (1 minuto)

1. En Supabase → **Storage** → **New bucket**
2. Name: `evidencias`
3. Public: **NO** (privado)
4. Click **Save**

### Paso 3: Configurar variables de entorno (3 minutos)

1. Copia `.env.example` a `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Obtén los valores de Supabase → **Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL` → Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → anon public key
   - `SUPABASE_SERVICE_ROLE_KEY` → service_role key (⚠️ NUNCA en frontend)

3. Obtén el string de conexión de Supabase → **Settings → Database → Connection string**:
   - `DATABASE_URL` → Transaction mode URL (puerto 6543)
   - `DIRECT_URL` → Session mode URL (puerto 5432)

4. Genera el AUTH_SECRET:
   ```bash
   openssl rand -base64 32
   ```
   Pega el resultado en `AUTH_SECRET`.

### Paso 4: Instalar dependencias (3 minutos)

```bash
npm install
```

### Paso 5: Generar cliente Prisma (1 minuto)

```bash
npm run db:generate
```

### Paso 6: Ejecutar seed (datos demo) (1 minuto)

```bash
npm run db:seed
```

**Resultado:** Crea 1 sede, 1 usuario admin, 7 áreas, 3 turnos, 1 ficha de ejemplo.

### Paso 7: Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre http://localhost:3000

**Credenciales de login:**
- Email: `admin@cafe.com`
- Password: `admin123`

⚠️ **Cambiar contraseña de admin en producción.**

---

## 📁 Estructura del proyecto

```
estandarizacion_v2/
├── sql/
│   └── 00_setup_completo.sql     # Script único para crear toda la DB
├── prisma/
│   ├── schema.prisma              # Schema Prisma v2.1
│   └── seed.ts                    # Datos demo
├── src/
│   ├── lib/
│   │   ├── prisma.ts              # Cliente Prisma singleton
│   │   ├── auth.ts                # Auth.js v5 config
│   │   ├── db-session.ts          # Helper RLS (Row Level Security)
│   │   ├── storage.ts             # Supabase Storage + sharp
│   │   └── validators.ts          # Schemas Zod
│   ├── app/
│   │   ├── layout.tsx             # Root layout
│   │   ├── page.tsx               # Redirect a /inicio
│   │   ├── globals.css            # Tailwind CSS
│   │   ├── login/page.tsx         # Página de login
│   │   ├── inicio/page.tsx        # Dashboard principal
│   │   └── api/auth/[...nextauth]/route.ts
│   └── middleware.ts              # Auth + routing por rol
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── README.md
```

---

## 🏗️ Arquitectura

### Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js | 16.3.2 |
| UI | React + Tailwind CSS 4 | 19 + 4 |
| ORM | Prisma | 7.9.1 |
| Base de datos | PostgreSQL (Supabase) | 15+ |
| Auth | Auth.js v5 + Prisma Adapter | 5.0.0-beta |
| Storage | Supabase Storage | — |
| Compresión | sharp | 0.33 |
| Validación | Zod | 4.4 |

### Seguridad (RLS)

Toda consulta a la base de datos se ejecuta dentro de un contexto de usuario que establece variables de sesión en PostgreSQL:

```typescript
import { withUserContext } from "@/lib/db-session";

await withUserContext(user.id, user.rol, user.sedeId, async (tx) => {
  // Aquí las queries se ejecutan con RLS filtrando por sedeId
  const checklists = await tx.checklist.findMany();
  return checklists;
});
```

Las políticas RLS garantizan que un usuario solo puede ver y modificar datos de su sede, excepto SUPER_ADMIN (ve todo) y RRHH (ve todos los usuarios).

### Compresión de imágenes (sharp)

Toda foto de evidencia se comprime antes de subir a Storage:

```typescript
import { uploadEvidencia } from "@/lib/storage";

const result = await uploadEvidencia(fileBuffer, checklistItemId, userId);
// Foto original 3 MB → comprimida a ~200 KB
```

Esto permite mantener costo $0 en Supabase Free Tier durante 9+ meses de operación.

---

## 📋 Próximos pasos

Una vez que el sistema esté corriendo:

1. **Generar las 54 fichas con IA** — Usar la estrategia del documento v2.1 (sección 8)
2. **Construir flujos de checklist** — `/checklists` para ejecutar items
3. **Construir reporte de incidencias** — Botón rojo de 15 segundos
4. **Construir dashboards** — KPIs por área y por sede
5. **Implementar onboarding de 2 semanas** — Plan detallado en documento v2.1 (sección 11)

---

## 🆘 Solución de problemas

### Error: "Prisma Client not generated"

```bash
npm run db:generate
```

### Error: "Environment variable not found"

Verifica que `.env.local` existe y tiene todas las variables de `.env.example`.

### Error: "RLS blocks the query"

Estás ejecutando una query fuera de `withUserContext`. Envuélvela:

```typescript
import { withCurrentUserContext } from "@/lib/db-session";

await withCurrentUserContext(async (tx) => {
  return await tx.checklist.findMany();
});
```

### Error: "Bucket not found"

Asegúrate de haber creado el bucket `evidencias` en Supabase → Storage.

### Login falla con credenciales correctas

1. Verifica que ejecutaste `npm run db:seed`
2. Revisa que el usuario admin existe en Supabase → Table Editor → Usuario
3. Verifica que `AUTH_SECRET` esté configurado en `.env.local`

---

## 📚 Documentación relacionada

- `Diseño_Tecnico_v2.1.docx` — Diseño técnico completo
- `Analisis_Migracion_v2.1.docx` — Análisis de la migración (referencia histórica)

---

## 📞 Soporte

Si algo no funciona:
1. Verifica los pasos 1-7 de este README
2. Revisa la consola del navegador (F12) y la terminal de Next.js
3. Consulta la sección "Solución de problemas" arriba
