# REPORTE FINAL — Reestructura del panel «Pantalla»

Rama: `panel-pantalla-reestructura` · Base: `master` (`83c63ca`) · 38 commits
Complementa a [REPORTE.md](REPORTE.md), que tiene el descubrimiento de la FASE 0.

Contrato de datos usado: **Pantalla / DJ — Schema v2 (28-08-2026)**. Cada nombre de columna,
cada CHECK y cada policy de RLS se leyó de `information_schema` / `pg_constraint` / `pg_policy`
antes de escribir el update. El anexo se usó como guía, no como fuente.

---

## 0. Cómo se verificó — leelo antes de la tabla

**Verificado:**

- `npm run build` sin errores, después de cada ítem.
- `npx eslint src` → **0 errores y 0 warnings nuevos**. Los 10 que quedan son preexistentes,
  en archivos que no toqué (`JuegosView`, `PantallaView`, `ProfileView`, `CouponScreen`,
  `useVideoRequests`, `useYouTubePlaylists`, `EscenarioView`).
- Dev server en el puerto 5199: `/admin` responde 200 y cada módulo nuevo transforma sin error
  (pedidos por HTTP uno por uno, incluido `src/tv/PantallaTV.jsx` para confirmar que sigue
  resolviendo después de tocar `persistence.js`).
- **Todas las cargas útiles de escritura, ejecutadas contra la base real.** Se creó un evento
  de prueba dentro de un bloque `DO`, se corrieron los 10 grupos de `UPDATE` de
  `pantalla_events` y los 14 `INSERT`/`UPSERT` de las tablas satélite con los payloads exactos
  que manda el panel, y el bloque termina en `RAISE EXCEPTION` para **abortar la transacción**.
  Resultado: todos los grupos pasaron; nombres de columna, tipos, CHECKs y la forma del jsonb
  de `levels` son correctos. Verificado después: **0 filas residuales**, `LDR4X3` sigue en
  `live` con sus 421 temas.

**No verificado — y por eso no lo afirmo:**

> **No abrí el panel en un navegador.** No tengo herramienta de navegador en esta sesión y
> `/admin` exige sesión de Supabase con fila en `admin_users`. Queda sin comprobar a mano:
> que cada acordeón abra y cierre, que su estado sobreviva a un F5, que un valor guardado
> sobreviva a un F5, y que la consola quede limpia. **Ese paso del criterio de HECHO queda de
> tu lado.** La prueba de payloads de arriba cubre el riesgo principal (nombres de columna y
> restricciones), pero no cubre la RLS: el bloque `DO` corre con rol privilegiado, así que
> valida la forma del dato, no el permiso.
>
> No se tocó ni un dato de ningún evento existente.

---

## 1. Tabla ítem por ítem

**HECHO** = implementado, compila, lintea limpio y su payload está verificado contra la base.

### FASE 0–2

| # | Ítem | Estado |
|---|---|---|
| 0 | Descubrimiento y `REPORTE.md` | HECHO |
| 1 | Menú desplegable en el sidebar | HECHO |
| 2 | Shell de dos columnas + `PanelSection` | HECHO |

**FASE 1** — acordeón inline con el sidebar expandido; flyout `position:fixed` cuando está
colapsado (un `absolute` lo recortaría el `overflow-y:auto` del `.sb-nav`). Abre por hover
**y** por click, y un toque afuera lo cierra: en touch el hover no existe. «Iniciar TV» usa
`pantalla_get_tv_link`; el token no se hardcodea ni se lee por REST. Sin evento activo, los
tres hijos quedan `disabled` con tooltip «No hay evento activo». El padre marca activo cuando
cualquier hijo lo está.

**FASE 2** — `PanelSection` guarda abierto/cerrado en `localStorage` bajo
`bizarrapp_pantalla_sec_<id>`. Guardado por sección con `useGuardado` + `<BotonGuardar>`:
**cero filas afectadas sin error de Supabase se muestra como error** (`rls_sin_filas`), nunca
como éxito. Apilado a `<1100px`, playlist primero.

### Bloque A — núcleo

