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

// Singleton — una sola instancia en toda la app
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,   // sesión persiste en localStorage
    autoRefreshToken:  true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,     // throttle para no saturar con 180 usuarios
    },
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
