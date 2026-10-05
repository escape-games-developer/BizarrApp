import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { CLIENT_DESIGN_TABLE, fetchActiveDesign } from "../../services/clientDesign";

/**
 * `design_key` activo de una sección de la app Cliente, en vivo: si el admin
 * activa otro diseño desde el Diseñador Cliente, la vista cambia sin recargar.
 *
 * Devuelve null mientras carga o si no hay dato (tabla sin migrar, sin red):
 * quien lo usa dibuja su Vista Original. Nunca bloquea la sección.
 */
export function useClientDesign(section) {
  const [designKey, setDesignKey] = useState(null);
  // Sufijo propio: dos instancias con el mismo canal chocarían en Supabase.
  const canalId = useRef(Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    let vivo = true;
    const cargar = () => fetchActiveDesign(section)
      .then((id) => { if (vivo) setDesignKey(id); })
      .catch((e) => console.warn("[useClientDesign] sin diseño activo, se usa el original:", e?.message ?? e));

    cargar();
    const channel = supabase
      .channel(`client-design-${section}-${canalId.current}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: CLIENT_DESIGN_TABLE, filter: `section=eq.${section}` },
        (payload) => { if (vivo) setDesignKey(payload.new?.design_key ?? null); })
      .subscribe((status) => {
        // Al reconectar se re-lee: no hay replay de eventos perdidos.
        if (status === "SUBSCRIBED") cargar();
      });

    return () => { vivo = false; supabase.removeChannel(channel); };
  }, [section]);

  return designKey;
}
