import { useState, useEffect, useCallback } from "react";

// ─── Fallback hardcodeado — funciona sin WiFi ─────────────────────────────────
// Reemplazar ytId con IDs reales del canal del bar.
// Estos son los que aparecen si YouTube no está disponible.
export const FALLBACK_PLAYLISTS = {

  // ── 50 VIDEOS MUSICALES ────────────────────────────────────────────────────
  // Para Mandalo a Pantalla — mezcla pop/rock/electro/latino, décadas 80s-2020s
  videos: [
    // 2020s
    { ytId:"OPf0YbXqDm0", title:"Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",             artist:"Mark Ronson"         },
    { ytId:"JGwWNGJdvx8", title:"Ed Sheeran - Shape of You (Official Music Video)",                artist:"Ed Sheeran"         },
    { ytId:"ktvTqknDobU", title:"Imagine Dragons - Radioactive",                  artist:"Imagine Dragons"         },
    { ytId:"09R8_2nJtjg", title:"Maroon 5 - Sugar (Official Music Video)",                artist:"Maroon 5"       },
    { ytId:"hT_nvWreIhg", title:"OneRepublic - Counting Stars",              artist:"OneRepublic"        },
    { ytId:"RgKAFK5djSk", title:"Wiz Khalifa - See You Again ft. Charlie Puth [Official Video] Furious 7 Soundtrack",               artist:"Wiz Khalifa"        },
    { ytId:"CevxZvSJLk8", title:"Katy Perry - Roar",                        artist:"Katy Perry"         },
    { ytId:"nfWlot6h_JM", title:"Taylor Swift - Shake It Off",    artist:"Taylor Swift"       },
    { ytId:"2Vv-BfVoq4g", title:"Ed Sheeran - Perfect (Official Music Video)",                     artist:"Ed Sheeran"         },
    { ytId:"lWA2pjMjpBs", title:"Rihanna - Diamonds",             artist:"Rihanna"    },
    // 2010s
    { ytId:"pRpeEdMmmQ0", title:"Shakira - Waka Waka (This Time for Africa) (The Official 2010 FIFA World Cup™ Song)",                   artist:"Shakira"            },
    { ytId:"YqeW9_5kURI", title:"Major Lazer & DJ Snake - Lean On (feat. MØ) [Official 4K Music Video]",           artist:"Major Lazer & DJ Snake"              },
    { ytId:"dQw4w9WgXcQ", title:"Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",     artist:"Rick Astley"        },
    { ytId:"fRh_vgS2dFE", title:"Justin Bieber - Sorry (PURPOSE : The Movement)",                       artist:"Justin Bieber"      },
    { ytId:"PT2_F-1esPk", title:"The Chainsmokers - Closer (Lyric) ft. Halsey",               artist:"The Chainsmokers"                },
    { ytId:"7PCkvCPvDXk", title:"Meghan Trainor - All About That Bass (Official Video)",                    artist:"Meghan Trainor"   },
    { ytId:"bx1Bh8ZvH84", title:"Oasis - Wonderwall (Official Video)",artist:"Oasis"             },
    { ytId:"SlPhMPnQ58k", title:"Maroon 5 - Memories (Official Video)",                    artist:"Maroon 5"       },
    { ytId:"uelHwf8o7_U", title:"Eminem - Love The Way You Lie ft. Rihanna",           artist:"Eminem"           },
    // 2000s
    { ytId:"fJ9rUzIMcZQ", title:"Queen – Bohemian Rhapsody (Official Video Remastered)",           artist:"Queen"              },
    { ytId:"8UVNT4wvIGY", title:"Gotye - Somebody That I Used To Know (feat. Kimbra) [Official Music Video]",               artist:"Gotye"            },
    { ytId:"Gs069dndIYk", title:"Earth, Wind & Fire - September (Official HD Video)",               artist:"Earth, Wind & Fire"            },
    { ytId:"YkADj0TPrJA", title:"Phil Collins - In The Air Tonight (Official Music Video)",                    artist:"Phil Collins"       },
    { ytId:"9bZkp7q19f0", title:"PSY - GANGNAM STYLE(강남스타일) M/V",               artist:"PSY"               },
    // 90s
    { ytId:"kXYiU_JCYtU", title:"Numb (Official Music Video) [4K UPGRADE] – Linkin Park",           artist:"Numb (Official Music Video) [4K UPGRADE]"              },
    { ytId:"1k8craCGpgs", title:"Journey - Don't Stop Believin' (Official Audio)",           artist:"Journey"       },
    { ytId:"djV11Xbc914", title:"a-ha - Take On Me (Official Video) [4K]",           artist:"a-ha"              },
    { ytId:"y6Sxv-sUYtM", title:"Pharrell Williams - Happy (Official Music Video)",                        artist:"Pharrell Williams"         },
    { ytId:"PIb6AZdTr-A", title:"Cyndi Lauper - Girls Just Want To Have Fun (Official Video)",            artist:"Cyndi Lauper"          },
    { ytId:"4fndeDfaWCg", title:"Backstreet Boys - I Want It That Way (Official HD Video)",                    artist:"Backstreet Boys"        },
    { ytId:"NUsoVlDFqZg", title:"Enrique Iglesias - Bailando ft. Descemer Bueno, Gente De Zona",           artist:"Enrique Iglesias"               },
    { ytId:"3JZ4pnNtyxQ", title:"Fleur East - Sax (Official Video)",                   artist:"Fleur East"             },
    { ytId:"KQ6zr6kCPj8", title:"LMFAO - Party Rock Anthem ft. Lauren Bennett, GoonRock",                        artist:"LMFAO"     },
    { ytId:"wyx6JDQCslE", title:"LMFAO - Sexy and I Know It",                    artist:"LMFAO"          },
    // Latino / Cumbia / Reggaeton
    { ytId:"kOkQ4T5WO9E", title:"Calvin Harris, Rihanna - This Is What You Came For (Official Video)",                   artist:"Calvin Harris, Rihanna"       },
    { ytId:"HCjNJDNzw8Y", title:"Camila Cabello - Havana (Audio) ft. Young Thug",                    artist:"Camila Cabello"           },
    { ytId:"jofNR_WkoCE", title:"Ylvis - The Fox (What Does The Fox Say?) [Official music video HD]",                   artist:"Ylvis"           },
    // Clásicos rock
    { ytId:"5anLPw0Efmo", title:"Evanescence - My Immortal (Official HD Music Video)",              artist:"Evanescence"       },
    { ytId:"tVj0ZTS4WF4", title:"Weird russian singer - Chum Drum Bedrum",          artist:"Weird russian singer"           },
  ],

  // ── 50 KARAOKE ────────────────────────────────────────────────────────────
  // Para Si lo sabe cante — pistas conocidas, aptas para cantar en público
  karaoke: [
    // Hits mega populares (todos los conocen)
    { ytId:"kXYiU_JCYtU", title:"Numb (Official Music Video) [4K UPGRADE] – Linkin Park",           artist:"Numb (Official Music Video) [4K UPGRADE]"              },
    { ytId:"fJ9rUzIMcZQ", title:"Queen – Bohemian Rhapsody (Official Video Remastered)",           artist:"Queen"              },
    { ytId:"dQw4w9WgXcQ", title:"Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",     artist:"Rick Astley"        },
    { ytId:"5anLPw0Efmo", title:"Evanescence - My Immortal (Official HD Music Video)",              artist:"Evanescence"       },
    { ytId:"tVj0ZTS4WF4", title:"Weird russian singer - Chum Drum Bedrum",          artist:"Weird russian singer"           },
    { ytId:"OPf0YbXqDm0", title:"Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",             artist:"Mark Ronson"         },
    { ytId:"09R8_2nJtjg", title:"Maroon 5 - Sugar (Official Music Video)",                artist:"Maroon 5"       },
    { ytId:"2Vv-BfVoq4g", title:"Ed Sheeran - Perfect (Official Music Video)",                     artist:"Ed Sheeran"         },
    { ytId:"CevxZvSJLk8", title:"Katy Perry - Roar",                        artist:"Katy Perry"         },
    // Pop femenino
    { ytId:"8UVNT4wvIGY", title:"Gotye - Somebody That I Used To Know (feat. Kimbra) [Official Music Video]",               artist:"Gotye"            },
    { ytId:"nfWlot6h_JM", title:"Taylor Swift - Shake It Off",   artist:"Taylor Swift"       },
    { ytId:"PT2_F-1esPk", title:"The Chainsmokers - Closer (Lyric) ft. Halsey",               artist:"The Chainsmokers"                },
    { ytId:"04854XqcfCY", title:"Queen - We Are The Champions (Official Video)",                    artist:"Queen"         },
    { ytId:"uelHwf8o7_U", title:"Eminem - Love The Way You Lie ft. Rihanna",           artist:"Eminem"           },
    // Rock clásico
    { ytId:"StKVS0eI85I", title:"Blondie - Call me",            artist:"Blondie"              },
    { ytId:"qeMFqkcPYcg", title:"Eurythmics, Annie Lennox, Dave Stewart - Sweet Dreams (Are Made Of This) (Official Video)",                 artist:"Eurythmics, Annie Lennox, Dave Stewart"              },
    { ytId:"djV11Xbc914", title:"a-ha - Take On Me (Official Video) [4K]",                  artist:"a-ha"              },
    { ytId:"1k8craCGpgs", title:"Journey - Don't Stop Believin' (Official Audio)",           artist:"Journey"       },
    { ytId:"5anLPw0Efmo", title:"Evanescence - My Immortal (Official HD Music Video)",              artist:"Evanescence"        },
    // Bailables / divertidos
    { ytId:"4fndeDfaWCg", title:"Backstreet Boys - I Want It That Way (Official HD Video)",                    artist:"Backstreet Boys"        },
    { ytId:"KQ6zr6kCPj8", title:"LMFAO - Party Rock Anthem ft. Lauren Bennett, GoonRock",                        artist:"LMFAO"     },
    { ytId:"YqeW9_5kURI", title:"Major Lazer & DJ Snake - Lean On (feat. MØ) [Official 4K Music Video]",           artist:"Major Lazer & DJ Snake"              },
    { ytId:"9bZkp7q19f0", title:"PSY - GANGNAM STYLE(강남스타일) M/V",               artist:"PSY"               },
    { ytId:"PIb6AZdTr-A", title:"Cyndi Lauper - Girls Just Want To Have Fun (Official Video)",            artist:"Cyndi Lauper"          },
    { ytId:"NUsoVlDFqZg", title:"Enrique Iglesias - Bailando ft. Descemer Bueno, Gente De Zona",           artist:"Enrique Iglesias"               },
    // Latino
    { ytId:"pRpeEdMmmQ0", title:"Shakira - Waka Waka (This Time for Africa) (The Official 2010 FIFA World Cup™ Song)",                   artist:"Shakira"            },
    { ytId:"7PCkvCPvDXk", title:"Meghan Trainor - All About That Bass (Official Video)",                    artist:"Meghan Trainor"   },
    { ytId:"YkADj0TPrJA", title:"Phil Collins - In The Air Tonight (Official Music Video)",                    artist:"Phil Collins"       },
    { ytId:"wyx6JDQCslE", title:"LMFAO - Sexy and I Know It",                    artist:"LMFAO"          },
    // Pop 90s-00s
    { ytId:"bx1Bh8ZvH84", title:"Oasis - Wonderwall (Official Video)",artist:"Oasis"             },
    { ytId:"y6Sxv-sUYtM", title:"Pharrell Williams - Happy (Official Music Video)",                      artist:"Pharrell Williams"             },
    { ytId:"Gs069dndIYk", title:"Earth, Wind & Fire - September (Official HD Video)",               artist:"Earth, Wind & Fire"            },
    { ytId:"RgKAFK5djSk", title:"Wiz Khalifa - See You Again ft. Charlie Puth [Official Video] Furious 7 Soundtrack",               artist:"Wiz Khalifa"        },
    { ytId:"SlPhMPnQ58k", title:"Maroon 5 - Memories (Official Video)",                    artist:"Maroon 5"       },
  ],

  // ── 15 FOLLOW THE LEADER ──────────────────────────────────────────────────
  // Para el escenario: ritmos bailables, energía alta, beat marcado
  ftl: [
    { ytId:"ktvTqknDobU", title:"Imagine Dragons - Radioactive",                  artist:"Imagine Dragons"         },
    { ytId:"OPf0YbXqDm0", title:"Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",             artist:"Mark Ronson"         },
    { ytId:"JGwWNGJdvx8", title:"Ed Sheeran - Shape of You (Official Music Video)",                artist:"Ed Sheeran"         },
    { ytId:"09R8_2nJtjg", title:"Maroon 5 - Sugar (Official Music Video)",                artist:"Maroon 5"       },
    { ytId:"YqeW9_5kURI", title:"Major Lazer & DJ Snake - Lean On (feat. MØ) [Official 4K Music Video]",           artist:"Major Lazer & DJ Snake"              },
    { ytId:"8UVNT4wvIGY", title:"Gotye - Somebody That I Used To Know (feat. Kimbra) [Official Music Video]",               artist:"Gotye"            },
    { ytId:"pRpeEdMmmQ0", title:"Shakira - Waka Waka (This Time for Africa) (The Official 2010 FIFA World Cup™ Song)",                   artist:"Shakira"            },
    { ytId:"4fndeDfaWCg", title:"Backstreet Boys - I Want It That Way (Official HD Video)",                    artist:"Backstreet Boys"        },
    { ytId:"9bZkp7q19f0", title:"PSY - GANGNAM STYLE(강남스타일) M/V",               artist:"PSY"               },
    { ytId:"SlPhMPnQ58k", title:"Maroon 5 - Memories (Official Video)",                    artist:"Maroon 5"       },
    { ytId:"uelHwf8o7_U", title:"Eminem - Love The Way You Lie ft. Rihanna",           artist:"Eminem"           },
    { ytId:"lWA2pjMjpBs", title:"Rihanna - Diamonds",             artist:"Rihanna"    },
  ],

  // ── 10 PERSONAL TRAINER ───────────────────────────────────────────────────
  // Para el escenario: ritmos de gym, energía sostenida, sin pausas
  pt: [
    { ytId:"hT_nvWreIhg", title:"OneRepublic - Counting Stars",              artist:"OneRepublic"        },
    { ytId:"fJ9rUzIMcZQ", title:"Queen – Bohemian Rhapsody (Official Video Remastered)",           artist:"Queen"              },
    { ytId:"OPf0YbXqDm0", title:"Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",             artist:"Mark Ronson"         },
    { ytId:"ktvTqknDobU", title:"Imagine Dragons - Radioactive",                  artist:"Imagine Dragons"         },
    { ytId:"PT2_F-1esPk", title:"The Chainsmokers - Closer (Lyric) ft. Halsey",               artist:"The Chainsmokers"                },
    { ytId:"StKVS0eI85I", title:"Blondie - Call me",            artist:"Blondie"              },
    { ytId:"YqeW9_5kURI", title:"Major Lazer & DJ Snake - Lean On (feat. MØ) [Official 4K Music Video]",           artist:"Major Lazer & DJ Snake"              },
    { ytId:"tVj0ZTS4WF4", title:"Weird russian singer - Chum Drum Bedrum",          artist:"Weird russian singer"           },
  ],

  // ── 15 DUELO DE TALENTOS ──────────────────────────────────────────────────
  // Para el escenario: temas que invitan a improvisar, bailar o cantar
  // El admin elige cuál suena mientras los dos participantes están en el escenario
  duelo: [
    { ytId:"ktvTqknDobU", title:"Imagine Dragons - Radioactive",                  artist:"Imagine Dragons"         },
    { ytId:"kXYiU_JCYtU", title:"Numb (Official Music Video) [4K UPGRADE] – Linkin Park",           artist:"Numb (Official Music Video) [4K UPGRADE]"              },
    { ytId:"OPf0YbXqDm0", title:"Mark Ronson - Uptown Funk (Official Video) ft. Bruno Mars",             artist:"Mark Ronson"         },
    { ytId:"8UVNT4wvIGY", title:"Gotye - Somebody That I Used To Know (feat. Kimbra) [Official Music Video]",               artist:"Gotye"            },
    { ytId:"09R8_2nJtjg", title:"Maroon 5 - Sugar (Official Music Video)",                artist:"Maroon 5"       },
    { ytId:"lWA2pjMjpBs", title:"Rihanna - Diamonds",             artist:"Rihanna"    },
    { ytId:"fJ9rUzIMcZQ", title:"Queen – Bohemian Rhapsody (Official Video Remastered)",           artist:"Queen"              },
    { ytId:"YqeW9_5kURI", title:"Major Lazer & DJ Snake - Lean On (feat. MØ) [Official 4K Music Video]",           artist:"Major Lazer & DJ Snake"              },
    { ytId:"Gs069dndIYk", title:"Earth, Wind & Fire - September (Official HD Video)",               artist:"Earth, Wind & Fire"            },
    { ytId:"pRpeEdMmmQ0", title:"Shakira - Waka Waka (This Time for Africa) (The Official 2010 FIFA World Cup™ Song)",                   artist:"Shakira"            },
    { ytId:"uelHwf8o7_U", title:"Eminem - Love The Way You Lie ft. Rihanna",           artist:"Eminem"           },
    { ytId:"tVj0ZTS4WF4", title:"Weird russian singer - Chum Drum Bedrum",          artist:"Weird russian singer"           },
    { ytId:"4fndeDfaWCg", title:"Backstreet Boys - I Want It That Way (Official HD Video)",                    artist:"Backstreet Boys"        },
  ],

};

