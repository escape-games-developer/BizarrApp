// supabase/functions/admin-create-user/index.ts
// Alta de usuarios desde el Admin (Usuarios del sistema y Clientes).
//
// Crea la cuenta con auth.admin.inviteUserByEmail: Supabase le manda el mail
// «Invite user» y el link vuelve a /auth/callback?next=invite, donde la
// persona elige su contraseña. El perfil (profiles) lo arma el trigger
// handle_new_user con la metadata { name, team, phone }.
//
// Quién puede:
//   - Anfitrión, Producción o Administrador general nuevo → sólo un administrador.
//   - Cliente nuevo → administrador, o anfitrión / producción con la sección «clientes».
//
// Staff con una cuenta que ya existe (p. ej. un cliente que pasa a anfitrión):
// no se crea nada ni se manda mail; se le da el rol sobre la cuenta existente.

import { serve }        from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const MAIL_RE    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECCION_RE = /^[a-z][a-zA-Z0-9]{1,63}$/;
const NOMBRE_MAX = 24;
const TIPOS      = ["cliente", "anfitrion", "produccion", "admin"];
// Perfiles con secciones asignadas (el admin ve todo). `operator` = alias viejo de anfitrion.
const CON_SECCIONES = ["anfitrion", "produccion"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Quién llama ────────────────────────────────────────────────────────────
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return json({ error: "unauthorized" }, 401);

    const { data: staff } = await supabase
      .from("admin_users").select("role, sections").eq("user_id", caller.id).maybeSingle();
    const esAdmin = staff?.role === "admin";
    const veClientes = esAdmin || (CON_SECCIONES.includes(staff?.role) && (staff.sections ?? []).includes("clientes"));

    // ── Datos ──────────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const tipoPedido = String(body.tipo ?? "");
    const tipo     = tipoPedido === "operator" ? "anfitrion" : tipoPedido;
    const email    = String(body.email ?? "").trim().toLowerCase();
    const nombre   = String(body.nombre ?? "").trim();
    const team     = ["batata", "membrillo"].includes(body.team) ? body.team : null;
    const phone    = String(body.telefono ?? "").trim() || null;
    const redirect = String(body.redirectTo ?? "");

    if (!TIPOS.includes(tipo))         return json({ error: "invalid_type" }, 400);
    if (!MAIL_RE.test(email))          return json({ error: "invalid_email" }, 400);
    if (!nombre || nombre.length > NOMBRE_MAX) return json({ error: "invalid_name" }, 400);
    if (!/^https?:\/\//.test(redirect)) return json({ error: "invalid_redirect" }, 400);

    const esStaff = tipo !== "cliente";
    if (esStaff ? !esAdmin : !veClientes) return json({ error: "forbidden" }, 403);

    let secciones: string[] = [];
    if (CON_SECCIONES.includes(tipo)) {
      secciones = [...new Set((Array.isArray(body.secciones) ? body.secciones : []).map(String))];
      if (secciones.some((s) => !SECCION_RE.test(s) || s === "usuarios")) {
        return json({ error: "invalid_section" }, 400);
      }
    }

    // ── ¿Ya existe la cuenta? ──────────────────────────────────────────────────
    const { data: existentes, error: eFind } = await supabase.rpc("admin_find_user_by_email", { p_email: email });
    if (eFind) throw eFind;
    const existente = existentes?.[0];
    if (existente) {
      if (!esStaff)           return json({ error: "email_exists" }, 409);
      if (existente.is_staff) return json({ error: "already_staff" }, 409);
      const { error: eIns } = await supabase.from("admin_users")
        .insert({ user_id: existente.id, role: tipo, sections: secciones });
      if (eIns) throw eIns;
      return json({ id: existente.id, existente: true, invitado: false });
    }

    // ── Alta + mail de invitación ──────────────────────────────────────────────
    const { data: invitado, error: eInv } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name: nombre, team, phone },
      redirectTo: redirect,
    });
    if (eInv || !invitado?.user) {
      const msg = String(eInv?.message || "");
      if (/rate limit/i.test(msg)) return json({ error: "rate_limit" }, 429);
      if (/already|exists|registered/i.test(msg)) return json({ error: "email_exists" }, 409);
      throw eInv ?? new Error("invite_failed");
    }

    if (esStaff) {
      const { error: eIns } = await supabase.from("admin_users")
        .insert({ user_id: invitado.user.id, role: tipo, sections: secciones });
      if (eIns) {
        // Sin rol no sirve: deshacemos el alta para no dejar una cuenta suelta.
        await supabase.auth.admin.deleteUser(invitado.user.id);
        throw eIns;
      }
    }

    return json({ id: invitado.user.id, existente: false, invitado: true });
  } catch (err) {
    console.error("[admin-create-user]", err?.message || err);
    return json({ error: "server_error", detail: err?.message ?? String(err) }, 500);
  }
});
