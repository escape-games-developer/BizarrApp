// supabase/functions/launch-raffle/index.ts
// Edge Function que corre en el servidor de Supabase.
// El admin la llama al terminar el efecto estroboscópico.
//
// v8 — Rey del Orto V1 · fallo tardío.
//
// Alineada BYTE A BYTE con el contrato de la migración 20260926180000 tal como
// quedó aplicada en producción (md5 f4f8212105ee1c45d1dbe803d50cdd7a).
//
// FIRMAS REALES, sin sobrecargas:
//   public.rey_resolver_sorteo(p_session_id uuid, p_prize text, p_dry_run boolean)
//   public.rey_cancelar_ronda (p_session_id uuid, p_cancel jsonb)
//
// Esta función llama ÚNICAMENTE a `rey_resolver_sorteo`. No llama nunca a
// `rey_cancelar_ronda`: la cancelación del fallo tardío la hace el resolver
// dentro de su propia transacción, con la fila bloqueada. Llamarla desde acá
// sería una segunda autoridad sobre el mismo estado.
//
// La RPC pasa la ronda a `raffle_state='cancelled'` —con su motivo en
// `game_state.raffle_cancel`— cuando rechaza la resolución definitiva de una
// ronda ya lanzada por MIN_PARTICIPANTS, NO_ELIGIBLE_PARTICIPANTS,
// RAFFLE_CONFIG_INCOMPLETE o INVALID_PRIZE. NO cancela por RAFFLE_CONFLICT,
// ROUND_NOT_FOUND, ROUND_NOT_LAUNCHED ni ante un error interno.
//
// Esta función NO decide nada y NO inventa estado: autentica, autoriza, valida
// el payload y traduce. La autoridad es la RPC.
//
// Cambios respecto de v7:
//  - dry_run=true propaga el cuadro completo de validación: connected_count,
//    eligible_count, required_count, raffle_state, jornada,
//    min_participants_enabled, block_repeat_winners_enabled.
//  - dry_run=false propaga `cancelled`, `already_cancelled`, los contadores
//    originales del rechazo y `cancel` (el motivo estructurado completo).
//  - `cancelled` se DERIVA (ver más abajo) porque el contrato real devuelve
//    `cancelled:false` junto con `already_cancelled:true`.
//  - `already_drawn` viaja con el mismo ganador y el mismo premio persistidos.
//  - Se mapean los dos códigos que aporta la migración nueva:
//    `ROUND_ALREADY_DRAWN` y `ROUND_CANCELLED`.
//
// v7 — Rey del Orto V1:
//  - La resolución completa se delega a la RPC transaccional
//    public.rey_resolver_sorteo (única autoridad): configuración
//    (rey_reglas_config), presencia, mínimo de participantes, elegibilidad por
//    historial (rey_ganadores), selección, registro de la victoria y
//    publicación en game_state, todo en una sola transacción con lock de la
//    fila de game_state.
//  - Esta función sólo autentica, autoriza (admin_users), valida el payload
//    y traduce la respuesta de la RPC. No reimplementa reglas.
//  - Nuevo: dry_run (default false). Sólo valida y cuenta; no elige, no
//    escribe, no genera eventos Realtime.
//  - LEGACY: exclude_previous se sigue aceptando en el payload para no romper
//    el Admin actual, pero se IGNORA. La autoridad sobre ganadores previos es
//    rey_reglas_config.bloquear_ganadores_repetidos. connected_users.excluded_raffle
//    ya no se lee ni se escribe.
//  - Contrato compatible: éxito { ok: true, winner, already_drawn? };
//    errores mantienen `error` (texto humano) y suman `code` estructurado.
//  - 500 devuelve un mensaje genérico (sin detalles SQL internos).

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const DEFAULT_PRIZE = "Consumición libre para dos";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcResult = {
  ok: boolean;
  code?: string;
  dry_run?: boolean;
  already_drawn?: boolean;
  cancelled?: boolean;
  already_cancelled?: boolean;
  // Motivo estructurado completo, tal como quedó en `game_state.raffle_cancel`:
  // { code, connected_count?, eligible_count?, required_count?, at }.
  cancel?: Record<string, unknown> | null;
  winner?: Record<string, unknown> | null;
  prize?: string | null;
  victoria_n?: number;
  jornada?: string;
  round_key?: string;
  connected_count?: number;
  eligible_count?: number;
  required_count?: number | null;
  raffle_state?: string;
  min_participants_enabled?: boolean;
  block_repeat_winners_enabled?: boolean;
};

