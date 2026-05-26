import { useState, useEffect, useCallback } from "react";

// ─── Fallback hardcodeado — funciona sin WiFi ─────────────────────────────────
// Reemplazar ytId con IDs reales del canal del bar.
// Estos son los que aparecen si YouTube no está disponible.
export const FALLBACK_PLAYLISTS = {

  // ── 50 VIDEOS MUSICALES ────────────────────────────────────────────────────
  // Para Mandalo a Pantalla — mezcla pop/rock/electro/latino, décadas 80s-2020s
  videos: [
    // 2020s
    { ytId:"OPf0YbXqDm0", title:"Blinding Lights",             artist:"The Weeknd"         },
    { ytId:"JGwWNGJdvx8", title:"Shape of You",                artist:"Ed Sheeran"         },
    { ytId:"ktvTqknDobU", title:"Uptown Funk",                  artist:"Bruno Mars"         },
    { ytId:"09R8_2nJtjg", title:"Shake It Off",                artist:"Taylor Swift"       },
    { ytId:"hT_nvWreIhg", title:"Counting Stars",              artist:"OneRepublic"        },
    { ytId:"RgKAFK5djSk", title:"See You Again",               artist:"Wiz Khalifa"        },
    { ytId:"CevxZvSJLk8", title:"Roar",                        artist:"Katy Perry"         },
    { ytId:"nfWlot6h_JM", title:"Shake It Off (Official)",    artist:"Taylor Swift"       },
    { ytId:"2Vv-BfVoq4g", title:"Perfect",                     artist:"Ed Sheeran"         },
    { ytId:"lWA2pjMjpBs", title:"Smooth Criminal",             artist:"Michael Jackson"    },
    // 2010s
    { ytId:"pRpeEdMmmQ0", title:"Waka Waka",                   artist:"Shakira"            },
    { ytId:"YqeW9_5kURI", title:"Party Rock Anthem",           artist:"LMFAO"              },
    { ytId:"dQw4w9WgXcQ", title:"Never Gonna Give You Up",     artist:"Rick Astley"        },
    { ytId:"fRh_vgS2dFE", title:"Sorry",                       artist:"Justin Bieber"      },
    { ytId:"PT2_F-1esPk", title:"Cheap Thrills",               artist:"Sia"                },
    { ytId:"7PCkvCPvDXk", title:"Bailando",                    artist:"Enrique Iglesias"   },
    { ytId:"bx1Bh8ZvH84", title:"Somebody That I Used to Know",artist:"Gotye"             },
    { ytId:"OPl1k8VszLQ", title:"Lean On",                     artist:"Major Lazer"        },
    { ytId:"SlPhMPnQ58k", title:"Titanium",                    artist:"David Guetta"       },
    { ytId:"uelHwf8o7_U", title:"Moves Like Jagger",           artist:"Maroon 5"           },
    // 2000s
    { ytId:"fJ9rUzIMcZQ", title:"Don't Stop Me Now",           artist:"Queen"              },
    { ytId:"iistxwgL8OQ", title:"I Gotta Feeling",             artist:"Black Eyed Peas"    },
    { ytId:"8UVNT4wvIGY", title:"Single Ladies",               artist:"Beyoncé"            },
    { ytId:"Gs069dndIYk", title:"Crazy in Love",               artist:"Beyoncé"            },
    { ytId:"M0da_OF9ZHk", title:"Just Dance",                  artist:"Lady Gaga"          },
    { ytId:"SCROQPGWj38", title:"Hips Don't Lie",              artist:"Shakira"            },
    { ytId:"YkADj0TPrJA", title:"Gasolina",                    artist:"Daddy Yankee"       },
    { ytId:"OMDmOHTmFuE", title:"Livin' la Vida Loca",         artist:"Ricky Martin"       },
    { ytId:"9bZkp7q19f0", title:"Gangnam Style",               artist:"PSY"               },
    { ytId:"OIwEBPDmSHY", title:"Yeah!",                       artist:"Usher"              },
    // 90s
    { ytId:"kXYiU_JCYtU", title:"Bohemian Rhapsody",           artist:"Queen"              },
    { ytId:"1k8craCGpgs", title:"Don't You Want Me",           artist:"Human League"       },
    { ytId:"djV11Xbc914", title:"A-ha - Take On Me",           artist:"A-ha"              },
    { ytId:"y6Sxv-sUYtM", title:"Jump",                        artist:"Kris Kross"         },
    { ytId:"PIb6AZdTr-A", title:"Blue (Da Ba Dee)",            artist:"Eiffel 65"          },
    { ytId:"4fndeDfaWCg", title:"Macarena",                    artist:"Los Del Rio"        },
    { ytId:"NUsoVlDFqZg", title:"Freed from Desire",           artist:"Gala"               },
    { ytId:"3JZ4pnNtyxQ", title:"Sandstorm",                   artist:"Darude"             },
    { ytId:"KQ6zr6kCPj8", title:"YMCA",                        artist:"Village People"     },
    { ytId:"wyx6JDQCslE", title:"La Bamba",                    artist:"Los Lobos"          },
    // Latino / Cumbia / Reggaeton
    { ytId:"yzTuBunvjEg", title:"Despacito",                   artist:"Luis Fonsi"         },
    { ytId:"kOkQ4T5WO9E", title:"Con Calma",                   artist:"Daddy Yankee"       },
    { ytId:"HCjNJDNzw8Y", title:"Mi Gente",                    artist:"J Balvin"           },
    { ytId:"jofNR_WkoCE", title:"Taki Taki",                   artist:"DJ Snake"           },
    { ytId:"CcNo0rKKhPg", title:"I Like It",                   artist:"Cardi B"            },
    { ytId:"nt5HhreNBFg", title:"Medellín",                    artist:"Madonna & Maluma"   },
    { ytId:"bTL2-yRJSgA", title:"Unforgettable",               artist:"French Montana"     },
    // Clásicos rock
    { ytId:"vy1V5LHXWbg", title:"Don't Stop Believin'",        artist:"Journey"            },
    { ytId:"5anLPw0Efmo", title:"Sweet Caroline",              artist:"Neil Diamond"       },
    { ytId:"tVj0ZTS4WF4", title:"Living on a Prayer",          artist:"Bon Jovi"           },
  ],

  // ── 50 KARAOKE ────────────────────────────────────────────────────────────
  // Para Si lo sabe cante — pistas conocidas, aptas para cantar en público
  karaoke: [
    // Hits mega populares (todos los conocen)
    { ytId:"kXYiU_JCYtU", title:"Bohemian Rhapsody",           artist:"Queen"              },
    { ytId:"fJ9rUzIMcZQ", title:"Don't Stop Me Now",           artist:"Queen"              },
    { ytId:"dQw4w9WgXcQ", title:"Never Gonna Give You Up",     artist:"Rick Astley"        },
    { ytId:"5anLPw0Efmo", title:"Sweet Caroline",              artist:"Neil Diamond"       },
    { ytId:"vy1V5LHXWbg", title:"Don't Stop Believin'",        artist:"Journey"            },
    { ytId:"tVj0ZTS4WF4", title:"Living on a Prayer",          artist:"Bon Jovi"           },
    { ytId:"OPf0YbXqDm0", title:"Blinding Lights",             artist:"The Weeknd"         },
    { ytId:"09R8_2nJtjg", title:"Shake It Off",                artist:"Taylor Swift"       },
    { ytId:"2Vv-BfVoq4g", title:"Perfect",                     artist:"Ed Sheeran"         },
    { ytId:"CevxZvSJLk8", title:"Roar",                        artist:"Katy Perry"         },
    // Pop femenino
    { ytId:"8UVNT4wvIGY", title:"Single Ladies",               artist:"Beyoncé"            },
    { ytId:"lp-EBkYFsAA", title:"Bad Romance",                 artist:"Lady Gaga"          },
    { ytId:"nfWlot6h_JM", title:"We Are Never Getting Back",   artist:"Taylor Swift"       },
    { ytId:"PT2_F-1esPk", title:"Cheap Thrills",               artist:"Sia"                },
    { ytId:"wZp0tQBnCmM", title:"Titanfall (Chandelier)",      artist:"Sia"                },
    { ytId:"hLQl3WQQoP0", title:"Adele - Someone Like You",    artist:"Adele"              },
    { ytId:"RTovLtmCZek", title:"Hello",                       artist:"Adele"              },
    { ytId:"iS1g8G_NkI0", title:"Rolling in the Deep",         artist:"Adele"              },
    { ytId:"04854XqcfCY", title:"Firework",                    artist:"Katy Perry"         },
    { ytId:"uelHwf8o7_U", title:"Moves Like Jagger",           artist:"Maroon 5"           },
    // Rock clásico
    { ytId:"StKVS0eI85I", title:"We Will Rock You",            artist:"Queen"              },
    { ytId:"vvlPDOFIGRA", title:"We Are the Champions",        artist:"Queen"              },
    { ytId:"lrpXArn3hQk", title:"I Want to Break Free",        artist:"Queen"              },
    { ytId:"qeMFqkcPYcg", title:"Radio Ga Ga",                 artist:"Queen"              },
    { ytId:"jMCFtuCTCqI", title:"Livin' on a Prayer (Karaoke)",artist:"Bon Jovi"           },
    { ytId:"djV11Xbc914", title:"Take On Me",                  artist:"A-ha"              },
    { ytId:"1k8craCGpgs", title:"Don't You Want Me",           artist:"Human League"       },
    { ytId:"MqDSMGa0wRc", title:"Africa",                      artist:"Toto"               },
    { ytId:"vy1V5LHXWbg", title:"Anyway You Want It",          artist:"Journey"            },
    { ytId:"5anLPw0Efmo", title:"I'm a Believer",              artist:"The Monkees"        },
    // Bailables / divertidos
    { ytId:"4fndeDfaWCg", title:"Macarena",                    artist:"Los Del Rio"        },
    { ytId:"KQ6zr6kCPj8", title:"YMCA",                        artist:"Village People"     },
    { ytId:"YqeW9_5kURI", title:"Party Rock Anthem",           artist:"LMFAO"              },
    { ytId:"9bZkp7q19f0", title:"Gangnam Style",               artist:"PSY"               },
    { ytId:"PIb6AZdTr-A", title:"Blue (Da Ba Dee)",            artist:"Eiffel 65"          },
    { ytId:"NUsoVlDFqZg", title:"Freed from Desire",           artist:"Gala"               },
    // Latino
    { ytId:"yzTuBuCTLEo", title:"Despacito",                   artist:"Luis Fonsi"         },
    { ytId:"pRpeEdMmmQ0", title:"Waka Waka",                   artist:"Shakira"            },
    { ytId:"SCROQPGWj38", title:"Hips Don't Lie",              artist:"Shakira"            },
    { ytId:"7PCkvCPvDXk", title:"Bailando",                    artist:"Enrique Iglesias"   },
    { ytId:"OMDmOHTmFuE", title:"Livin' la Vida Loca",         artist:"Ricky Martin"       },
    { ytId:"YkADj0TPrJA", title:"Gasolina",                    artist:"Daddy Yankee"       },
    { ytId:"wyx6JDQCslE", title:"La Bamba",                    artist:"Los Lobos"          },
    // Pop 90s-00s
    { ytId:"bx1Bh8ZvH84", title:"Somebody That I Used to Know",artist:"Gotye"             },
    { ytId:"y6Sxv-sUYtM", title:"Mmmbop",                      artist:"Hanson"             },
    { ytId:"OIwEBPDmSHY", title:"Yeah!",                       artist:"Usher"              },
    { ytId:"iistxwgL8OQ", title:"I Gotta Feeling",             artist:"Black Eyed Peas"    },
    { ytId:"Gs069dndIYk", title:"Crazy in Love",               artist:"Beyoncé"            },
    { ytId:"RgKAFK5djSk", title:"See You Again",               artist:"Wiz Khalifa"        },
    { ytId:"SlPhMPnQ58k", title:"Titanium",                    artist:"David Guetta"       },
  ],

  // ── 15 FOLLOW THE LEADER ──────────────────────────────────────────────────
  // Para el escenario: ritmos bailables, energía alta, beat marcado
  ftl: [
    { ytId:"ktvTqknDobU", title:"Uptown Funk",                  artist:"Bruno Mars"         },
    { ytId:"OPf0YbXqDm0", title:"Blinding Lights",             artist:"The Weeknd"         },
    { ytId:"JGwWNGJdvx8", title:"Shape of You",                artist:"Ed Sheeran"         },
    { ytId:"09R8_2nJtjg", title:"Shake It Off",                artist:"Taylor Swift"       },
    { ytId:"YqeW9_5kURI", title:"Party Rock Anthem",           artist:"LMFAO"              },
    { ytId:"8UVNT4wvIGY", title:"Single Ladies",               artist:"Beyoncé"            },
    { ytId:"SCROQPGWj38", title:"Hips Don't Lie",              artist:"Shakira"            },
    { ytId:"pRpeEdMmmQ0", title:"Waka Waka",                   artist:"Shakira"            },
    { ytId:"4fndeDfaWCg", title:"Macarena",                    artist:"Los Del Rio"        },
    { ytId:"9bZkp7q19f0", title:"Gangnam Style",               artist:"PSY"               },
    { ytId:"iistxwgL8OQ", title:"I Gotta Feeling",             artist:"Black Eyed Peas"    },
    { ytId:"OPl1k8VszLQ", title:"Lean On",                     artist:"Major Lazer"        },
    { ytId:"SlPhMPnQ58k", title:"Titanium",                    artist:"David Guetta"       },
    { ytId:"uelHwf8o7_U", title:"Moves Like Jagger",           artist:"Maroon 5"           },
    { ytId:"lWA2pjMjpBs", title:"Smooth Criminal",             artist:"Michael Jackson"    },
  ],

  // ── 10 PERSONAL TRAINER ───────────────────────────────────────────────────
  // Para el escenario: ritmos de gym, energía sostenida, sin pausas
  pt: [
    { ytId:"hT_nvWreIhg", title:"Counting Stars",              artist:"OneRepublic"        },
    { ytId:"fJ9rUzIMcZQ", title:"Don't Stop Me Now",           artist:"Queen"              },
    { ytId:"OPf0YbXqDm0", title:"Blinding Lights",             artist:"The Weeknd"         },
    { ytId:"ktvTqknDobU", title:"Uptown Funk",                  artist:"Bruno Mars"         },
    { ytId:"PT2_F-1esPk", title:"Cheap Thrills",               artist:"Sia"                },
    { ytId:"StKVS0eI85I", title:"We Will Rock You",            artist:"Queen"              },
    { ytId:"iistxwgL8OQ", title:"I Gotta Feeling",             artist:"Black Eyed Peas"    },
    { ytId:"YqeW9_5kURI", title:"Party Rock Anthem",           artist:"LMFAO"              },
    { ytId:"tVj0ZTS4WF4", title:"Living on a Prayer",          artist:"Bon Jovi"           },
    { ytId:"vy1V5LHXWbg", title:"Don't Stop Believin'",        artist:"Journey"            },
  ],

  // ── 15 DUELO DE TALENTOS ──────────────────────────────────────────────────
  // Para el escenario: temas que invitan a improvisar, bailar o cantar
  // El admin elige cuál suena mientras los dos participantes están en el escenario
  duelo: [
    { ytId:"ktvTqknDobU", title:"Uptown Funk",                  artist:"Bruno Mars"         },
    { ytId:"kXYiU_JCYtU", title:"Bohemian Rhapsody",           artist:"Queen"              },
    { ytId:"OPf0YbXqDm0", title:"Blinding Lights",             artist:"The Weeknd"         },
    { ytId:"8UVNT4wvIGY", title:"Single Ladies",               artist:"Beyoncé"            },
    { ytId:"09R8_2nJtjg", title:"Shake It Off",                artist:"Taylor Swift"       },
    { ytId:"lWA2pjMjpBs", title:"Smooth Criminal",             artist:"Michael Jackson"    },
    { ytId:"fJ9rUzIMcZQ", title:"Don't Stop Me Now",           artist:"Queen"              },
    { ytId:"SCROQPGWj38", title:"Hips Don't Lie",              artist:"Shakira"            },
    { ytId:"YqeW9_5kURI", title:"Party Rock Anthem",           artist:"LMFAO"              },
    { ytId:"Gs069dndIYk", title:"Crazy in Love",               artist:"Beyoncé"            },
    { ytId:"pRpeEdMmmQ0", title:"Waka Waka",                   artist:"Shakira"            },
    { ytId:"iistxwgL8OQ", title:"I Gotta Feeling",             artist:"Black Eyed Peas"    },
    { ytId:"uelHwf8o7_U", title:"Moves Like Jagger",           artist:"Maroon 5"           },
    { ytId:"tVj0ZTS4WF4", title:"Living on a Prayer",          artist:"Bon Jovi"           },
    { ytId:"4fndeDfaWCg", title:"Macarena",                    artist:"Los Del Rio"        },
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
