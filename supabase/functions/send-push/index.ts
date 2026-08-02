// supabase/functions/send-push/index.ts
// Edge Function que corre en el servidor de Supabase.
// El admin la llama para mandar una notificación push nativa (Web Push / VAPID)
// a todos los usuarios presentes en la sesión activa.
// Recorre push_subscriptions, envía con web-push, limpia suscripciones muertas.

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush          from "npm:web-push@3.6.7";

// TODO: cuando esté el dominio de producción de la webapp, reemplazar "*"
// por el origin exacto (ej: "https://bizarren.app") para acotar el CORS.
const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  try {
    // Cliente con service role — saltea RLS en las queries internas.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Autenticación: sólo admin ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") || "";
    const token      = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "No autorizado" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json({ error: "No autorizado" }, 401);

    const { data: adminCheck } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!adminCheck) return json({ error: "Solo el admin puede enviar push" }, 401);

    // ── Parámetros ──────────────────────────────────────────────────────────────
    const { session_id, title, body, url, tag } = await req.json();
    if (!session_id || !title) {
      return json({ error: "session_id y title son requeridos" }, 400);
    }

    // ── Configurar VAPID ─────────────────────────────────────────────────────────
    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT")!,
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    // 1. Usuarios presentes en la sesión (heartbeat en los últimos 10 minutos)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: present } = await supabase
      .from("connected_users")
      .select("user_id")
      .eq("session_id", session_id)
      .gt("last_seen", tenMinAgo);

    const userIds = [...new Set((present || []).map((r) => r.user_id).filter(Boolean))];
    if (userIds.length === 0) {
      return json({ sent: 0, failed: 0, cleaned: 0 });
    }

    // 2. Suscripciones push de esos usuarios
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (!subs || subs.length === 0) {
      return json({ sent: 0, failed: 0, cleaned: 0 });
    }

    const payload = JSON.stringify({ title, body: body || "", url: url || "/", tag: tag || "bizarren" });

    let sent = 0, failed = 0, cleaned = 0;

    // 3. Enviar a cada suscripción (en paralelo)
    await Promise.all(subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, payload);
        sent++;
        // 5. Marcar uso reciente
        await supabase
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (err) {
        failed++;
        // 4. 410 Gone / 404 Not Found → suscripción muerta, borrar fila
        const code = err?.statusCode;
        if (code === 410 || code === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", s.id);
          cleaned++;
        } else {
          console.error("[send-push] error enviando:", code, err?.body || err?.message);
        }
      }
    }));

    return json({ sent, failed, cleaned });

  } catch (err) {
    return json({ error: err.message }, 500);
  }
});