// Normalizar fallback al mismo formato que YouTube API
function normalizeFallback(list) {
  return list.map((v, i) => ({
    ...v,
    id:       v.ytId,
    thumb:    `https://img.youtube.com/vi/${v.ytId}/mqdefault.jpg`,
    position: i,
    source:   "fallback",
  }));
}

// ─── YouTube Data API v3 ───────────────────────────────────────────────────────
const YT_KEY     = import.meta.env?.VITE_YOUTUBE_API_KEY;
const YT_BASE    = "https://www.googleapis.com/youtube/v3";
const MAX_PAGES  = 3;   // máximo 150 videos por playlist
const PAGE_SIZE  = 50;

function extractArtist(title) {
  for (const sep of [" - ", " – ", " · ", " | "]) {
    if (title.includes(sep)) return title.split(sep)[0].trim();
  }
  return null;
}

async function fetchFromYouTube(playlistId) {
  if (!YT_KEY || !playlistId) return null;  // null = usar fallback

  let videos    = [];
  let pageToken = null;
  let pages     = 0;

  do {
    const params = new URLSearchParams({
      part:       "snippet",
      playlistId,
      maxResults: PAGE_SIZE,
      key:        YT_KEY,
      ...(pageToken ? { pageToken } : {}),
    });

    const res  = await fetch(`${YT_BASE}/playlistItems?${params}`);
    if (!res.ok) return null;   // error de red o API → fallback

    const data = await res.json();
    if (data.error) return null;

    const items = (data.items || [])
      .filter(i =>
        i.snippet.title !== "Deleted video" &&
        i.snippet.title !== "Private video"
      )
      .map(i => ({
        id:       i.snippet.resourceId.videoId,
        ytId:     i.snippet.resourceId.videoId,
        title:    i.snippet.title,
        artist:   extractArtist(i.snippet.title),
        thumb:    i.snippet.thumbnails?.medium?.url ||
                  `https://img.youtube.com/vi/${i.snippet.resourceId.videoId}/mqdefault.jpg`,
        position: i.snippet.position,
        source:   "youtube",
      }));

    videos    = [...videos, ...items];
    pageToken = data.nextPageToken || null;
    pages++;

  } while (pageToken && pages < MAX_PAGES);

  return videos.sort((a, b) => a.position - b.position);
}

