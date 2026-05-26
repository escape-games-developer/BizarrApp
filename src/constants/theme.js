// ─── Paleta BizarrApp ─────────────────────────────────────────────────────────
export const C = {
  dark:   "#0A0500",
  dark2:  "#1A0A00",
  dark3:  "#2A1200",
  yellow: "#FFD700",
  amber:  "#F59E0B",
  white:  "#F5E6C0",
  gray:   "#A08060",
  pink:   "#EC4899",
  green:  "#22C55E",
  purple: "#A855F7",
  blue:   "#60A5FA",
  red:    "#EF4444",
  teal:   "#06B6D4",
};

// ─── Equipos ──────────────────────────────────────────────────────────────────
export const TEAMS = {
  batata: {
    id: "batata",
    name: "Team Batata",
    emoji: "🍠",
    color: "#F97316",
    colorB: "#EA580C",
    bg: "rgba(249,115,22,.14)",
    border: "rgba(249,115,22,.4)",
  },
  membrillo: {
    id: "membrillo",
    name: "Team Membrillo",
    emoji: "🍋",
    color: "#EAB308",
    colorB: "#CA8A04",
    bg: "rgba(234,179,8,.14)",
    border: "rgba(234,179,8,.4)",
  },
};

// ─── Geolocalización ──────────────────────────────────────────────────────────
// ⚠️ Reemplazar con coordenadas reales del bar
export const BAR_LAT    = -34.60927;  // Av. Hipólito Yrigoyen 851, CABA
export const BAR_LNG    = -58.378576; // Av. Hipólito Yrigoyen 851, CABA
export const GEO_RADIUS = 100; // metros

// ─── Avatares preset ──────────────────────────────────────────────────────────
export const PRESET_AVATARS = [
  { id: "a1",  emoji: "🦁", bg: ["#EF4444","#B91C1C"] },
  { id: "a2",  emoji: "🐯", bg: ["#F59E0B","#B45309"] },
  { id: "a3",  emoji: "🦊", bg: ["#F97316","#C2410C"] },
  { id: "a4",  emoji: "🐺", bg: ["#8B5CF6","#6D28D9"] },
  { id: "a5",  emoji: "🦋", bg: ["#EC4899","#BE185D"] },
  { id: "a6",  emoji: "🐬", bg: ["#06B6D4","#0E7490"] },
  { id: "a7",  emoji: "🦅", bg: ["#3B82F6","#1D4ED8"] },
  { id: "a8",  emoji: "🐉", bg: ["#10B981","#065F46"] },
  { id: "a9",  emoji: "🦄", bg: ["#A855F7","#7E22CE"] },
  { id: "a10", emoji: "🐻", bg: ["#84CC16","#3F6212"] },
  { id: "a11", emoji: "🦈", bg: ["#64748B","#334155"] },
  { id: "a12", emoji: "🌙", bg: ["#FFD700","#B45309"] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const rand     = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
export const ytThumb  = (id)   => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
