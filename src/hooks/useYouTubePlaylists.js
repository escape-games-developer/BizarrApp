import { useState, useEffect, useCallback } from "react";

const YT_KEY = import.meta.env?.VITE_YOUTUBE_API_KEY;
const YT_BASE = "https://www.googleapis.com/youtube/v3";
const TYPES = ["videos", "karaoke", "ftl", "pt", "duelo"];

function emptyPlaylists() {
  return Object.fromEntries(TYPES.map((type) => [type, []]));
}

function extractArtist(title) {
  for (const separator of [" - ", " – ", " · ", " | "]) {
    if (title.includes(separator)) return title.split(separator)[0].trim();
  }
  return null;
}

/**
 * Id de una playlist de YouTube, a partir de un link o del id pelado.
 * Acepta: youtube.com/playlist?list=XXX, cualquier watch?v=…&list=XXX,
 * youtube.com/embed/videoseries?list=XXX, o XXX directo.
 */
export function extractPlaylistId(input) {
  if (!input) return null;
  const u = String(input).trim();
  const m = u.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  // Los ids de playlist arrancan con PL/UU/LL/FL/OL/RD, o son un id de canal.
  return /^[a-zA-Z0-9_-]{12,}$/.test(u) ? u : null;
}

/** Traduce el error de la API a algo que el operador pueda accionar. */
function mensajeErrorYt(status, data) {
  const reason = data?.error?.errors?.[0]?.reason || "";
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
    return "Se agotó la cuota diaria de la API de YouTube. Probá mañana o usá otra API key.";
  }
  if (reason === "playlistNotFound" || status === 404) {
    return "La playlist no existe, es privada o el link está mal.";
  }
  if (status === 403) return "La API de YouTube rechazó la consulta (API key sin permisos o restringida).";
  if (status === 400) return "El id de playlist no tiene un formato válido.";
  return data?.error?.message || `La API de YouTube respondió ${status}.`;
}

/**
 * Lee una playlist de YouTube completa (hasta 3 páginas = 150 temas).
 *
 * Devuelve { videos, error }. Es el ÚNICO lector de playlists del proyecto:
 * lo usan el hook de acá y el importador de Admin › Playlists YouTube, para
 * que no existan dos implementaciones de paginado y de thumbnails.
 */
