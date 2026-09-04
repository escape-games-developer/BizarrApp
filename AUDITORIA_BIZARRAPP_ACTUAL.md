# AUDITORÍA TÉCNICA COMPLETA — BIZARRAPP

Fecha de auditoría: 3 de septiembre de 2026  
Rama inspeccionada: `panel-pantalla-reestructura`  
Commit HEAD: `9269086 feat: reestructura panel de pantalla y roles de administracion`  
Alcance: revisión estática integral, build, lint, Git y contratos SQL incluidos en el repositorio. No se modificó código ni infraestructura y no se accedió a Supabase/Vercel de producción.

# ESTADO REAL DE BIZARRAPP

1. **¿La aplicación puede utilizarse hoy con clientes reales?**  
   **No puede afirmarse que sí.** La SPA compila y hay circuitos reales conectados a Supabase, pero existen bloqueadores de integración en juegos, contratos de base no reproducibles desde las migraciones versionadas, diseñadores desconectados del runtime y ausencia de pruebas end-to-end con cliente, Admin y pantallas simultáneas. Novedades, autenticación, mensajes, colas de escenario y el módulo DJ/Pantalla son los subsistemas más cercanos a operación, pero todos requieren una prueba controlada contra el backend desplegado.

2. **¿Qué partes están realmente operativas?**  
   A nivel de código, las más completas son: autenticación/perfil (`src/hooks/useAuth.js`), Novedades (`useBanners` + `NovedadesPanel`), mensajes moderados (`useMessages`), pedidos de video (`useVideoRequests`), colas de escenario (`useEscenarioQueue`), postulaciones de Duelo y aplausómetro, y el nuevo DJ Democracy/Pantalla (`pantallaDj.js`, `usePantallaEvent.js`, `DjVotingTab.jsx`, `PantallaDjPanel.jsx`, `PantallaTV.jsx`). Se clasifican como **PARCIAL** hasta validar RLS, Realtime, YouTube y concurrencia en el entorno real.

3. **¿Qué parece completo pero todavía no lo está?**  
   El panel nuevo de Pantalla ofrece muchas configuraciones que sólo persisten, pero ningún runtime las ejecuta (equipos, logros automáticos, premios, contactos, limpieza de invitados, tandas, links cortos y efectos TV). El diseñador TV guarda en Supabase, pero `/tv` lee una clave local fija. El diseñador general “publica” sólo a `localStorage` y la WebApp real no lo consume. Rey del Orto y Trivia tienen UI, Admin y pantalla gigante, pero el cliente no recibe `gameState`; además el hook de Rey del Orto ignora ese estado.

4. **Los 5 problemas más graves:**

   1. `App.jsx` no pasa `gameState` a `JuegosView` ni `EscenarioView`, cortando los juegos que dependen de él.
   2. El esquema versionado no crea múltiples tablas que el código actual usa; un entorno nuevo no es reproducible.
   3. No existen pruebas automatizadas ni verificación end-to-end; build exitoso no valida RLS, Realtime, YouTube ni varios celulares.
   4. Los diseñadores no están integrados al runtime real: TV usa `localStorage:default` y WebApp no consume el diseño publicado.
   5. Muchas funciones visibles del panel Pantalla sólo guardan configuración; faltan motores/RPC/jobs/consumidores que produzcan el efecto prometido.

5. **Orden exacto recomendado:**  
   (1) congelar y reconciliar el contrato Supabase/migraciones; (2) montar un entorno de staging reproducible; (3) corregir y probar sesión/auth/propagación de `gameState`; (4) validar mensajes, video y pantalla gigante; (5) probar y estabilizar DJ/TV con trazas; (6) cerrar Duelo; (7) cerrar Trivia y Rey del Orto; (8) decidir o completar los minijuegos sociales; (9) integrar un único diseñador; (10) implementar sólo después los motores de recompensas/equipos/tandas.

## Veredicto y límites

- **Build:** exitoso con Vite 8.0.14; 195 módulos transformados.
- **Bundle:** `dist/assets/index-*.js` mide aproximadamente 1,40 MB minificado / 619 KB gzip. Vite advierte que supera 500 KB.
- **Lint:** 0 errores, 13 warnings.
- **Tests:** no hay script `test`, dependencias de test ni archivos de prueba detectados. No se ejecutaron tests inexistentes.
- **Backend real:** **NO CONFIRMADO**. No se consultó Supabase remoto; las conclusiones de datos/RLS se basan en código y SQL versionado.
- **Navegador/dispositivos:** **NO CONFIRMADO**. No se realizó prueba manual multiusuario ni reproducción real de YouTube.
- **Producción:** **REQUIERE VERIFICACIÓN EXTERNA** en Vercel/Supabase.

# 1. MAPA REAL DEL PROYECTO

## Arquitectura

BizarrApp es una SPA de React 18 construida con Vite. No utiliza React Router: `src/main.jsx` decide el componente raíz leyendo `window.location.pathname`.

| Ruta | Superficie | Entrada real |
|---|---|---|
| `/` | WebApp cliente | `src/App.jsx` |
| `/admin...` | Cabina/Admin | `src/admin/BizarrApp AdminPanel Festival.tsx` |
| `/pantalla...` | Pantalla gigante histórica | `src/bigscreen/BizarrApp PantallaGigante Festival.tsx` |
| `/tv...` | Motor DJ/YouTube nuevo | `src/tv/PantallaTV.jsx` |
| `/designer...` | Diseñador general de pantallas cliente | `src/views/Designer/DesignerView.jsx` |
| `/designer-preview/client/home...` | Preview local del diseñador | `ClientHomePreview.jsx` |
| `/auth/callback...` | Confirmación/reset de Supabase Auth | `AuthCallbackView.jsx` |

La WebApp cambia internamente entre `novedades`, `menu`, `pantalla`, `games`, `escenario` y `profile` mediante estado React y query string, no rutas independientes. Vercel reescribe todas las URLs a `index.html`.

## Capas principales

- `src/views`: pantallas cliente, auth y diseñador.
- `src/admin`: panel monolítico principal, gestión de usuarios/playlists y módulo Pantalla reestructurado.
- `src/bigscreen`: pantalla gigante histórica, mensajes, videos, juegos y Duelo.
- `src/tv`: pantalla de reproducción del nuevo DJ Democracy con dos IFrames de YouTube.
- `src/hooks/realtime`: acceso y sincronización de sesión, juegos, mensajes, videos, banners, presencia, colas, trivia, Duelo y Pantalla.
- `src/services`: acceso a Pantalla v2, configuración y biblioteca multimedia.
- `src/designers` y `src/views/Designer`: dos diseñadores diferentes.
- `supabase/schema.sql`: esquema base histórico.
- `supabase/migrations`: cambios de auth, aplausómetro, medios y DJ/Pantalla.
- `supabase/functions`: `launch-raffle` y `send-push`.
- `public`: PWA/service worker, logo, fondos, botones, placas y artes demo.