| # | Sección | Estado | Escribe en |
|---|---|---|---|
| A1 | Código del evento | HECHO | `pantalla_events.code` |
| A2 | Modo de contenido | HECHO | `content_mode` |
| A3 | Modo de votación | HECHO | `voting_mode` |
| A4 | Reglas de votación | HECHO | `active_candidates_count`, `relegation_rounds_threshold`, `reject_score_threshold` |
| A5 | Sacar Tema (+ cartel en TV) | HECHO | `kick_enabled`, `kick_button_text`, `kick_threshold_pct`, `kick_activity_minutes`, `kick_tv_text` |
| A6 | Poderes de usuario | HECHO | `pantalla_vote_powers` + `super_votes_per_user` + RPC `pantalla_reset_vote_powers` |
| A7 | Playlist | HECHO | RPCs `pantalla_add_items` / `pantalla_import_playlist` |
| A8 | Fila de canción | HECHO | `position`, `title`, `artist`, `trim_start_seconds`, `trim_end_seconds`, `youtube_volume`, `pinned`, `locked`, `enabled` |
| A9 | Link TV / vMix | HECHO | RPCs `pantalla_get_tv_link` / `pantalla_regenerate_tv_token` |
| A10 | Invitados | HECHO | `pantalla_participants` + RPCs de rol y expulsión |
| A11 | Reiniciar evento | HECHO | RPC `pantalla_reset_event`, confirmación de dos pasos |
| A12 | Duplicar / finalizar evento | HECHO | RPCs `pantalla_duplicate_event`, `pantalla_end_event`, `pantalla_start_event` |

- **A7** suma, además de lo pedido: importar playlist del bar (existía y se habría perdido) y
  acciones masivas sobre la selección. «Limpiar duplicados» agrupa por `youtube_id`,
  conserva la primera aparición y **nunca borra la que está sonando**. «Exportar lista»
  descarga un `.txt` en el mismo formato que acepta el alta, sin dependencias nuevas.
- **A8** el drag y la posición editable operan sobre la lista completa ordenada por
  `position`, no sobre la vista filtrada: arrastrar con el buscador activo mueve el tema a su
  lugar real. `reorderItems` sube sólo las filas que cambiaron, de a tandas de 25.
- **A8 / duración:** no se calcula nada con `duration_seconds`. Se muestra lo que reporta la
  TV si es el tema actual, `duration_seconds` si algún día se llena, y **un guion** en
  cualquier otro caso. Nunca `NaN` ni `0:00`.
- **A12** incluye «Iniciar evento»: al sacar las pestañas viejas, el editor se quedaba sin
  ninguna forma de poner el evento en vivo.

### Bloque B — configuración de la noche

| # | Sección | Estado | Escribe en |
|---|---|---|---|
| B1 | Subtítulos automáticos de YouTube | HECHO | `youtube_captions_enabled` (dentro de «Modo de contenido», sólo activo en modo video) |
| B2 | Limpieza automática de invitados | HECHO | `guest_cleanup_enabled`, `guest_max_connection_hours` |
| B3 | Ingreso de invitados | HECHO | `nickname_suffixes`, `require_email_mode`, `require_phone_mode` |
| B4 | Base de contactos + CSV | HECHO | lee `pantalla_contacts`. **Sólo lectura**, como pediste |
| B5 | Paquetes de emojis por rol | HECHO | `pantalla_emoji_packs` |
| B6 | Personalización visual | HECHO | `accent_color`, `text_color`, `background_color`, `logo_url`, `background_image_url` |
| B7 | Transición entre canciones | HECHO | `transition_*` + `pantalla_gifs` (`kind='transition'`) |
| B8 | Filtro de contenido | HECHO | `content_filter_enabled`, `content_filter_words` |

- **B2** guarda de verdad, pero la sección **avisa en pantalla que el job no corre**: la base
  no tiene `pg_cron` ni `pg_net` instalados.
- **B5** el parseo de emojis usa `Intl.Segmenter` cuando está: es lo único que agrupa bien un
  emoji compuesto (bandera, familia, tono de piel) en vez de partirlo por code unit.
- **B6** el logo y el fondo salen de la biblioteca de imágenes que el bar ya tiene
  (`MediaLibraryModal` + `media_assets`). No se creó una segunda biblioteca.
