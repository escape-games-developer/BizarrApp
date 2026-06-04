import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

const SESSION_KEY = "bizarrapp_session";

export function useAuth() {
  const [user,    setUser]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  });
  const [regStep, setRegStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Restaurar sesión al recargar ────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // No hay sesión activa en Supabase → limpiar localStorage
        localStorage.removeItem(SESSION_KEY);
        setUser(null);
        setRegStep(1);
        return;
      }

      // Hay sesión → buscar perfil actualizado desde la BD
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        const fullProfile = {
          id:          session.user.id,
          email:       session.user.email,
          name:        profile.name,
          team:        profile.team,
          avatarId:    profile.avatar_id,
          avatarEmoji: profile.avatar_emoji,
          photoUrl:    profile.photo_url,
          geoOk:       profile.geo_ok,
          registered:  profile.registered,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(fullProfile));
        setUser(fullProfile);
        setRegStep(fullProfile.registered ? 5 : 1);
      }
    };

    restoreSession();

    // Escuchar cambios de sesión
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

      // 2. Upsert perfil en tabla profiles (id = userId, no user_id)
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
          id:           userId,
          name:         profile.name,
          team:         profile.team         || null,
          avatar_id:    profile.avatarId     || null,
          avatar_emoji: profile.avatarEmoji  || null,
          photo_url:    profile.photoUrl     || null,
          phone:        profile.phone        || null,
          geo_ok:       profile.geoOk        || false,
          registered:   true,
        });

      if (profileError) {
        console.error("[useAuth] Error guardando perfil:", profileError);
      }

      // 3. Guardar sesión local
      const fullProfile = {
        ...profile,
        id:         userId,
        registered: true,
      };
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

      // Buscar perfil — clave es id, no user_id
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      const fullProfile = profileData
        ? {
            id:          data.user.id,
            email:       email.toLowerCase().trim(),
            name:        profileData.name,
            team:        profileData.team,
            avatarId:    profileData.avatar_id,
            avatarEmoji: profileData.avatar_emoji,
            photoUrl:    profileData.photo_url,
            geoOk:       profileData.geo_ok,
            registered:  profileData.registered,
          }
        : {
            id:         data.user.id,
            email:      email.toLowerCase().trim(),
            registered: false,
          };

      localStorage.setItem(SESSION_KEY, JSON.stringify(fullProfile));
      setUser(fullProfile);
      setRegStep(fullProfile.registered ? 5 : 1);
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

    if (user?.id) {
      const dbUpdates = {};
      if (updates.name         !== undefined) dbUpdates.name         = updates.name;
      if (updates.team         !== undefined) dbUpdates.team         = updates.team;
      if (updates.avatarId     !== undefined) dbUpdates.avatar_id    = updates.avatarId;
      if (updates.avatarEmoji  !== undefined) dbUpdates.avatar_emoji = updates.avatarEmoji;
      if (updates.photoUrl     !== undefined) dbUpdates.photo_url    = updates.photoUrl;
      if (updates.phone        !== undefined) dbUpdates.phone        = updates.phone;
      if (updates.geoOk        !== undefined) dbUpdates.geo_ok       = updates.geoOk;
      if (updates.registered   !== undefined) dbUpdates.registered   = updates.registered;

      if (Object.keys(dbUpdates).length > 0) {
        // Clave es id, no user_id
        await supabase.from("profiles").update(dbUpdates).eq("id", user.id);
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