## Dependencias y scripts

Dependencias runtime: React, React DOM, `@supabase/supabase-js` y `react-qr-code`. Scripts: `dev`, `build`, `preview`, `lint`. No hay suite de tests. La aplicación depende directamente de YouTube IFrame API y YouTube Data API vía navegador.

## Variables de entorno detectadas

| Variable | Uso | Riesgo |
|---|---|---|
| `VITE_SUPABASE_URL` | clientes Supabase y Edge Functions | obligatoria |
| `VITE_SUPABASE_ANON_KEY` | clientes y header `apikey` | obligatoria; no exponer más allá del rol anon previsto |
| `VITE_YOUTUBE_API_KEY` | búsquedas/playlists YouTube | requiere restricciones por dominio/cuota |
| `VITE_GUEST_LOGIN` | habilita login anónimo y omite registro/geo | crítico si queda `true` en producción |
| `VITE_SKIP_GEO` | saltea geolocalización | crítico si queda `true` en producción |

No se muestran valores de `.env`. El archivo real existe y está ignorado por Git.

# 2. INVENTARIO Y CLASIFICACIÓN DE SECCIONES

La clasificación es deliberadamente conservadora: “PARCIAL” significa que hay un circuito real en código, pero falta validación end-to-end o algún extremo.

## WebApp cliente

| Sección | Estado | Evidencia y corte |
|---|---|---|
| Autenticación, registro y perfil | 🟡 PARCIAL | Supabase Auth + `profiles` en `useAuth.js`; perfil pendiente y caché en localStorage. Email callback existe. Falta prueba de configuración remota, providers, redirects y RLS. |
| Geogate | 🟡 PARCIAL | `useGeoGate.js` y `geo_ok` del perfil. Invitado y `VITE_SKIP_GEO` son bypass explícitos. No se valida HTTPS/geolocalización en dispositivos reales. |
| Novedades | 🟡 PARCIAL | `useBanners.js` lee Supabase y usa Realtime; `NovedadesPanel.jsx` gestiona. Falta prueba RLS/publicación real. |
| Menú/carta | 🟠 SOLO UI / MOCK | `CartaView.jsx` usa `constants/menuData.js`; existe tabla `menu_items`, pero la vista no la consulta y el panel `MenuPanel` no cierra un CRUD real equivalente. |
| Mandalo a Pantalla — mensajes | 🟡 PARCIAL | Cliente inserta, Admin modera y `/pantalla` muestra aprobados mediante `messages`. Falta prueba simultánea y de policies. |
| Mandalo a Pantalla — videoclips | 🟡 PARCIAL | Cliente crea `video_requests`, Admin aprueba/larga, pantalla histórica reproduce. Hay auto-lanzamiento con `setTimeout(100)` y abundantes logs; falta prueba de carreras y Storage. |
| Pantalla — Música/DJ | 🟡 PARCIAL | Flujo nuevo real con RPCs y Realtime. Ver auditoría específica. |
| Notificaciones push | 🟡 PARCIAL | service worker, `usePushSubscription` y Edge Function `send-push`; VAPID/configuración/deploy no están confirmados. |
| Cupones | 🟡 PARCIAL | tabla `coupons`, Realtime y `CouponScreen`; falta confirmar quién los emite y políticas reales. |
| Presencia/clientes conectados | 🟡 PARCIAL | `usePresence` hace check-in/heartbeat y consulta `connected_users`; depende de una sesión activa única. |

## Juegos y escenario

| Sección | Estado | Motivo principal |
|---|---|---|
| Rey del Orto | 🔴 ROTA | `JuegosView` recibe `gameState` pero `App.jsx` no lo pasa. Además `useRaffle(gameState)` ignora su argumento y mantiene un estado local que nunca llega a `winner`; el cliente no refleja el ganador. |
| Desafío Demente / Trivia | 🔴 ROTA | Admin y pantalla tienen flujo, `trivia_votes` persiste, pero cliente recibe `gameState` indefinido. `useTriviaAccumulated` consulta `trivia_totals`, objeto ausente de las migraciones versionadas. |
| Sumate que sumamos | 🟠 SOLO UI / MOCK | Muestra `target_number` y un único `assigned_number` global desde payload; no hay participación, agrupación, validación, persistencia de resultado ni reset por cliente. |
| Arma la palabra | 🟠 SOLO UI / MOCK | Igual: muestra palabra/letra desde payload global; no hay motor multiusuario ni comprobación de grupo/resultado. |
| Duelo de Talentos | 🟡 PARCIAL | Postulación, selección Admin, pantalla y aplausómetro son reales. Falta confirmar tabla `duelo_postulaciones` en migraciones (no está creada), probar RLS y cerrar resultado/reinicio al cliente. El usuario tampoco puede retirar postulación (TODO explícito). |
| Follow the Leader | 🟡 PARCIAL | Inscripción real en `escenario_queue` y playlist; Admin puede gestionar cola. No hay resultado ni retorno de estado final al cliente. |
| Personal Trainer | 🟡 PARCIAL | Inscripción real en cola; sin flujo de resultado. |
| Karaoke / “Si lo sabe cante” | 🟡 PARCIAL | Inscripción + selección de canción; Admin maneja cola. No existe karaoke de doblaje separado. |
| Ruleta | ⚪ ESQUELETO/AUSENTE | No se encontró juego Ruleta. El único elemento de azar es Rey del Orto/sorteos. |
| Karaoke de doblaje | ⚪ AUSENTE | No se encontró implementación ni ruta. |
| Otros desafíos/juegos históricos | ⚫ LEGACY | El archivo `src/BizarrApp WebApp Festival.tsx` contiene una WebApp monolítica antigua y no es importado por `main.jsx`; puede generar falsos positivos al buscar funcionalidades. |

## Admin y pantallas

