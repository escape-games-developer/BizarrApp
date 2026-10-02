import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Reordenar una lista vertical arrastrando desde un handle. Sin dependencias:
 * Pointer Events, así que mouse, lápiz y touch usan el mismo código.
 *
 * - Sólo el handle inicia el arrastre (la fila no), con el botón principal.
 * - La fila arrastrada sigue al puntero; las demás se corren para abrirle
 *   lugar, con transición, y un recuadro marca dónde va a quedar.
 * - Al soltar se llama `onMover(desde, hasta)` UNA vez; la fila aterriza con
 *   una transición corta en lugar de saltar.
 * - Escape, `pointercancel` o perder la captura cancelan sin cambiar nada.
 * - Cerca de los bordes del contenedor con scroll, scrollea solo.
 * - Teclado sobre el handle: Espacio/Enter agarra y suelta, ↑/↓ mueven,
 *   Escape vuelve a la posición original. Los anuncios van a `anuncio`
 *   (para una región aria-live).
 *
 * Las posiciones se miden relativas a la lista al empezar, así el scroll
 * durante el arrastre no desarma el cálculo.
 */

const BORDE_AUTOSCROLL = 48;
const VEL_AUTOSCROLL   = 12;

function contenedorConScroll(el) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight) return n;
  }
  return document.scrollingElement || document.documentElement;
}