// code → [HTTP status, mensaje humano para el Admin actual]
const ERRORS: Record<string, [number, (r: RpcResult) => string]> = {
  MIN_PARTICIPANTS: [400, (r) =>
    `Faltan participantes: hay ${r.connected_count ?? 0} conectados y se necesitan ${r.required_count ?? "?"}`],
  NO_ELIGIBLE_PARTICIPANTS: [400, () => "No hay participantes elegibles"],
  RAFFLE_CONFIG_INCOMPLETE: [400, () => "La configuración de reglas del sorteo está incompleta"],
  INVALID_PRIZE:            [400, () => "Premio inválido"],
  INVALID_REQUEST:          [400, () => "Solicitud inválida"],
  ROUND_NOT_LAUNCHED:       [409, () => "La ronda no está en estado 'launched'"],
  ROUND_NOT_FOUND:          [409, () => "No existe una ronda para esta sesión"],
  RAFFLE_CONFLICT:          [409, () => "Conflicto al resolver el sorteo. Intentá de nuevo."],
  // `rey_cancelar_ronda` cuando se le pide cancelar una ronda que ya tiene
  // ganador publicado. Inalcanzable a través del resolver (sólo cancela desde
  // 'launched'), pero mapeado para no caer en el 500 genérico si algún día se
  // llama a la RPC de contención de otra manera.
  ROUND_ALREADY_DRAWN:      [409, () => "Esta ronda ya tiene un ganador"],
  // Defensa: ronda cancelada cuyo motivo no trajo código. Con el contrato
  // actual no puede pasar —`rey_cancelar_ronda` exige un `code` válido y el
  // CHECK obliga a que `raffle_cancel` exista— pero si el código llegara vacío
  // es mejor un mensaje que un 500.
  ROUND_CANCELLED:          [409, () => "El sorteo de esta ronda quedó cancelado"],
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role: única credencial con EXECUTE sobre la RPC
    );

    // 1) Auth: token válido
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(401, { error: "No autorizado" });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    const user = userData?.user;
    if (authError || !user) {
      return jsonResponse(401, { error: "No autorizado" });
    }

    // 2) Autorización: admin
    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!adminCheck) {
      return jsonResponse(403, { error: "Solo el admin puede lanzar el sorteo" });
    }

    // 3) Params
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { ok: false, code: "INVALID_REQUEST", error: "Solicitud inválida" });
    }
    const session_id = body?.session_id;
    const prize      = body?.prize;
    const dry_run    = body?.dry_run === true;
    // LEGACY: body.exclude_previous se acepta pero se ignora a propósito.

    if (!session_id) {
      return jsonResponse(400, { error: "session_id requerido" });
    }
    if (typeof session_id !== "string" || !UUID_RE.test(session_id)) {
      return jsonResponse(400, { ok: false, code: "INVALID_REQUEST", error: "session_id inválido" });
    }

    const prizeText =
      typeof prize === "string" && prize.trim() !== "" ? prize.trim() : DEFAULT_PRIZE;

    // 4) Resolución (o dry-run) en la RPC transaccional
    const { data, error: rpcError } = await supabase.rpc("rey_resolver_sorteo", {
      p_session_id: session_id,
      p_prize:      dry_run ? null : prizeText,
      p_dry_run:    dry_run,
    });
    if (rpcError) {
      console.error("launch-raffle: rpc error", rpcError);
      return jsonResponse(500, { ok: false, code: "INTERNAL_ERROR", error: "Error interno al resolver el sorteo" });
    }

    const r = data as RpcResult;

    // 5) Traducción de la respuesta
    if (!r?.ok) {
      // `code` puede venir vacío sólo si `raffle_cancel` no tuviera código, que
      // el contrato actual impide. Se nombra explícito para no traducir un
      // rechazo real como si fuera un error interno.
      const code = r?.code ?? (r?.already_cancelled ? "ROUND_CANCELLED" : "INTERNAL_ERROR");
      const [status, msg] = ERRORS[code] ?? [500, () => "Error interno al resolver el sorteo"];
      return jsonResponse(status, {
        ok: false,
        code,
        error: msg(r ?? { ok: false }),
        dry_run: r?.dry_run ?? dry_run,
        // `cancelled: true` ⇒ la ronda YA está en 'cancelled' y el
        // estroboscópico está apagado; el panel no tiene nada que hacer.
        //
        // Se DERIVA de las dos señales, y no es un detalle: el contrato real
        // devuelve `cancelled:false` junto con `already_cancelled:true` —
        // porque en esa llamada no se canceló nada, ya estaba cancelada—. Un
        // pass-through crudo de `cancelled` le diría al Admin que la ronda
        // sigue lanzada justo cuando NO lo está.
        cancelled:         r?.cancelled === true || r?.already_cancelled === true,
        already_cancelled: r?.already_cancelled === true,
        // Contadores ORIGINALES del rechazo, tal como los devuelve la RPC. Acá
        // no se recalcula ninguno.
        //
        // Pueden llegar en `null`: los rechazos por configuración y por premio
        // inválido no tienen contadores (se rechazan antes de contar gente), y
        // una ronda ya cancelada por esos motivos devuelve null al leerlos de
        // `raffle_cancel`. El Admin sólo imprime números cuando son números.
        connected_count: r?.connected_count,
        eligible_count:  r?.eligible_count,
        required_count:  r?.required_count,
        raffle_state:    r?.raffle_state,
        // Motivo estructurado completo. Es la fuente durable: lo mismo que
        // quedó en `game_state.raffle_cancel` y que llega a las tres pantallas
        // por Realtime.
        cancel:          r?.cancel ?? null,
      });
    }

    if (r.dry_run) {
      return jsonResponse(200, {
        ok: true,
        dry_run: true,
        connected_count: r.connected_count,
        eligible_count:  r.eligible_count,
        required_count:  r.required_count,
        raffle_state:    r.raffle_state,
        min_participants_enabled:     r.min_participants_enabled,
        block_repeat_winners_enabled: r.block_repeat_winners_enabled,
        jornada: r.jornada,
      });
    }

    // Ronda ya resuelta: se devuelve el ganador PERSISTIDO, no uno nuevo. Es el
    // camino de recuperación cuando el Admin no recibió la respuesta de la
    // resolución (timeout, red cortada) y vuelve a preguntar.
    //
    // El contrato real devuelve acá `winner` y `prize` — y nada más: la
    // victoria y la jornada son datos del momento en que se insertó la fila en
    // `rey_ganadores`, no se releen. No se inventan.
    if (r.already_drawn) {
      return jsonResponse(200, {
        ok: true,
        already_drawn: true,
        winner: r.winner ?? null,
        prize:  r.prize,
      });
    }

    return jsonResponse(200, {
      ok: true,
      already_drawn: false,
      winner: r.winner,
      prize: r.prize,
      victoria_n: r.victoria_n,
      jornada: r.jornada,
      round_key: r.round_key,
      connected_count: r.connected_count,
      eligible_count: r.eligible_count,
      required_count: r.required_count,
    });

  } catch (err) {
    console.error("launch-raffle: unexpected error", err);
    return jsonResponse(500, { ok: false, code: "INTERNAL_ERROR", error: "Error interno al resolver el sorteo" });
  }
});