| Sección | Estado | Evidencia y corte |
|---|---|---|
| Dashboard | 🟡 PARCIAL | Renderiza sesión/conectados; no hay observabilidad ni salud del backend. |
| Lanzador/En vivo | 🟡 PARCIAL | Controla `game_state`, placas, juegos, escenario, audio y video; varias pantallas cliente no consumen bien ese estado. |
| Moderación mensajes | 🟡 PARCIAL | Lee/escribe estados de `messages`; pantalla gigante consume aprobados. |
| Moderación videos | 🟡 PARCIAL | Cola, votos, aprobación y lanzamiento; falta prueba de carrera/autoplay. |
| Placas | 🟡 PARCIAL | El Admin controla `active_placa` y pantalla gigante renderiza; varios assets son estáticos. |
| Novedades Admin | 🟡 PARCIAL | CRUD real de `banners` y biblioteca de medios. |
| Playlists YouTube internas | 🔴 ROTA / NO REPRODUCIBLE | Usa `playlists`, `playlist_items`, `playlist_categories`, `playlist_to_category`; ninguna se crea en SQL versionado. Puede funcionar sólo si la base remota tiene esquema fuera de Git. |
| Usuarios/roles | 🟡 PARCIAL | `UsuariosPanel` y roles recientes en `admin_users`; falta validar autorización/RLS real. |
| Pantalla gigante `/pantalla` | 🟡 PARCIAL | Consume juego, mensajes, videos, placas y Duelo; no es la misma salida que `/tv`. Necesita gesto de audio y conserva flag local. |
| TV nueva `/tv` | 🟡 PARCIAL | Motor DJ real, token y dos players. No muestra los juegos históricos. |
| Diseñador general `/designer` | 🟠 SOLO UI / MOCK | Editor rico, assets y publish locales; no altera WebApp/Admin/TV/Pantalla reales. |
| Diseñador TV | 🟡 PARCIAL | Guarda `tv_canvas_config`, pero el runtime TV todavía lee localStorage fijo. |
| Diseñador invitado | ⚪ ESQUELETO | El Admin muestra “próxima etapa”; no hay componente/runtime. |

# 3. ANÁLISIS DE PUNTA A PUNTA

## Sesión compartida

`useGameState.js` busca una fila `sessions.is_active=true` con `.maybeSingle()` y luego una fila `game_state`. Realtime escucha todos los UPDATE de `game_state` y filtra el `session_id` dentro del callback. Conserva datos tras refresh porque vuelve a Supabase. Sin embargo:

- no hay restricción SQL visible que garantice una única sesión activa;
- `.maybeSingle()` falla si hay más de una;
- el cliente no observa INSERT/DELETE de sesiones, por lo que si carga sin sesión activa queda “esperando” pero no se suscribe a `sessions` para detectar que el Admin abra una después;
- las escrituras Admin actualizan por `session_id`, pero no verifican cantidad de filas afectadas;
- `gameState` se pierde antes de llegar a componentes de juegos por el error de props de `App.jsx`.

Persistencia: Supabase, salvo preferencias/UI. Multiusuario: previsto mediante Realtime, **NO CONFIRMADO** en prueba de carga.

## Mensajes

Cliente (`PantallaView` → `useMessages.send`) → INSERT `messages` pendiente → Admin (`MensajesPanel`) aprueba/rechaza → Realtime actualiza cliente y pantalla → `/pantalla` muestra aprobado. El circuito está presente. Se corta la certeza en RLS/deploy y prueba real; no en una ausencia obvia de código.

## Videoclips históricos

Cliente toma catálogo de playlists → crea `video_requests` → si la cola está vacía, `useVideoRequests` intenta autoaprobar 100 ms después → Admin también puede aprobar → `/pantalla` consulta el video `launched` → iframe/reproductor. `video_votes` y el bucket `videos-locales` se usan, pero no aparecen creados/configurados de forma completa en las migraciones incluidas. Riesgo de doble decisión cliente/Admin y de depender de objetos remotos no versionados.

## Novedades

Admin CRUD `banners` → Supabase → `useBanners` carga y escucha cambios → WebApp renderiza. La imagen puede ser URL directa o join con `media_assets`; Storage `bizarren-media` sí tiene migración. Este circuito está bien delineado, sujeto a prueba RLS.

# 4. FLUJOS DE JUEGOS

## Rey del Orto

| Paso | Estado |
|---|---|
| Cliente abre juego | FALLA funcionalmente: abre, pero sin `gameState` |
| Sesión | OK en `useGameState` |
| Supabase/estado | Admin marca `raffle_state`; Edge Function elige entre `connected_users` y actualiza `game_state` |
| Admin | OK en código: lanza y resetea |
| Pantalla gigante | PARCIAL: `RaffleScreen` consume `gameState` |
| Resultado | Guardado en `game_state` |
| Cliente recibe resultado | FALLA: prop ausente y `useRaffle` local no deriva winner |

## Desafío Demente / Trivia

Cliente → `useTriviaVoter` inserta un voto único en `trivia_votes` → Realtime actualiza totales → Admin controla preguntas/fases mediante `game_state` → pantalla gigante muestra pregunta/totales/ganador → cliente debería revelar respuesta. Corte actual: cliente sin `gameState`; acumulado depende de `trivia_totals` no versionado. También el hook mantiene optimistamente el voto aun ante cualquier error, no sólo duplicado, por lo que puede mostrar “enviado” aunque RLS/red fallen.

## Duelo

Cliente → INSERT `duelo_postulaciones` → Admin ve lista y selecciona dos → `game_state` publica fase/participantes → `/pantalla` monta `DueloBigscreen` → micrófono mide aplauso y llama `applause_add` → RPC agrega conteo → Admin/pantalla reciben Realtime → `applause_finish` resuelve ganador. Es el juego más avanzado.

Cortes/riesgos:

- `duelo_postulaciones` no está creada por las migraciones incluidas;
- RLS de esa tabla no es auditable desde el repo;
- el cliente no puede retirar su postulación;
- la captura de micrófono, permisos y calibración requieren HTTPS/hardware real;
- no se verificó cómo el resultado vuelve y persiste en el cliente tras refresh;
- no hay tests de concurrencia para llamadas acumulativas del aplausómetro.

## Follow the Leader, Personal Trainer y Karaoke

Cliente → `escenario_queue` → Realtime → Admin llama/actualiza estado → pantalla muestra escenario/video. Persisten en Supabase y soportan varios usuarios por diseño. No tienen resultado formal ni un ciclo de ronda completo; son colas operativas, no juegos terminados según los diez criterios.

## Sumate que sumamos / Arma la palabra

Admin publica un payload → cliente muestra un número/letra → pantalla puede anunciar el juego. No hay acción cliente, asignación individual segura, matching entre usuarios, confirmación, ganador ni resultado persistido. El flujo se corta inmediatamente después de mostrar la consigna.

## Cumplimiento de los 10 criterios de terminado

Leyenda: ✓ presente en código; ~ parcial/no probado; ✗ ausente o roto.

| Juego | 1 abre | 2 sesión | 3 participa | 4 persiste | 5 Admin | 6 pantalla | 7 resultado | 8 refresh | 9 multiusuario | 10 reset | Terminado |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Rey del Orto | ~ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ~ | ✓ | NO |
| Trivia | ~ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ cliente | ~ | ~ | ✓ | NO |
| Duelo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ~ | ✓ | NO |
| Follow Leader | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✓ | NO |
| Personal Trainer | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✓ | NO |
| Karaoke | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✓ | NO |
| Sumate | ✓ | ✓ | ✗ | ✗ | ~ | ~ | ✗ | ✗ | ✗ | ~ | NO |
| Arma la palabra | ✓ | ✓ | ✗ | ✗ | ~ | ~ | ✗ | ✗ | ✗ | ~ | NO |

