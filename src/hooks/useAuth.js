import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const SESSION_KEY = "bizarrapp_session";

export function useAuth() {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  });
  const [regStep, setRegStep] = useState(() =>
    user?.registered ? 5 : 1
  );
  const [loading, setLoading] = useState(false);

  // Escuchar cambios de sesión de Supabase
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          localStorage.removeItem(SESSION_KEY);
          setUser(null);
          setRegStep(1);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // ── Registro ────────────────────────────────────────────────────────────────
  const register = useCallback(async (profile, password) => {
    setLoading(true);
    try {
      // 1. Crear usuario en Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: profile.email.toLowerCase().trim(),
        password,
      });

      if (error) return { ok: false, error: error.message };

      const userId = data.user?.id;
      if (!userId) return { ok: false, error: "Error al crear usuario." };

      // 2. Guardar perfil en tabla profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id:      userId,
          name:         profile.name,
          team:         profile.team,
          avatar_id:    profile.avatarId    || null,
          avatar_emoji: profile.avatarEmoji || null,
          photo_url:    profile.photoUrl    || null,
          phone:        profile.phone       || null,
          geo_ok:       false,
          registered:   true,
        });

      if (profileError) {
        console.error("[useAuth] Error guardando perfil:", profileError);
      }

      // 3. Guardar sesión local
      const fullProfile = { ...profile, id: userId, registered: true };
      localStorage.setItem(SESSION_KEY, JSON.stringify(fullProfile));
      setUser(fullProfile);
      setRegStep(5);

      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) return { ok: false, error: "Email o contraseña incorrectos." };

      // Buscar perfil en la tabla profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();

      const fullProfile = profileData
        ? {
            id:           data.user.id,
            name:         profileData.name,
            email:        email.toLowerCase().trim(),
            team:         profileData.team,
            avatarId:     profileData.avatar_id,
            avatarEmoji:  profileData.avatar_emoji,
            photoUrl:     profileData.photo_url,
            geoOk:        profileData.geo_ok,
            registered:   true,
          }
        : { id: data.user.id, email: email.toLowerCase().trim(), registered: true };

      localStorage.setItem(SESSION_KEY, JSON.stringify(fullProfile));
      setUser(fullProfile);
      setRegStep(5);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Actualizar perfil ───────────────────────────────────────────────────────
  const updateUser = useCallback(async (updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      return next;
    });
    // Sincronizar con Supabase si hay user_id
    if (user?.id) {
      const dbUpdates = {};
      if (updates.name)         dbUpdates.name         = updates.name;
      if (updates.team)         dbUpdates.team         = updates.team;
      if (updates.avatarId)     dbUpdates.avatar_id    = updates.avatarId;
      if (updates.avatarEmoji)  dbUpdates.avatar_emoji = updates.avatarEmoji;
      if (updates.geoOk !== undefined) dbUpdates.geo_ok = updates.geoOk;
      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from("profiles").update(dbUpdates).eq("user_id", user.id);
      }
    }
  }, [user?.id]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    setRegStep(1);
  }, []);

  return {
    user,
    regStep,
    setRegStep,
    register,
    login,
    updateUser,
    logout,
    loading,
    isLoggedIn: !!user?.registered,
  };
}