// supabase/functions/launch-raffle/index.ts
// Edge Function que corre en el servidor de Supabase.
// El admin la llama al terminar el efecto estroboscópico.
// Selecciona un ganador random en el servidor — no manipulable desde el cliente.
//
// Endurecimientos v6:
//  - UPDATE atómico (WHERE raffle_state='launched'): la primera llamada gana.
//  - Idempotencia: llamada duplicada sobre ronda ya resuelta devuelve el mismo
//    ganador persistido con { already_drawn: true } y HTTP 200.
//  - Elegibilidad por presencia: last_seen >= now() - 2 minutos.
//  - Sin participantes elegibles: NO se toca game_state; se devuelve 400
//    con { error: 'No hay participantes elegibles' }.
//  - Se preserva el contrato con el frontend: params (session_id, prize,
//    exclude_previous) y body de éxito ({ ok, winner }).

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const DEFAULT_PRIZE = "Consumición libre para dos";
const PRESENCE_WINDOW_MS = 2 * 60 * 1000; // 2 minutos

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function loadWinnerFull(
  supabase: ReturnType<typeof createClient>,
  session_id: string,
  user_id: string | null,
  fallback_name: string | null,
) {
  if (!user_id) return null;
  const { data } = await supabase
    .from("connected_users")
    .select("user_id, name, team, avatar_id, avatar_emoji")
    .eq("session_id", session_id)
    .eq("user_id", user_id)
    .maybeSingle();
  if (data) return data;
  return { user_id, name: fallback_name };
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service role bypasses RLS
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
    const { session_id, prize, exclude_previous } = await req.json();
    if (!session_id) {
      return jsonResponse(400, { error: "session_id requerido" });
    }

    // 4) Candidatos elegibles: sesión + presencia + (opcional) excluded_raffle
    const cutoffIso = new Date(Date.now() - PRESENCE_WINDOW_MS).toISOString();
    let query = supabase
      .from("connected_users")
      .select("user_id, name, team, avatar_id, avatar_emoji")
      .eq("session_id", session_id)
      .gte("last_seen", cutoffIso);
    if (exclude_previous) {
      query = query.eq("excluded_raffle", false);
    }
    const { data: candidates, error: candidatesError } = await query;
    if (candidatesError) throw candidatesError;

    // 5) Sin candidatos: ver si otra llamada ya resolvió la ronda
    if (!candidates || candidates.length === 0) {
      const { data: currentState } = await supabase
        .from("game_state")
        .select("raffle_state, raffle_winner_id, raffle_winner_name")
        .eq("session_id", session_id)
        .maybeSingle();

      if (currentState?.raffle_state === "winner") {
        const winner = await loadWinnerFull(
          supabase,
          session_id,
          currentState.raffle_winner_id,
          currentState.raffle_winner_name,
        );
        return jsonResponse(200, { ok: true, winner, already_drawn: true });
      }

      return jsonResponse(400, { error: "No hay participantes elegibles" });
    }

    // 6) Sorteo
    const winner = candidates[Math.floor(Math.random() * candidates.length)];

    // 7) UPDATE atómico: sólo si la ronda todavía está en 'launched'
    const { data: updated, error: updateError } = await supabase
      .from("game_state")
      .update({
        raffle_state:       "winner",
        raffle_winner_id:   winner.user_id,
        raffle_winner_name: winner.name,
        raffle_prize:       prize || DEFAULT_PRIZE,
      })
      .eq("session_id", session_id)
      .eq("raffle_state", "launched")
      .select("raffle_winner_id, raffle_winner_name");
    if (updateError) throw updateError;

    // 8) 0 filas: otro proceso ya resolvió. Devolver el ganador persistido.
    if (!updated || updated.length === 0) {
      const { data: raced } = await supabase
        .from("game_state")
        .select("raffle_state, raffle_winner_id, raffle_winner_name")
        .eq("session_id", session_id)
        .maybeSingle();

      if (raced?.raffle_state === "winner") {
        const racedWinner = await loadWinnerFull(
          supabase,
          session_id,
          raced.raffle_winner_id,
          raced.raffle_winner_name,
        );
        return jsonResponse(200, { ok: true, winner: racedWinner, already_drawn: true });
      }

      // Estado inesperado (no 'launched' ni 'winner'): la ronda no está lista.
      return jsonResponse(409, { error: "La ronda no está en estado 'launched'" });
    }

    // 9) Marcar al ganador como excluido de sorteos futuros (si corresponde)
    if (exclude_previous) {
      await supabase
        .from("connected_users")
        .update({ excluded_raffle: true })
        .eq("session_id", session_id)
        .eq("user_id", winner.user_id);
    }

    return jsonResponse(200, { ok: true, winner });

  } catch (err) {
    return jsonResponse(500, { error: (err as Error).message });
  }
});
