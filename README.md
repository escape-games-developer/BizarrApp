# BizarrApp
### La App de Bizarren Miusik Bar

Sistema interactivo para eventos en vivo. Conecta la pantalla gigante del bar con los celulares del público en tiempo real.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite 5 |
| Estilos | CSS-in-JS (no depende de Tailwind ni CSS modules) |
| Estado | React hooks + Context (sin Redux) |
| Realtime | **Pendiente**: Ably / Pusher / Supabase Realtime |
| Auth | **Pendiente**: Supabase Auth / Firebase Auth |
| Base de datos | **Pendiente**: Supabase / PlanetScale |
| Deploy | Vercel (recomendado) |

---

## Estructura

```
src/
├── constants/
│   ├── theme.js      → paleta, equipos, avatares, helpers (rand, ytThumb)
│   ├── data.js       → menú, playlists, preguntas trivia, strobe colors
│   └── styles.js     → CSS global (una sola inyección en App.jsx)
│
├── hooks/
│   ├── useAuth.js    → registro, login, sesión con localStorage
│   ├── useGeoGate.js → verificación de ubicación (Haversine, 100m radio)
│   └── useRaffle.js  → lógica del Rey del Orto (strobe, countdown, winner)
│
├── components/
│   ├── AvatarDisplay.jsx → avatar preset o foto propia
│   └── UI.jsx            → BlockedView, StepBar, VideoRow, LiveChip, Confetti
│
├── views/
│   ├── Carta/CartaView.jsx           → Módulo 1: carta del bar
│   ├── Novedades/NovedadesView.jsx   → Módulo 2: banners del admin
│   ├── Juegos/JuegosView.jsx         → Módulo 3: Rey del Orto, Sumá, Palabra, Trivia
│   ├── Escenario/EscenarioView.jsx   → Módulo 4: Duelo, FTL, PT, Karaoke
│   ├── Pantalla/PantallaView.jsx     → Módulo 5: mensajes + videoclips
│   └── Perfil/ProfileView.jsx        → Módulo 6: login + registro 5 pasos
│
└── App.jsx   → root, router de vistas, nav, estado global
```

---

## Instalación

```bash
git clone <repo>
cd bizarrapp
npm install
npm run dev
```

Abrir en `http://localhost:3000`

> **HTTPS requerido** para geolocalización en dispositivos móviles reales.
> Descomentar `https: true` en `vite.config.js` o usar `ngrok`.

---

## Configuración necesaria antes de producción

### 1. Coordenadas del bar
`src/constants/theme.js`:
```js
export const BAR_LAT    = -34.XXXXXX;  // ← coordenadas reales
export const BAR_LNG    = -58.XXXXXX;
export const GEO_RADIUS = 100;          // metros (ajustar si es necesario)
```

### 2. Logo
Reemplazar `/public/logo.png` con el logo real.

### 3. Auth + Base de datos (Supabase recomendado)
Reemplazar `src/hooks/useAuth.js` con:
```js
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// register:
const { data, error } = await supabase.auth.signUp({ email, password });
await supabase.from("profiles").insert({ user_id: data.user.id, ...profile });

// login:
const { data, error } = await supabase.auth.signInWithPassword({ email, password });

// session:
const { data: { session } } = await supabase.auth.getSession();
```

### 4. Realtime (sincronización admin → celulares)
El estado `activeGame` y `activeEscenario` en `App.jsx` hoy es local.
Para sincronizarlos en tiempo real:

**Con Ably:**
```js
import Ably from "ably";
const client = new Ably.Realtime(ABLY_API_KEY);
const channel = client.channels.get("bizarrapp-events");

// Admin publica:
channel.publish("game-activated", { game: "rey del orto" });

// Clientes escuchan:
channel.subscribe("game-activated", (msg) => setActiveGame(msg.data.game));
```

**Con Supabase Realtime:**
```js
supabase
  .channel("game-state")
  .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, (payload) => {
    setActiveGame(payload.new.active_game);
    setActiveEscenario(payload.new.active_escenario);
  })
  .subscribe();
```

### 5. Email de confirmación
Reemplazar el `console.info` en `useAuth.js` con:
- **Resend** (recomendado): `resend.emails.send({ from, to, subject, html })`
- **SendGrid**: `sgMail.send({ to, from, subject, html })`
- **Supabase**: el email de confirmación viene automático con `signUp()`

---

## Módulos de la app

| # | Módulo | Acceso | Activación |
|---|--------|--------|------------|
| 1 | 🍹 Carta | Siempre | — |
| 2 | 📣 Novedades | Siempre | Admin publica banners |
| 3 | 🎮 Juegos | Requiere geo ✓ | Admin activa un juego por vez |
| 4 | 🎤 Escenario | Requiere geo ✓ | Admin activa una exp. por vez |
| 5 | 📺 Pantalla | Requiere geo ✓ | Siempre activo (con moderación) |
| 6 | 👤 Perfil | Siempre | — |

**Juegos disponibles (Módulo 3):**
- `rey del orto` — sorteo con efecto estroboscópico
- `suma` — sumar el número exacto con compañeros
- `palabra` — armar la palabra con otros usuarios
- `trivia` — Desafío Demente! Team Batata vs Team Membrillo

**Experiencias de escenario (Módulo 4):**
- `duelo` — votación entre dos participantes
- `ftl` — Follow the Leader (baile grupal)
- `pt` — Bizarren Personal Trainer (gym dance)
- `karaoke` — Si lo sabe cante

---

## Equipos

Los equipos están hardcodeados como `batata` y `membrillo`.
Para hacerlos configurables por noche, moverlos a la base de datos
y cargarlos con un fetch en el inicio de sesión del admin.

---

## Checklist de producción

- [ ] Coordenadas reales del bar en `theme.js`
- [ ] Logo en `/public/logo.png`
- [ ] Supabase / Firebase Auth configurado
- [ ] Realtime (Ably o Supabase) para sincronizar admin → clientes
- [ ] HTTPS habilitado en producción (Vercel lo hace automático)
- [ ] Variables de entorno en `.env` (nunca hardcodear API keys)
- [ ] Email transaccional configurado (Resend / SendGrid)
- [ ] Test en iPhone (Safari) y Android (Chrome)
- [ ] QR de entrada generado y pegado en el bar

---

## Estimación de implementación

| Tarea | Tiempo estimado |
|---|---|
| Setup Supabase + Auth | 1 día |
| Realtime admin → clientes | 2 días |
| Email transaccional | 0.5 día |
| QR + landing de entrada | 0.5 día |
| Testing en dispositivos | 2 días |
| Deploy Vercel + dominio | 0.5 día |
| **Total** | **~6-7 días** |

---

## Créditos

Diseño y producto: Jorge Luis Farray — Bizarren Miusik Bar, Buenos Aires.
