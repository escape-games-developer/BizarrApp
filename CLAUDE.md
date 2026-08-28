# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server on port 5173
npm run build     # Production build to dist/
npm run preview   # Preview production build
npm run lint      # ESLint over src/**/*.{js,jsx}
```

No test suite exists — verification is done by running the app.

## Architecture

BizarrApp is a real-time interactive event platform for Bizarren Miusik Bar (Buenos Aires). It has **three separate UIs** served from one React app, routed in `src/App.jsx`:

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `WebApp` | Customer mobile app for bar patrons |
| `/admin` | `AdminPanel` | Staff control dashboard |
| `/pantalla` | `PantallaGigante` | Large projection screen display |
| `/tv` | `PantallaTV` | Motor de reproducción del módulo Pantalla/Escenario (YouTube IFrame API) |
| `/auth/callback` | `AuthCallbackView` | Destino de los mails de Supabase Auth (confirmar cuenta / recuperar contraseña) |

Each is essentially an independent React sub-app with its own realtime subscriptions and state.

## Tech Stack

- **React 18 + Vite** — JSX only (no TypeScript in src/), except admin and bigscreen which are `.tsx`
- **Supabase** — Auth, PostgreSQL, Realtime (postgres_changes pub/sub)
- **Inline styles** — No CSS framework; global styles injected once via `src/constants/styles.js`
- **No Redux** — State via React hooks + Context; realtime hooks in `src/hooks/realtime/`

## Key Data Flow

**Realtime game sync** (the core loop):
1. AdminPanel writes to `game_state` table in Supabase
2. Supabase fires `postgres_changes` event
3. `useGameState` hook delivers state to WebApp and PantallaGigante simultaneously

**Auth flow:**
- 5-step registration in `ProfileView` → Supabase Auth user + `profiles` table row
- Session stored in localStorage, restored via `useAuth.js` on page load
- `geoOk` boolean from `useGeoGate.js` gates access to Juegos, Escenario, and Pantalla modules

**Mails de Auth (confirmación y recuperación)** — ver `supabase/AUTH_SETUP.md`:
- `signUp()` manda el perfil en `options.data`; el trigger `handle_new_user`
  (migración `20260827120000`) crea la fila de `profiles` del lado del server.
  Es lo que hace que el perfil sobreviva a la confirmación por email — sin
  sesión, el INSERT del cliente cae por RLS.
- Los dos mails vuelven a `/auth/callback?next=novedades|reset`.
  `AuthCallbackView` canjea la sesión (soporta los tres formatos de Supabase:
  hash implícito, `?code=` PKCE y `?token_hash=`) y después:
  - `next=novedades` → hidrata el perfil y redirige a `/?view=novedades&confirmed=1`
    (la app arranca en el menú **Noti**)
  - `next=reset` → formulario de contraseña nueva → `/?view=novedades&passwordChanged=1`
- `ChangePasswordCard` (paso 5 del perfil) cambia la contraseña con sesión
  activa, reautenticando con la actual.
- `?view=` es el parámetro público de deep-link de la WebApp (push, QR, mails).

**Geofencing:**
- `useGeoGate.js` uses Haversine distance against bar coordinates `-34.6090°, -58.3785°`
- 100 m radius required; needs HTTPS in production for browser geolocation permission

**Moderated chat:**
- Users submit to `messages` table; admin approves/rejects via status field
- PantallaGigante subscribes only to `status='approved'` rows

**Presence:**
- `usePresence.js` inserts into `connected_users` on mount, heartbeats every 30 s
- AdminPanel reads this table for the active-user count and raffle pool

## Module Map (WebApp)

Six views accessible from the bottom nav:

1. **Carta** — Bar menu (always accessible)
2. **Novedades** — Admin-pushed banners
3. **Juegos** — Games (geo-gated): Rey del Orto raffle, Suma, Palabra, Trivia (Team Batata 🍠 vs Team Membrillo 🍋)
4. **Escenario** — Stage experiences (geo-gated): Duelo, FTL, PT, Karaoke
5. **Pantalla** — Message submission + video requests for giant screen (geo-gated)
6. **Perfil** — Registration / login / profile

## Source Layout

```
src/
├── App.jsx                          # Route: /, /admin, /pantalla
├── lib/
│   ├── supabase.js                  # Singleton client (20 events/sec throttle)
│   ├── authRedirect.js              # URLs de retorno de los mails de Auth
│   └── authCallback.js              # Lectura y canje del link del mail
├── constants/
│   ├── theme.js                     # Colors, team definitions, bar geo-coordinates, avatar presets
│   ├── data.js                      # Menu items, trivia questions, video playlists, raffle names
│   └── styles.js                    # Global CSS string, injected once
├── hooks/
│   ├── useAuth.js                   # register(), login(), session restore
│   ├── useGeoGate.js                # Geofencing (Haversine, 100 m radius)
│   ├── useRaffle.js                 # Rey del Orto state machine + strobe
│   ├── useCoupon.js                 # Prize/coupon logic
│   ├── useYouTubePlaylists.js       # Playlist config persistence
│   └── realtime/
│       ├── useGameState.js          # game_state table subscription + admin controls
│       ├── useMessages.js           # Chat (user/screen/admin views)
│       ├── usePresence.js           # Heartbeat check-in
│       ├── useEscenarioQueue.js     # Stage experience queue
│       └── useTriviaVotes.js        # Team trivia voting
├── components/                      # Shared UI primitives
│   └── media/                       # Biblioteca de imágenes (modal, uploader, encuadre)
├── tv/                              # /tv — motor de reproducción (Pantalla/Escenario)
├── services/
│   └── mediaAssets.js               # CRUD de media_assets + bucket bizarren-media
│   └── pantallaDj.js                # RPCs del módulo Pantalla/Escenario
├── views/                           # The 6 WebApp modules (one dir each)
│   └── Auth/                        # Callback del mail, olvidé mi contraseña, cambio de contraseña
├── admin/
│   ├── BizarrApp AdminPanel Festival.tsx
│   └── NovedadesPanel.jsx           # CRUD de banners + imagen de biblioteca
│   └── pantalla/                    # Admin + consola DJ de Pantalla/Escenario
└── bigscreen/
    └── BizarrApp PantallaGigante Festival.tsx
```

## Environment

```
VITE_SUPABASE_URL=https://zkltjvgbpzelwzsphurg.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`vite.config.js` has an HTTPS block commented out — uncomment it for mobile geolocation testing on local network.
