import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding Cafe DeChiapas (v2.1 - 21 tablas)...");

  const sede = await prisma.sede.upsert({
    where: { id: "demo-sede-001" },
    update: {},
    create: {
      id: "demo-sede-001",
      nombre: "Cafe DeChiapas - Sede Piloto",
      direccion: "Av. Principal 123, Tuxtla Gutierrez, Chiapas",
      telefono: "+52 961 123 4567",
      activo: true,
    },
  });
  console.log("✓ Sede:", sede.nombre);

  // ConfigSede - upsert manual (no unique id predictable)
  const existingConfig = await prisma.configSede.findUnique({ where: { sedeId: sede.id } });
  if (!existingConfig) {
    await prisma.configSede.create({
      data: {
        sedeId: sede.id,
        idioma: "es",
        zonaHoraria: "America/Mexico_City",
        moneda: "MXN",
        requiereFotoEvidencia: true,
        maxMinutosVerificacion: 60,
      },
    });
    console.log("✓ ConfigSede creada");
  } else {
    console.log("✓ ConfigSede ya existe");
  }

  // Turnos
  const turnosExistentes = await prisma.turno.count({ where: { sedeId: sede.id } });
  if (turnosExistentes === 0) {
    const turnos = [
      { nombre: "Matutino", horaInicio: "06:00", horaFin: "14:00", orden: 1 },
      { nombre: "Vespertino", horaInicio: "14:00", horaFin: "22:00", orden: 2 },
      { nombre: "Nocturno", horaInicio: "22:00", horaFin: "06:00", orden: 3 },
    ];
    for (const t of turnos) await prisma.turno.create({ data: { ...t, sedeId: sede.id } });
    console.log("✓ Turnos: 3");
  } else {
    console.log("✓ Turnos ya existen:", turnosExistentes);
  }

  // Usuario admin (SUPER_ADMIN con rol en Usuario, no en EquipoMiembro)
  const passwordHash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@cafe.com" },
    update: {},
    create: {
      email: "admin@cafe.com",
      nombre: "Administrador",
      apellido: "Sistema",
      passwordHash,
      rol: "SUPER_ADMIN",
      sedeIdActiva: sede.id,
      activo: true,
    },
  });
  console.log("✓ Usuario admin:", admin.email, `(${admin.rol})`);

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
  for (const a of areas) {
    const area = await prisma.area.upsert({
      where: { sedeId_codigo: { sedeId: sede.id, codigo: a.c } },
      update: {},
      create: { codigo: a.c, nombre: a.n, icono: a.i, color: a.col, orden: a.o, sedeId: sede.id, tipo: "SISTEMA", activo: true },
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

  console.log(`✅ Seed completo: 8 areas, ${total} procesos, 1 admin`);
  console.log("");
  console.log("Para iniciar sesión:");
  console.log("  Email: admin@cafe.com");
  console.log("  Password: admin123");
}

main().catch((e) => { console.error("❌ Seed error:", e); process.exit(1); }).finally(() => prisma.$disconnect());
