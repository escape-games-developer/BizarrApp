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
  // Los juegos con postulación avisan recién con la convocatoria abierta.
  if (!a || a.postulacion || !sessionId) return;
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

/**
 * Mensaje o promo del operador al celular (Lanzar → Mensaje / Promo). La
 * WebApp ya lo muestra adentro (`webapp_banner`); esto avisa además a quien
 * tenga la app cerrada y el push activado. Tag = id del mensaje.
 */
export async function pushMensaje(sessionId, mensaje) {
  if (!sessionId || !mensaje?.texto) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("send-push", {
      body: {
        session_id: sessionId,
        title: `${mensaje.emoji || "📣"} ${mensaje.texto}`.slice(0, 80),
        body:  mensaje.subtitulo || "Bizarren Miusik Bar",
        url:   "/?view=novedades",
        tag:   `mensaje-${mensaje.id}`,
      },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
  } catch (e) {
    console.warn("[pushMensaje]", e?.message || e);
  }
}

/**
 * Convocatoria abierta de un juego de Escenario (FTL / PT): la ÚNICA
 * notificación del juego, y lleva directo a la pantalla de postularse.
 * El tag cambia en cada apertura para que el navegador vuelva a avisar.
 */
export async function pushConvocatoria(sessionId, juego) {
  if (!sessionId || !juego) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.functions.invoke("send-push", {
      body: {
        session_id: sessionId,
        title: `${juego.icon} ${juego.label}`,
        body:  "¡Postulate para subir al escenario!",
        url:   "/?view=escenario",
        tag:   `convocatoria-${juego.type}-${Date.now()}`,
      },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
    });
  } catch (e) {
    console.warn("[pushConvocatoria]", e?.message || e);
  }
}
