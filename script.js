/* =========================================================
   Estado: se guardan datos por separado para cada versión
   ========================================================= */
const ALTO_BANDA = 100;

const nuevoRegistro = () => ({
  clics: [],
  movs: [],
  permanencia: {},
  conteo: {},
  totalClics: 0,
  profundidad: 0
});

const estado = {
  modo: 'con',
  vista: 'ninguna',
  datos: { con: nuevoRegistro(), sin: nuevoRegistro() }
};

const capaCalor = document.getElementById('capa-calor');
const capaScroll = document.getElementById('capa-scroll');
const panel = document.getElementById('panel');
const stClics = document.getElementById('stClics');
const stBarra = document.getElementById('stBarra');
const ranking = document.getElementById('ranking');
const aviso = document.getElementById('aviso');

let heat = null;

const actual = () => estado.datos[estado.modo];
const alturaPagina = () => Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);

/* =========================================================
   Mapa de calor (clics y movimiento) con heatmap.js
   ========================================================= */
function construirCalor() {
  capaCalor.innerHTML = '';
  capaCalor.style.height = '0px';
  heat = null;

  if (estado.vista !== 'clics' && estado.vista !== 'movimiento') return;

  if (typeof h337 === 'undefined') {
    aviso.classList.remove('d-none');
    return;
  }
  aviso.classList.add('d-none');

  capaCalor.style.height = alturaPagina() + 'px';

  const esClics = estado.vista === 'clics';
  heat = h337.create({
    container: capaCalor,
    radius: esClics ? 45 : 30,
    maxOpacity: 0.7,
    minOpacity: 0,
    blur: 0.85
  });

  // heatmap.js fuerza position:relative en el contenedor; lo revertimos
  capaCalor.style.position = 'absolute';

  const puntos = esClics ? actual().clics : actual().movs;
  if (puntos.length) {
    heat.setData({ max: esClics ? 4 : 10, data: puntos });
  }
}

/* =========================================================
   Mapa de scroll: franjas frías (poco tiempo) a calientes (mucho)
   ========================================================= */
function pintarScroll() {
  capaScroll.innerHTML = '';
  capaScroll.style.height = '0px';

  if (estado.vista !== 'scroll') {
    capaScroll.style.display = 'none';
    return;
  }

  capaScroll.style.display = 'block';
  capaScroll.style.height = alturaPagina() + 'px';

  const perm = actual().permanencia;
  const valores = Object.values(perm);
  const maximo = valores.length ? Math.max(1, ...valores) : 1;
  const franjas = Math.ceil(alturaPagina() / ALTO_BANDA);

  for (let i = 0; i < franjas; i++) {
    const t = (perm[i] || 0) / maximo;
    const franja = document.createElement('div');
    franja.style.top = (i * ALTO_BANDA) + 'px';
    franja.style.height = ALTO_BANDA + 'px';
    // frío (azul) a caliente (rojo)
    const hue = Math.round(220 * (1 - t));
    franja.style.background = `hsla(${hue}, 90%, 50%, 0.35)`;
    capaScroll.appendChild(franja);
  }
}

/* =========================================================
   Panel: estadísticas
   ========================================================= */
function actualizarPanel() {
  const d = actual();
  stClics.textContent = d.totalClics;
  stBarra.style.width = d.profundidad + '%';
  stBarra.textContent = d.profundidad + '%';

  const lista = Object.entries(d.conteo).sort((a, b) => b[1] - a[1]).slice(0, 8);
  ranking.innerHTML = lista.length
    ? lista.map(([nombre, cant], i) =>
        `<li class="list-group-item d-flex justify-content-between py-1">
           <span>${i + 1}. ${nombre}</span>
           <span class="badge text-bg-dark">${cant}</span>
         </li>`).join('')
    : '<li class="list-group-item text-secondary py-1">Haz clic en la página…</li>';
}

function medirScroll() {
  const d = actual();
  const prof = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / alturaPagina()) * 100));
  if (prof > d.profundidad) {
    d.profundidad = prof;
    actualizarPanel();
  }
}

function refrescarVista() {
  capaCalor.style.height = '0px';
  capaScroll.style.height = '0px';
  construirCalor();
  pintarScroll();
  medirScroll();
  actualizarPanel();
}

/* =========================================================
   Captura de eventos REALES del usuario
   ========================================================= */
document.addEventListener('click', (e) => {
  if (e.target.closest('#panel')) return;

  const enlaceVacio = e.target.closest('a[href="#"]');
  if (enlaceVacio) e.preventDefault();

  const d = actual();
  const punto = { x: Math.round(e.pageX), y: Math.round(e.pageY), value: 1 };
  d.clics.push(punto);
  d.totalClics++;

  const el = e.target.closest('[data-track]');
  const nombre = el ? el.dataset.track : 'Zona sin contenido';
  d.conteo[nombre] = (d.conteo[nombre] || 0) + 1;

  if (heat && estado.vista === 'clics') heat.addData(punto);
  actualizarPanel();
});

let ultimoMov = 0;
document.addEventListener('mousemove', (e) => {
  const ahora = performance.now();
  if (ahora - ultimoMov < 80 || e.target.closest('#panel')) return;
  ultimoMov = ahora;

  const d = actual();
  const punto = { x: Math.round(e.pageX), y: Math.round(e.pageY), value: 1 };
  d.movs.push(punto);
  if (d.movs.length > 5000) d.movs.shift();

  if (heat && estado.vista === 'movimiento') heat.addData(punto);
});

window.addEventListener('scroll', medirScroll, { passive: true });

setInterval(() => {
  if (document.hidden) return;
  const d = actual();
  const ini = Math.floor(window.scrollY / ALTO_BANDA);
  const fin = Math.floor((window.scrollY + window.innerHeight) / ALTO_BANDA);
  for (let i = ini; i <= fin; i++) {
    d.permanencia[i] = (d.permanencia[i] || 0) + 0.25;
  }
  if (estado.vista === 'scroll') pintarScroll();
}, 250);

/* =========================================================
   Controles del panel
   ========================================================= */
document.querySelectorAll('input[name="modo"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    estado.modo = radio.value;
    document.body.classList.toggle('con-jerarquia', radio.value === 'con');
    document.body.classList.toggle('sin-jerarquia', radio.value === 'sin');
    requestAnimationFrame(refrescarVista);
  });
});

document.querySelectorAll('input[name="vista"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    estado.vista = radio.value;
    refrescarVista();
  });
});

document.getElementById('btnReiniciar').addEventListener('click', () => {
  estado.datos = { con: nuevoRegistro(), sin: nuevoRegistro() };
  refrescarVista();
});

document.getElementById('btnPanel').addEventListener('click', () => {
  panel.classList.toggle('cerrado');
});

let temporizador;
window.addEventListener('resize', () => {
  clearTimeout(temporizador);
  temporizador = setTimeout(refrescarVista, 250);
});

window.addEventListener('load', refrescarVista);
