import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

/**
 * Qué carta se embebe en MENÚ — `admin_ui_config` fila `key='menu'`
 * (migración 20261013210000_menu_fuente).
 *
 * `value = { version: 1, fuente: "wordpress" | "pedidos" }`. Un solo campo: las
 * dos cartas no pueden estar activas a la vez.
 *
 * `useMenuConfig` lo lee la app del cliente (RPC pública, sin sesión).
 * `useMenuConfigAdmin` lo lee y guarda Ajustes, con el control de concurrencia
 * de siempre: el UPDATE filtra por el `updated_at` leído (texto crudo).
 */

export const MENUS = {
  wordpress: {
    titulo: "Carta actual (WordPress)",
    url: "https://bizarrenbar.com.ar/chupi-morfi/",
  },
  pedidos: {
    titulo: "Pedidos Bizarren",
    url: "https://pedidos-bizarren.lovable.app/",
    // Recibe el nombre del cliente logueado en el fragmento (#nombre=…) para
    // completar el pedido. El fragmento no viaja al servidor de Lovable.
    recibeNombre: true,
  },
};

/** Lo que había antes de que existiera la configuración. */
export const MENU_POR_DEFECTO = "wordpress";

const TABLA = "admin_ui_config";
const CLAVE = "menu";
const VERSION = 1;

const fuenteDe = (value) => (MENUS[value?.fuente] ? value.fuente : null);

/** Cliente: `fuente` es null mientras carga (así no se descarga una carta para tirarla). */
export function useMenuConfig() {
  const [fuente, setFuente] = useState(null);
  useEffect(() => {
    let vivo = true;
    supabase.rpc("menu_config").then(({ data, error }) => {
      if (!vivo) return;
      if (error) console.error("[useMenuConfig]", error);
      setFuente(fuenteDe(data) ?? MENU_POR_DEFECTO);
    });
    return () => { vivo = false; };
  }, []);
  return fuente;
}

/** Admin (Ajustes): lee la fila y guarda la carta elegida. */
export function useMenuConfigAdmin() {
  const [fuente, setFuente] = useState(null);       // null = cargando o sin fila
  const [updatedAt, setUpdatedAt] = useState(null);  // texto crudo de Supabase
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: e } = await supabase
      .from(TABLA).select("value, updated_at").eq("key", CLAVE).maybeSingle();
    if (e || !data) {
      if (e) console.error("[useMenuConfigAdmin]", e);
      setFuente(null);
      setError(e
        ? "No se pudo cargar la configuración de la carta."
        : "Falta aplicar en Supabase la migración 20261013210000_menu_fuente.");
      return;
    }
    setFuente(fuenteDe(data.value) ?? MENU_POR_DEFECTO);
    setUpdatedAt(data.updated_at);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = useCallback(async (nueva) => {
    const { data, error: e } = await supabase
      .from(TABLA).update({ value: { version: VERSION, fuente: nueva } })
      .eq("key", CLAVE).eq("updated_at", updatedAt)
      .select("value, updated_at");
    if (e) {
      throw new Error(e.code === "42501"
        ? "Tu usuario no tiene permisos para cambiar la carta."
        : "No se pudo guardar la carta elegida.");
    }
    if (!data?.length) {
      await cargar();
      throw new Error("Otra persona cambió esta configuración recién. Se recargó lo vigente: revisalo y probá de nuevo.");
    }
    setFuente(fuenteDe(data[0].value));
    setUpdatedAt(data[0].updated_at);
  }, [updatedAt, cargar]);

  return { fuente, error, guardar, recargar: cargar };
}
