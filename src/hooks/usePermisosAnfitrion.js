import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Ajustes → Permisos del anfitrión — `admin_ui_config` fila
 * `key='permisos_anfitrion'` (migración 20261027130000).
 *
 * Qué puede hacer el perfil Anfitrión además de ver y lanzar. Cada permiso es
 * un booleano; lo que falte en la fila toma el valor de PERMISOS_POR_DEFECTO.
 * Mismo contrato que useGeneralConfig: el Admin guarda con control de
 * concurrencia sobre el `updated_at` crudo.
 */

const TABLA = "admin_ui_config";
const CLAVE = "permisos_anfitrion";
const VERSION = 1;

export const PERMISOS_ANFITRION = [
  { id: "escenarioLlamar", icon: "🎤", juego: "Follow the Leader / Personal Trainer",
    titulo: "Llamar al participante al escenario",
    activo: "El anfitrión ve los inscriptos y llama a quien sube (a mano o al azar).",
    inactivo: "El anfitrión sólo ve quién está en el escenario; a quién llamar lo decide Producción." },
  { id: "escenarioCancion", icon: "🎵", juego: "Follow the Leader / Personal Trainer",
    titulo: "Elegir la canción",
    activo: "El anfitrión ve la biblioteca y le asigna la canción al participante.",
    inactivo: "La canción la elige Producción. El anfitrión ve cuál quedó asignada y lanza." },
  { id: "triviaPreguntas", icon: "🧠", juego: "Desafío Demente",
    titulo: "Elegir las preguntas de la ronda",
    activo: "El anfitrión ve la biblioteca de preguntas y arma la ronda.",
    inactivo: "Las preguntas las elige Producción. El anfitrión las ve con la respuesta correcta y lanza." },
];

export const PERMISOS_POR_DEFECTO = Object.freeze({
  escenarioLlamar: true, escenarioCancion: false, triviaPreguntas: false,
});

const normalizar = (value) => Object.fromEntries(PERMISOS_ANFITRION.map(({ id }) =>
  [id, typeof value?.[id] === "boolean" ? value[id] : PERMISOS_POR_DEFECTO[id]]));

/** Panel del anfitrión: permisos vigentes (se releen cada 20 s). */
export function usePermisosAnfitrion() {
  const [permisos, setPermisos] = useState(PERMISOS_POR_DEFECTO);
  useEffect(() => {
    let vivo = true;
    const leer = () => supabase.from(TABLA).select("value").eq("key", CLAVE).maybeSingle()
      .then(({ data, error }) => {
        if (!vivo) return;
        if (error) { console.error("[usePermisosAnfitrion]", error); return; }
        setPermisos(normalizar(data?.value));
      });
    leer();
    const t = setInterval(leer, 20000);
    return () => { vivo = false; clearInterval(t); };
  }, []);
  return permisos;
}

/** Admin (Ajustes): lee la fila y guarda cambios. */
export function usePermisosAnfitrionAdmin() {
  const [config, setConfig] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[usePermisosAnfitrionAdmin]", e);
      setConfig(null);
      setError(e ? "No se pudieron cargar los permisos del anfitrión."
        : "Falta aplicar en Supabase la migración 20261027130000_permisos_anfitrion.");
      return;
    }
    setConfig(normalizar(data.value));
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva) => {
    const value = { version: VERSION, ...normalizar(nueva) };
    const { data, error: e } = await supabase
      .from(TABLA).update({ value }).eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? "Tu usuario no tiene permisos para cambiar esta configuración."
        : "No se pudieron guardar los permisos.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió estos permisos recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setConfig(normalizar(data[0].value));
    setUpdatedAt(data[0].updated_at);
  }, [updatedAt, cargar]);

  return { config, error, guardar, recargar: cargar };
}
