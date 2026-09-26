// supabase/functions/launch-raffle/index.ts
// Edge Function que corre en el servidor de Supabase.
// El admin la llama al terminar el efecto estroboscópico.
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
      const code = r?.code ?? "INTERNAL_ERROR";
      const [status, msg] = ERRORS[code] ?? [500, () => "Error interno al resolver el sorteo"];
      return jsonResponse(status, {
        ok: false,
        code,
        error: msg(r ?? { ok: false }),
        dry_run: r?.dry_run ?? dry_run,
        connected_count: r?.connected_count,
        eligible_count:  r?.eligible_count,
        required_count:  r?.required_count,
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

    if (r.already_drawn) {
      return jsonResponse(200, { ok: true, winner: r.winner ?? null, already_drawn: true });
    }

    return jsonResponse(200, {
      ok: true,
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
