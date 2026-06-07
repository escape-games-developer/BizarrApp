import { createClient } from "@supabase/supabase-js";

// Variables de entorno — crear archivo .env en la raíz:
//   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.\n" +
    "Crear archivo .env en la raíz del proyecto."
  );
}

// Cliente con auth persistente — usado por AdminPanel para writes (necesita auth.uid())
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

// Cliente anónimo puro — lecturas y Realtime sin sesión de auth.
// Usado por useGameState, useMessages, etc. para que /pantalla y /
// no hereden ni intenten refrescar tokens del admin.
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    false,
    autoRefreshToken:  false,
    detectSessionInUrl: false,
    storageKey:        "sb-anon",   // evita "Multiple GoTrueClient instances"
  },
  realtime: {
    params: { eventsPerSecond: 20 },
  },
});

// Helper: obtener sesión activa
export async function getActiveSession() {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, label, date")
    .eq("is_active", true)
    .single();
  if (error) throw error;
  return data;
}

// Helper: verificar si el usuario actual es admin
export async function checkIsAdmin() {
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .single();
  return !!data;
}
