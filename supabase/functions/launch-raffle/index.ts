// supabase/functions/launch-raffle/index.ts
// Edge Function que corre en el servidor de Supabase.
// El admin la llama al terminar el efecto estroboscópico.
// Selecciona un ganador random en el servidor — no manipulable desde el cliente.

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verificar que quien llama es admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // service role bypasses RLS
    );

    const authHeader = req.headers.get("Authorization")!;
    const token      = authHeader.replace("Bearer ", "");

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verificar que es admin
    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .single();

    if (!adminCheck) {
      return new Response(JSON.stringify({ error: "Solo el admin puede lanzar el sorteo" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obtener parámetros del body
    const { session_id, prize, exclude_previous } = await req.json();
    if (!session_id) {
      return new Response(JSON.stringify({ error: "session_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Seleccionar ganador random del servidor
    // Postgres ORDER BY random() es suficiente para este caso de uso
    let query = supabase
      .from("connected_users")
      .select("user_id, name, team, avatar_id, avatar_emoji")
      .eq("session_id", session_id);

    if (exclude_previous) {
      query = query.eq("excluded_raffle", false);
    }

    const { data: candidates, error: candidatesError } = await query;

    if (candidatesError || !candidates || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: "No hay usuarios conectados en la sesión" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Random en Deno (suficientemente justo para un sorteo de bar)
    const winner = candidates[Math.floor(Math.random() * candidates.length)];

    // Actualizar game_state con el ganador
    const { error: updateError } = await supabase
      .from("game_state")
      .update({
        raffle_state:        "winner",
        raffle_winner_id:    winner.user_id,
        raffle_winner_name:  winner.name,
        raffle_prize:        prize || "Consumición libre para dos",
      })
      .eq("session_id", session_id);

    if (updateError) throw updateError;

    // Marcar al ganador como excluido de sorteos futuros (si está activado)
    if (exclude_previous) {
      await supabase
        .from("connected_users")
        .update({ excluded_raffle: true })
        .eq("session_id", session_id)
        .eq("user_id", winner.user_id);
    }

    return new Response(
      JSON.stringify({ ok: true, winner }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
