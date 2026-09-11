import { useEffect, useRef, useState } from "react";
import { supabaseAnon } from "../lib/supabase";
import { getKickStatus } from "../services/pantallaDj";

/**
 * TOMATAZO — el motor visual de «Sacar Tema» en modo 🍅.
 *
 * Reproduce la animación del DJ Democracy original, medida cuadro por cuadro
 * sobre la grabación:
 *
 *   1. el tomate entero entra MUY GRANDE por un lateral o una esquina
 *   2. viaja ~1 s girando sobre su eje y ACHICÁNDOSE fuerte (perspectiva: viene
 *      de cerca del espectador y se va hacia la pantalla)
 *   3. pega en un punto concreto
 *   4. desde ese punto el tomate ROTO se desprende y baja una distancia corta
 *   5. la MANCHA es el ARRASTRE que va del punto de impacto hasta el roto
 *   6. el conjunto (impacto + arrastre + roto en la punta) QUEDA quieto
 *   7. a los 10 s se desvanece y se va
 *
 * ── Las tres imágenes ───────────────────────────────────────────────────────
 *
 *   kick_tomato_flying_url   → el tomate ENTERO, que gira y se achica
 *   kick_tomato_splat_url    → el ARRASTRE, anclado por su EXTREMO SUPERIOR en
 *                              el punto de impacto, que crece hacia el roto
 *   kick_tomato_exploded_url → el tomate ROTO, que cae por esa misma línea y
 *                              queda en la punta del arrastre
 *
 * ── Un punto y un vector, nada más ──────────────────────────────────────────
 *
 *   impacto = { x, y }                      ← se calcula UNA vez por lanzamiento
 *   caída   = { dx, dy }                    ← siempre hacia abajo
 *
 *   el entero TERMINA en impacto
 *   el arrastre VA de impacto a impacto+caída
 *   el roto VA de impacto a impacto+caída
 *
 * El arrastre y el roto comparten el ángulo, la distancia, la duración y el
 * easing, así que no pueden separarse: en cualquier instante el roto está en la
 * punta del arrastre.
 *
 * El arrastre NO se centra en el impacto — se ANCLA por su extremo de arriba
 * (`transform-origin: 50% 0%` + `translateX(-50%)`, sin corrimiento vertical).
 * Es un trazo que empieza en el golpe, no una imagen flotando en el medio.
 *
 * ── De dónde sale la señal ──────────────────────────────────────────────────
 * La ÚNICA señal de impacto nuevo es `pantalla_events.kick_impact_seq`, que la
 * TV ya recibe por la suscripción de `usePantallaEvent`: no se abre otro canal
 * de realtime. El servidor la incrementa sólo al ENTRAR un voto; retirar un voto
 * (untoggle) mueve `kick_votes_current` pero NO la secuencia.
 *
 * ── Hacen falta 2 activos ───────────────────────────────────────────────────
 * Con un solo participante activo el voto vale el 100% del padrón y el servidor
 * saca el tema de una. Eso no es una votación, así que no se dibuja nada: la
 * canción cambia directo, sin tomate, sin mancha y sin cartel. El padrón sale de
 * `active` (el mismo `pantalla__active_count` del umbral, sin staff ni dj), que
 * es el único lugar donde se define qué es «activo».
 *
 * ── Baseline ────────────────────────────────────────────────────────────────
 * `kick_impact_seq` es monotónico durante toda la jornada: abrir /tv con la
 * votación en 25 NO son 25 impactos pendientes, es el punto de partida.
 *
 * ── Qué NO hace ─────────────────────────────────────────────────────────────
 * No toca el motor A/B de reproducción ni el audio: es una capa `position:
 * fixed` con `pointer-events: none`. La canción la avanza el servidor.
 */

// ── Dónde puede pegar ───────────────────────────────────────────────────────
const X_MIN = 8, X_MAX = 92;
const Y_MIN = 8, Y_MAX = 88;
// Influencia del progreso hacia el umbral: leve a propósito. La posición la
// manda el seq; ni con progreso 1 los tomates terminan en 50/50.
const SESGO_CENTRO = 0.12;
// Anti-apilamiento: distancia mínima contra los impactos vecinos, en % de
// viewport. Si la posición base cae más cerca, se prueban reubicaciones.
const DIST_MINIMA = 12;
const VECINOS_A_MIRAR = 4;
const CANDIDATOS = 4;

// ── Vuelo del entero — medido en la grabación original: ~1 s ────────────────
const VUELO_MIN_MS = 850;
const VUELO_MAX_MS = 1150;
// Perspectiva: entra enorme y llega chico. La reducción tiene que ser evidente.
const ESCALA_INI_MIN = 2.5, ESCALA_INI_MAX = 4.0;   // al entrar
const ESCALA_FIN_MIN = 0.55, ESCALA_FIN_MAX = 0.8;  // al impactar
// Nadie revolea en línea recta. El recorrido lleva un arco chico (como el de un
// brazo) más un temblor independiente en cada parada: alcanza para que no se vea
// el riel, sin convertirlo en un zig-zag.
const ARCO_MIN = 2, ARCO_MAX = 5;
const TEMBLOR_MAX = 1.2;
// El desvío vertical se achica respecto del horizontal: en vh el mismo número se
// ve más grande que en vw.
const DESVIO_Y = 0.7;
// Giro del entero: 1 a 2,5 vueltas.
const GIRO_MIN = 360, GIRO_MAX = 900;

