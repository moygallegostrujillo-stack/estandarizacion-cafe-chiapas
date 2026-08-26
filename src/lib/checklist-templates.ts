// Templates operativos realistas por proceso - 5-7 tareas medibles, observables en 5s
export const CHECKLIST_TEMPLATES: Record<string, { descripcion: string; evidenciaRequerida: boolean }[]> = {
  // BAR
  "BAR-01": [
    { descripcion: "Máquina espresso encendida luz verde OK y purgada 2s", evidenciaRequerida: false },
    { descripcion: "Temperatura refrigerador bar 2-5°C", evidenciaRequerida: true },
    { descripcion: "Estación surtida: leche, jarabes, vasos, filtros", evidenciaRequerida: false },
    { descripcion: "Hielo lleno, limpio y sin olor", evidenciaRequerida: false },
    { descripcion: "Prueba espresso 25-30s extracción correcta", evidenciaRequerida: false },
    { descripcion: "Caja bar fondo $500 contado", evidenciaRequerida: false },
    { descripcion: "Bitácora apertura firmada", evidenciaRequerida: false },
  ],
  "BAR-02": [
    { descripcion: "Copas pulidas sin manchas ni huellas", evidenciaRequerida: false },
    { descripcion: "Shaker, jigger y utensilios limpios ordenados", evidenciaRequerida: false },
    { descripcion: "Garnish fresco cortado y refrigerado", evidenciaRequerida: false },
    { descripcion: "Servilletas y posavasos stock completo", evidenciaRequerida: false },
    { descripcion: "Foto estación montada", evidenciaRequerida: true },
  ],
  "BAR-03": [
    { descripcion: "Fruta porcionada etiquetada con fecha", evidenciaRequerida: false },
    { descripcion: "Syrups >50% y fechados", evidenciaRequerida: false },
    { descripcion: "Pre-batch del día en refrigeración", evidenciaRequerida: false },
    { descripcion: "Hielo reserva 2 bolsas", evidenciaRequerida: false },
    { descripcion: "Foto mise en place", evidenciaRequerida: true },
  ],
  "BAR-04": [
    { descripcion: "Pizarra especial del día actualizada", evidenciaRequerida: false },
    { descripcion: "Ofreció postre/café a últimas 3 mesas", evidenciaRequerida: false },
    { descripcion: "Conoce 3 maridajes del día", evidenciaRequerida: false },
    { descripcion: "Ticket promedio turno anotado", evidenciaRequerida: false },
  ],
  "BAR-05": [
    { descripcion: "Comanda leída sin faltantes", evidenciaRequerida: false },
    { descripcion: "Bebida servida en <3 min", evidenciaRequerida: false },
    { descripcion: "Presentación según receta", evidenciaRequerida: false },
    { descripcion: "Entrega con servilleta y cuchara", evidenciaRequerida: false },
    { descripcion: "Estación limpia tras servicio", evidenciaRequerida: false },
  ],
  "BAR-06": [
    { descripcion: "Botellas abiertas medidas en mL", evidenciaRequerida: false },
    { descripcion: "Botellas cerradas contadas", evidenciaRequerida: false },
    { descripcion: "Mermas pesadas registradas", evidenciaRequerida: false },
    { descripcion: "Foto inventario final", evidenciaRequerida: true },
    { descripcion: "Formato firmado por supervisor", evidenciaRequerida: false },
  ],
  "BAR-07": [
    { descripcion: "Máquina apagada y limpia", evidenciaRequerida: false },
    { descripcion: "Botellas bajo llave", evidenciaRequerida: false },
    { descripcion: "Barra limpia, seca, sin basura", evidenciaRequerida: false },
    { descripcion: "Basura retirada, botes limpios", evidenciaRequerida: false },
    { descripcion: "Foto cierre general", evidenciaRequerida: true },
  ],
  // COMPRAS
  "COM-01": [
    { descripcion: "Lista maestra insumos revisada y sin faltantes", evidenciaRequerida: false },
    { descripcion: "Especificaciones (marca, calibre) confirmadas", evidenciaRequerida: false },
    { descripcion: "Proveedores aprobados vigentes", evidenciaRequerida: false },
    { descripcion: "Foto lista maestra", evidenciaRequerida: true },
  ],
  "COM-02": [
    { descripcion: "Punto de reorden verificado por categoría", evidenciaRequerida: false },
    { descripcion: "Lead times de proveedores confirmados", evidenciaRequerida: false },
    { descripcion: "Calendario compras semanal actualizado", evidenciaRequerida: false },
  ],
  "COM-03": [
    { descripcion: "3 cotizaciones comparadas", evidenciaRequerida: false },
    { descripcion: "Proveedor con mejor calidad/precio seleccionado", evidenciaRequerida: false },
    { descripcion: "Contrato/acuerdo vigente", evidenciaRequerida: false },
  ],
  "COM-04": [
    { descripcion: "Cálculo par stock con merma histórica", evidenciaRequerida: false },
    { descripcion: "Ajuste por evento/proyección clima", evidenciaRequerida: false },
    { descripcion: "Cantidades autorizadas por gerente", evidenciaRequerida: false },
  ],
  "COM-05": [
    { descripcion: "Temperatura recepción 0-4°C (fríos) + foto termómetro", evidenciaRequerida: true },
    { descripcion: "Cantidad vs albarán coincide", evidenciaRequerida: false },
    { descripcion: "Calidad visual OK (sin golpes, sin caducadas)", evidenciaRequerida: false },
    { descripcion: "Albarán firmado y archivado", evidenciaRequerida: false },
  ],
  "COM-06": [
    { descripcion: "Precio vs histórico variación <5%", evidenciaRequerida: false },
    { descripcion: "Alerta variación >5% reportada", evidenciaRequerida: false },
    { descripcion: "Negociación registrada", evidenciaRequerida: false },
  ],
  "COM-07": [
    { descripcion: "Etiquetado entrada con fecha y lote", evidenciaRequerida: false },
    { descripcion: "Ubicación FIFO respetada", evidenciaRequerida: false },
    { descripcion: "Caducadas retiradas y merma registrada", evidenciaRequerida: false },
    { descripcion: "Foto rotación FIFO", evidenciaRequerida: true },
  ],
  // PERSONAL
  "PER-01": [
    { descripcion: "Descripción puesto firmada por titular", evidenciaRequerida: false },
    { descripcion: "Tareas críticas listadas y visibles", evidenciaRequerida: false },
    { descripcion: "Autoridad y reportes claros", evidenciaRequerida: false },
  ],
  "PER-02": [
    { descripcion: "KPIs por rol visibles en pizarra", evidenciaRequerida: false },
    { descripcion: "Límites de decisión comunicados", evidenciaRequerida: false },
    { descripcion: "Rendición cuentas del turno firmada", evidenciaRequerida: false },
  ],
  "PER-03": [
    { descripcion: "Horario semanal publicado domingo 18:00", evidenciaRequerida: false },
    { descripcion: "Cobertura pico (12-16h, 19-22h) completa", evidenciaRequerida: false },
    { descripcion: "Cambios con 24h aviso y autorización", evidenciaRequerida: false },
  ],
  "PER-04": [
    { descripcion: "Uniforme completo y limpio", evidenciaRequerida: false },
    { descripcion: "Uñas cortas, sin joyas, cabello recogido", evidenciaRequerida: false },
    { descripcion: "Celular guardado (no en servicio)", evidenciaRequerida: false },
    { descripcion: "Foto protocolo higiene", evidenciaRequerida: true },
  ],
  "PER-05": [
    { descripcion: "Asistencia capacitación firmada", evidenciaRequerida: false },
    { descripcion: "Evaluación 80% aprobada", evidenciaRequerida: false },
    { descripcion: "Material entregado", evidenciaRequerida: false },
  ],
  "PER-06": [
    { descripcion: "Evaluación mensual realizada", evidenciaRequerida: false },
    { descripcion: "Plan mejora con 3 acciones", evidenciaRequerida: false },
    { descripcion: "Firma evaluado y evaluador", evidenciaRequerida: false },
  ],
  // CAJA
  "CAJ-01": [
    { descripcion: "Fondo inicial $1000 contado y registrado", evidenciaRequerida: true },
    { descripcion: "Billetes falsos verificados con marcador", evidenciaRequerida: false },
    { descripcion: "POS encendido y prueba $1 OK", evidenciaRequerida: false },
    { descripcion: "Turno abierto en sistema", evidenciaRequerida: false },
  ],
  "CAJ-02": [
    { descripcion: "Billetes grandes en caja fuerte inmediato", evidenciaRequerida: false },
    { descripcion: "Ticket entregado a cada cliente", evidenciaRequerida: false },
    { descripcion: "Corte parcial cada $3000", evidenciaRequerida: false },
  ],
  "CAJ-03": [
    { descripcion: "Descuento autorizado por gerente (firma)", evidenciaRequerida: false },
    { descripcion: "Motivo descuento registrado", evidenciaRequerida: false },
    { descripcion: "Ticket con descuento archivado", evidenciaRequerida: false },
  ],
  "CAJ-04": [
    { descripcion: "Anulación con autorización y motivo", evidenciaRequerida: false },
    { descripcion: "Ticket anulado grapado al original", evidenciaRequerida: false },
    { descripcion: "Foto anulación", evidenciaRequerida: true },
  ],
  "CAJ-05": [
    { descripcion: "Corte X impreso y contado", evidenciaRequerida: false },
    { descripcion: "Diferencia vs sistema < $10", evidenciaRequerida: false },
    { descripcion: "Fondo entregado a gerente contado", evidenciaRequerida: false },
  ],
  "CAJ-06": [
    { descripcion: "Promoción del día activa en POS", evidenciaRequerida: false },
    { descripcion: "Pizarra promoción visible", evidenciaRequerida: false },
    { descripcion: "Stock promoción suficiente", evidenciaRequerida: false },
  ],
  "CAJ-07": [
    { descripcion: "Cortesía autorizada y registrada", evidenciaRequerida: false },
    { descripcion: "Motivo cortesía anotado", evidenciaRequerida: false },
    { descripcion: "Ticket cortesía firmado", evidenciaRequerida: false },
  ],
  "CAJ-08": [
    { descripcion: "Arqueo final contado doble", evidenciaRequerida: true },
    { descripcion: "Depósito en sobre sellado", evidenciaRequerida: false },
    { descripcion: "Cierre turno en sistema", evidenciaRequerida: false },
    { descripcion: "Foto cierre caja", evidenciaRequerida: true },
  ],
  // SALON
  "SAL-01": [
    { descripcion: "Luces, música y clima encendidos", evidenciaRequerida: false },
    { descripcion: "Mesas y sillas limpias y alineadas", evidenciaRequerida: false },
    { descripcion: "Baños limpios, papel y jabón OK + foto", evidenciaRequerida: true },
    { descripcion: "Menús limpios y completos", evidenciaRequerida: false },
  ],
  "SAL-02": [
    { descripcion: "Mesa montada: mantel, cubiertos, vaso, servilleta", evidenciaRequerida: false },
    { descripcion: "Centro de mesa y carta en posición", evidenciaRequerida: false },
    { descripcion: "Sillas sin manchas", evidenciaRequerida: false },
    { descripcion: "Foto montaje", evidenciaRequerida: true },
  ],
  "SAL-03": [
    { descripcion: "Saludo en <30s con sonrisa", evidenciaRequerida: false },
    { descripcion: "Acompañamiento a mesa y silla recorrida", evidenciaRequerida: false },
    { descripcion: "Agua servida en <2 min", evidenciaRequerida: false },
  ],
  "SAL-04": [
    { descripcion: "Comanda tomada sin errores, alergias preguntadas", evidenciaRequerida: false },
    { descripcion: "Comanda enviada a cocina/bar inmediato", evidenciaRequerida: false },
    { descripcion: "Tiempo prometido comunicado", evidenciaRequerida: false },
  ],
  "SAL-05": [
    { descripcion: "Ofreció postre/bebida especial", evidenciaRequerida: false },
    { descripcion: "Conoce 2 maridajes", evidenciaRequerida: false },
    { descripcion: "Ticket promedio anotado", evidenciaRequerida: false },
  ],
  "SAL-06": [
    { descripcion: "Plato servido por lado correcto, sin interrupción", evidenciaRequerida: false },
    { descripcion: "Chequeo a los 2 bocados", evidenciaRequerida: false },
    { descripcion: "Mesa limpia sin platos sucios", evidenciaRequerida: false },
  ],
  "SAL-07": [
    { descripcion: "Cuenta entregada en <2 min al pedir", evidenciaRequerida: false },
    { descripcion: "Despedida con nombre y gracias", evidenciaRequerida: false },
    { descripcion: "Invitación a volver", evidenciaRequerida: false },
  ],
  "SAL-08": [
    { descripcion: "Mesas desmontadas y limpias", evidenciaRequerida: false },
    { descripcion: "Piso barrido y trapeado", evidenciaRequerida: false },
    { descripcion: "Luces y clima apagados", evidenciaRequerida: false },
    { descripcion: "Foto cierre salón", evidenciaRequerida: true },
  ],
  // INVENTARIO
  "INV-01": [
    { descripcion: "Conteo físico por categoría pesado/contado", evidenciaRequerida: false },
    { descripcion: "Formato conteo sin celdas vacías", evidenciaRequerida: false },
    { descripcion: "Foto conteo", evidenciaRequerida: true },
  ],
  "INV-02": [
    { descripcion: "Frecuencia diaria/semanal respetada por insumo", evidenciaRequerida: false },
    { descripcion: "Calendario inventario visible", evidenciaRequerida: false },
  ],
  "INV-03": [
    { descripcion: "Responsable conteo firmó", evidenciaRequerida: false },
    { descripcion: "Supervisor validó", evidenciaRequerida: false },
  ],
  "INV-04": [
    { descripcion: "Diferencia <2% o reporte con causa", evidenciaRequerida: false },
    { descripcion: "Ajuste autorizado por gerente", evidenciaRequerida: false },
    { descripcion: "Foto diferencia", evidenciaRequerida: true },
  ],
  "INV-05": [
    { descripcion: "Mermas pesadas y causa anotada (ej. sobrecocción)", evidenciaRequerida: false },
    { descripcion: "Merma >3% reportada", evidenciaRequerida: false },
    { descripcion: "Foto merma", evidenciaRequerida: true },
  ],
  "INV-06": [
    { descripcion: "Ajuste con folio y motivo", evidenciaRequerida: false },
    { descripcion: "Kardex actualizado", evidenciaRequerida: false },
    { descripcion: "Firma gerente", evidenciaRequerida: false },
  ],
  // LIMPIEZA
  "LIM-01": [
    { descripcion: "Área a limpiar identificada (piso, baño, cocina)", evidenciaRequerida: false },
    { descripcion: "Check área completa", evidenciaRequerida: false },
  ],
  "LIM-02": [
    { descripcion: "Químico correcto dosis según ficha técnica", evidenciaRequerida: false },
    { descripcion: "Utensilio limpio (franela distinta por área)", evidenciaRequerida: false },
    { descripcion: "EPP puesto (guantes)", evidenciaRequerida: false },
  ],
  "LIM-03": [
    { descripcion: "Frecuencia respetada (ej. baños cada 2h)", evidenciaRequerida: false },
    { descripcion: "Horario sin clientes (antes de abrir)", evidenciaRequerida: false },
  ],
  "LIM-04": [
    { descripcion: "Responsable asignado visible en pizarra", evidenciaRequerida: false },
    { descripcion: "Suplente definido", evidenciaRequerida: false },
  ],
  "LIM-05": [
    { descripcion: "Supervisor verificó con luz y tacto", evidenciaRequerida: false },
    { descripcion: "Foto verificación limpieza", evidenciaRequerida: true },
    { descripcion: "Firma supervisor", evidenciaRequerida: false },
  ],
  "LIM-06": [
    { descripcion: "Estándar 90% blanco en prueba (servilleta)", evidenciaRequerida: false },
    { descripcion: "Sin olores", evidenciaRequerida: false },
  ],
  // COCINA
  "COC-01": [
    { descripcion: "Receta impresa a la vista y sin manchas", evidenciaRequerida: false },
    { descripcion: "Porcionador calibrado", evidenciaRequerida: false },
    { descripcion: "Prueba sabor OK por chef", evidenciaRequerida: false },
  ],
  "COC-02": [
    { descripcion: "Producción según par stock del día", evidenciaRequerida: false },
    { descripcion: "Etiquetado con fecha/hora", evidenciaRequerida: false },
    { descripcion: "Foto producción", evidenciaRequerida: true },
  ],
  "COC-03": [
    { descripcion: "Refrigeración 0-4°C, congelación -18°C + foto termómetro", evidenciaRequerida: true },
    { descripcion: "Crudos abajo, cocidos arriba, separados", evidenciaRequerida: false },
    { descripcion: "Todo tapado y etiquetado FIFO", evidenciaRequerida: false },
  ],
  "COC-04": [
    { descripcion: "Cocina limpia y desinfectada post-servicio", evidenciaRequerida: false },
    { descripcion: "Campana y filtros sin grasa", evidenciaRequerida: false },
    { descripcion: "Foto limpieza cocina", evidenciaRequerida: true },
  ],
  "COC-05": [
    { descripcion: "Merma pesada y registrada con causa", evidenciaRequerida: false },
    { descripcion: "Merma >5% reportada a chef", evidenciaRequerida: false },
    { descripcion: "Foto merma", evidenciaRequerida: true },
  ],
  "COC-06": [
    { descripcion: "Mise en place por estación completo", evidenciaRequerida: false },
    { descripcion: "Todo porcionado y en insertos tapados", evidenciaRequerida: false },
    { descripcion: "Foto mise en place cocina", evidenciaRequerida: true },
  ],
};

export function getChecklistTemplate(codigo: string) {
  return CHECKLIST_TEMPLATES[codigo] || null;
}