**Ningún juego cumple hoy los diez puntos con evidencia suficiente.**

# 5. DJ DEMOCRACY / MÚSICA

## Circuito actual

1. Admin crea/importa temas a `pantalla_playlist_items` y configura `pantalla_events`.
2. Admin inicia evento mediante `pantalla_start_event` y obtiene link TV con token.
3. Cliente descubre el único evento `live`, ejecuta `pantalla_join_event`, heartbeat y carga candidatos.
4. Cliente vota por RPC (`cast`, `clear`, `super`) y reacciona por INSERT.
5. RPCs recalculan score/candidatos y Realtime actualiza cliente, Admin y TV.
6. `/tv` valida código/token mediante `pantalla_resolve_tv`, carga `current_item_id`, reproduce con dos players y reporta progreso.
7. Al terminar/error/crossfade, TV llama `pantalla_tv_song_ended`; el servidor valida el item esperado y avanza.
8. Admin puede congelar/reiniciar votos, forzar avance, editar/eliminar/reordenar y cerrar/resetear el evento.

Persistencia: Supabase para evento, lista, votos y historial. Preferencias/diseño TV todavía parcialmente locales. Multiusuario: diseñado para concurrencia mediante RPCs `SECURITY DEFINER`; requiere pruebas reales de RLS y contención.

## Búsqueda y playlists

- Hay búsquedas/catálogos mediante YouTube Data API y fallback/config local en `useYouTubePlaylists.js`.
- Las playlists históricas del bar usan tablas `playlists*`, no creadas en SQL versionado.
- La playlist del evento nuevo usa `pantalla_playlist_items` y RPCs versionadas.
- Se soportan título/artista, recortes, volumen, fijado, bloqueo, enable/disable, importación y reordenamiento.
- No existe descarga fiable de duración previa: muchos temas pueden tener `duration_seconds=NULL`; la duración efectiva depende del player TV.

## Votos, reacciones, “sacar tema” y sincronización

- Votos positivos/negativos y supervotos están encapsulados en RPCs.
- Reacciones se insertan directamente y TV las escucha en un canal con cleanup.
- Kick usa `pantalla_toggle_kick_vote`/`pantalla_get_kick_status`; el avance resultante llega como cambio externo de `current_item_id`.
- Todos los hooks revisados eliminan sus canales al desmontar. Los nombres incluyen evento/usuario y, en Pantalla, sufijos por instancia para evitar colisiones.
- React StrictMode monta efectos dos veces en desarrollo; los cleanup presentes reducen el riesgo, pero no reemplazan una prueba de duplicación en producción.

## Bug histórico: canciones que cambian solas

**Estado: mitigado en código actual, NO CONFIRMADO resuelto en operación.**

El motor `useContinuousTvPlayers.js` contiene defensas específicas:

- sólo avanza por `natural-ended`, ventana de crossfade, error/timeout del **player actual**;
- rechaza `ENDED` de player inactivo o item viejo;
- compara siempre contra `latestCurrentRef.current.id`;
- `advancedRef` hace el avance idempotente por tema;
- la RPC recibe `_item_id` como guard de current esperado;
- timeout del standby no avanza;
- `PAUSED`, `CUED`, `BUFFERING`, votos y rerenders no avanzan;
- watcher exige dos muestras válidas;
- la anticipación se limita al 40% de la duración del tema corto;
- todos los intervalos, timers, fades y players se limpian al desmontar;
- corta después de cinco videos no reproducibles.

Causas aún posibles y verificables con trazas:

1. `rain_anticipation_seconds` alto + duración/`trim_end_seconds` corto inicia crossfade legítimo muy pronto. El límite actual reduce, pero no elimina, un cambio temprano en clips extremadamente cortos.
2. YouTube devuelve `ENDED` prematuro o error 2/5/100/101/150; si pertenece al player actual, el diseño ordena saltar.
3. El timeout de 12 s del player actual ordena `error-skip` si nunca arranca, aunque no haya votos negativos.
4. Admin llama `pantalla_advance_event`, o el umbral kick cambia `current_item_id`; TV lo interpreta correctamente como avance externo.
5. Dos instancias TV válidas podrían ambas reportar fin. El guard de item esperado debe volverlo idempotente, pero no hay exclusión de “TV líder” y debe probarse contra la RPC desplegada.
6. El warning de lint por dependencia faltante `current` en el efecto principal merece prueba de stale closure, aunque se usa `latestCurrentRef` precisamente para mitigarlo.
7. Si el backend remoto conserva una versión vieja de `pantalla_tv_song_ended` o de los guards, el frontend nuevo no basta. Hay dos overloads históricos documentados.

Para confirmar causa durante un incidente se necesita consola en modo desarrollo (`[TV ADVANCE]`/`[TV ADVANCE BLOCKED]`), fila de `pantalla_play_history.ended_reason`, timestamps de `pantalla_events.current_item_id`, configuración de recortes y eventos de YouTube. Sin esos datos, atribuirlo a “votos negativos” sería incorrecto.

## Funciones del panel DJ que no llegan al runtime

- equipos y puntajes por equipo;
- asignación automática de equipo;
- logros y premios automáticos;
- premios otorgados visibles en cliente/TV;
- tandas automáticas cada N temas;
- audio propio/MP3;
- contactos derivados del ingreso;
- limpieza automática de invitados;
- efectos visuales por broadcast;
- QRs firmados por roles;
- mayor subida/caída histórica;
- link corto `/t/:codigo`.

Estas secciones no están “rotas” como formularios: guardan configuración. Sí están incompletas como producto porque ningún motor la ejecuta.

# 6. SUPABASE Y REALTIME

## Tablas/objetos utilizados

