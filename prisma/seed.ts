import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Cafe DeChiapas (v2.1 - 21 tablas)...");

  // 3 sedes reales: Poliforum, Cabeza Maya, Hospital (cocina)
  const sedesData = [
    { id: "demo-sede-001", nombre: "Cafe DeChiapas - Sede Piloto", direccion: "Av. Principal 123, Tuxtla Gutierrez, Chiapas", telefono: "+52 961 123 4567" },
    { id: "sede-poliforum", nombre: "Cafe DeChiapas - Poliforum", direccion: "Poliforum, Tuxtla", telefono: "+52 961 123 4567" },
    { id: "sede-cabeza-maya", nombre: "Cafe DeChiapas - Cabeza Maya", direccion: "Cabeza Maya, Tuxtla", telefono: "+52 961 123 4568" },
    { id: "sede-hospital", nombre: "Cafe DeChiapas - Hospital", direccion: "Hospital, Tuxtla", telefono: "+52 961 123 4569" },
  ];
  const sedes: typeof sedesData = [];
  for (const sd of sedesData) {
    const s = await prisma.sede.upsert({ where: { id: sd.id }, update: {}, create: { id: sd.id, nombre: sd.nombre, direccion: sd.direccion, telefono: sd.telefono, activo: true } });
    sedes.push(s as never);
    const cfg = await prisma.configSede.findUnique({ where: { sedeId: s.id } });
    if (!cfg) await prisma.configSede.create({ data: { sedeId: s.id, idioma: "es", zonaHoraria: "America/Mexico_City", moneda: "MXN", requiereFotoEvidencia: true, maxMinutosVerificacion: 60 } });
    const tc = await prisma.turno.count({ where: { sedeId: s.id } });
    if (tc === 0) {
      for (const t of [{ nombre: "Matutino", horaInicio: "06:00", horaFin: "14:00", orden: 1 }, { nombre: "Vespertino", horaInicio: "14:00", horaFin: "22:00", orden: 2 }, { nombre: "Nocturno", horaInicio: "22:00", horaFin: "06:00", orden: 3 }]) {
        await prisma.turno.create({ data: { ...t, sedeId: s.id } });
      }
    }
  }
  console.log("✓ Sedes:", sedes.map((s) => s.nombre).join(", "));
  const sede = sedes[0]!; // compatibilidad resto del seed

  // Usuarios: admin + Julie/Erika/Fredy/Manolo + barra demo
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@cafe.com" },
    update: {},
    create: { email: "admin@cafe.com", nombre: "Administrador", apellido: "Sistema", passwordHash, rol: "SUPER_ADMIN", sedeIdActiva: sedes.find((s) => s.id === "sede-poliforum")!.id, activo: true },
  });
  console.log("✓ Usuario admin:", admin.email, `(${admin.rol})`);
  const sedePoliforum = sedes.find((s) => s.id === "sede-poliforum")!;
  const sedeCabeza = sedes.find((s) => s.id === "sede-cabeza-maya")!;
  for (const u of [
    { email: "julie@cafe.com", nombre: "Julie", rol: "GERENTE", sedeId: sedePoliforum.id, pass: "julie1234" },
    { email: "erika@cafe.com", nombre: "Erika", rol: "GERENTE", sedeId: sedeCabeza.id, pass: "erika1234" },
    { email: "fredy@cafe.com", nombre: "Fredy", rol: "SUPER_ADMIN", sedeId: sedePoliforum.id, pass: "fredy1234" },
    { email: "manolo@cafe.com", nombre: "Manolo", rol: "SUPER_ADMIN", sedeId: sedePoliforum.id, pass: "manolo1234" },
    { email: "barra@cafe.com", nombre: "Jefe Barra", rol: "JEFE_AREA", sedeId: sedePoliforum.id, pass: "barra1234" },
  ]) {
    const h = await bcrypt.hash(u.pass, 10);
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, nombre: u.nombre, passwordHash: h, rol: u.rol, sedeIdActiva: u.sedeId, activo: true },
    });
    console.log("✓ Usuario:", u.email, `(${u.rol} - ${u.sedeId})`);
  }
  // Asigna BAR a barra@cafe.com
  try {
    const bar = await prisma.area.findFirst({ where: { codigo: "BAR", sedeId: sedePoliforum.id } });
    if (bar) await prisma.usuario.update({ where: { email: "barra@cafe.com" }, data: { areaId: bar.id } as never });
  } catch {}

  const areas = [
    { c: "BAR", n: "Bar", i: "🍸", col: "#3B82F6", o: 1, procs: [
      { c: "BAR-01", n: "Apertura", p: "CRITICO", f: "DIARIO" },
      { c: "BAR-02", n: "Montaje", p: "ALTA", f: "DIARIO" },
      { c: "BAR-03", n: "Mise en place", p: "ALTA", f: "DIARIO" },
      { c: "BAR-04", n: "Venta sugestiva", p: "MEDIA", f: "DIARIO" },
      { c: "BAR-05", n: "Servicio", p: "CRITICO", f: "POR_TURNO" },
      { c: "BAR-06", n: "Inventario", p: "ALTA", f: "DIARIO" },
      { c: "BAR-07", n: "Cierre", p: "CRITICO", f: "DIARIO" },
    ]},
    { c: "COM", n: "Compras", i: "🛒", col: "#10B981", o: 2, procs: [
      { c: "COM-01", n: "Que comprar", p: "CRITICO", f: "SEMANAL" },
      { c: "COM-02", n: "Cuando comprar", p: "ALTA", f: "SEMANAL" },
      { c: "COM-03", n: "A quien comprar", p: "ALTA", f: "MENSUAL" },
      { c: "COM-04", n: "Cantidades", p: "ALTA", f: "SEMANAL" },
      { c: "COM-05", n: "Recepcion", p: "CRITICO", f: "POR_TURNO" },
      { c: "COM-06", n: "Control precios", p: "MEDIA", f: "MENSUAL" },
      { c: "COM-07", n: "Rotacion FIFO", p: "CRITICO", f: "DIARIO" },
    ]},
    { c: "PER", n: "Personal", i: "👥", col: "#8B5CF6", o: 3, procs: [
      { c: "PER-01", n: "Funciones", p: "CRITICO", f: "ANUAL" },
      { c: "PER-02", n: "Responsabilidades", p: "ALTA", f: "ANUAL" },
      { c: "PER-03", n: "Horarios", p: "ALTA", f: "SEMANAL" },
      { c: "PER-04", n: "Protocolos", p: "CRITICO", f: "MENSUAL" },
      { c: "PER-05", n: "Capacitaciones", p: "ALTA", f: "MENSUAL" },
      { c: "PER-06", n: "Evaluaciones", p: "MEDIA", f: "MENSUAL" },
    ]},
    { c: "CAJ", n: "Caja", i: "💰", col: "#F59E0B", o: 4, procs: [
      { c: "CAJ-01", n: "Apertura", p: "CRITICO", f: "DIARIO" },
      { c: "CAJ-02", n: "Manejo efectivo", p: "CRITICO", f: "POR_TURNO" },
      { c: "CAJ-03", n: "Descuentos", p: "ALTA", f: "DIARIO" },
      { c: "CAJ-04", n: "Anulaciones", p: "ALTA", f: "DIARIO" },
      { c: "CAJ-05", n: "Cortes", p: "CRITICO", f: "DIARIO" },
      { c: "CAJ-06", n: "Promociones", p: "MEDIA", f: "DIARIO" },
      { c: "CAJ-07", n: "Cortesias", p: "ALTA", f: "DIARIO" },
      { c: "CAJ-08", n: "Cierres", p: "CRITICO", f: "DIARIO" },
    ]},
    { c: "SAL", n: "Salon", i: "🍽️", col: "#EF4444", o: 5, procs: [
      { c: "SAL-01", n: "Apertura", p: "CRITICO", f: "DIARIO" },
      { c: "SAL-02", n: "Montaje", p: "ALTA", f: "DIARIO" },
      { c: "SAL-03", n: "Recepcion", p: "CRITICO", f: "POR_TURNO" },
      { c: "SAL-04", n: "Toma pedido", p: "CRITICO", f: "POR_TURNO" },
      { c: "SAL-05", n: "Venta sugerida", p: "MEDIA", f: "DIARIO" },
      { c: "SAL-06", n: "Servicio", p: "CRITICO", f: "POR_TURNO" },
      { c: "SAL-07", n: "Despedida", p: "MEDIA", f: "DIARIO" },
      { c: "SAL-08", n: "Cierre", p: "CRITICO", f: "DIARIO" },
    ]},
    { c: "INV", n: "Inventario", i: "📦", col: "#06B6D4", o: 6, procs: [
      { c: "INV-01", n: "Conteo", p: "CRITICO", f: "DIARIO" },
      { c: "INV-02", n: "Frecuencia", p: "ALTA", f: "MENSUAL" },
      { c: "INV-03", n: "Responsables", p: "ALTA", f: "MENSUAL" },
      { c: "INV-04", n: "Diferencias", p: "CRITICO", f: "DIARIO" },
      { c: "INV-05", n: "Mermas", p: "CRITICO", f: "DIARIO" },
      { c: "INV-06", n: "Ajustes", p: "ALTA", f: "DIARIO" },
    ]},
    { c: "LIM", n: "Limpieza", i: "🧹", col: "#84CC16", o: 7, procs: [
      { c: "LIM-01", n: "Que se limpia", p: "CRITICO", f: "DIARIO" },
      { c: "LIM-02", n: "Como", p: "CRITICO", f: "DIARIO" },
      { c: "LIM-03", n: "Cuando", p: "ALTA", f: "DIARIO" },
      { c: "LIM-04", n: "Con quien", p: "ALTA", f: "SEMANAL" },
      { c: "LIM-05", n: "Verificacion", p: "CRITICO", f: "DIARIO" },
      { c: "LIM-06", n: "Estandares", p: "MEDIA", f: "MENSUAL" },
    ]},
    { c: "COC", n: "Cocina", i: "👨‍🍳", col: "#EC4899", o: 8, procs: [
      { c: "COC-01", n: "Recetas", p: "CRITICO", f: "ANUAL" },
      { c: "COC-02", n: "Produccion", p: "CRITICO", f: "DIARIO" },
      { c: "COC-03", n: "Almacenamiento", p: "CRITICO", f: "DIARIO" },
      { c: "COC-04", n: "Limpieza", p: "CRITICO", f: "DIARIO" },
      { c: "COC-05", n: "Mermas", p: "ALTA", f: "DIARIO" },
      { c: "COC-06", n: "Mise en place", p: "CRITICO", f: "DIARIO" },
    ]},
  ];

  let total = 0;
  for (const s of sedes) {
  for (const a of areas) {
    const area = await prisma.area.upsert({
      where: { sedeId_codigo: { sedeId: s.id, codigo: a.c } },
      update: {},
      create: { codigo: a.c, nombre: a.n, icono: a.i, color: a.col, orden: a.o, sedeId: s.id, tipo: "SISTEMA", activo: true },
    });
    for (let i = 0; i < a.procs.length; i++) {
      const p = a.procs[i];
      total++;
      // Evitar duplicar proceso si ya existe
      let proceso = await prisma.proceso.findFirst({ where: { codigo: p.c, areaId: area.id } });
      if (!proceso) {
        proceso = await prisma.proceso.create({
          data: { codigo: p.c, nombre: p.n, areaId: area.id, prioridad: p.p, frecuencia: p.f, versionActual: 1, orden: i + 1 },
        });
      }
      // Ficha - crear si no existe
      let ficha = await prisma.ficha.findFirst({ where: { procesoId: proceso.id, version: 1 } });
      if (!ficha) {
        ficha = await prisma.ficha.create({
          data: {
            procesoId: proceso.id, version: 1,
            responsablePuesto: a.n + " turno",
            aprobadorPuesto: "Jefe de " + a.n,
            activo: true,
          },
        });
        // KPIs y Riesgos relacionales (v2.1)
        await prisma.fichaKpi.create({
          data: { fichaId: ficha.id, nombre: "Tiempo de ejecución", formula: "minutos desde inicio hasta checklist completado", meta: "≤ 30 min", frecuencia: p.f },
        });
        await prisma.fichaRiesgo.create({
          data: { fichaId: ficha.id, tipo: "operacional", descripcion: "Incumplimiento de estándar " + p.c, probabilidad: "media", impacto: "alto", mitigacion: "Verificar checklist con foto. Escalar a supervisor." },
        });
        await prisma.preguntaFicha.createMany({
          data: [
            { fichaId: ficha.id, numero: 1, pregunta: "QUIEN lo hace", respuesta: a.n + " turno" },
            { fichaId: ficha.id, numero: 2, pregunta: "COMO se hace", respuesta: "Pasos secuenciales con verbos de acción" },
            { fichaId: ficha.id, numero: 3, pregunta: "CUANDO se hace", respuesta: "Frecuencia: " + p.f + " - 15-30 min" },
            { fichaId: ficha.id, numero: 4, pregunta: "QUE PASA si sale mal", respuesta: "Contingencias. Escalar a supervisor" },
            { fichaId: ficha.id, numero: 5, pregunta: "COMO COMPRUEBO", respuesta: "Checklist + foto + registro" },
            { fichaId: ficha.id, numero: 6, pregunta: "QUE RECURSOS", respuesta: "Insumos, equipos, EPP, documentos" },
            { fichaId: ficha.id, numero: 7, pregunta: "DONDE se registra", respuesta: "CafeOps - " + a.c },
          ],
        });
      }
    }
  }
  }

  console.log(`✅ Seed completo: ${sedes.length} sedes, 8 areas c/u, ${total} procesos`);
  console.log("");
  console.log("Para iniciar sesión:");
  console.log("  Email: admin@cafe.com");
  console.log("  Password: admin123");
}

main().catch((e) => { console.error("❌ Seed error:", e); process.exit(1); }).finally(() => prisma.$disconnect());
