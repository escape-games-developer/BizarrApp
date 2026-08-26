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

async function fetchFromYouTube(playlistId) {
  if (!YT_KEY || !playlistId) return [];
  const videos = [];
  let pageToken = null;
  let pages = 0;
  do {
    const params = new URLSearchParams({
      part: "snippet", playlistId, maxResults: "50", key: YT_KEY,
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await fetch(`${YT_BASE}/playlistItems?${params}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (data.error) return [];
    videos.push(...(data.items || [])
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
  return videos.sort((a, b) => a.position - b.position);
}

export function useYouTubePlaylists(config = {}) {
  const [playlists, setPlaylists] = useState(emptyPlaylists);
  const [sources, setSources] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const configKey = JSON.stringify(config);

  const load = useCallback(async () => {
    setLoading(true);
    const next = emptyPlaylists();
    const nextSources = {};
    await Promise.all(TYPES.map(async (type) => {
      const playlistId = config[type];
      if (!playlistId || !YT_KEY) return;
      try {
        next[type] = await fetchFromYouTube(playlistId);
        if (next[type].length) nextSources[type] = "youtube";
      } catch {
        next[type] = [];
      }
    }));
    setPlaylists(next);
    setSources(nextSources);
    setLastSync(new Date());
    setLoading(false);
  }, [configKey]);

  useEffect(() => { load(); }, [load]);
  const totalVideos = Object.values(playlists).reduce((total, list) => total + list.length, 0);
  return { playlists, sources, loading, lastSync, totalVideos, refresh: load };
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
