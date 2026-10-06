import { supabase } from "../lib/supabase";
import { anuncioDe, urlDeAnuncio } from "../client/anuncios/anunciosCatalog";

/**
 * Notificación del navegador para un anuncio de juego/escenario.
 *
 * La llama el Admin justo después de anunciar (useAdminControls). Reutiliza la
 * infraestructura existente: Edge Function `send-push` → conectados de la
 * sesión con push activado → public/sw.js.
 *
 * Identidad: el `id` de la fila que el trigger abrió en `client_announcements`
 * viaja como `tag`. El navegador reemplaza una notificación con el mismo tag,
 * así que reintentos no la duplican; un re-anuncio trae otro id y avisa de nuevo.
 * Sin fila abierta para esa placa no se manda nada (no hay identidad).
 *
 * Es un aviso: si falla, el anuncio en pantalla sigue igual.
 */
export async function pushAnuncio(sessionId, placa) {
  const a = anuncioDe(placa);
  if (!a || !sessionId) return;
  try {
    const { data: fila, error } = await supabase
      .from("client_announcements")
      .select("id")
      .eq("session_id", sessionId)
      .eq("placa", placa)
      .is("ended_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!fila?.id) { console.warn("[pushAnuncio] sin anuncio abierto para", placa); return; }

    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("send-push", {
      body: {
        session_id: sessionId,
        title: `${a.emoji} ${a.nombre}`,
        body:  a.cuerpo,
        url:   urlDeAnuncio(placa),
        tag:   `anuncio-${fila.id}`,
      },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
  } catch (e) {
    console.warn("[pushAnuncio]", e?.message || e);
  }
}