// ── Caída del roto — corta y torpe ──────────────────────────────────────────
const CAIDA_MIN_MS = 500;
const CAIDA_MAX_MS = 850;
// Vertical hacia abajo es 0°. El desvío casi nunca pasa de ±10° y en ningún caso
// de ±18°: el tomate pega y se desliza, no sale disparado en diagonal.
const ANGULO_MAX = 18;
const ANGULO_SESGO = 1.7;   // exponente: concentra la mayoría en ángulos chicos
// Arrastre corto: una marca compacta, no un chorreado que cruza la pantalla.
const CAIDA_MIN_VH = 6, CAIDA_MAX_VH = 14;
const CAIDA_TOPE_VH = 16;
// Margen para que la punta del arrastre no se vaya del cuadro.
const BORDE_SEGURO_Y = 96;
const BORDE_SEGURO_X = 96;
// Desprendimiento: el golpe lo despega un poco de costado y lo levanta apenas
// antes de que la gravedad gane. Nunca más de ~1,5 vh: no es un rebote.
const DESPEGUE_X_MAX = 1.6;
const DESPEGUE_Y_MAX = 1.2;
// Y una pausa brevísima pegado a la pantalla antes de empezar a caer.
const PAUSA_MIN_MS = 40, PAUSA_MAX_MS = 100;
// Giro del roto mientras baja: menos marcado que el del entero.
const GIRO_ROTO_MIN = 180, GIRO_ROTO_MAX = 420;

// ── Vida del resultado ──────────────────────────────────────────────────────
// Desde el impacto: el conjunto queda quieto 10 s y después se desvanece rápido
// y se va del DOM. Cada tomatazo tiene su propio reloj.
const VIDA_IMPACTO_MS = 10000;
const SALIDA_MS = 420;
// Separación de una ráfaga: varios votos casi simultáneos se ven como varios
// tomates, no como uno.
const SEPARACION_MS = 130;
// Techo de impactos simultáneos en pantalla; al pasarse se va el más viejo.
const MAX_IMPACTOS = 18;
// Si el seq salta mucho (pestaña dormida, reconexión con votos en el medio) se
// dibuja una ráfaga razonable en vez de una lluvia de cien tomates.
const MAX_RAFAGA = 8;
const BANNER_MS = 3000;
// Progreso de emergencia si la RPC de estado falla: se pierde la precisión del
// punto de impacto, no el tomate.
const PROGRESO_FALLBACK = 0.5;
const TEXTO_POR_DEFECTO = "El pueblo quitó este tema de forma democrática 👎";
// El arrastre y el roto comparten duración, pausa y tiempo LINEAL: la gravedad
// vive en las paradas de los keyframes, y usar el mismo reloj en los dos es lo
// que los mantiene pegados.
const EASE_CAIDA = "linear";
// Conversión aproximada vh→vw para un 16:9, sólo para recortar la deriva lateral
// de modo que la punta no se vaya por el costado. El vector se expresa en vh en
// los dos ejes para que el ángulo sea exacto en cualquier pantalla.
const VH_A_VW_16_9 = 0.5625;

const DEV = import.meta.env.DEV;

