// Contrato de las columnas type / published_at / cta_* de `banners`
// (migración 20261013220000). Lo comparten la card del cliente y el admin.

export const NEWS_TYPES = ["PROMO", "DESTACADO", "EVENTO", "PROXIMAMENTE"];

// Etiqueta corta para selects y tabla del admin.
export const TYPE_LABEL = {
  PROMO:        "Promo",
  DESTACADO:    "Destacado",
  EVENTO:       "Evento",
  PROXIMAMENTE: "Próximamente",
};

// Texto del badge de la card del cliente.
export const TYPE_BADGE = {
  PROMO:        "PROMO",
  DESTACADO:    "DESTACADO",
  EVENTO:       "EVENTO",
  PROXIMAMENTE: "PRÓXIMAMENTE",
};

export const CTA_LABEL = {
  CONSULTAR:   "Consultar",
  VER_DETALLE: "Ver detalle",
};

// Las promos invitan a consultar; el resto, a ver el detalle.
export const ctaModeFor = (type) => (type === "PROMO" ? "CONSULTAR" : "VER_DETALLE");

export const newsType = (b) => (NEWS_TYPES.includes(b?.type) ? b.type : "DESTACADO");

// Fecha de la novedad en ISO (YYYY-MM-DD). Las filas anteriores a la
// migración no tienen published_at: se usa la fecha de alta.
export const newsDate = (b) =>
  String(b?.published_at || b?.created_at || "").slice(0, 10);

export const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export const formatDateDMY = (iso) => {
  const s = String(iso || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

export const isHttpUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

// Extracto de la card: espacios colapsados y corte a `max` caracteres.
export const NEWS_EXCERPT_MAX = 133;

export const truncateText = (text, max = NEWS_EXCERPT_MAX) => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max).trimEnd()}…`;
};
