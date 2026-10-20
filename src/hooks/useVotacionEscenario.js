import { useCallback, useEffect, useState } from "react";
import { supabase, supabaseAnon } from "../lib/supabase";

/**
 * Cómo vota el público en los juegos de Escenario — `admin_ui_config` fila
 * `key='votacion_escenario'` (migración 20261019170000_votacion_escenario).
 *
 * `value = { version: 1, ftl: <modo>, pt: <modo> }`, modo:
 *   'toques' → Mod 1: barómetro de energía (se toca la pantalla)
 *   'votos'  → Mod 2: un voto fijo 👍/👎
 *   'pelea'  → Mod 3: toques múltiples 👍/👎 que pelean la barra
 *   'off'    → sin votación
 *
 * `useVotacionEscenario` lo leen el celular, /tv y el panel del juego (RPC
 * pública). La tabla no está en Realtime: se relee cada `cadaMs`, así un
 * cambio en Ajustes llega solo a una performance en curso.
 * `useVotacionEscenarioAdmin` lo lee y guarda Ajustes, con el control de
 * concurrencia de siempre: el UPDATE filtra por el `updated_at` leído.
 */

export const MODOS_VOTACION = {
  toques: { titulo: "Mod 1 · Barómetro de toques",
    detalle: "El público toca la pantalla del celular todas las veces que quiera y la barra de energía sube o baja en la TV." },
  votos:  { titulo: "Mod 2 · Voto positivo y negativo",
    detalle: "Un solo voto fijo por persona, 👍 o 👎 (se puede cambiar). El barómetro de la TV muestra el % de votos positivos." },
  pelea:  { titulo: "Mod 3 · Pelea de toques 👍 / 👎",
    detalle: "Cada uno toca 👍 o 👎 todas las veces que quiera. La barra arranca en el medio: los 👍 la suben y los 👎 la bajan." },
};

export const VOTACION_POR_DEFECTO = Object.freeze({ ftl: "toques", pt: "off" });

const TABLA = "admin_ui_config";
const CLAVE = "votacion_escenario";
const VERSION = 1;
const MODOS_VALIDOS = ["toques", "votos", "pelea", "off"];

const normalizar = (v) => ({
  ftl: MODOS_VALIDOS.includes(v?.ftl) ? v.ftl : VOTACION_POR_DEFECTO.ftl,
  pt:  MODOS_VALIDOS.includes(v?.pt)  ? v.pt  : VOTACION_POR_DEFECTO.pt,
});

/** Modo de votación por juego. `anonimo` en /tv (entra por token, sin sesión). */
export function useVotacionEscenario({ anonimo = false, cadaMs = 15000 } = {}) {
  const [config, setConfig] = useState(VOTACION_POR_DEFECTO);
  const cliente = anonimo ? supabaseAnon : supabase;

  useEffect(() => {
    let vivo = true;
    const leer = () => cliente.rpc("votacion_escenario_config").then(({ data, error }) => {
      if (!vivo) return;
      if (error) { console.error("[useVotacionEscenario]", error); return; }
      setConfig(normalizar(data));
    });
    leer();
    const id = setInterval(leer, cadaMs);
    return () => { vivo = false; clearInterval(id); };
  }, [cliente, cadaMs]);

  return config;
}

/** Admin (Ajustes): lee la fila y guarda el modo de cada juego. */
export function useVotacionEscenarioAdmin() {
  const [config, setConfig] = useState(null);       // null = cargando o sin fila
  const [updatedAt, setUpdatedAt] = useState(null);  // texto crudo de Supabase
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useVotacionEscenarioAdmin]", e);
      setConfig(null);
      setError(e
        ? "No se pudo cargar la configuración de votación."
        : "Falta aplicar en Supabase la migración 20261019170000_votacion_escenario.");
      return;
    }
    setConfig(normalizar(data.value));
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva) => {
    const { data, error: e } = await supabase
      .from(TABLA).update({ value: { version: VERSION, ...normalizar(nueva) } })
      .eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? "Tu usuario no tiene permisos para cambiar la votación."
        : "No se pudo guardar la votación elegida.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
  }, [updatedAt, cargar]);

  return { config, error, guardar, recargar: cargar };
}
