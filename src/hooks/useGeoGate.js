import { useState, useCallback, useEffect } from "react";
import { BAR_LAT, BAR_LNG, GEO_RADIUS } from "../constants/theme";

// ─── Distancia Haversine en metros ────────────────────────────────────────────
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * useGeoGate
 * Verifica que el usuario esté dentro del radio del bar.
 *
 * Estados posibles:
 *   "idle"        → no se ha pedido permiso todavía
 *   "checking"    → solicitando ubicación
 *   "ok"          → dentro del radio → acceso completo
 *   "far"         → fuera del radio → solo carta
 *   "denied"      → permiso rechazado → solo carta
 *   "unavailable" → GPS no disponible → solo carta
 *   "error"       → timeout u otro error → solo carta
 */
export function useGeoGate() {
  const [geoState,   setGeoState]   = useState("idle");
  const [distMeters, setDistMeters] = useState(null);
  const [loading,    setLoading]    = useState(false);

  const check = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState("unavailable");
      return;
    }
    setLoading(true);
    setGeoState("checking");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const dist = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          BAR_LAT,
          BAR_LNG
        );
        setDistMeters(Math.round(dist));
        setGeoState(dist <= GEO_RADIUS ? "ok" : "far");
        setLoading(false);
      },
      (err) => {
        setGeoState(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }, []);

  const isRestricted = geoState !== "ok";
  const isChecking   = geoState === "checking";

  return { geoState, distMeters, isRestricted, isChecking, loading, retry: check };
}
