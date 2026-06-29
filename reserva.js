/* ============================================================
   El Pulqui — Simulador de reserva
   Calcula el precio según origen, destino, tipo de servicio
   y cantidad de pasajeros. Sin backend: todo es en el cliente.
   ============================================================ */

// Paradas seleccionables como origen/destino, con el kilómetro
// acumulado sobre el recorrido (usado para calcular la distancia).
const PARADAS = [
  { nombre: 'Parque Rivadavia', km: 0 },
  { nombre: 'Rosario', km: 300 },
  { nombre: 'Santa Fe de la Vera Cruz', km: 470 },
  { nombre: 'Reconquista', km: 780 },
  { nombre: 'Resistencia', km: 1020 },
  { nombre: 'Formosa', km: 1190 },
  { nombre: 'Asunción', km: 1370 },
];

// Nombres alternativos que pueden llegar por la URL y mapean a una parada.
// (Parque Rivadavia es el punto de embarque en Buenos Aires / Almagro.)
const ALIASES = {
  'terminal de almagro': 'Parque Rivadavia',
  'terminal de omnibus almagro': 'Parque Rivadavia',
  almagro: 'Parque Rivadavia',
  'buenos aires': 'Parque Rivadavia',
};

// Modelo de precio (ajustable).
const PRECIO_POR_KM = 18; // ARS por km, servicio base
const SERVICIOS = {
  normal: { etiqueta: 'Normal', factor: 1.0 },
  semicama: { etiqueta: 'Semi Cama', factor: 1.35 },
  cama: { etiqueta: 'Cama', factor: 1.7 },
};

// Horarios de salida diarios y su servicio asociado.
const HORARIOS = [
  { hora: '08:00', servicio: 'Semi Cama' },
  { hora: '14:00', servicio: 'Normal' },
  { hora: '18:00', servicio: 'Cama' },
  { hora: '22:00', servicio: 'Cama' },
];

const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

// --- Referencias del DOM ---
const $origen = document.getElementById('origen');
const $destino = document.getElementById('destino');
const $fecha = document.getElementById('fecha');
const $horario = document.getElementById('horario');
const $pasajeros = document.getElementById('pasajeros');
const $servicios = document.querySelectorAll('input[name="servicio"]');
const $confirmar = document.getElementById('confirmar');
const $aviso = document.getElementById('reserva-aviso');

// Resumen en vivo
const $resTramo = document.getElementById('res-tramo');
const $resDistancia = document.getElementById('res-distancia');
const $resServicio = document.getElementById('res-servicio');
const $resPasajeros = document.getElementById('res-pasajeros');
const $resUnitario = document.getElementById('res-unitario');
const $resTotal = document.getElementById('res-total');

// Comprobante
const $ticket = document.getElementById('comprobante');
const $tkTramo = document.getElementById('tk-tramo');
const $tkFecha = document.getElementById('tk-fecha');
const $tkHorario = document.getElementById('tk-horario');
const $tkServicio = document.getElementById('tk-servicio');
const $tkPasajeros = document.getElementById('tk-pasajeros');
const $tkTotal = document.getElementById('tk-total');

/** Carga las opciones de paradas en los <select> de origen y destino. */
function poblarParadas() {
  // Opción vacía primero: origen y destino son opcionales.
  $origen.add(new Option('Seleccioná origen', ''));
  $destino.add(new Option('Seleccioná destino', ''));
  PARADAS.forEach((parada, indice) => {
    $origen.add(new Option(parada.nombre, indice));
    $destino.add(new Option(parada.nombre, indice));
  });
}

/** Carga los horarios de salida en el <select>. */
function poblarHorarios() {
  HORARIOS.forEach(({ hora, servicio }) => {
    $horario.add(new Option(`${hora} hs · ${servicio}`, hora));
  });
}

/** Devuelve el id del servicio seleccionado (normal / semicama / cama). */
function servicioSeleccionado() {
  const elegido = Array.from($servicios).find((opcion) => opcion.checked);
  return elegido ? elegido.value : 'normal';
}

/** Normaliza un texto (sin acentos, minúsculas) para comparar nombres. */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Índice de la parada cuyo nombre coincide con `valor`, o -1 si no hay match. */
function indiceParada(valor) {
  let objetivo = normalizar(valor);
  if (!objetivo) return -1;
  if (ALIASES[objetivo]) objetivo = normalizar(ALIASES[objetivo]);
  return PARADAS.findIndex((parada) => {
    const nombre = normalizar(parada.nombre);
    return nombre === objetivo || nombre.includes(objetivo) || objetivo.includes(nombre);
  });
}