- **B8** normaliza a minúsculas, recorta y deduplica antes de guardar, así quien compare del
  lado del servidor no tiene que adivinar el formato.

### Bloque C — juego y premios

| # | Sección | Estado | Escribe en |
|---|---|---|---|
| C1 | Equipos | HECHO | `pantalla_teams` + `teams_enabled` y las 12 columnas `team_*` |
| C2 | Regalos periódicos para VIP | HECHO | `pantalla_vip_gifts` |
| C3 | Recompensas — interruptores | HECHO | `rewards_enabled`, `achievements_auto_enabled` |
| C4 | Catálogo de premios | HECHO | `pantalla_prizes` (8 claves del CHECK) |
| C5 | Logros con niveles | HECHO | `pantalla_achievements`, `levels` en la forma del contrato |
| C6 | Premios reales + lugar de retiro | HECHO | `pantalla_physical_prizes`, `physical_prize_pickup_place` |
| C7 | Código de canje del premio físico | HECHO | **`pantalla_event_secrets.physical_prize_code`** |
| C8 | Premios visuales en TV | HECHO | `giant_reaction_count`, `giant_reaction_scale`, `screen_message_duration_seconds`, `gif_screen_duration_seconds` |
| C9 | Textos de cartel en TV | HECHO | `tv_texts` jsonb, las 9 claves |
| C10 | Galería de GIFs de premio | HECHO | `pantalla_gifs` (`kind='prize'`) |

- **C5** cada nivel es `{threshold, prize_key}`; el premio sale de las 8 claves del CHECK. Un
  nivel se guarda sólo si tiene umbral **y** premio, y se ordenan por umbral al guardar, así
  que no importa en qué fila se carguen. Un checkbox agrega `repeat_last: true` al último
  nivel que quedó. Verificado contra la base con el jsonb exacto.
- **C7** el código vive en `pantalla_event_secrets`, que **no tiene policy de lectura
  pública** — es la misma tabla del token de la TV. Se lee y se escribe sólo con el cliente
  autenticado. El upsert manda únicamente `event_id` y `physical_prize_code`, así que en un
  conflicto **no toca `tv_access_token`** y nadie pierde el acceso de la TV por guardar un
  código. En la UI el campo arranca tapado (`type="password"`) y se vuelve a tapar al cambiar
  de evento: el panel se abre en la barra y se comparte pantalla.

### Bloque D — extras

| # | Sección | Estado | Escribe en |
|---|---|---|---|
| D1 | Tandas publicitarias | HECHO para YouTube | `ads_enabled`, `ads_every_n_songs`, `pantalla_ad_clips`. Cola reordenable por drag y por flechas |
| D2 | Presets de orden de playlist | HECHO | `pantalla_playlist_presets` |
| D3 | Diseñador de Pantalla TV | HECHO con una salvedad (abajo) | `tv_canvas_config` |
| D3 | Diseñador de Pantalla del Invitado | **OMITIDO** | El componente no existe. Sólo hay un placeholder en el sidebar; crearlo desde cero es un proyecto aparte, no un ítem de este checklist |

**D1 — lo que falta:** subir MP3 propios. `pantalla_ad_clips.audio_path` existe, pero no hay
bucket de audio en Storage. La sección lo dice en pantalla y sólo acepta links de YouTube.

**D3 — la salvedad, importante:**

> Pediste cambiar la persistencia del diseñador de `localStorage` a las columnas. Lo hice: el
> diseñador resuelve el evento (el elegido en el panel de Pantalla, o el que esté en vivo),
> **lee de `tv_canvas_config`** y, si esa columna está vacía, migra lo que hubiera en
> localStorage. El primer Guardar lo sube a la base. La cabecera dice contra qué evento
> guarda, y sin evento el botón queda deshabilitado en vez de guardar en el vacío.
>
> **Pero el diseñador sigue escribiendo además una copia en localStorage, a propósito.**
> `src/tv/PantallaTV.jsx` lee `loadTvConfig("default")` de forma **síncrona** y escucha el
> evento `bizarr-tv-config-saved`. La regla 2 me prohíbe tocar la vista TV, así que si
> cortaba el localStorage rompía la TV. Con el espejo, la base es la fuente de verdad y el
> diseño viaja, y la TV de hoy sigue funcionando igual que antes.
>
> `persistence.js` sólo suma `normalizeTvConfig` (cambio aditivo): `loadTvConfig` mantiene su
> firma y su comportamiento, y `PantallaTV.jsx` no se tocó. **Para cerrar del todo la
> migración falta que la vista TV lea `tv_canvas_config` en vez del localStorage** — es un
> cambio del lado de la TV, fuera de alcance.