// ─── Hook principal ────────────────────────────────────────────────────────────
/**
 * useYouTubePlaylists
 *
 * Carga videos desde YouTube API. Si no hay API key, no hay red, o la
 * playlist no está configurada, usa automáticamente el fallback hardcodeado.
 * El componente nunca ve un error — siempre recibe una lista de videos.
 *
 * @param {Object} config  { videos, karaoke, ftl, pt } — playlist IDs de YouTube
 *
 * @returns {Object}
 *   playlists   — { videos, karaoke, ftl, pt } — arrays de videos listos
 *   sources     — { videos: "youtube"|"fallback", ... } — origen de cada lista
 *   loading     — boolean
 *   lastSync    — Date | null
 *   totalVideos — número total de videos cargados
 *   refresh     — función para re-sincronizar manualmente
 */
export function useYouTubePlaylists(config = {}) {
  const TYPES = ["videos", "karaoke", "ftl", "pt", "duelo"];

  const [playlists, setPlaylists] = useState(() =>
    Object.fromEntries(TYPES.map(t => [t, normalizeFallback(FALLBACK_PLAYLISTS[t] || [])]))
  );
  const [sources,   setSources]   = useState(() =>
    Object.fromEntries(TYPES.map(t => [t, "fallback"]))
  );
  const [loading,   setLoading]   = useState(false);
  const [lastSync,  setLastSync]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const resultPlaylists = {};
    const resultSources   = {};

    await Promise.all(
      TYPES.map(async type => {
        const pid = config[type];

        // 1. Intentar YouTube si hay API key y playlist configurada
        if (YT_KEY && pid) {
          try {
            const ytVideos = await fetchFromYouTube(pid);
            if (ytVideos && ytVideos.length > 0) {
              resultPlaylists[type] = ytVideos;
              resultSources[type]   = "youtube";
              return;
            }
          } catch {
            // red caída → continúa al fallback
          }
        }

        // 2. Fallback hardcodeado (siempre disponible)
        resultPlaylists[type] = normalizeFallback(FALLBACK_PLAYLISTS[type]);
        resultSources[type]   = "fallback";
      })
    );

    setPlaylists(resultPlaylists);
    setSources(resultSources);
    setLastSync(new Date());
    setLoading(false);
  }, [JSON.stringify(config)]);

  useEffect(() => { load(); }, [load]);

  const totalVideos = Object.values(playlists).reduce((a, b) => a + b.length, 0);

  return { playlists, sources, loading, lastSync, totalVideos, refresh: load };
}