| Tabla/objeto | Uso principal | R/W | Realtime | ¿Creada en SQL versionado? |
|---|---|---|---|---|
| `profiles` | perfil, geo, equipo | R/W | no directo | sí |
| `admin_users` | autorización/roles | R/W | no | sí |
| `sessions` | sesión activa | R/W | no en cliente | sí |
| `connected_users` | presencia y sorteos | R/W | sí | sí |
| `game_state` | estado global juegos/pantalla | R/W | sí | sí |
| `trivia_votes` | votos por pregunta | R/W | sí | sí |
| `trivia_totals` | vista/tabla de acumulados | R | indirecto | **no** |
| `messages` | mensajes moderados | R/W | sí | sí |
| `video_requests` | cola y reproducción | R/W | sí | sí |
| `video_votes` | votos de video | R/W | sí | **no** |
| `banners` | novedades | R/W | sí | sí |
| `escenario_queue` | colas karaoke/FTL/PT | R/W | sí | sí |
| `coupons` | cupones usuario | R/W | sí | sí |
| `push_subscriptions` | endpoints push | R/W | no | **no** |
| `duelo_postulaciones` | candidatos Duelo | R/W | sí | **no** |
| `applause_sessions/counts/user_contrib` | rondas y conteos | R/W/RPC | sí | sí |
| `media_assets` | catálogo Storage | R/W | no | sí |
| `playlists`, `playlist_items` | playlists históricas | R/W | sí | **no** |
| `playlist_categories`, `playlist_to_category` | categorías | R/W | sí | **no** |
| `pantalla_events` | evento/config/estado TV | R/W/RPC | sí | sí |
| `pantalla_event_secrets` | token TV/código premio | R/W/RPC | no público | sí |
| `pantalla_playlist_items` | playlist/ranking | R/W/RPC | sí | sí |
| `pantalla_participants` | invitados/roles | R/W/RPC | sí | sí |
| `pantalla_votes` | votos | R/RPC | sí | sí |
| `pantalla_vote_powers` | pesos/habilitación | R/W | sí | sí |
| `pantalla_kick_votes` | sacar tema | RPC | sí | sí |
| `pantalla_reactions` | emojis | W/R | sí | sí |
| `pantalla_play_history` | historial | R/RPC | sí | sí |
| `pantalla_teams` | configuración equipos | R/W | no runtime | **no** |
| `pantalla_vip_gifts` | regalos VIP | R/W | no runtime | **no** |
| `pantalla_emoji_packs` | emoji por rol | R/W | no runtime | **no** |
| `pantalla_gifs` | transición/premio | R/W | no runtime completo | **no** |
| `pantalla_ad_clips` | tandas | R/W | no motor | **no** |
| `pantalla_achievements` | logros | R/W | no motor | **no** |
| `pantalla_prizes` | premios | R/W | no cliente/TV | **no** |
| `pantalla_granted_rewards` | premios otorgados | R/W | no cliente/TV | **no** |
| `pantalla_physical_prizes` | premio físico | R/W | no runtime | **no** |
| `pantalla_playlist_presets` | orden guardado | R/W | no | **no** |
| `pantalla_short_links` | links cortos | R/W | sin resolver público | **no** |

`menu_items` sí se crea en `schema.sql`, pero la WebApp actual no lo consulta.

**Hallazgo crítico:** las tablas marcadas “no” pueden existir en la base desplegada, pero no son reconstruibles desde este repositorio. Esto contradice una entrega reproducible y deja RLS, constraints, índices y Realtime fuera de auditoría. **REQUIERE VERIFICACIÓN EXTERNA** y luego migraciones idempotentes versionadas.

## RPCs versionadas y propósito

- Aplausómetro: `applause_add`, `applause_finish`.
- Cliente Pantalla: `pantalla_join_event`, `pantalla_heartbeat`, `pantalla_cast_vote`, `pantalla_clear_vote`, `pantalla_cast_super_vote`, `pantalla_get_kick_status`, `pantalla_toggle_kick_vote`.
- Admin: `pantalla_create_event`, `pantalla_duplicate_event`, `pantalla_start_event`, `pantalla_end_event`, `pantalla_reset_event`, `pantalla_reset_votes`, `pantalla_reset_vote_powers`, `pantalla_freeze_voting`, `pantalla_advance_event`, `pantalla_refill_candidates`, `pantalla_add_items`, `pantalla_import_playlist`, `pantalla_set_participant_role`, `pantalla_remove_participant`, `pantalla_get_tv_link`, `pantalla_regenerate_tv_token`.
- TV: `pantalla_resolve_tv`, `pantalla_tv_report`, `pantalla_tv_song_ended`.
- Auxiliares internos: `pantalla__recalc`, `pantalla__advance`, `pantalla__active_count`, `pantalla__ensure_participant`, `pantalla__opposite`, `pantalla__new_code`, `pantalla__tv_authorized`, `pantalla_can_manage`.

No se detectaron llamadas literales a RPCs que falten en migraciones. Muchas llamadas pasan por el wrapper dinámico `rpc(fn, args)`, por lo que una búsqueda literal simple no las muestra.

## Inventario Realtime

| Canal/patrón | Tabla/evento | Consumidor | Cleanup | Riesgo |
|---|---|---|---|---|
| `game-state-{session}` | UPDATE `game_state` | cliente/Admin/pantalla | sí + reconexión | sin filtro server-side; filtra callback |
| `messages-{session}-{role}` | `messages` | cliente/Admin/pantalla | sí | nombres compartidos por rol podrían colisionar si hay instancias duplicadas |
| `video_requests_{session}` | `video_requests` | Admin/pantalla | sí | refetch completo |
| `video_votes_{session}` | `video_votes` | Admin | sí | tabla no versionada |
| `banners_{session/global}` | `banners` | WebApp | sí | banners mayormente globales |
| `escenario-queue-{session}-{type}` | `escenario_queue` | cliente/Admin | sí | refetch completo |
| `duelo_postulaciones_{session}` | `duelo_postulaciones` | cliente/Admin | sí + reconexión | tabla/RLS no versionada |
| `trivia-votes-*` | INSERT `trivia_votes` | totales | sí | debounce 300 ms |
| `trivia-accumulated-*` | INSERT `trivia_votes` | acumulado | sí | consulta objeto faltante |
| `applause:*` | `applause_sessions/counts` | Duelo | sí | alta frecuencia; requiere carga |
| `applause_bigscreen_*` | `applause_sessions` | pantalla | sí | — |
| cuatro `playlist*_ch` | tablas playlists | Admin/cliente | sí | nombres globales; riesgo si hook se monta dos veces |
| `pantalla-ev-*` | evento + items | todas superficies nuevas | sí | sufijo por instancia correcto |
| `pantalla-live-watch-*` | todos los eventos | cliente DJ sin evento | sí | refetch ante cualquier cambio |
| `pantalla-mine-*` | votos/participante propio | cliente DJ | sí | — |
| `pantalla-admin-*` | participantes/votos | Admin | sí | — |
| `pantalla-tv-reactions-*` | reacciones | TV | sí | — |
| `coupons-*` | cupones | cliente | sí | — |

No se encontró una subscription sin cleanup evidente. Sí hay potencial de canales con nombre fijo (`playlists_ch`, etc.) si el hook se monta en más de una superficie dentro del mismo cliente Supabase.

# 7. DISEÑADORES DE PANTALLA