/**
 * Calcula los datos de la reserva a partir del estado del formulario.
 * Devuelve null si falta el origen o el destino, o si son iguales.
 */
function calcularReserva() {
  // Origen y destino son opcionales: sin ambos no hay tramo que calcular.
  if ($origen.value === '' || $destino.value === '') return null;

  const iOrigen = Number($origen.value);
  const iDestino = Number($destino.value);
  if (iOrigen === iDestino) return null;

  const distancia = Math.abs(PARADAS[iDestino].km - PARADAS[iOrigen].km);
  const servicio = SERVICIOS[servicioSeleccionado()];
  const pasajeros = Math.max(1, Number($pasajeros.value) || 1);

  const unitario = Math.round(distancia * PRECIO_POR_KM * servicio.factor);
  const total = unitario * pasajeros;

  return {
    origen: PARADAS[iOrigen].nombre,
    destino: PARADAS[iDestino].nombre,
    distancia,
    servicio: servicio.etiqueta,
    pasajeros,
    unitario,
    total,
  };
}

/** Actualiza el panel de resumen en vivo y el estado del botón confirmar. */
function actualizarResumen() {
  const reserva = calcularReserva();

  if (!reserva) {
    const ambosElegidos = $origen.value !== '' && $destino.value !== '';
    $resTramo.textContent = ambosElegidos
      ? 'Elegí un origen y un destino distintos'
      : 'Elegí origen y destino';
    $resDistancia.textContent = '—';
    $resServicio.textContent = '—';
    $resPasajeros.textContent = '—';
    $resUnitario.textContent = '—';
    $resTotal.textContent = '—';
    $confirmar.disabled = true;
    // Mismo origen y destino es un error; que falte uno es sólo un dato pendiente.
    $aviso.textContent = 'El origen y el destino no pueden ser iguales.';
    $aviso.hidden = !ambosElegidos;
    return;
  }

  $resTramo.textContent = `${reserva.origen} → ${reserva.destino}`;
  $resDistancia.textContent = `${reserva.distancia} km`;
  $resServicio.textContent = reserva.servicio;
  $resPasajeros.textContent = String(reserva.pasajeros);
  $resUnitario.textContent = pesos.format(reserva.unitario);
  $resTotal.textContent = pesos.format(reserva.total);
  $confirmar.disabled = false;
  $aviso.hidden = true;
}

/** Renderiza el comprobante en pantalla con los datos confirmados. */
function confirmarReserva(evento) {
  evento.preventDefault();
  const reserva = calcularReserva();
  if (!reserva) {
    if ($origen.value === '' || $destino.value === '') {
      $aviso.textContent = 'Elegí un origen y un destino para reservar.';
      $aviso.hidden = false;
    }
    return;
  }

  $tkTramo.textContent = `${reserva.origen} → ${reserva.destino}`;
  $tkFecha.textContent = $fecha.value || 'Sin especificar';
  $tkHorario.textContent = `${$horario.value} hs`;
  $tkServicio.textContent = reserva.servicio;
  $tkPasajeros.textContent = String(reserva.pasajeros);
  $tkTotal.textContent = pesos.format(reserva.total);

  $ticket.hidden = false;
  $ticket.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Precarga el formulario con los parámetros recibidos por la URL.
 * Todos son opcionales: origen, destino, fecha y pasajeros.
 * Ej: reserva.html?origen=Rosario&destino=Formosa&fecha=2026-06-29&pasajeros=3
 */
function aplicarParametros() {
  const params = new URLSearchParams(window.location.search);

  const origen = params.get('origen');
  if (origen) {
    const indice = indiceParada(origen);
    if (indice !== -1) $origen.value = String(indice);
  }

  const destino = params.get('destino');
  if (destino) {
    const indice = indiceParada(destino);
    if (indice !== -1) $destino.value = String(indice);
  }

  const fecha = params.get('fecha');
  if (fecha) $fecha.value = fecha;

  const pasajeros = Number(params.get('pasajeros'));
  if (pasajeros >= 1) $pasajeros.value = String(Math.min(5, Math.floor(pasajeros)));
}

// --- Inicialización ---
poblarParadas();
poblarHorarios();
$horario.selectedIndex = 0;

// Fecha mínima: hoy.
$fecha.min = new Date().toISOString().split('T')[0];

// Precarga con los parámetros recibidos por la URL (todos opcionales).
aplicarParametros();

// Recalcular ante cualquier cambio del formulario.
[$origen, $destino, $pasajeros, ...$servicios].forEach((control) =>
  control.addEventListener('change', actualizarResumen)
);
$pasajeros.addEventListener('input', actualizarResumen);
document.getElementById('form-reserva').addEventListener('submit', confirmarReserva);

actualizarResumen();