export async function fetchYoutubePlaylist(playlistIdOrUrl) {
  const playlistId = extractPlaylistId(playlistIdOrUrl);
  if (!playlistId) return { videos: [], error: "No se reconoció un id de playlist en lo que pegaste." };
  if (!YT_KEY) {
    return { videos: [], error: "Falta la API key de YouTube (VITE_YOUTUBE_API_KEY) en este entorno." };
  }
  const videos = [];
  let pageToken = null;
  let pages = 0;
  try {
    do {
      const params = new URLSearchParams({
        part: "snippet", playlistId, maxResults: "50", key: YT_KEY,
        ...(pageToken ? { pageToken } : {}),
      });
      const response = await fetch(`${YT_BASE}/playlistItems?${params}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) {
        return { videos: [], error: mensajeErrorYt(response.status, data) };
      }
      videos.push(...(data.items || [])
        .filter((item) => item.snippet?.resourceId?.videoId)
        // Los borrados y privados vienen con título fijo y sin video usable.
        .filter((item) => !["Deleted video", "Private video"].includes(item.snippet.title))
        .map((item) => ({
          id: item.snippet.resourceId.videoId,
          ytId: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          artist: extractArtist(item.snippet.title),
          thumb: item.snippet.thumbnails?.medium?.url || ytThumb(item.snippet.resourceId.videoId),
          position: item.snippet.position,
          source: "youtube",
        })));
      pageToken = data.nextPageToken || null;
      pages += 1;
    } while (pageToken && pages < 3);
  } catch (err) {
    return { videos: [], error: err?.message || "No se pudo contactar a YouTube." };
  }
  if (!videos.length) {
    return { videos: [], error: "La playlist no tiene videos reproducibles (¿vacía o toda privada?)." };
  }
  // El orden de YouTube es el que vale: es el que espera ver el operador.
  return { videos: videos.sort((a, b) => a.position - b.position), error: null };
}


export function useYouTubePlaylists(config = {}) {
  const [playlists, setPlaylists] = useState(emptyPlaylists);
  const [sources, setSources] = useState({});
  // `errors` ya lo destructuraba PantallaView y siempre le llegaba vacío
  // porque el hook nunca lo devolvía: los fallos de YouTube quedaban mudos.
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const configKey = JSON.stringify(config);

  const load = useCallback(async () => {
    setLoading(true);
    const next = emptyPlaylists();
    const nextSources = {};
    const nextErrors = {};
    await Promise.all(TYPES.map(async (type) => {
      const playlistId = config[type];
      if (!playlistId) return;
      try {
        const { videos, error } = await fetchYoutubePlaylist(playlistId);
        next[type] = videos;
        if (videos.length) nextSources[type] = "youtube";
        if (error) nextErrors[type] = error;
      } catch (err) {
        next[type] = [];
        nextErrors[type] = err?.message || "Error leyendo la playlist de YouTube.";
      }
    }));
    setPlaylists(next);
    setSources(nextSources);
    setErrors(nextErrors);
    setLastSync(new Date());
    setLoading(false);
  }, [configKey]);

  useEffect(() => { load(); }, [load]);
  const totalVideos = Object.values(playlists).reduce((total, list) => total + list.length, 0);
  return { playlists, sources, errors, loading, lastSync, totalVideos, refresh: load };
}

const CONFIG_KEY = "bizarrapp_yt_config";
export const PLAYLIST_TYPES = [
  { id:"videos", label:"Videos Musicales", icon:"🎵", desc:"Para Mandalo a Pantalla", module:"Módulo 5" },
  { id:"karaoke", label:"Si lo sabe cante", icon:"🎤", desc:"Pistas con letra", module:"Módulo 4 — Escenario" },
  { id:"ftl", label:"Follow the Leader", icon:"💃", desc:"Videos estilo Just Dance", module:"Módulo 4 — Escenario" },
  { id:"pt", label:"Personal Trainer", icon:"🏋️", desc:"Videos de gym dance", module:"Módulo 4 — Escenario" },
  { id:"duelo", label:"Duelo de Talentos", icon:"⚔️", desc:"Canciones para el duelo", module:"Módulo 4 — Escenario" },
];

export function useYouTubePlaylistAdmin() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"); }
    catch { return {}; }
  });
  const updatePlaylistId = useCallback((type, playlistId) => setConfig((current) => {
    const next = { ...current, [type]: playlistId.trim() };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }), []);
  const removePlaylistId = useCallback((type) => setConfig((current) => {
    const next = { ...current };
    delete next[type];
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  }), []);
  return { config, updatePlaylistId, removePlaylistId };
}

export const ytThumb = (id) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
export const ytWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

export function parsePlaylistId(input) {
  if (!input) return null;
  const value = input.trim();
  if (/^PL[A-Za-z0-9_-]+$/.test(value)) return value;
  try { return new URL(value).searchParams.get("list") || null; }
  catch { return null; }
}

export async function searchYouTube(query, maxResults = 10) {
  if (!YT_KEY || !query || query.trim().length < 2) return { results: [], source: YT_KEY ? "youtube" : "no_key" };
  try {
    const url = new URL(`${YT_BASE}/search`);
    Object.entries({ part:"snippet", type:"video", videoEmbeddable:"true", maxResults:String(maxResults), q:query, key:YT_KEY })
      .forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) return { results: [], source: "error" };
    const data = await response.json();
    return {
      source: "youtube",
      results: (data.items || []).filter((item) => item.id?.videoId).map((item) => ({
        ytId: item.id.videoId,
        title: item.snippet?.title || "",
        artist: item.snippet?.channelTitle || "",
        thumb: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || "",
        publishedAt: item.snippet?.publishedAt,
      })),
    };
  } catch {
    return { results: [], source: "error" };
  }
}
