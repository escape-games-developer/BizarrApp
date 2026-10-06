import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CLIENT_DESIGN_TABLE, fetchActiveDesign } from "../../services/clientDesign";

/**
 * `design_key` activo de una sección de la app Cliente, en vivo: si el admin
 * activa otro diseño desde el Diseñador Cliente, la vista cambia sin recargar.
 *
 * Devuelve null mientras carga o si no hay dato (tabla sin migrar, sin red):
 * quien lo usa dibuja su Vista Original. Nunca bloquea la sección.
 *
 * El último valor leído queda en memoria (`ultimo`): si la sección se vuelve a
 * montar, o se precargó con `prefetchClientDesign`, arranca con el diseño
 * correcto en vez de mostrar el Original y saltar. Se relee igual al montar.
 */
const ultimo = new Map();

/** Lee el diseño activo de una sección y lo deja en memoria. Sin efectos de UI. */
export function prefetchClientDesign(section) {
  return fetchActiveDesign(section)
    .then((key) => { ultimo.set(section, key); return key; })
    .catch(() => null);
}

export function useClientDesign(section) {
  const [designKey, setDesignKey] = useState(() => ultimo.get(section) ?? null);
  // Sufijo propio: dos instancias con el mismo canal chocarían en Supabase.
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    let vivo = true;
    const aplicar = (key) => { ultimo.set(section, key); if (vivo) setDesignKey(key); };
    const cargar = () => fetchActiveDesign(section)
      .then(aplicar)
      .catch((e) => console.warn("[useClientDesign] sin diseño activo, se usa el original:", e?.message ?? e));

    cargar();
    const channel = supabase
      .channel(`client-design-${section}-${canalId.current}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: CLIENT_DESIGN_TABLE, filter: `section=eq.${section}` },
        (payload) => aplicar(payload.new?.design_key ?? null))
      .subscribe((status) => {
        // Al reconectar se re-lee: no hay replay de eventos perdidos.
        if (status === "SUBSCRIBED") cargar();
      });

    return () => { vivo = false; supabase.removeChannel(channel); };
  }, [section]);

  return designKey;
}