### FASE 4 — Consola «En vivo»

| Ítem | Estado | Nota |
|---|---|---|
| Sonando ahora + A continuación + transcurrido/restante | HECHO | Restante = `tv_duration − tv_current_time`. Sin TV conectada se dice explícitamente que no hay tiempo |
| Controles: pausar votos, bloquear ranking, reiniciar votos | HECHO | RPCs `pantalla_advance_event`, `pantalla_freeze_voting`, `pantalla_reset_votes` + `voting_disabled` |
| Estadísticas en vivo | HECHO | Invitados, a favor, en contra, súper votos, súper odios, más activo (con nombre), más popular y más rechazada |
| Top N en vivo (+pos / −neg / score) | HECHO | Sobre el canal de Realtime que ya mantiene `usePantallaEvent`; no abre uno nuevo |
| QR para unirse | HECHO | — |
| Link TV / vMix con copiar y regenerar | HECHO | Misma sección que en el editor |
| Invitados con gestión | HECHO | Misma sección que en el editor |
| **Sorteos y reconocimientos manuales** | HECHO | `pantalla_granted_rewards`: `source='raffle'` al sortear, `'manual'` al reconocer. Premio del catálogo habilitado, listado de otorgados y marca de entrega |
| Historial de la noche | HECHO (no estaba en el checklist) | Al sacar las pestañas quedaba sin acceso; vive como una sección más |
| Efectos visuales en TV | Visible y deshabilitado · «requiere RPC» | Falta el canal de broadcast |
| Súper votos por equipo | Visible y deshabilitado · «requiere RPC» | Falta el motor de puntaje de equipos |
| QRs de roles especiales | Visible y deshabilitado · «requiere RPC» | Falta el token firmado por rol |
| Más activo / más popular / mayor subida / mayor caída | Parcial, a propósito | Más activo y más popular **sí** se calculan con los datos ya en memoria. **Mayor subida y mayor caída quedan en `—`**: harían falta fotos del ranking a lo largo de la noche y no se guarda ninguna serie de tiempo. No se inventó ninguna RPC |

**Sobre el sorteo:** se resuelve en el cliente sobre los participantes activos y se guarda
**una sola fila**. La elección del ganador queda registrada, no se recalcula. Un checkbox
visible deja al staff fuera (encendido por defecto), en vez de excluirlo en silencio. Si
`pantalla_prizes` todavía está vacío se ofrecen las 8 claves, para que el DJ no quede trabado
por una sección de configuración que quizá nadie tocó.

**Ningún ítem quedó BLOQUEADO. Un solo OMITIDO: el diseñador del invitado, que no existe.**

---

## 2. Archivos

### Creados (40)

```
REPORTE.md                                    REPORTE_FINAL.md
src/services/pantallaConfig.js                ← CRUD de las 12 tablas satélite + canvas + secrets

src/admin/pantalla/
  PantallaSidebarMenu.jsx   PanelSection.jsx        panelControls.jsx
  PantallaEditor.jsx        PantallaConsola.jsx
  playlist/PlaylistPanel.jsx   playlist/FilaCancion.jsx
  sections/  SeccionesConfig · SeccionCiclo · SeccionCodigo · SeccionContenido
             SeccionVotacion · SeccionReglas · SeccionKick · SeccionPoderes
             SeccionTvLink · SeccionInvitados · SeccionIngreso · SeccionContactos
             SeccionLimpieza · SeccionEmojis · SeccionRegalosVip · SeccionEquipos
             SeccionVisual · SeccionDisenadores · SeccionTandas · SeccionTransicion
             SeccionRecompensas · SeccionCodigoCanje · SeccionCartelesTv · SeccionFiltro
             SeccionPresets · SeccionLinkCorto · SeccionReset
             SeccionEstadisticas · SeccionQr · SeccionSorteos · SeccionesPendientesVivo
```

