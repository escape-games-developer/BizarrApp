import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Sumate que Sumamos — ronda + números (Backend V1).
 *
 * Todo sale de la base, nunca de estado local: `sumate_rounds` (objetivo,
 * estado, motivo de cancelación, grupo ganador) y `sumate_assignments` (el
 * número de cada persona). Por eso un F5 en cualquier momento devuelve
 * exactamente la misma pantalla, con el mismo número.
 *
 * RLS parte las dos caras del juego sin que el frontend tenga que portarse
 * bien: el cliente sólo puede LEER su propia fila de assignments, y el admin
 * las lee todas. El celular no puede armar la lista de números ajenos aunque
 * quiera.
 *
 * ── UNA SOLA AUTORIDAD ────────────────────────────────────────────────────
 * Desde el Backend V1 el lanzamiento es ATÓMICO: `sumate_launch_round` crea la
 * ronda, reparte los números, calcula el objetivo Y pone
 * `game_state.active_game='suma'` en la misma transacción.
 *
 * Por eso acá NO se llama a `activateGame('suma')` después de lanzar, y
 * `cerrarJuego()` usa `sumate_cancel_round(round, true)` en vez de cancelar y
 * después llamar a `deactivateGame()`. Las dos escrituras separadas que había
 * antes podían quedar a medias: ronda viva sin proyectar, o pantalla proyectando
 * una ronda muerta.
 *
 * ── CONTRATO DE RESPUESTA ─────────────────────────────────────────────────
 * Las RPC devuelven SIEMPRE jsonb `{ ok, code, ... }` y no tiran excepciones
 * por condiciones operativas. `rpc()` normaliza acá las dos formas de falla:
 *   · `error` de PostgREST (red, permisos, función inexistente) → code técnico
 *   · `data.ok === false`  → el código estructurado del backend
 * Así el consumidor mira SIEMPRE `res.code` y nunca tiene que leer un texto.
 *
 * @param {string|null} sessionId
 * @param {object}  opts
 * @param {boolean} opts.admin   true en el panel: trae TODOS los assignments.
 * @param {string|null} opts.userId  con ronda abierta, se le pide su número.
 */

/** Campos de la ronda que consumen las tres pantallas. */
const CAMPOS_RONDA =
  "id,target_number,status,winner_group,cancel_reason,created_at,finished_at";

/**
 * Normaliza cualquier llamada RPC a `{ ok, code, ... }`.
 *
 * Un fallo de transporte NO es lo mismo que un rechazo del backend: el primero
 * no dice nada sobre el estado de la ronda, y el panel tiene que poder
 * distinguirlos para no cantar una cancelación que quizá no ocurrió.
 */
async function rpc(nombre, args) {
  const { data, error } = await supabase.rpc(nombre, args);
  if (error) {
    return {
      ok: false,
      code: error.code === "PGRST301" ? "UNAUTHORIZED" : "RPC_ERROR",
      error: error.message || "No se pudo contactar al servidor.",
      transport: true,
    };
  }
  if (data && typeof data === "object") return data;
  // Una RPC del contrato V1 siempre devuelve un objeto. Si llega otra cosa, es
  // una versión vieja desplegada: se dice, no se adivina.
  return { ok: false, code: "RPC_ERROR", error: "Respuesta inesperada del servidor.", transport: true };
}