export function useArrastreLista({ ids, onMover, habilitado = true, nombre = (id) => id }) {
  const listaRef  = useRef(null);
  const filasRef  = useRef(new Map());   // id → <li>
  const handlesRef = useRef(new Map());  // id → handle
  const dragRef   = useRef(null);        // estado vivo del arrastre (sin re-render)
  const [drag, setDrag] = useState(null);           // { id, desde, hasta, dy, alto, filas }
  const [aterrizaje, setAterrizaje] = useState(null); // { id, delta, fase }
  const [teclado, setTeclado] = useState(null);     // { id, original }
  const [anuncio, setAnuncio] = useState("");

  // ── Puntero ─────────────────────────────────────────────────────────────
  const calcular = useCallback((clientY) => {
    const d = dragRef.current;
    if (!d || !listaRef.current) return;
    const y = clientY - listaRef.current.getBoundingClientRect().top;
    const f = d.filas[d.desde];
    const dyPuntero = y - d.inicioY;
    // Lo que se DIBUJA no sale de la lista: si saliera, agrandaría el área
    // scrolleable y el autoscroll no terminaría nunca. El destino, en cambio,
    // sigue al puntero real, así se puede llegar al primer y al último lugar.
    const ultima = d.filas[d.filas.length - 1];
    const dy = Math.max(-f.top, Math.min(dyPuntero, ultima.top + ultima.height - f.height - f.top));
    const centro = f.top + f.height / 2 + dyPuntero;
    let hasta = 0;
    d.filas.forEach((o, j) => { if (j !== d.desde && o.top + o.height / 2 < centro) hasta++; });
    d.dy = dy;
    d.hasta = hasta;
    setDrag({ ...d });
  }, []);

  const terminar = useCallback((confirmar) => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    cancelAnimationFrame(d.raf);
    document.body.style.userSelect = d.userSelectPrevio;
    document.body.style.cursor = d.cursorPrevio;
    setDrag(null);
    if (confirmar && d.hasta !== d.desde) {
      const f = d.filas[d.desde];
      const destinoTop = d.hasta > d.desde
        ? d.filas[d.hasta].top + d.filas[d.hasta].height - f.height
        : d.filas[d.hasta].top;
      setAterrizaje({ id: d.id, delta: f.top + d.dy - destinoTop, fase: 0 });
      onMover(d.desde, d.hasta);
      setAnuncio(`${nombre(d.id)} movido a la posición ${d.hasta + 1} de ${d.filas.length}.`);
    } else if (confirmar) {
      setAterrizaje({ id: d.id, delta: d.dy, fase: 0 });
    } else {
      setAnuncio(`Reordenamiento cancelado. ${nombre(d.id)} vuelve a su lugar.`);
    }
  }, [onMover, nombre]);

  // Aterrizaje en dos cuadros: primero en la posición visual (sin transición),
  // después a 0 con transición.
  useLayoutEffect(() => {
    if (aterrizaje?.fase !== 0) return;
    const r = requestAnimationFrame(() => setAterrizaje((a) => (a ? { ...a, fase: 1 } : a)));
    return () => cancelAnimationFrame(r);
  }, [aterrizaje]);

  const empezar = useCallback((e, id) => {
    if (!habilitado || dragRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();               // sin selección de texto ni foco por mouse
    e.stopPropagation();
    const lista = listaRef.current;
    if (!lista) return;
    const base = lista.getBoundingClientRect().top;
    const filas = ids.map((fid) => {
      const r = filasRef.current.get(fid).getBoundingClientRect();
      return { top: r.top - base, height: r.height };
    });
    const desde = ids.indexOf(id);
    const gap = filas.length > 1 ? Math.max(0, filas[1].top - filas[0].top - filas[0].height) : 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setTeclado(null);
    setAterrizaje(null);
    dragRef.current = {
      id, desde, hasta: desde, dy: 0, filas, alto: filas[desde].height + gap,
      inicioY: e.clientY - base, ultimoY: e.clientY, pointerId: e.pointerId,
      scroller: contenedorConScroll(lista), raf: 0,
      userSelectPrevio: document.body.style.userSelect, cursorPrevio: document.body.style.cursor,
    };
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    setDrag({ ...dragRef.current });
    setAnuncio(`${nombre(id)} agarrado. Posición ${desde + 1} de ${ids.length}.`);

    const autoscroll = () => {
      const d = dragRef.current;
      if (!d) return;
      const s = d.scroller;
      const caja = s === document.scrollingElement || s === document.documentElement
        ? { top: 0, bottom: window.innerHeight }
        : s.getBoundingClientRect();
      // Sólo si se está arrastrando HACIA ese borde: agarrar una fila que ya
      // está cerca del borde no tiene que scrollear por sí solo.
      let paso = 0;
      if (d.ultimoY < caja.top + BORDE_AUTOSCROLL && d.dy < 0) paso = -VEL_AUTOSCROLL;
      else if (d.ultimoY > caja.bottom - BORDE_AUTOSCROLL && d.dy > 0) paso = VEL_AUTOSCROLL;
      if (paso) {
        const antes = s.scrollTop;
        s.scrollTop += paso;
        if (s.scrollTop !== antes) calcular(d.ultimoY);
      }
      d.raf = requestAnimationFrame(autoscroll);
    };
    dragRef.current.raf = requestAnimationFrame(autoscroll);
  }, [habilitado, ids, calcular, nombre]);

  const mover = useCallback((e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.ultimoY = e.clientY;
    calcular(e.clientY);
  }, [calcular]);

  // Escape durante un arrastre con puntero.
  useEffect(() => {
    if (!drag) return;
    const tecla = (e) => { if (e.key === "Escape") { e.preventDefault(); terminar(false); } };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [drag, terminar]);

  // Si el componente se desmonta a mitad de un arrastre, restaurar el body.
  useEffect(() => () => {
    const d = dragRef.current;
    if (d) {
      cancelAnimationFrame(d.raf);
      document.body.style.userSelect = d.userSelectPrevio;
      document.body.style.cursor = d.cursorPrevio;
    }
  }, []);

  // ── Teclado ─────────────────────────────────────────────────────────────
  // Tras mover con teclado, React reubica el nodo y el foco se pierde: volverlo
  // a poner sobre el handle de la fila agarrada.
  useLayoutEffect(() => {
    if (teclado) handlesRef.current.get(teclado.id)?.focus();
  }, [ids, teclado]);

  const teclaHandle = useCallback((e, id) => {
    if (!habilitado || dragRef.current) return;
    const i = ids.indexOf(id);
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (teclado?.id === id) {
        setTeclado(null);
        setAnuncio(`${nombre(id)} soltado en la posición ${i + 1} de ${ids.length}.`);
      } else {
        setTeclado({ id, original: i });
        setAnuncio(`${nombre(id)} agarrado. Posición ${i + 1} de ${ids.length}. Usá las flechas y Espacio para soltar; Escape cancela.`);
      }
    } else if (teclado?.id === id && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= ids.length) return;
      onMover(i, j);
      setAnuncio(`${nombre(id)}: posición ${j + 1} de ${ids.length}.`);
    } else if (teclado?.id === id && e.key === "Escape") {
      e.preventDefault();
      if (i !== teclado.original) onMover(i, teclado.original);
      setTeclado(null);
      setAnuncio(`Reordenamiento cancelado. ${nombre(id)} vuelve a la posición ${teclado.original + 1}.`);
    }
  }, [habilitado, ids, teclado, onMover, nombre]);

  // ── Props y estilos para el componente ───────────────────────────────────
  const propsHandle = (id) => ({
    ref: (el) => { if (el) handlesRef.current.set(id, el); else handlesRef.current.delete(id); },
    onPointerDown: (e) => empezar(e, id),
    onPointerMove: mover,
    onPointerUp: (e) => { if (dragRef.current?.pointerId === e.pointerId) terminar(true); },
    onPointerCancel: () => terminar(false),
    // pointerup ya terminó el arrastre; si la captura se pierde sin soltar
    // (ventana pierde foco, nodo reemplazado), se cancela.
    onLostPointerCapture: () => { if (dragRef.current) terminar(false); },
    onKeyDown: (e) => teclaHandle(e, id),
    onBlur: () => { if (teclado?.id === id) setTeclado(null); },
    "aria-pressed": teclado?.id === id,
  });

  const refFila = (id) => (el) => { if (el) filasRef.current.set(id, el); else filasRef.current.delete(id); };

  /** Transform de cada fila: la arrastrada sigue al puntero; las demás abren lugar. */
  const estiloFila = (id, i) => {
    if (drag) {
      if (id === drag.id) {
        return { transform: `translateY(${drag.dy}px)`, transition: "none", zIndex: 2, position: "relative" };
      }
      let corrimiento = 0;
      if (drag.hasta > drag.desde && i > drag.desde && i <= drag.hasta) corrimiento = -drag.alto;
      if (drag.hasta < drag.desde && i >= drag.hasta && i < drag.desde) corrimiento = drag.alto;
      return { transform: `translateY(${corrimiento}px)`, transition: "transform .18s ease" };
    }
    if (aterrizaje?.id === id) {
      return aterrizaje.fase === 0
        ? { transform: `translateY(${aterrizaje.delta}px)`, transition: "none", zIndex: 2, position: "relative" }
        : { transform: "translateY(0)", transition: "transform .16s ease", position: "relative" };
    }
    // Recién soltado: el resto ya está en su lugar real, sin animar el regreso.
    return { transform: "none", transition: aterrizaje?.fase === 0 ? "none" : "transform .18s ease" };
  };

  /** Recuadro del lugar de destino (top/height relativos a la lista), o null. */
  const destino = drag && drag.hasta !== drag.desde ? (() => {
    const f = drag.filas[drag.desde];
    const top = drag.hasta > drag.desde
      ? drag.filas[drag.hasta].top + drag.filas[drag.hasta].height - f.height
      : drag.filas[drag.hasta].top;
    return { top, height: f.height };
  })() : null;

  return {
    listaRef, refFila, propsHandle, estiloFila, destino, anuncio,
    arrastrando: drag?.id ?? null,
    agarradoTeclado: teclado?.id ?? null,
  };
}