### Modificados (7)

| Archivo | Qué cambió |
|---|---|
| `src/admin/BizarrApp AdminPanel Festival.tsx` | 4 ediciones puntuales: import del menú; `pantallaDj` → `pantallaEditor` + `pantallaLive` con `parent:"pantalla"`; el loop del sidebar filtra `!s.parent` y monta el desplegable en Moderación; dos `case` en `renderPanel` con `modo` y `goTo`. **El sidebar no se rediseñó** |
| `src/admin/pantalla/PantallaDjPanel.jsx` | De shell con 6 pestañas a shell de datos + dos disposiciones (`modo="editor"` / `"live"`) |
| `src/admin/pantalla/pantallaStyles.js` | Dos bloques nuevos al final (shell + `PanelSection`, y la fila de canción). Nada existente se tocó |
| `src/services/pantallaDj.js` | `saveEventFields`, `saveItemFields`, `saveVotePowers`, `reorderItems`, `deleteItems`, `setItemsEnabled`. Las funciones viejas quedaron intactas |
| `src/components/pantalla/pantallaUi.js` | Una clave nueva en `ERRORES`: `rls_sin_filas` |
| `src/designers/lib/persistence.js` | **Sólo aditivo**: se extrajo `normalizeTvConfig` y se exportó. `loadTvConfig` mantiene firma y comportamiento |
| `src/designers/tv/TvDesigner.jsx` | Resuelve el evento, lee de `tv_canvas_config` con migración desde localStorage, guarda en la base + espejo local |

### Eliminados (6) — superados por la reestructura

`EventoTab.jsx`, `ReglasTab.jsx`, `DjConsoleTab.jsx`, `InvitadosTab.jsx`, `EventoHeader.jsx`,
`PlaylistTab.jsx`. Su contenido vive en las secciones del editor y de la consola; con las
pestañas fuera quedaban como código muerto. `EventNameEditor.jsx` y `HistorialTab.jsx` siguen
en uso.

**No se tocó:** `src/tv/`, `src/hooks/realtime/`, `game_state`, geo, el motor de playlist, la
pantalla del invitado. Cero dependencias nuevas.

---

## 3. Columnas o tablas que faltaron

**Ninguna.** El schema v2 cubrió todo lo que el panel necesita. Lo único que se pidió y no
tiene dónde guardarse:

| Qué | Por qué no se implementó |
|---|---|
| Subir MP3 de tanda | `pantalla_ad_clips.audio_path` existe, pero **no hay bucket de audio en Storage**. Tampoco se puede usar `content_mode='audio'` de verdad por lo mismo |
| Ruta `/t/:codigo` | `pantalla_short_links` existe y la sección crea los links, pero **la ruta no está dada de alta en `App.jsx`**: el link corto todavía no redirige. No la agregué porque el alcance era panel y sidebar, y resolver el código además necesita una RPC `security definer` (la tabla no tiene lectura pública, a propósito) |

---

## 4. Lógica de servidor pendiente

Lo que hay que escribir para que cada sección haga algo de verdad. El panel ya deja la
configuración lista para todas.

