import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";
import { normalizarPantallas } from "./modelo";

/**
 * Pantallas editadas de un juego — `admin_ui_config` key `lienzo_<juego>`
 * (migración 20261024010000): `{ version: 1, pantallas: { <estado>: pantalla } }`.
 *
 * `useLienzo(juego)` lo lee la TV con la RPC pública (sin sesión), una sola
 * consulta compartida por juego — mismo esquema que usePantallaQr.
 * `useLienzoAdmin(juego)` lee y guarda desde el Diseñador, con el control de
 * concurrencia de siempre (updated_at).
 *
 * Al guardar, el Diseñador avisa por Realtime (broadcast en `lienzo-cambios`,
 * público: la TV entra sin sesión) y cada TV o celular con ese juego abierto
 * relee en el acto. La lectura periódica queda de respaldo por si el aviso no
 * llega (red caída, reconexión).
 */

const TABLA = "admin_ui_config";
const VERSION = 1;
const CADA_MS = 3000;
const stores = {};   // juego → { valor, subs, timer }

const CANAL = "lienzo-cambios";
let canal = null;
/** Un solo canal por pestaña, abierto con la primera suscripción o el primer aviso. */
function canalCambios() {
  if (!canal) {
    canal = supabaseAnon.channel(CANAL)
      .on("broadcast", { event: "guardado" }, ({ payload }) => {
        const juego = payload?.juego;
        if (juego && stores[juego]?.subs.size) leer(juego);
      })
      .subscribe();
  }
  return canal;
}

/** El Diseñador guardó: que lo relean todas las pantallas abiertas. */
function avisarCambio(juego) {
  canalCambios().send({ type: "broadcast", event: "guardado", payload: { juego } })
    .catch((e) => console.warn(`[useLienzo:${juego}] aviso de cambio:`, e));
}

function leer(juego) {
  const s = stores[juego];
  return supabaseAnon.rpc("pantalla_lienzo_config", { p_juego: juego }).then(({ data, error }) => {
    if (error) { console.error(`[useLienzo:${juego}]`, error); return; }
    const nuevo = normalizarPantallas(data);
    if (JSON.stringify(nuevo) === JSON.stringify(s.valor)) return;
    s.valor = nuevo;
    s.subs.forEach((fn) => fn(nuevo));
  });
}

function suscribir(juego, fn, cada) {
  const s = stores[juego] ||= { valor: {}, subs: new Set(), timer: null };
  s.subs.add(fn);
  canalCambios();
  if (!s.timer) { leer(juego); s.timer = setInterval(() => leer(juego), cada); }
  return () => {
    s.subs.delete(fn);
    if (!s.subs.size) { clearInterval(s.timer); s.timer = null; }
  };
}

/** Relee ya (vista previa del Diseñador, después de guardar). */
export function refrescarLienzo(juego) {
  if (stores[juego]?.subs.size) leer(juego);
}

/**
 * `{ <estado>: pantalla }` — vacío = la pantalla de fábrica del código.
 * `juego` null: no consulta nada (devuelve {}).
 * `cada`: la TV relee cada 3 s; la app del cliente usa algo más largo para no
 * sumar una consulta por celular cada 3 s.
 */
export function useLienzo(juego, { cada = CADA_MS } = {}) {
  const [pantallas, setPantallas] = useState(() => (juego && stores[juego]?.valor) || {});
  useEffect(() => {
    if (!juego) { setPantallas({}); return undefined; }
    return suscribir(juego, setPantallas, cada);
  }, [juego, cada]);
  return pantallas;
}

export function useLienzoAdmin(juego) {
  const clave = `lienzo_${juego}`;
  const [pantallas, setPantallas] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase.from(TABLA).select("value, updated_at").eq("key", clave).maybeSingle();
    if (e || !data) {
      setPantallas(null);
      setError(e ? "No se pudo cargar el diseño de las pantallas." : `Falta aplicar en Supabase la migración del editor (${clave}).`);
      return;
    }
    setPantallas(normalizarPantallas(data.value));
    setUpdatedAt(data.updated_at);
  }, [clave]);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nuevas) => {
    const { data, error: e } = await supabase.from(TABLA)
      .update({ value: { version: VERSION, pantallas: nuevas } })
      .eq("key", clave).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501" ? "Tu usuario no tiene permisos para cambiar el diseño."
        : e.code === "23514" ? "El diseño es demasiado grande para guardarse." : "No se pudo guardar el diseño.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió este diseño recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setPantallas(normalizarPantallas(data[0].value));
    setUpdatedAt(data[0].updated_at);
    refrescarLienzo(juego);
    avisarCambio(juego);
  }, [clave, updatedAt, cargar, juego]);

  return { pantallas, error, guardar, recargar: cargar };
}