## Diseñador general `/designer`

- Guarda borradores en `localStorage` con claves `bizarren-designer-draft-*`.
- Assets propios y componentes reutilizables también son locales.
- “Publicar” sólo copia JSON a una clave `localStorage` `...published...`.
- `ClientHomePreview` sí consume esa clave.
- `src/App.jsx`, Admin, `/pantalla` y `/tv` no consumen ese documento.
- Los datos del preview provienen de `views/Designer/data/clientHomeData.js`, no del runtime real.

**DISEÑADOR FUNCIONA COMO EDITOR PERO NO ESTÁ INTEGRADO AL RUNTIME.**

## Diseñador TV

- Formato: JSON de `DEFAULT_TV_CONFIG`, con `screen`, bloques estándar y `customBlocks`.
- Resuelve el evento guardado por el panel o el evento live.
- Lee/escribe `pantalla_events.tv_canvas_config` mediante `pantallaConfig.js`.
- Mantiene espejo en `localStorage` para compatibilidad.
- `/tv` no lee `event.tv_canvas_config`; inicializa `loadTvConfig("default")` y escucha sólo `bizarr-tv-canvas-config:default`.

Consecuencia: el diseño guardado puede viajar en Supabase, pero no llega automáticamente a otra máquina TV. Todos los eventos comparten la misma clave local `default`. Hoy hay que guardar/replicar localmente en la máquina del proyector.

## Diseñador invitado

Sólo hay funciones base `loadGuestConfig/saveGuestConfig` y una opción Admin que dice “próxima etapa”. No hay editor ni consumidor. **ESQUELETO**.

# 8. HARDCODE, MOCKS Y CÓDIGO LEGACY

- Carta completa hardcodeada en `src/constants/menuData.js`.
- Datos/constantes visuales y equipos en `src/constants/data.js` y `theme.js`.
- Diseñador general usa `mockData.js` y runtime data estática para preview.
- Assets demo en `public/novedades-demo`.
- `src/BizarrApp WebApp Festival.tsx`: WebApp monolítica antigua no importada.
- El Admin y la pantalla gigante siguen siendo archivos monolíticos de ~405 KB y ~298 KB; convive código histórico con módulos nuevos.
- Dos sistemas de playlist: local/config YouTube y tablas internas; además playlist Pantalla v2.
- Dos pantallas físicas con responsabilidades distintas: `/pantalla` histórica y `/tv` DJ.
- Dos diseñadores distintos y persistencias incompatibles.
- TODO explícito: retirar postulación de Duelo no implementado.
- Placeholders explícitos: diseñador invitado; efectos TV, supervotos por equipos y QRs de roles deshabilitados; mayor subida/caída en `—`.
- Alertas de navegador en acciones Admin/destructivas y diseñador; deben revisarse para operación, aunque no son por sí mismas un fallo.
- Logs de depuración abundantes en `useVideoRequests`, `useDueloPostulaciones`, `useGameState`, media y TV. Algunos incluyen IDs/metadatos operativos, no keys.
- IDs/valores fijos relevantes: diseñador TV usa sesión `"default"`; preferencias de panel/anchos/audio se guardan localmente; QR cliente usa `?pantallaCode=`.
- URL fija de YouTube IFrame API y thumbnails es esperable; API key proviene de env.
- `useVideoRequests` usa `setTimeout(100)` para auto-lanzar cola vacía: solución temporal susceptible a carrera.
- Sorteo nuevo de reconocimientos en panel se resuelve en cliente con aleatoriedad local y luego persiste una fila; es auditable sólo después de guardar, no antes.

# 9. ERRORES TÉCNICOS Y CALIDAD

## Build

`npm.cmd run build`: **OK**. Advertencia de chunk principal mayor a 500 KB. El enrutamiento carga Admin, diseñadores y pantallas en el mismo bundle porque son imports estáticos; conviene code splitting por ruta en una fase posterior.

## Lint

0 errores y 13 warnings:

- variables sin usar en `PantallaDjPanel.jsx` (2), `CouponScreen.jsx` (1), `useVideoRequests.js` (1), `EscenarioView.jsx` (3), `JuegosView.jsx` (2), `PantallaView.jsx` (1);
- dependencia `config` faltante en `useYouTubePlaylists.js`;
- dependencia `current` faltante en `useContinuousTvPlayers.js`;
- dependencias `onSave` y `user?.geoOk` faltantes en `ProfileView.jsx`;
- `package.json` no declara `"type":"module"`, aunque `eslint.config.js` usa ESM; Node lo reparsa y advierte costo.

## Defectos/riesgos concretos

1. Prop `gameState` omitida en `App.jsx` hacia Juegos/Escenario.
2. `useRaffle` no consume el estado del backend aunque el llamador se lo pasa.
3. `useTriviaVoter` conserva éxito optimista ante cualquier error de INSERT.
4. `useGameState` no detecta creación posterior de una sesión si arrancó sin sesión.
5. Varias consultas `.maybeSingle()` presuponen unicidad no garantizada por índice visible.
6. `updateEvent`/`updateItem` y controles Admin históricos no comprueban cero filas afectadas por RLS.
7. El nuevo código de guardado sí hace `.select("id")`; conviven ambos patrones.
8. La TV no consume diseño Supabase.
9. Links cortos se crean pero no existe ruta `/t/:codigo` ni RPC pública de resolución.
10. Configuración de audio propio/tandas no tiene bucket/runtime.
11. El schema del frontend supera ampliamente las migraciones versionadas.
12. No hay Error Boundary global; errores de render pueden tumbar una superficie completa.
13. No hay tests unitarios, integración, E2E ni smoke test automatizado de rutas.
14. No hay typecheck: gran parte es JS/JSX y los `.tsx` monolíticos no están bajo `tsc`.
15. El bundle grande aumenta tiempo de arranque en celulares y superficies que no necesitan Admin.

# 10. GIT

- Rama: `panel-pantalla-reestructura`.
- HEAD: `9269086`.
- Cambio local rastreado previo: `supabase/.temp/cli-latest`, de `v2.105.0` a `v2.116.0`.
- Archivo no rastreado previo: `.claude/settings.local.json`.
- Archivo autorizado creado por esta auditoría: `AUDITORIA_BIZARRAPP_ACTUAL.md`.
- El build escribió `dist`, pero está ignorado/no aparece como cambio rastreado.
- No se hizo commit, push, merge, checkout ni reset.

Commits recientes muestran una reestructura muy activa del panel Pantalla: roles Admin, cabecera/evento, timers/crossfade, diseñador TV, sorteos, playlist, contactos, filtros, recompensas, consola y configuraciones. Hay **riesgo de perder** los dos cambios locales previos si se limpia el árbol sin revisarlos; su impacto funcional parece bajo para `.temp`, pero `.claude/settings.local.json` puede contener preferencias de desarrollo.