| RPC / job | Para qué sirve | Qué sección queda esperándolo |
|---|---|---|
| Otorgar y consumir premios automáticamente | Motor de logros: leer `pantalla_achievements.levels` e insertar en `pantalla_granted_rewards` con `source='achievement'` | C5, C3. El otorgamiento **manual** ya funciona desde la cabina |
| Motor de puntaje de equipos | Sumar según `team_points_*` al votar/reaccionar, cerrar la ronda por `team_round_mode` y sortear el `team_round_prize_key` | C1, súper votos por equipo |
| Asignación automática al equipo con menos integrantes al unirse | Llenar `pantalla_participants.team_id` | C1 |
| Inserción de tandas cada N canciones | Que el motor de la TV meta el siguiente `pantalla_ad_clips` habilitado y suba `times_played` | D1 |
| Resolver link corto (`security definer`) + ruta `/t/:codigo` | `pantalla_short_links` no tiene lectura pública a propósito | Link corto |
| Escribir en `pantalla_contacts` desde `pantalla_join_event` | Guardar nickname/email/teléfono según `require_*_mode` | B3, B4 |
| Limpieza de invitados por `guest_max_connection_hours` | Necesita `pg_cron` o un edge function agendado; **hoy la base no tiene ninguno de los dos** | B2 |
| Aplicar/guardar presets del lado del servidor | Hoy el panel reordena desde el cliente con `reorderItems`. Funciona, pero con 421 temas son muchos UPDATE; una RPC lo haría en una | D2 |
| Serie de tiempo del ranking | «Mayor subida» y «mayor caída» | FASE 4 |
| Canal de broadcast de efectos de TV | Confetti, destellos, láser | FASE 4 |
| Token firmado por rol en `pantalla_join_event` | QRs de VIP / Cumpleañero / Staff | FASE 4 |
| Que la TV lea `tv_canvas_config` | Cerrar la migración del diseñador (hoy lee la copia local) | D3 |
| Diseñador de Pantalla del Invitado | No existe el componente; `guest_canvas_config` está esperando | D3 |

---

## 5. Cosas rotas o sospechosas que encontré y **no** toqué

1. **La vista TV lee el diseño del `localStorage`, no de la base.** Es la salvedad de D3.
   Además `PantallaTV.jsx` usa la clave fija `:default`, así que **todos los eventos comparten
   el mismo diseño local** aunque ahora cada uno tenga el suyo en `tv_canvas_config`. Mientras
   la TV no migre, el diseñador hay que abrirlo en la máquina del proyector, o guardar una vez
   desde ahí.

2. **`updateEvent` y `updateItem` no verifican filas afectadas.** Las dejé intactas para no
   tocar código fuera de los ítems, pero **reportan éxito ante un rechazo de RLS**. Las nuevas
   (`saveEventFields`, `saveItemFields`, `saveVotePowers`, y todo `pantallaConfig.js`) sí lo
   tratan como error. `updateItem` la sigue usando la fila de canción para los toggles rápidos
   de fijar / bloquear / activar: **ese camino todavía puede tragarse un rechazo en silencio.**

3. **`pantalla_events.status` no tiene índice único parcial sobre `live`.**
   `fetchLiveEvent()` usa `.maybeSingle()`: si por algún camino quedaran dos eventos en vivo,
   esa consulta **tira error** y el menú del sidebar se queda sin evento activo. Mi código lo
   trata como «no hay evento» y no rompe, pero la causa raíz es de la base.

4. **`duration_seconds` NULL en los 421 temas.** Lo respeté en todos lados. Vale saber que
   **el motor no tiene de dónde sacar cuándo termina un tema salvo el aviso de la TV**: si la
   TV se cae a mitad de una canción, no hay fallback de tiempo. Los `trim_end_seconds` siguen
   vacíos y el respaldo `backup_trim_end_20260828` sigue ahí sin restaurar.

5. **`pantalla_tv_song_ended` sigue con dos overloads** (3 y 4 args). El servicio llama
   siempre a la de 4, como pediste. Sin defaults no hay ambigüedad en PostgREST, pero conviene
   borrar la deprecada cuando no queden clientes viejos.

6. **La biblioteca de imágenes se monta dentro de una sección plegable** (B6).
   `MediaLibraryModal` trae su propio CSS y su propio `useMediaAssets`; convive bien con el
   `overflow` de la columna lateral porque es un modal, pero es la única pieza del panel que
   no controlo por completo.

7. **`pantalla_granted_rewards` todavía no lo consume nadie.** El panel ya otorga premios de
   verdad, pero ni la TV ni la app del invitado leen esa tabla: por ahora un premio otorgado
   sólo se ve desde la cabina. Por eso la sección incluye la marca de entrega manual, que es
   lo único que hoy cierra el circuito.

---

## 6. Commits

38 commits en `panel-pantalla-reestructura`, con prefijo `panel:`. Uno por ítem, salvo tres
pares que comparten archivo y por eso comparten commit (A7+A8, B1 dentro de A2, y el par de
secciones de recompensas).