/** Pseudo-random determinista: el mismo seq da el mismo número en toda TV. */
function ruido(semilla) {
  let h = Math.imul(semilla ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const vw = (n) => `${n.toFixed(2)}vw`;
const vh = (n) => `${n.toFixed(2)}vh`;
const deg = (n) => `${Math.round(n)}deg`;
const entre = (lo, hi, t) => lo + t * (hi - lo);

/**
 * Una posición candidata para el impacto de `n`. `j` elige el par de canales de
 * ruido: j=0 es la posición base y 1…3 son reubicaciones, para cuando la base
 * cae encima de un tomatazo vecino.
 */
function candidato(n, j, p) {
  const x = entre(X_MIN, X_MAX, ruido(n * 64 + 1 + j * 2));
  const y = entre(Y_MIN, Y_MAX, ruido(n * 64 + 2 + j * 2));
  const k = SESGO_CENTRO * Math.min(1, Math.max(0, p));
  return { x: x + (50 - x) * k, y: y + (50 - y) * k };
}

/**
 * Punto de impacto: repartido por toda la pantalla y sin apilarse con los
 * anteriores.
 *
 * Los vecinos NO se leen de lo que esta TV tiene en pantalla: se recalculan
 * desde seq-1…seq-4. Así la elección depende sólo del seq y dos TVs del mismo
 * evento eligen el mismo punto aunque una haya entrado a mitad de la canción.
 */
function puntoDeImpacto(n, p) {
  const vecinos = [];
  for (let k = 1; k <= VECINOS_A_MIRAR && n - k >= 0; k++) vecinos.push(candidato(n - k, 0, p));

  let mejor = null, mejorDist = -1;
  for (let j = 0; j < CANDIDATOS; j++) {
    const c = candidato(n, j, p);
    let dist = Infinity;
    for (const v of vecinos) dist = Math.min(dist, Math.hypot(c.x - v.x, c.y - v.y));
    if (dist >= DIST_MINIMA) return c;          // suficientemente lejos: sirve
    if (dist > mejorDist) { mejor = c; mejorDist = dist; }
  }
  return mejor;                                  // ninguno llegó: el más lejano
}

/**
 * Por dónde entra el tomate. Los laterales y las esquinas se llevan 8 de los 9
 * casos, que es de donde entra en el original; por arriba entra 1 de 9.
 */
function entrada(n) {
  const slot = Math.floor(ruido(n * 64 + 10) * 9) % 9;
  const largo = entre(10, 90, ruido(n * 64 + 11));
  switch (slot) {
    case 0: case 1: return { startX: -28,   startY: largo, lado: "izquierda" };
    case 2: case 3: return { startX: 128,   startY: largo, lado: "derecha" };
    case 4:         return { startX: -26,   startY: -26,   lado: "esquina-arriba-izq" };
    case 5:         return { startX: 126,   startY: -26,   lado: "esquina-arriba-der" };
    case 6:         return { startX: -26,   startY: 126,   lado: "esquina-abajo-izq" };
    case 7:         return { startX: 126,   startY: 126,   lado: "esquina-abajo-der" };
    default:        return { startX: largo, startY: -28,   lado: "arriba" };
  }
}

/**
 * Geometría completa de UN tomatazo. Todo determinista: dos TVs del mismo evento
 * dibujan el mismo tomate, con la misma trayectoria, el mismo giro y la misma
 * caída, sin hablarse entre ellas. Nada de `Math.random()`.
 *
 * La idea es imperfección controlada: cada tomatazo tiene que parecer tirado por
 * otra persona, sin que la pantalla se vuelva un caos.
 *
 * Varía por seq: punto de impacto, borde de entrada, punto sobre ese borde,
 * arco y temblor del recorrido, cuánto camino lleva hecho en cada parada, escalas
 * de la perspectiva y su ritmo, ritmo del giro, duración del vuelo, ángulo,
 * distancia, pausa, desprendimiento y ritmo de la caída, y giro del roto.
 */
export function positionForImpact(seq, progress) {
  const p = Math.min(1, Math.max(0, Number(progress) || 0));
  const n = Math.trunc(Number(seq) || 0);
  const r = (i) => ruido(n * 64 + i);

  // ── EL punto. Uno solo, compartido por las tres piezas ───────────────────
  const { x, y } = puntoDeImpacto(n, p);
  const { startX, startY, lado } = entrada(n);

  // ── Vuelo del entero ─────────────────────────────────────────────────────
  const duracionVuelo = Math.round(entre(VUELO_MIN_MS, VUELO_MAX_MS, r(17)));
  const escalaIni = entre(ESCALA_INI_MIN, ESCALA_INI_MAX, r(18));
  const escalaFin = entre(ESCALA_FIN_MIN, ESCALA_FIN_MAX, r(20));

  // El recorrido se describe con CINCO paradas (0 / 25 / 50 / 75 / 100 % del
  // tiempo). Lo que hace que no parezca un riel es que las tres de adentro se
  // mueven por seq en tres cosas a la vez:
  //
  //   · CUÁNTO camino lleva hecho en cada parada. Las fracciones están
  //     adelantadas respecto del tiempo (0,34 del camino al 25% del tiempo, por
  //     ejemplo) y cada tramo avanza menos que el anterior: sale con impulso y
  //     va perdiendo velocidad, como algo revoleado y no como algo que flota.
  //   · un ARCO perpendicular al trayecto, más ancho en el medio, que es la
  //     curva del brazo que lo tiró.
  //   · un TEMBLOR chico e independiente en cada parada, que desarma la
  //     simetría del arco sin llegar a zig-zag.
  //
  // Los desvíos se van apagando hacia el final, así que nunca se pierde de vista
  // que el tomate va a impactX/impactY.
  // El camino recorrido sale de 1-(1-t)^e con e entre 1,4 y 1,9, evaluado en las
  // cuatro paradas. Al ser cóncava, cada tramo avanza MENOS que el anterior sin
  // excepción: el tomate sale con impulso y llega frenando, siempre. Lo que varía
  // por seq es el exponente, o sea cuánto frena. Acá no va jitter a propósito —
  // sorteando las fracciones suelta, un tramo podía salir más rápido que el
  // anterior y el lanzamiento perdía el frenado.
  const frenado = entre(1.4, 1.9, r(27));
  const f = [0, 0.25, 0.5, 0.75, 1].map((t) => 1 - Math.pow(1 - t, frenado));
  const dirX = x - startX, dirY = y - startY;
  const largoTrayecto = Math.hypot(dirX, dirY) || 1;
  const perpX = -dirY / largoTrayecto, perpY = (dirX / largoTrayecto) * DESVIO_Y;
  const arco = entre(ARCO_MIN, ARCO_MAX, r(12)) * (r(13) < 0.5 ? -1 : 1);
  const formaArco = [0, 0.62, 1, 0.54, 0];           // más abierto en el medio
  const paradas = f.map((frac, i) => {
    const temblor = i === 0 || i === 4
      ? 0
      : (r(30 + i) - 0.5) * 2 * TEMBLOR_MAX * (1 - frac);
    const desvio = arco * formaArco[i] + temblor;
    return {
      x: startX + dirX * frac + perpX * desvio,
      y: startY + dirY * frac + perpY * desvio,
    };
  });

  // Gira sobre su propio eje: 1 a 2,5 vueltas, en cualquier sentido, arrancando
  // de una orientación distinta cada vez. Y NO a velocidad constante: las
  // fracciones de giro consumidas en cada parada también se sortean, así que el
  // tomate acelera y frena en el aire en vez de rodar como una rueda. El sentido
  // nunca se invierte (las fracciones son crecientes por construcción).
  const sentido = r(33) < 0.5 ? -1 : 1;
  const giro    = Math.round(entre(GIRO_MIN, GIRO_MAX, r(14)));
  const rotIni  = Math.round(r(15) * 360 - 180);
  const rotFin  = rotIni + sentido * giro;
  const gf = [0, entre(0.14, 0.32, r(34)), entre(0.42, 0.62, r(16)), entre(0.68, 0.86, r(35)), 1];
  const rotaciones = gf.map((frac) => rotIni + (rotFin - rotIni) * frac);

  // La perspectiva tampoco baja a ritmo parejo: la reducción ya consumida en
  // cada parada se sortea. Siempre decreciente, nunca uniforme.
  const sf = [0, entre(0.22, 0.34, r(36)), entre(0.52, 0.64, r(37)), entre(0.76, 0.86, r(38)), 1];
  const escalas = sf.map((frac) => escalaIni - (escalaIni - escalaFin) * frac);

  // ── Vector de caída: SIEMPRE hacia abajo, corto y torpe ──────────────────
  // Vertical = 0°, desvío ±18° y con sesgo a los ángulos chicos: la mayoría cae
  // casi a plomo. La distancia vertical se recorta para que la punta del arrastre
  // no se vaya del cuadro, y la lateral para que no se vaya por el costado;
  // después el ángulo se RECALCULA del vector ya recortado, así que el arrastre y
  // el roto siguen compartiendo exactamente la misma línea.
  const anguloPedido = ANGULO_MAX * Math.pow(r(21), ANGULO_SESGO) * (r(39) < 0.5 ? -1 : 1);
  let dy = entre(CAIDA_MIN_VH, CAIDA_MAX_VH, r(22));
  dy = Math.min(dy, CAIDA_TOPE_VH, Math.max(CAIDA_MIN_VH, BORDE_SEGURO_Y - y));
  let dx = dy * Math.tan((anguloPedido * Math.PI) / 180);
  const dxMaxVh = Math.max(0, (dx >= 0 ? BORDE_SEGURO_X - x : x - (100 - BORDE_SEGURO_X)))
                  / VH_A_VW_16_9;
  dx = Math.sign(dx) * Math.min(Math.abs(dx), dxMaxVh);
  // Ángulo efectivo: positivo = hacia la derecha. En CSS el giro positivo lleva
  // el extremo hacia la izquierda, así que el arrastre se rota con el negado.
  const anguloGrados = (Math.atan2(dx, dy) * 180) / Math.PI;
  const largoArrastre = Math.hypot(dx, dy);
  const duracionCaida = Math.round(entre(CAIDA_MIN_MS, CAIDA_MAX_MS, r(23)));
  // Pausa pegado a la pantalla antes de desprenderse. La comparten el roto y el
  // arrastre, así que siguen arrancando juntos.
  const pausa = Math.round(entre(PAUSA_MIN_MS, PAUSA_MAX_MS, r(40)));
  // Fracciones del vector recorridas en cada parada de la caída (0 / 15 / 45 /
  // 75 / 100 %). Salen de t^e con e entre 1,8 y 2,4: al ser convexa, cada tramo
  // avanza MÁS que el anterior sin excepción, que es exactamente la gravedad. El
  // exponente cambia por seq, así que cada tomate acelera distinto. A los 15% del
  // tiempo lleva apenas un 1–3 % del recorrido: queda pegado y después se suelta.
  const gravedad = entre(1.8, 2.4, r(41));
  const kf = [0, 0.15, 0.45, 0.75, 1].map((t) => Math.pow(t, gravedad));
  // Y en la primera parada, el desprendimiento: el golpe lo empuja apenas de
  // costado y lo levanta un poco antes de que la gravedad gane.
  const despegueX = (r(44) - 0.5) * 2 * DESPEGUE_X_MAX;
  const despegueY = -entre(0.3, DESPEGUE_Y_MAX, r(45));
  // El giro del roto no toca la dirección: sólo lo hace rodar mientras baja, y
  // también con velocidad angular irregular.
  const rotoIni = ((rotFin % 360) + 540) % 360 - 180;
  const rotoFin = rotoIni + (r(24) < 0.5 ? -1 : 1)
                  * Math.round(entre(GIRO_ROTO_MIN, GIRO_ROTO_MAX, r(25)));
  const rf = [0, entre(0.10, 0.22, r(46)), entre(0.38, 0.52, r(47)), entre(0.70, 0.82, r(48)), 1];
  const rotacionesRoto = rf.map((frac) => rotoIni + (rotoFin - rotoIni) * frac);

  return {
    x, y,
    vuelo: {
      dur: duracionVuelo,
      startX, startY, lado,
      escalaIni, escalaFin, escalas,
      rotIni, rotFin, rotaciones,
      paradas,
      // Desplazamientos RELATIVOS al impacto: la última parada es
      // translate3d(0,0,0), o sea el centro exacto del golpe.
      vars: Object.assign({}, ...paradas.map((pt, i) => ({
        [`--x${i}`]: vw(pt.x - x),
        [`--y${i}`]: vh(pt.y - y),
        [`--r${i}`]: deg(rotaciones[i]),
        [`--s${i}`]: escalas[i].toFixed(3),
      }))),
    },
    caida: {
      dur: duracionCaida,
      pausa,
      anguloGrados, dx, dy, largo: largoArrastre,
      rotIni: rotoIni, rotFin: rotoFin,
      // El arrastre se rota con el ángulo negado (ver arriba) y mide exactamente
      // el largo del vector, así que su punta cae sobre el destino del roto. Su
      // scaleY usa las MISMAS fracciones que el roto: crecen juntos.
      varsArrastre: Object.assign({ "--ang": deg(-anguloGrados) },
        ...kf.map((frac, i) => ({ [`--k${i}`]: Math.max(0.02, frac).toFixed(4) }))),
      varsRoto: Object.assign({}, ...kf.map((frac, i) => ({
        // El desprendimiento entra sólo en la primera parada.
        [`--fx${i}`]: vh(dx * frac + (i === 1 ? despegueX : 0)),
        [`--fy${i}`]: vh(dy * frac + (i === 1 ? despegueY : 0)),
        [`--er${i}`]: deg(rotacionesRoto[i]),
      }))),
    },
  };
}

const CSS = `
  .tomatazo-capa{position:fixed;inset:0;z-index:120;pointer-events:none;overflow:hidden;--tam:clamp(70px,8.5vw,176px)}

  /* Contrato de posición: todo se ancla con left/top en % del viewport y el
     corrimiento va DENTRO del propio transform. Nada mide por contenido, nada
     hereda el transform del vuelo. */
  .tomatazo-pieza{position:absolute;display:block;margin:0;object-fit:contain;transform-origin:center center}

  /* 1 · el tomate ENTERO: entra enorme por un lateral o una esquina, gira sobre
     su eje, SE ACHICA (perspectiva) y termina en translate3d(0,0,0) — el centro
     exacto del impacto, a escala --s1. */
  /* Cinco paradas y tiempo LINEAL entre ellas: el frenado y el ritmo del giro ya
     están en las paradas, que se mueven por seq. Un easing suave encima volvería
     a uniformar justo lo que se quiere imperfecto, y uno con forma de S por tramo
     lo haría latir en cada parada. */
  .tomatazo-vuelo{width:var(--tam);height:var(--tam);animation-name:tomatazoVuelo;animation-timing-function:linear;animation-fill-mode:both;will-change:transform;filter:drop-shadow(0 10px 26px rgba(0,0,0,.6))}
  @keyframes tomatazoVuelo{
    0%{transform:translate(-50%,-50%) translate3d(var(--x0),var(--y0),0) rotate(var(--r0)) scale(var(--s0));opacity:0}
    8%{opacity:1}
    25%{transform:translate(-50%,-50%) translate3d(var(--x1),var(--y1),0) rotate(var(--r1)) scale(var(--s1))}
    50%{transform:translate(-50%,-50%) translate3d(var(--x2),var(--y2),0) rotate(var(--r2)) scale(var(--s2))}
    75%{transform:translate(-50%,-50%) translate3d(var(--x3),var(--y3),0) rotate(var(--r3)) scale(var(--s3))}
    100%{transform:translate(-50%,-50%) translate3d(0,0,0) rotate(var(--r4)) scale(var(--s4));opacity:1}
  }

  /* 2 · el ARRASTRE: anclado por su extremo SUPERIOR en el impacto.
     transform-origin:50% 0% pone el eje en ese extremo y el único corrimiento
     es horizontal, así que el borde de arriba del trazo queda clavado en el
     punto. Crece con scaleY a la par que el roto baja. */
  .tomatazo-arrastre{transform-origin:50% 0%;will-change:transform}
  .tomatazo-arrastre-img{position:absolute;inset:0;display:block;margin:0;width:100%;height:100%;object-fit:fill}
  .tomatazo-arrastre-css{position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,62,44,.95),rgba(182,20,10,.88) 55%,rgba(118,10,6,.35));border-radius:46% 54% 40% 60%/8% 8% 92% 92%}
  @keyframes tomatazoArrastre{
    0%{transform:translateX(-50%) rotate(var(--ang)) scaleY(var(--k0));opacity:.6}
    15%{transform:translateX(-50%) rotate(var(--ang)) scaleY(var(--k1));opacity:.8}
    45%{transform:translateX(-50%) rotate(var(--ang)) scaleY(var(--k2))}
    75%{transform:translateX(-50%) rotate(var(--ang)) scaleY(var(--k3))}
    100%{transform:translateX(-50%) rotate(var(--ang)) scaleY(var(--k4));opacity:1}
  }

  /* 3 · el tomate ROTO: nace en el MISMO punto y baja por la MISMA línea, con la
     misma duración y el mismo easing que el arrastre — no pueden separarse. Al
     terminar queda quieto en la punta. */
  .tomatazo-roto{width:var(--tam);height:var(--tam);will-change:transform;filter:drop-shadow(0 6px 16px rgba(0,0,0,.5))}
  .tomatazo-roto-css{background:radial-gradient(circle at 40% 34%,#ffb08a 0 10%,#ff4a33 34%,#c21807 68%,rgba(120,8,4,.18) 100%);border-radius:46% 54% 38% 62%/52% 40% 60% 48%}
  @keyframes tomatazoCaida{
    0%{transform:translate(-50%,-50%) translate3d(var(--fx0),var(--fy0),0) rotate(var(--er0))}
    15%{transform:translate(-50%,-50%) translate3d(var(--fx1),var(--fy1),0) rotate(var(--er1))}
    45%{transform:translate(-50%,-50%) translate3d(var(--fx2),var(--fy2),0) rotate(var(--er2))}
    75%{transform:translate(-50%,-50%) translate3d(var(--fx3),var(--fy3),0) rotate(var(--er3))}
    100%{transform:translate(-50%,-50%) translate3d(var(--fx4),var(--fy4),0) rotate(var(--er4))}
  }

  /* Salida a los 10 s. Sólo toca opacity, así que no pelea con el transform que
     dejó quieta la animación de movimiento. */
  @keyframes tomatazoSalida{from{opacity:1}to{opacity:0}}

  /* Mira de control, sólo en DEV: marca impactX/impactY, que es el extremo
     INICIAL del arrastre — no su medio ni el roto. */
  .tomatazo-mira{position:absolute;width:6px;height:6px;margin:0;border-radius:50%;background:#ff0033;box-shadow:0 0 0 1px rgba(255,255,255,.9);transform:translate(-50%,-50%)}

  .tomatazo-banner{position:fixed;left:0;right:0;bottom:9vh;z-index:125;display:flex;justify-content:center;padding:0 5vw;pointer-events:none}
  .tomatazo-banner b{
    font-family:'Syne',sans-serif;font-weight:900;text-align:center;line-height:1.15;
    font-size:clamp(20px,3.1vw,58px);letter-spacing:.02em;color:#FFF1E8;
    padding:.7em 1.1em;border-radius:.5em;
    background:linear-gradient(135deg,rgba(194,24,7,.96),rgba(120,8,4,.96));
    border:2px solid rgba(255,176,138,.55);
    box-shadow:0 18px 60px rgba(0,0,0,.6);
    text-shadow:0 3px 12px rgba(0,0,0,.75);
    animation:tomatazoBanner ${BANNER_MS}ms ease-out both;
  }
  @keyframes tomatazoBanner{
    0%{opacity:0;transform:translate3d(0,32%,0) scale(.9)}
    8%{opacity:1;transform:translate3d(0,0,0) scale(1)}
    88%{opacity:1;transform:translate3d(0,0,0) scale(1)}
    100%{opacity:0;transform:translate3d(0,18%,0) scale(.97)}
  }
`;

/** Movimiento + salida a los 10 s, en una sola declaración por elemento. */
const animacion = (nombre, dur, ease, demora = 0) =>
  `${nombre} ${dur}ms ${ease} ${demora}ms both, `
  + `tomatazoSalida ${SALIDA_MS}ms ease-in ${VIDA_IMPACTO_MS - SALIDA_MS}ms forwards`;

/** El resultado de un tomatazo: arrastre anclado en el impacto + roto en la punta. */
function Impacto({ impacto, splat, exploded }) {
  const { g } = impacto;
  return (
    <>
      {/* El arrastre: ancho fijo, alto = largo exacto del vector de caída. */}
      <div className="tomatazo-pieza tomatazo-arrastre"
        style={{
          ...g.caida.varsArrastre,
          left: `${g.x}%`, top: `${g.y}%`,
          width: "calc(var(--tam) * .52)", height: `${g.caida.largo.toFixed(2)}vh`,
          animation: animacion("tomatazoArrastre", g.caida.dur, EASE_CAIDA, g.caida.pausa),
        }}>
        {splat
          ? <img className="tomatazo-arrastre-img" src={splat} alt=""/>
          : <span className="tomatazo-arrastre-css"/>}
      </div>

      {/* El roto: mismo punto de partida, misma línea, misma duración. */}
      {exploded
        ? <img className="tomatazo-pieza tomatazo-roto" src={exploded} alt=""
            style={{ ...g.caida.varsRoto, left: `${g.x}%`, top: `${g.y}%`,
                     animation: animacion("tomatazoCaida", g.caida.dur, EASE_CAIDA, g.caida.pausa) }}/>
        : <span className="tomatazo-pieza tomatazo-roto tomatazo-roto-css"
            style={{ ...g.caida.varsRoto, left: `${g.x}%`, top: `${g.y}%`,
                     animation: animacion("tomatazoCaida", g.caida.dur, EASE_CAIDA, g.caida.pausa) }}/>}
    </>
  );
}

export default function TomatazoOverlay({ event, eventId, client = supabaseAnon }) {
  const activo = event?.kick_enabled === true && event?.kick_style === "tomato";
  const seq    = Number(event?.kick_impact_seq ?? 0);
  const itemId = event?.current_item_id ?? null;
  const textoBanner = (event?.kick_tv_text || "").trim() || TEXTO_POR_DEFECTO;

  // Dos colecciones: el entero vive lo que dura su vuelo; el resultado (arrastre
  // + roto) vive 10 s desde el impacto.
  const [voladores, setVoladores] = useState([]);
  const [impactos,  setImpactos]  = useState([]);
  const [banner,    setBanner]    = useState(null);

  // `null` = todavía no hay baseline. El primer seq visto no anima.
  const seqRef  = useRef(null);
  const itemRef = useRef(null);
  // Los timers viven fuera del ciclo del efecto a propósito: un voto nuevo
  // vuelve a correr el efecto y no debe cancelar el tomate que está volando.
  const timers = useRef(new Set());
  const vivo   = useRef(true);
  // Desempata las keys: tras un reset del evento el seq vuelve a 0 y los
  // números se repiten.
  const contador = useRef(0);

  useEffect(() => {
    vivo.current = true;
    const pendientes = timers.current;
    return () => {
      vivo.current = false;
      pendientes.forEach(clearTimeout);
      pendientes.clear();
    };
  }, []);

  useEffect(() => {
    if (!activo) {
      // Apagar el Tomatazo tira el baseline: al volver a prenderse, el seq del
      // momento vuelve a ser punto de partida y no se recuperan impactos viejos.
      // Acá SÍ se limpia todo de una: el overlay dejó de existir.
      seqRef.current  = null;
      itemRef.current = null;
      setVoladores((prev) => (prev.length ? [] : prev));
      setImpactos((prev)  => (prev.length ? [] : prev));
      setBanner(null);
      return;
    }

    const programar = (fn, ms) => {
      const t = setTimeout(() => { timers.current.delete(t); if (vivo.current) fn(); }, ms);
      timers.current.add(t);
    };

    // Primer valor con el Tomatazo activo: baseline, sin animación.
    if (seqRef.current === null) {
      seqRef.current  = seq;
      itemRef.current = itemId;
      return;
    }

    const seqPrevio  = seqRef.current;
    const cambioTema = itemId !== itemRef.current;
    const delta      = seq - seqPrevio;

    // Se avanza el puntero YA, antes de cualquier await: si entra un segundo
    // voto mientras se resuelve el progreso del primero, su delta se calcula
    // contra este valor y no se pierde ni se duplica ningún impacto.
    seqRef.current  = seq;
    itemRef.current = itemId;

    // Ni un voto nuevo: o es un untoggle (que no mueve el seq), o el reset del
    // evento lo volvió a 0, o llegó el UPDATE del avance de canción.
    //
    // El cambio de canción NO borra nada: cada tomatazo vive sus 10 segundos y se
    // va solo. Que los impactos le queden encima al tema siguiente es parte del
    // efecto — al tema malo le tiraron tomates y se ven.
    if (delta <= 0) return;

    const cantidad = Math.min(delta, MAX_RAFAGA);

    const lanzar = (seqImpacto, progreso) => {
      const g = positionForImpact(seqImpacto, progreso);
      const key = `${seqImpacto}-${++contador.current}`;

      if (DEV) console.info("[TOMATAZO ORIGINAL]", {
        seq: seqImpacto,
        impactX: Number(g.x.toFixed(1)), impactY: Number(g.y.toFixed(1)),
        startSide: g.vuelo.lado,
        flightDuration: g.vuelo.dur,
        startScale: Number(g.vuelo.escalaIni.toFixed(2)),
        fallAngle: Number(g.caida.anguloGrados.toFixed(1)),
        fallDx: Number(g.caida.dx.toFixed(1)),
        fallDy: Number(g.caida.dy.toFixed(1)),
        fallDuration: g.caida.dur,
      });

      // T=0 · el entero entra enorme y viaja hacia el punto achicándose.
      setVoladores((prev) => [...prev, { key, g }]);

      // T=vuelo · impacta: se va el entero y en EL MISMO punto nacen el arrastre
      // y el roto, que bajan juntos por la misma línea.
      programar(() => {
        setVoladores((prev) => prev.filter((v) => v.key !== key));
        setImpactos((prev) => [...prev.slice(-(MAX_IMPACTOS - 1)), { key, g }]);
        // Reloj propio de ESTE tomatazo: a los 10 s se va él solo, sin tocar los
        // demás. La animación de salida ya lo dejó en opacidad 0.
        programar(() => setImpactos((prev) => prev.filter((i) => i.key !== key)),
                  VIDA_IMPACTO_MS);
      }, g.vuelo.dur);
    };

    /**
     * Qué corresponde dibujar por este voto: el progreso hacia el umbral, o
     * `null` para no dibujar nada.
     *
     * ── Regla de padrón: hacen falta 2 activos ──────────────────────────────
     * Con UN SOLO activo el voto ya vale el 100% del padrón: `needed` es 1 y el
     * servidor saca el tema de una. No hubo votación — no hay nada que mostrar,
     * así que no se tira ningún tomate, no queda mancha, no aparece el roto y
     * tampoco sale el cartel. La canción cambia directo.
     *
     * El dato de `active` sale de `pantalla__active_count` (participantes con
     * heartbeat fresco, sin staff ni dj, ya excluidos en el servidor) y es el
     * mismo que usa el umbral: no se inventa otra definición acá.
     *
     * ── La carrera del último voto ──────────────────────────────────────────
     * El voto que alcanza el umbral dispara `pantalla__advance` dentro de la
     * MISMA RPC, así que cuando la TV consulta puede encontrar ya el tema
     * siguiente con la votación en cero. Antes eso se resolvía sin consultar
     * —`cambioTema` ⇒ progreso 1— y justo ese atajo era el que dejaba pasar el
     * tomate del padrón de uno, que es EL caso en el que siempre cambia el tema.
     *
     * Ahora se consulta siempre, porque `active` NO depende de la canción ni de
     * los votos: `pantalla__active_count` sólo mira `pantalla_participants`, y el
     * avance no borra participantes. O sea que el `active` que vuelve después del
     * avance sigue siendo el de esta votación, y alcanza para decidir. El
     * progreso, en cambio, sí se pierde con el avance, y para eso quedan los dos
     * guards de siempre:
     *
     *   · si `current_item_id` ya cambió → el impacto es del tema anterior y sólo
     *     pudo ser el que lo volteó: progreso 1.
     *   · si sigue igual pero la RPC devuelve otro `item_id` → el avance ocurrió
     *     entre el UPDATE y la consulta: progreso 1.
     *
     * Si la RPC falla no se sabe cuántos activos hay. En ese caso se dibuja: un
     * tomatazo de más por un error de red se nota menos que perder el efecto en
     * una mesa llena.
     *
     * El progreso apenas mueve el punto de impacto (ver SESGO_CENTRO): sigue acá
     * porque es lo que decide el cartel de tema volteado.
     */
    const resolverImpacto = async () => {
      let status;
      try {
        status = await getKickStatus(eventId, client);
      } catch (err) {
        if (DEV) console.warn("[TOMATAZO] getKickStatus falló, progreso estimado", err);
        return cambioTema ? 1 : PROGRESO_FALLBACK;
      }
      if (!status) return cambioTema ? 1 : PROGRESO_FALLBACK;

      const activos = Number(status.active ?? 0);
      if (activos <= 1) {
        if (DEV) console.info("[TOMATAZO] sin animación: padrón de", activos,
                              "activo(s); el tema cambia directo", { seq });
        return null;
      }

      if (cambioTema) return 1;
      if (status.item_id && status.item_id !== itemId) return 1;
      return Math.min(1, Math.max(0, Number(status.progress) || 0));
    };

    resolverImpacto().then((progreso) => {
      if (!vivo.current) return;
      // Padrón de un solo activo: nada de Tomatazo. El baseline del seq ya quedó
      // avanzado más arriba —antes del await— así que este voto tampoco se
      // reproduce más tarde: no hay replay.
      if (progreso === null) return;

      for (let i = 0; i < cantidad; i++) {
        const seqImpacto = seq - cantidad + 1 + i;
        if (i === 0) lanzar(seqImpacto, progreso);
        else programar(() => lanzar(seqImpacto, progreso), i * SEPARACION_MS);
      }
      // El tema se fue abajo: cartel. Los impactos siguen su propio reloj.
      if (progreso >= 1) {
        setBanner(textoBanner);
        programar(() => setBanner(null), BANNER_MS);
      }
    });
  }, [activo, seq, itemId, eventId, client, textoBanner]);

  if (!activo) return null;

  const flying   = event?.kick_tomato_flying_url   || null;
  const exploded = event?.kick_tomato_exploded_url || null;
  const splat    = event?.kick_tomato_splat_url    || null;

  return (
    <>
      <style>{CSS}</style>
      <div className="tomatazo-capa" aria-hidden="true">
        {/* Orden de pintado: la mira de DEV y los resultados abajo, el tomate
            entero por encima mientras vuela. */}
        {DEV && impactos.map(({ key, g }) => (
          <span key={`mira-${key}`} className="tomatazo-mira"
            style={{ left: `${g.x}%`, top: `${g.y}%` }}/>
        ))}

        {impactos.map((impacto) => (
          <Impacto key={impacto.key} impacto={impacto} splat={splat} exploded={exploded}/>
        ))}

        {voladores.map(({ key, g }) => {
          const estilo = {
            ...g.vuelo.vars, left: `${g.x}%`, top: `${g.y}%`,
            animationDuration: `${g.vuelo.dur}ms`,
          };
          return flying
            ? <img key={key} className="tomatazo-pieza tomatazo-vuelo" src={flying} alt="" style={estilo}/>
            : <span key={key} className="tomatazo-pieza tomatazo-vuelo" style={{
                ...estilo, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "calc(var(--tam) * .94)", lineHeight: 1,
              }}>🍅</span>;
        })}
      </div>
      {banner && <div className="tomatazo-banner" aria-hidden="true"><b>{banner}</b></div>}
    </>
  );
}
