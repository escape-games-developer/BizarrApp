import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

/**
 * Normaliza la palabra igual que `arma_palabra_normalizar` en Postgres:
 * mayúsculas, sin acentos, sin espacios alrededor, Ñ conservada.
 *
 * Existe acá SÓLO para que el panel pueda mostrar en vivo lo que va a quedar y
 * habilitar el botón. La normalización que vale es la del servidor — el RPC
 * vuelve a normalizar y a validar lo que reciba.
 */
export function normalizarPalabra(texto) {
  return (texto || "")
    .trim()
    .toUpperCase()
    .replace(/[ÁÀÄÂÃ]/g, "A")
    .replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔÕ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U");
}

/** Mismo criterio que el CHECK de la tabla: 3 a 6 letras, sin espacios. */
export const PALABRA_RE = /^[A-ZÑ]{3,6}$/;

/** Cuántas palabras puede preparar el operador para una partida. */
export const MAX_PALABRAS = 10;

/**
 * ¿La palabra sirve para jugar? Espejo de `arma_palabra_valida` en Postgres.
 *
 * Además de la forma, exige LETRAS ÚNICAS. No es un capricho: el reparto
 * garantiza que cada letra de la palabra salga al menos una vez, y con letras
 * repetidas eso dejaría de alcanzar — CASA necesita DOS personas con A, y
 * "al menos una A" no lo asegura.
 *
 * La autoridad es el servidor: el RPC vuelve a normalizar y a validar.
 */
export function palabraValida(palabra) {
  const p = palabra || "";
  if (!PALABRA_RE.test(p)) return false;
  return new Set(p.split("")).size === p.length;
}

/** Por qué se rechaza, para poder decírselo al operador. */
export function motivoPalabraInvalida(palabra) {
  const p = palabra || "";
  if (p.length < 3) return "La palabra necesita al menos 3 letras.";
  if (p.length > 6) return "Máximo 6 letras.";
  if (!PALABRA_RE.test(p)) return "Una sola palabra, sin espacios, números ni signos.";
  if (new Set(p.split("")).size !== p.length) return "No puede repetir letras.";
  return null;
}

/** Códigos estables que `arma_palabra_launch_round` manda en HINT. */
const CODIGOS_LANZAMIENTO = ["UNAUTHORIZED", "INVALID_WORD", "CONFIG_INCOMPLETE", "MIN_PARTICIPANTS"];

/**
 * Convierte el rechazo de `arma_palabra_launch_round` en `{ code, ...detalle }`.
 *
 * El contrato V1 (migración `20260928233131_arma_palabra_reglas_v1`) rechaza
 * con EXCEPCIÓN, no con `{ok:false}`: el código estable viaja en `hint` y un
 * JSON `{code, connected_count, required_count, ...}` en `details`. Este
 * parser sólo lee esos dos campos; el texto SQL de `message` no sale de acá.
 *
 * Un fallo de transporte (red, JWT vencido) no trae hint: se clasifica aparte
 * para no decirle al operador "faltan participantes" cuando no llegó al server.
 */
export function rechazoLanzamiento(e) {
  let detalle = {};
  if (typeof e?.details === "string" && e.details.trim().startsWith("{")) {
    try { detalle = JSON.parse(e.details) || {}; } catch { detalle = {}; }
  }
  const hint = typeof e?.hint === "string" ? e.hint.trim() : "";
  let code =
    CODIGOS_LANZAMIENTO.includes(hint)         ? hint :
    CODIGOS_LANZAMIENTO.includes(detalle.code) ? detalle.code :
    null;
  if (!code) {
    code = (e?.code === "PGRST301" || e?.code === "42501") ? "UNAUTHORIZED" : "RPC_ERROR";
  }
  return { ...detalle, code };
}

/**
 * Arma la Palabra — ronda + letras.
 *
 * Gemelo de `useSumateRound`: todo sale de la base (`arma_palabra_rounds` y
 * `arma_palabra_assignments`), nunca de estado local, así que un F5 en
 * cualquier momento devuelve la misma pantalla con la misma letra.
 *
 * RLS parte las dos caras sin depender de que el frontend se porte bien: el
 * cliente sólo puede LEER su propia fila de assignments y el admin las lee
 * todas. El celular no puede armar la lista de letras ajenas aunque quiera.
 *
 * @param {string|null} sessionId
 * @param {object}  opts
 * @param {boolean} opts.admin   true en el panel: trae TODAS las letras.
 * @param {string|null} opts.userId  con ronda abierta, se le pide su letra.
 */
