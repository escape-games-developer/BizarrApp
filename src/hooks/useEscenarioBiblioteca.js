import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { listarBiblioteca } from "../services/escenarioBiblioteca";

/**
 * Playlists y videos de la biblioteca de un juego de Escenario ('ftl' | 'pt').
 * Se recarga sola por Realtime: dos PCs de operación ven lo mismo.
 */
export function useEscenarioBiblioteca(juego) {
  const [playlists, setPlaylists] = useState([]);
  const [videos,    setVideos]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const montadoRef = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const r = await listarBiblioteca(juego);
      if (!montadoRef.current) return;
      setPlaylists(r.playlists); setVideos(r.videos); setError(null);
    } catch (e) {
      const msg = e.message || String(e);
      if (montadoRef.current) setError(/could not find the table|does not exist/i.test(msg)
        ? "Falta aplicar la migración 20261019120000_escenario_biblioteca en Supabase."
        : msg);
    } finally {
      if (montadoRef.current) setLoading(false);
    }
  }, [juego]);

  useEffect(() => {
    montadoRef.current = true;
    setLoading(true);
    cargar();
    const canal = supabase
      .channel(`esc-biblio-${juego}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "escenario_videos" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "escenario_playlists" }, cargar)
      .subscribe();
    return () => { montadoRef.current = false; supabase.removeChannel(canal); };
  }, [juego, cargar]);

  return { playlists, videos, loading, error, refresh: cargar };
}