# 11. PRODUCCIÓN VS LOCAL

## Confirmado en repositorio

- Vercel ejecuta `npm run build`, publica `dist` y reescribe toda ruta a `index.html`.
- Vite escucha en `0.0.0.0:5173` en desarrollo.
- Sourcemaps deshabilitados en producción.
- React/ReactDOM se separan en chunk; el resto queda en un bundle muy grande.
- PWA registra `/sw.js`; debe revisarse política de caché al desplegar versiones.
- Geo en móvil local puede requerir HTTPS; el comentario de Vite lo reconoce.

## No confirmado

- Branch conectada a producción: **REQUIERE VERIFICACIÓN EXTERNA**. Estar en `panel-pantalla-reestructura` no prueba que Vercel despliegue esa rama.
- Valores de env por Production/Preview: **REQUIERE VERIFICACIÓN EXTERNA**.
- Que `VITE_GUEST_LOGIN` y `VITE_SKIP_GEO` estén apagadas: **REQUIERE VERIFICACIÓN EXTERNA**.
- Dominio/redirect URLs de Supabase Auth: **REQUIERE VERIFICACIÓN EXTERNA**.
- Migraciones realmente aplicadas, tablas extra, RLS y Realtime publication: **REQUIERE VERIFICACIÓN EXTERNA**.
- Deploy de Edge Functions y secretos VAPID: **REQUIERE VERIFICACIÓN EXTERNA**.
- Restricciones/referrer y cuota de YouTube API: **REQUIERE VERIFICACIÓN EXTERNA**.

# 12. MATRIZ FINAL

| Prioridad | Sección | Estado | UI | Backend | Cliente | Admin | TV/Pantalla | Realtime | Problema principal |
|---|---|---|---|---|---|---|---|---|---|
| P0 | Contrato Supabase | 🔴 ROTA | n/a | incompleto en Git | afecta | afecta | afecta | no auditable | muchas tablas/RLS no versionadas |
| P0 | Estado global de juegos | 🔴 ROTA | sí | sí | roto | sí | sí | sí | `gameState` no llega a vistas cliente |
| P0 | Validación operativa | 🔴 ROTA | — | — | no probada | no probada | no probada | no probado | cero E2E/tests |
| P1 | DJ Democracy | 🟡 PARCIAL | completa | amplio | sí | sí | `/tv` | sí | falta prueba real y concordancia backend |
| P1 | Duelo | 🟡 PARCIAL | completa | parcial | sí | sí | `/pantalla` | sí | tabla/RLS no versionada y cierre no probado |
| P1 | Mensajes | 🟡 PARCIAL | completa | sí | sí | sí | `/pantalla` | sí | RLS/flujo real no confirmado |
| P1 | Videos | 🟡 PARCIAL | completa | parcial | sí | sí | `/pantalla` | sí | objetos no versionados y carrera auto-launch |
| P1 | Auth/perfil/geo | 🟡 PARCIAL | completa | sí | sí | roles | indirecto | auth listener | configuración remota no confirmada |
| P1 | Rey del Orto | 🔴 ROTA | completa | sí | roto | sí | sí | game_state | cliente nunca deriva ganador |
| P1 | Trivia | 🔴 ROTA | completa | parcial | roto | sí | sí | sí | prop ausente + `trivia_totals` faltante |
| P2 | Novedades | 🟡 PARCIAL | completa | sí | sí | sí | no | sí | sólo falta validación real |
| P2 | Escenario colas | 🟡 PARCIAL | completa | sí | sí | sí | parcial | sí | sin resultado/ciclo completo |
| P2 | Playlists internas | 🔴 ROTA | completa | no versionado | consume | gestiona | videos | sí | cuatro tablas ausentes del SQL |
| P2 | Diseñador TV | 🟡 PARCIAL | completa | guarda | n/a | sí | no consume DB | no | runtime usa localStorage fijo |
| P2 | Menú | 🟠 SOLO UI / MOCK | completa | desconectado | estático | aparente | no | no | ignora `menu_items` |
| P2 | Push | 🟡 PARCIAL | sí | Edge Function | sí | dispara | no | no | deploy/secretos no confirmados |
| P2 | Premios/equipos/logros | 🟠 SOLO CONFIG | completa | tablas remotas | no | configura | no | no | falta motor y consumidores |
| P2 | Tandas | 🟠 SOLO CONFIG | completa | parcial | no | configura | no inserta | no | falta motor/bucket audio |
| P2 | Links cortos | 🔴 ROTA | completa | guarda | no resuelve | configura | no | no | falta ruta y RPC pública |
| P2 | Sumate | 🟠 SOLO UI / MOCK | básica | no | pasivo | payload | placa | game_state | no existe juego multiusuario |
| P2 | Arma palabra | 🟠 SOLO UI / MOCK | básica | no | pasivo | payload | placa | game_state | no existe juego multiusuario |
| P3 | Diseñador general | 🟠 SOLO UI / MOCK | rica | localStorage | no consume | preview | no | no | publicación sólo local |
| P3 | Diseñador invitado | ⚪ ESQUELETO | placeholder | config base | no | no | no | no | componente inexistente |
| P3 | Código legacy | ⚫ LEGACY | duplicada | mixto | no enroutado | monolitos | monolito | mixto | eleva mantenimiento/confusión |

# BLOQUEADORES PARA USAR BIZARRAPP EN EL BAR

## P0-01 — Base de datos no reproducible

El código llama tablas esenciales que no existen en las migraciones incluidas. Sin capturar el esquema real, no se puede desplegar staging, verificar RLS ni recuperar producción con certeza.

## P0-02 — Juegos cliente sin estado

`App.jsx` omite `gameState` al renderizar `JuegosView` y `EscenarioView`. Rey del Orto, Trivia y vistas que dependen del payload no reciben la ronda activa.

## P0-03 — Rey del Orto no muestra resultado al cliente

`useRaffle` mantiene una animación local independiente, ignora `gameState` y nunca establece el ganador desde Supabase.

## P0-04 — Trivia cliente no completa el circuito

La UI no recibe pregunta/fase por el error de props. Aunque el voto se inserte, puede mostrar éxito ante fallo y el acumulado usa un objeto no versionado.

## P0-05 — Sin validación end-to-end

No existe evidencia ejecutable de una noche real: sesión + múltiples celulares + Admin + `/pantalla` + `/tv` + refresh/reconexión. Para un sistema en vivo, esto bloquea afirmar aptitud operativa.

## P0-06 — DJ/TV requiere prueba controlada antes de público