export function useSumateRound(sessionId, { admin = false, userId = null } = {}) {
  const [round,       setRound]       = useState(null);
  const [assignments, setAssignments] = useState([]); // sólo admin
  const [miNumero,    setMiNumero]    = useState(null);
  const [miNumeroRes, setMiNumeroRes] = useState(null); // { ok, code, ... } del último intento
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const instanceRef = useRef(Math.random().toString(36).slice(2, 8));
  const montadoRef  = useRef(true);

  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false; }; }, []);

  // ── Última ronda de la sesión ─────────────────────────────────────────────
  const leerRonda = useCallback(async () => {
    if (!sessionId) { setRound(null); setLoading(false); return null; }
    const { data, error: e } = await supabase
      .from("sumate_rounds")
      .select(CAMPOS_RONDA)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!montadoRef.current) return null;
    if (e) { setError(e.message); setLoading(false); return null; }
    setError(null);
    setRound(data || null);
    setLoading(false);
    return data || null;
  }, [sessionId]);

  useEffect(() => { leerRonda(); }, [leerRonda]);

  // Realtime de la ronda: el objetivo, la cancelación y el ganador llegan solos
  // a TV, admin y celulares sin que nadie tenga que refrescar.
  //
  // Un solo canal por (sesión, instancia del hook). `instanceRef` evita que dos
  // montajes del mismo hook peleen por el mismo nombre de canal, y el cleanup
  // lo remueve: no quedan listeners duplicados acumulándose entre renders.
  useEffect(() => {
    if (!sessionId) return undefined;
    const ch = supabase
      .channel(`sumate:round:${sessionId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "sumate_rounds",
        filter: `session_id=eq.${sessionId}`,
      }, () => { leerRonda(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, leerRonda]);

  // ── Assignments (sólo admin; al cliente RLS le devuelve nada más el suyo) ──
  const roundId = round?.id || null;

  const leerAssignments = useCallback(async () => {
    if (!admin || !roundId) { setAssignments([]); return; }
    const { data, error: e } = await supabase
      .from("sumate_assignments")
      .select("user_id,assigned_number")
      .eq("round_id", roundId);
    if (!montadoRef.current || e) return;

    // Nombre, avatar y presencia salen de connected_users: los assignments
    // guardan sólo el user_id. `last_seen` viaja para que el panel pueda
    // marcar a los que ya no están — el backend valida el grupo sin mirar
    // presencia, así que el operador tiene que verlo con sus ojos.
    const { data: gente } = await supabase
      .from("connected_users")
      .select("user_id,name,avatar_emoji,last_seen")
      .eq("session_id", sessionId);
    const porId = new Map((gente || []).map((g) => [g.user_id, g]));
    if (!montadoRef.current) return;
    setAssignments((data || []).map((a) => ({
      ...a,
      name:         porId.get(a.user_id)?.name || "Jugador",
      avatar_emoji: porId.get(a.user_id)?.avatar_emoji || null,
      last_seen:    porId.get(a.user_id)?.last_seen || null,
    })).sort((x, y) => x.name.localeCompare(y.name, "es")));
  }, [admin, roundId, sessionId]);

  useEffect(() => { leerAssignments(); }, [leerAssignments]);

  useEffect(() => {
    if (!admin || !roundId) return undefined;
    const ch = supabase
      .channel(`sumate:assign:${roundId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "sumate_assignments",
        filter: `round_id=eq.${roundId}`,
      }, () => { leerAssignments(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [admin, roundId, leerAssignments]);

  // ── Mi número ─────────────────────────────────────────────────────────────
  // Automático: nadie toca ningún botón. `sumate_obtener_numero` es idempotente
  // y devuelve el mismo número en cualquier estado de la ronda si ya lo tenía
  // (por eso el resultado sigue visible con la ronda cerrada), y sólo crea uno
  // nuevo si la persona está presente en la sesión de esa ronda.
  //
  // Reemplaza a `sumate_ensure_assignment`, que existe sólo como compatibilidad
  // para el cliente viejo desplegado: devuelve int y comunica el motivo del
  // rechazo levantando una excepción, que es justo lo que no se puede mostrar.
  const roundStatus = round?.status ?? null;
  useEffect(() => {
    if (admin || !roundId || !userId) { setMiNumero(null); setMiNumeroRes(null); return; }
    let cancelado = false;
    (async () => {
      const res = await rpc("sumate_obtener_numero", { p_round: roundId });
      if (cancelado || !montadoRef.current) return;
      setMiNumeroRes(res);
      setMiNumero(res?.ok ? (res.assigned_number ?? null) : null);
    })();
    return () => { cancelado = true; };
  }, [admin, roundId, userId, roundStatus]);

  // ── Acciones de admin ─────────────────────────────────────────────────────
  // Todas devuelven el jsonb del backend SIN recortar y sin tirar: el panel
  // decide qué hacer mirando `code`. Ninguna escribe estado por su cuenta.

  /**
   * LANZAR / NUEVA RONDA — una sola llamada.
   *
   * El backend cierra la ronda anterior (`cancel_reason='new_round'`), crea la
   * nueva, reparte números, calcula el objetivo y pone el juego al aire, todo
   * en una transacción. NO hay que llamar a `activateGame('suma')` después.
   */
  const lanzarRonda = useCallback(async () => {
    if (!sessionId) return { ok: false, code: "INVALID_REQUEST", error: "Sin sesión activa" };
    const res = await rpc("sumate_launch_round", { p_session: sessionId });
    await leerRonda();
    return res;
  }, [sessionId, leerRonda]);

  // ⚠️ NO HAY `validarGrupo`, y es la decisión central de esta versión.
  //
  // Sumate se resuelve FÍSICAMENTE: la gente se junta, se acerca al escenario y
  // el staff resuelve ahí. La plataforma no necesita saber qué personas formaron
  // la suma, así que el operador no selecciona a nadie y no hay validación
  // digital del ganador.
  //
  // `validate_sumate_group` sigue existiendo en Supabase —no se borró ninguna
  // RPC— pero quedó SIN CONSUMIDOR en el frontend. Se saca el wrapper de acá en
  // vez de dejarlo colgando para que nadie lo llame por inercia creyendo que es
  // parte del flujo.
  //
  // Consecuencia: el flujo normal ya no produce `status='finished'`. Una ronda
  // termina en `cancelled` (manual / new_round / jornada / expired), que NO es
  // un fracaso: es el cierre operativo normal. Las rondas `finished` que
  // existen en la base son históricas y las pantallas las siguen sabiendo
  // pintar.

  /**
   * CANCELAR — idempotente; nunca degrada una ronda con ganador.
   * `cerrarJuego=true` además saca Sumate del aire en la misma transacción
   * (reemplaza al `deactivateGame()` suelto) y lo informa en `game_closed`.
   */
  const cancelarRonda = useCallback(async (cerrarJuego = false) => {
    if (!roundId) return { ok: false, code: "ROUND_NOT_FOUND", error: "No hay ronda" };
    const res = await rpc("sumate_cancel_round", { p_round_id: roundId, p_close_game: !!cerrarJuego });
    await leerRonda();
    return res;
  }, [roundId, leerRonda]);

  /**
   * ¿El objetivo sigue siendo formable con los que están presentes?
   * Sólo lectura: no cancela, no recalcula, no reasigna.
   */
  const verificarObjetivo = useCallback(async () => {
    if (!roundId) return { ok: false, code: "ROUND_NOT_FOUND", error: "No hay ronda" };
    return rpc("sumate_check_target", { p_round_id: roundId });
  }, [roundId]);

  return {
    round, assignments, miNumero, miNumeroRes, loading, error,
    lanzarRonda, cancelarRonda, verificarObjetivo, refresh: leerRonda,
  };
}
