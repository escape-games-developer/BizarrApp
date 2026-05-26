import { useState, useCallback } from "react";

// ─── Simulación de base de datos de usuarios ─────────────────────────────────
// En producción: reemplazar con llamadas a API + JWT
// Clave: email (lowercase) → { passwordHash, profile }
const USER_STORE_KEY = "bizarrapp_users";
const SESSION_KEY    = "bizarrapp_session";

function getStore() {
  try {
    return JSON.parse(localStorage.getItem(USER_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveStore(store) {
  localStorage.setItem(USER_STORE_KEY, JSON.stringify(store));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

/**
 * useAuth
 * Maneja registro, login y sesión persistente.
 *
 * En producción: reemplazar localStorage con:
 *   - Supabase Auth  →  supabase.auth.signUp / signInWithPassword
 *   - Firebase Auth  →  createUserWithEmailAndPassword / signInWithEmailAndPassword
 *   - API propia     →  fetch('/api/auth/...')
 */
export function useAuth() {
  const [user,    setUser]    = useState(() => getSession());
  const [regStep, setRegStep] = useState(() => getSession()?.registered ? 5 : 1);

  // ── Registro ────────────────────────────────────────────────────────────────
  const register = useCallback((profile, password) => {
    const key   = profile.email.toLowerCase().trim();
    const store = getStore();

    if (store[key]) {
      return { ok: false, error: "Este email ya está registrado." };
    }

    // Simular hash de contraseña (en producción: bcrypt en el backend)
    const entry = { password, profile: { ...profile, registered: true } };
    store[key] = entry;
    saveStore(store);

    // Guardar sesión
    localStorage.setItem(SESSION_KEY, JSON.stringify(entry.profile));
    setUser(entry.profile);
    setRegStep(5);

    // Simular envío de email de bienvenida
    console.info(
      `[BizarrApp] Email enviado a ${profile.email}: ¡Bienvenido, ${profile.name}!`
    );

    return { ok: true };
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback((email, password) => {
    const key   = email.toLowerCase().trim();
    const store = getStore();
    const entry = store[key];

    if (!entry)                   return { ok: false, error: "No encontramos ese email." };
    if (entry.password !== password) return { ok: false, error: "Contraseña incorrecta." };

    localStorage.setItem(SESSION_KEY, JSON.stringify(entry.profile));
    setUser(entry.profile);
    setRegStep(5);
    return { ok: true };
  }, []);

  // ── Actualizar perfil ───────────────────────────────────────────────────────
  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      // También actualizar en el store
      if (next.email) {
        const store = getStore();
        const key   = next.email.toLowerCase();
        if (store[key]) {
          store[key].profile = next;
          saveStore(store);
        }
      }
      return next;
    });
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
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
    isLoggedIn: !!user?.registered,
  };
}