export function useArmaPalabraRound(sessionId, { admin = false, userId = null } = {}) {
  const [round,       setRound]       = useState(null);
  const [assignments, setAssignments] = useState([]); // sólo admin
  const [miLetra,     setMiLetra]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const instanceRef = useRef(Math.random().toString(36).slice(2, 8));
  const montadoRef  = useRef(true);

  useEffect(() => { montadoRef.current = true; return () => { montadoRef.current = false; }; }, []);

  // ── Última ronda de la sesión ─────────────────────────────────────────────
  const leerRonda = useCallback(async () => {
    if (!sessionId) { setRound(null); setLoading(false); return null; }
    const { data, error: e } = await supabase
      .from("arma_palabra_rounds")
      .select("id,target_word,status,winner_group,created_at,finished_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!montadoRef.current) return null;
    if (e) { setError(e.message); setLoading(false); return null; }
    setRound(data || null);
    setLoading(false);
    return data || null;
  }, [sessionId]);

  useEffect(() => { leerRonda(); }, [leerRonda]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const ch = supabase
      .channel(`palabra:round:${sessionId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "arma_palabra_rounds",
        filter: `session_id=eq.${sessionId}`,
      }, () => { leerRonda(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, leerRonda]);

  // ── Letras (sólo admin; al cliente RLS le devuelve nada más la suya) ───────
  const roundId = round?.id || null;

  const leerAssignments = useCallback(async () => {
    if (!admin || !roundId) { setAssignments([]); return; }
    const { data, error: e } = await supabase
      .from("arma_palabra_assignments")
      .select("user_id,assigned_letter")
      .eq("round_id", roundId);
    if (!montadoRef.current || e) return;

    const { data: gente } = await supabase
      .from("connected_users")
      .select("user_id,name,avatar_emoji")
      .eq("session_id", sessionId);
    const porId = new Map((gente || []).map((g) => [g.user_id, g]));
    if (!montadoRef.current) return;
    setAssignments((data || []).map((a) => ({
      ...a,
      name:         porId.get(a.user_id)?.name || "Jugador",
      avatar_emoji: porId.get(a.user_id)?.avatar_emoji || null,
    })).sort((x, y) => x.name.localeCompare(y.name, "es")));
  }, [admin, roundId, sessionId]);

  useEffect(() => { leerAssignments(); }, [leerAssignments]);

  useEffect(() => {
    if (!admin || !roundId) return undefined;
    const ch = supabase
      .channel(`palabra:assign:${roundId}:${instanceRef.current}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "arma_palabra_assignments",
        filter: `round_id=eq.${roundId}`,
      }, () => { leerAssignments(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [admin, roundId, leerAssignments]);

  // ── Mi letra ──────────────────────────────────────────────────────────────
  // Automática: nadie toca ningún botón. Si ya tengo letra me la devuelve, y si
  // entré con la ronda empezada el servidor me da una de las letras MENOS
  // entregadas de la palabra (nunca una letra ajena, nunca un señuelo), así el
  // reparto sigue parejo. El RPC es idempotente por el UNIQUE(round_id,user_id),
  // así que dos pestañas dan la misma letra.
  useEffect(() => {
    if (admin || !roundId || !userId) { setMiLetra(null); return; }
    let cancelado = false;
    (async () => {
      // Primero leer: con la ronda cerrada el RPC tira, pero mi letra tiene que
      // seguir viéndose en la pantalla de resultado.
      const { data } = await supabase
        .from("arma_palabra_assignments")
        .select("assigned_letter")
        .eq("round_id", roundId)
        .eq("user_id", userId)
        .maybeSingle();
      if (cancelado) return;
      if (data?.assigned_letter) { setMiLetra(data.assigned_letter); return; }
      if (round?.status !== "playing") return;

      const { data: letra, error: e } = await supabase
        .rpc("arma_palabra_ensure_assignment", { p_round: roundId });
      if (cancelado) return;
      if (e) { setError(e.message); return; }
      setMiLetra(letra ?? null);
    })();
    return () => { cancelado = true; };
  }, [admin, roundId, userId, round?.status]);

  // ── Acciones de admin ─────────────────────────────────────────────────────
  // Rechazos: tira un Error con `.rechazo = { code, connected_count?,
  // required_count?, ... }` (ver `rechazoLanzamiento`). Quién puede lanzar lo
  // decide SÓLO el servidor: acá no se cuenta a nadie ni se compara mínimos.
  const lanzarRonda = useCallback(async (palabra) => {
    if (!sessionId) {
      const err = new Error("Sin sesión activa");
      err.rechazo = { code: "SESSION_MISSING" };
      throw err;
    }
    const { data, error: e } = await supabase
      .rpc("arma_palabra_launch_round", {
        p_session: sessionId, p_target_word: palabra,
      });
    if (e) {
      console.error("[useArmaPalabraRound] launch rechazado:", e);
      const err = new Error("Lanzamiento rechazado");
      err.rechazo = rechazoLanzamiento(e);
      throw err;
    }
    await leerRonda();
    return data;
  }, [sessionId, leerRonda]);

  // ⚠️ NO HAY `validarGrupo`, y es la decisión central de esta versión.
  //
  // Arma la Palabra se resuelve FÍSICAMENTE: la gente se busca en el bar, se
  // junta y se acerca al escenario, y el staff resuelve ahí. La plataforma no
  // necesita saber qué personas formaron la palabra, así que el operador no
  // selecciona a nadie en ningún orden y no hay validación digital del ganador.
  //
  // `validate_arma_palabra_group` sigue existiendo en Supabase —no se borró
  // ninguna RPC— pero quedó SIN CONSUMIDOR en el frontend. Se saca el wrapper
  // de acá en vez de dejarlo colgando para que nadie lo llame por inercia
  // creyendo que es parte del flujo.
  //
  // Consecuencia: el flujo normal ya no produce `status='finished'`. Una ronda
  // termina cancelada, que NO es un fracaso: es el cierre operativo normal.

  const cancelarRonda = useCallback(async () => {
    if (!roundId) return;
    const { error: e } = await supabase
      .rpc("arma_palabra_cancel_round", { p_round_id: roundId });
    if (e) throw new Error(e.message);
    await leerRonda();
  }, [roundId, leerRonda]);

  return {
    round, assignments, miLetra, loading, error,
    lanzarRonda, cancelarRonda, refresh: leerRonda,
  };
}