El motor está defensivamente diseñado, pero YouTube, autoplay, errores, doble TV, crossfade, recortes y la versión de RPC remota no fueron verificados. El bug histórico sólo puede considerarse mitigado, no cerrado.

## P0-07 — Dos salidas de pantalla no equivalentes

`/pantalla` muestra juegos/mensajes/videos; `/tv` reproduce DJ. No hay una salida única que garantice todas las experiencias. El operador debe alternar o usar dos superficies y esto necesita un procedimiento explícito.

# 13. PLAN DE CIERRE

Estimación relativa: S (horas), M (1–3 días), L (varios días), XL (proyecto).

## FASE 1 — BASE OPERATIVA

| Orden | Tarea | Dificultad | Dependencia | Riesgo | Archivos/áreas | Tamaño |
|---:|---|---|---|---|---|---|
| 1 | Exportar/comparar esquema remoto y versionar todas las tablas, RLS, índices, publications, buckets y vistas faltantes | alta | acceso Supabase | alto | `supabase/` | L |
| 2 | Crear Supabase de staging desde cero sólo con migraciones y datos semilla mínimos | alta | 1 | alto | `supabase/`, env externo | L |
| 3 | Definir unicidad de sesión activa/evento live y conducta sin sesión | media | 1 | alto | schema, `useGameState`, `pantallaDj` | M |
| 4 | Reparar contrato de props `gameState` y añadir smoke tests de vistas | baja | 2 | medio | `App.jsx`, Juegos/Escenario | S |
| 5 | Probar auth, registro, confirmación, reset, geo, invitado y roles en staging | media | 2 | alto | `useAuth`, Auth views, Admin | M |
| 6 | E2E de mensajes, video, presencia, refresh y reconexión con 3 clientes | media | 2–5 | alto | hooks Realtime, bigscreen | M |
| 7 | Documentar qué pantalla física usa `/pantalla` y cuál `/tv`, o diseñar un orquestador único | alta | 6 | alto | bigscreen/tv/Admin | L |
| 8 | Añadir observabilidad segura: estado de canales, versión frontend/schema y motivos de avance | media | 2 | medio | hooks, TV, Admin | M |

## FASE 2 — DJ DEMOCRACY

| Orden | Tarea | Dificultad | Dependencia | Riesgo | Archivos | Tamaño |
|---:|---|---|---|---|---|---|
| 1 | Verificar versión exacta de RPCs desplegadas y overloads | media | Fase 1 | alto | migraciones `pantalla_*` | S |
| 2 | Banco de prueba YouTube: normal, short, recorte, bloqueado, error, buffering, autoplay y fin | alta | staging | alto | `useContinuousTvPlayers.js`, `PantallaTV.jsx` | L |
| 3 | Ensayar dos TVs y llamadas concurrentes de fin/kick/manual | alta | 2 | alto | TV + RPC advance | M |
| 4 | Capturar trazas del bug histórico y validar cada `ended_reason` | media | 2 | alto | TV/history | M |
| 5 | Integrar `tv_canvas_config` remoto en `/tv` por evento | media | Fase 1 | medio | `PantallaTV`, `TvDesigner`, persistence | M |
| 6 | Decidir/eliminar playlists duplicadas y localStorage de configuración pública | alta | flujo validado | medio | hooks playlists/services | L |
| 7 | Sólo después: tandas, equipos, premios, contactos y efectos, uno por circuito completo | alta | 1–6 | alto | panel/services/SQL/TV/client | XL |

## FASE 3 — JUEGOS

Orden por cercanía a terminado:

1. **Duelo** — dificultad alta, riesgo alto, L. Versionar postulaciones/RLS; probar selección, aplauso, ganador, refresh, reconexión, reset y permisos de micrófono.
2. **Trivia** — dificultad media, riesgo medio, M. Pasar estado, versionar/reemplazar `trivia_totals`, rollback de voto fallido y test de ronda completa.
3. **Rey del Orto** — dificultad media, riesgo medio, M. Derivar animación/ganador desde `game_state`, validar Edge Function y cupones.
4. **Karaoke** — dificultad media, riesgo medio, M. Cerrar llamado, reproducción, final y estado cliente.
5. **Follow the Leader** — dificultad media, M. Igual que Karaoke, sin selección vocal.
6. **Personal Trainer** — dificultad baja/media, S–M. Cerrar estado de turno/fin.
7. **Sumate que sumamos** — dificultad alta, XL. Diseñar asignación individual, matching, validación, ganador, pantalla y reset; hoy no hay motor.
8. **Arma la palabra** — dificultad alta, XL. Mismo faltante estructural.

No iniciar Ruleta o Karaoke de doblaje antes de cerrar los juegos existentes.

## FASE 4 — DISEÑADOR

1. Elegir un solo sistema de documentos y targets — alta, L.
2. Conectar publicación a Supabase con versión/borrador/publicado — alta, L.
3. Hacer que WebApp y/o TV consuman documento publicado con fallback — alta, L.
4. Migrar assets de IndexedDB/localStorage a `media_assets` — alta, L.
5. Recién entonces implementar diseñador invitado — alta, XL.

Dependencia: base estable y decisión de runtime de pantallas. Riesgo: alto porque el diseñador puede inutilizar navegación si publica documentos inválidos; necesita validación y rollback.

## FASE 5 — MEJORAS

- Code splitting por superficie/ruta — media, M.
- Separar monolitos Admin/pantalla histórica — alta, L, sólo con tests previos.
- Reducir logs y establecer logging por entorno — baja, S.
- Resolver warnings de hooks/variables — baja/media, S.
- Añadir Error Boundaries y estados offline/reconexión — media, M.
- CI con build, lint, migración desde cero y E2E — media/alta, L.
- Revisar service worker/cache busting y actualización forzada en pantallas — media, M.
- Prueba de carga de Realtime y aplausómetro — alta, M–L.

# 14. CRITERIO DE ACEPTACIÓN OPERATIVA

Antes de declarar BizarrApp lista para el bar, cada sección debe demostrar en staging y luego en una prueba cerrada:

1. migración limpia desde cero;
2. RLS con usuario, invitado, Admin y TV anon/token;
3. dos Admin/TV no producen doble acción;
4. al menos cinco clientes concurrentes reciben el mismo estado;
5. refresh durante cada fase recupera la ronda;
6. caída/reconexión de red no duplica votos/listeners;
7. errores de YouTube no crean loops;
8. reset deja una ronda realmente nueva;
9. resultado persiste y vuelve a cliente/Admin/pantalla;
10. consola sin errores y trazas suficientes para diagnosticar.

Hasta completar esas pruebas, el estado correcto del proyecto es: **base técnicamente prometedora, build sano, muchas superficies implementadas, pero operación real NO CONFIRMADA y varios flujos críticos incompletos o rotos.**