// ─── Admin: configuración de IDs ─────────────────────────────────────────────
const CONFIG_KEY = "bizarrapp_yt_config";

export const PLAYLIST_TYPES = [
  { id:"videos",  label:"Videos Musicales",  icon:"🎵", desc:"Para Mandalo a Pantalla",   module:"Módulo 5" },
  { id:"karaoke", label:"Si lo sabe cante",  icon:"🎤", desc:"Pistas con letra",           module:"Módulo 4 — Escenario" },
  { id:"ftl",     label:"Follow the Leader", icon:"💃", desc:"Videos estilo Just Dance",   module:"Módulo 4 — Escenario" },
  { id:"pt",      label:"Personal Trainer",  icon:"🏋️", desc:"Videos de gym dance",        module:"Módulo 4 — Escenario" },
  { id:"duelo",   label:"Duelo de Talentos", icon:"⚔️",  desc:"Canciones para el duelo",   module:"Módulo 4 — Escenario" },
];

export function useYouTubePlaylistAdmin() {
  const [config, setConfig] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"); }
    catch { return {}; }
  });

  const updatePlaylistId = useCallback((type, pid) => {
    setConfig(prev => {
      const next = { ...prev, [type]: pid.trim() };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removePlaylistId = useCallback((type) => {
    setConfig(prev => {
      const next = { ...prev };
      delete next[type];
      localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { config, updatePlaylistId, removePlaylistId };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export const ytThumb    = id => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
export const ytWatchUrl = id => `https://www.youtube.com/watch?v=${id}`;

export function parsePlaylistId(input) {
  if (!input) return null;
  const t = input.trim();
  if (/^PL[A-Za-z0-9_-]+$/.test(t)) return t;
  try { return new URL(t).searchParams.get("list") || null; }
  catch { return null; }
}
