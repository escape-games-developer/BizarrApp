export const createTvBlock = (overrides = {}) => ({
  visible: true,
  x: 5,
  y: 5,
  w: 25,
  h: 15,
  z: 2,
  opacity: 1,
  bg: { mode: "none", color: "#111111", image: null, opacity: 1 },
  border: { enabled: false, width: 1, color: "#ffffff" },
  shadow: { enabled: false, strength: "soft" },
  radius: 8,
  font: {
    family: "inherit",
    align: "center",
    titleSize: null,
    titleWeight: "bold",
    artistSize: null,
    scoreSize: null,
    titleColor: null,
    artistColor: null,
    scoreColor: null,
  },
  content: { text: "", textPosition: "bottom", textSize: 16, textColor: "#ffffff", bold: true },
  ...overrides,
});

export const TV_BLOCKS = [
  { id: "video", label: "Video / Reproductor" },
  { id: "logo", label: "Logo" },
  { id: "qr", label: "QR de votación" },
  { id: "upcoming", label: "Próximas canciones" },
  { id: "nowPlaying", label: "Título + Artista" },
  { id: "progress", label: "Barra de progreso" },
  { id: "header", label: "Header (nombre + código)" },
  { id: "statusPills", label: "Pastillas de estado" },
  { id: "gifPrize", label: "GIF a Pantalla (premio)" },
  { id: "transition", label: "Transición entre canciones" },
  { id: "votingClosed", label: "Aviso de votación cerrada" },
  { id: "kickCounter", label: "Contador Sacar Tema 👎" },
  { id: "teamScore", label: "Marcador de equipos" },
];

export const DEFAULT_TV_CONFIG = {
  version: 1,
  screen: {
    backgroundMode: "none",
    backgroundColor: "#000000",
    backgroundImage: null,
    overlay: { enabled: false, url: null, opacity: 1 },
    reactionEmojiSize: "medium",
  },
  blocks: {
    video: createTvBlock({ x: 0, y: 0, w: 100, h: 100, z: 1, border: { enabled: false, width: 0, color: "#ffffff" } }),
    logo: createTvBlock({ x: 1.5, y: 2, w: 14, h: 14, z: 3, bg: { mode: "image", color: "#111111", image: "/logo.png", opacity: 1 }, content: { text: "", textPosition: "bottom", textSize: 16, textColor: "#ffffff", bold: true } }),
    qr: createTvBlock({ x: 2, y: 61, w: 16, h: 35, z: 3, content: {
      text: "ESCANEÁ PARA VOTAR", textPosition: "top", textSize: 16,
      textColor: "#FFD600", bold: true, showCode: false, showSubtitle: false,
      subtitle: "Entrá y votá…", labelFont: "inherit", labelSize: 18,
      labelColor: "#FFD600", codeFont: "inherit", codeSize: null,
      codeColor: "#FFD600",
    } }),
    upcoming: createTvBlock({ x: 79, y: 61, w: 19, h: 35, z: 3, bg: { mode: "color", color: "#111111", image: null, opacity: 0.65 }, border: { enabled: false, width: 1, color: "#ffd500" }, shadow: { enabled: true, strength: "soft" }, radius: 15, font: { family: "poppins", align: "left", titleSize: 15, titleWeight: "normal", artistSize: null, scoreSize: null, titleColor: null, artistColor: null, scoreColor: null } }),
    nowPlaying: createTvBlock({ x: 20, y: 2, w: 58, h: 10, z: 3 }),
    progress: createTvBlock({ x: 20, y: 14, w: 58, h: 5, z: 3 }),
    header: createTvBlock({ x: 79, y: 2, w: 19, h: 8, z: 3 }),
    statusPills: createTvBlock({ x: 79, y: 12, w: 19, h: 8, z: 3 }),
    gifPrize: createTvBlock({ x: 2, y: 25, w: 16, h: 32, z: 4 }),
    transition: createTvBlock({ x: 35, y: 35, w: 30, h: 25, z: 8, visible: false }),
    votingClosed: createTvBlock({ x: 22, y: 86, w: 54, h: 10, z: 6, bg: { mode: "color", color: "#e67e22", image: null, opacity: 1 } }),
    kickCounter: createTvBlock({ x: 32, y: 75, w: 36, h: 8, z: 7, bg: { mode: "color", color: "#ef4444", image: null, opacity: 1 } }),
    teamScore: createTvBlock({ x: 79, y: 48, w: 19, h: 10, z: 4 }),
  },
  customBlocks: {},
};

const guestBlock = () => ({
  visible: true,
  bg: { mode: "none", color: null, image: null },
  border: { width: 0, color: "#ffffff" },
  shadow: { enabled: false },
  font: { size: "medium", family: "inherit", color: "#ffffff", bold: true, align: "center" },
});

export const DEFAULT_GUEST_CONFIG = {
  version: 1,
  screen: { backgroundMode: "none", backgroundColor: null, backgroundImage: null, logoSizePx: 80, iconScale: { small: 20, medium: 30, large: 40 } },
  order: ["header", "rewardsButton", "reactionsBar", "nowPlaying", "songList", "voteButtons"],
  blocks: {
    header: guestBlock(), rewardsButton: guestBlock(), reactionsBar: guestBlock(),
    nowPlaying: guestBlock(), songList: guestBlock(), voteButtons: guestBlock(),
    rewardsModal: guestBlock(), winPopup: guestBlock(),
  },
};

export function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}
