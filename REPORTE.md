# REPORTE — Reestructura del panel «Pantalla» del administrador

Rama: `panel-pantalla-reestructura`
Raíz del proyecto (repo git): `bizarrapp/`

---

## FASE 0 — Descubrimiento

### Sidebar del admin

| Qué | Dónde |
|---|---|
| Componente | `src/admin/BizarrApp AdminPanel Festival.tsx` — el `<aside className="sb">` arranca en la línea ~2391 |
| Declaración de items | Constante `SECS` (línea ~232): array plano de `{id, icon, label, group, grad, glow}` |
| Grupos | Se derivan del array: `[...new Set(SECS.map(s=>s.group))]`. No hay estructura de árbol: un item = un botón |
| Estado activo | `sec` (useState en `AdminPanel`) + clase `.sb-btn-active` |
| Hover | Sólo CSS: `.sb-btn:hover{background:#9B2FFF22}` |
| Colapsado | `sbCollapsed` (useState) → clase `.sb.collapsed` (210px → 60px); con el sidebar colapsado se ocultan labels y group-labels y se muestran separadores |
| CSS | Template string `css` en el mismo archivo (línea ~34 en adelante), bloque `/* Sidebar */` línea ~47 |
| Render del panel | `renderPanel()` (switch por `sec`), línea ~2320. `case "pantallaDj"` → `<PantallaDjPanel sec={curSec} sessionId={...}/>` |

El item de interés hoy: `{id:"pantallaDj", icon:"🎧", label:"Pantalla", group:"Moderación"}`.

### Panel «Pantalla» actual

| Archivo | Rol |
|---|---|
| `src/admin/pantalla/PantallaDjPanel.jsx` | Shell: selector de evento, carga de datos compartidos, 6 pestañas horizontales |
| `src/admin/pantalla/EventoHeader.jsx` | Cabecera común (nombre, estado, QR, accesos) |
| `src/admin/pantalla/EventNameEditor.jsx` | Edición inline del nombre |
| `src/admin/pantalla/EventoTab.jsx` | Estado del evento, acceso del cliente, link de TV |
| `src/admin/pantalla/PlaylistTab.jsx` | Alta por links de YouTube, import de playlists del bar, lista de temas |
| `src/admin/pantalla/ReglasTab.jsx` | Reglas de votación, Sacar Tema, matriz de poderes, nota de freeze |
| `src/admin/pantalla/DjConsoleTab.jsx` | Consola del DJ (2 columnas) |
| `src/admin/pantalla/InvitadosTab.jsx` | Participantes y roles |
| `src/admin/pantalla/HistorialTab.jsx` | Historial de reproducción |
| `src/admin/pantalla/pantallaStyles.js` | CSS del módulo, prefijo `pdj-`, inyectado en el shell |
| `src/components/pantalla/pantallaUi.js` | Paleta `P`, formateadores, traducción de errores |

La navegación actual es **pestañas horizontales** (`TABS` en `PantallaDjPanel.jsx`), no la arquitectura de dos columnas de DJ Democracy.

### Controles existentes hoy y contra qué escriben

| Control | Archivo | Destino |
|---|---|---|
| Nombre del evento | `EventNameEditor` | `pantalla_events.name` |
| Iniciar / Finalizar | `EventoTab` | RPC `pantalla_start_event` / `pantalla_end_event` |
| Duplicar | `EventoTab` | RPC `pantalla_duplicate_event` |
| Reiniciar evento | `EventoTab` | RPC `pantalla_reset_event` (confirmación de un paso) |
| Link/QR del invitado | `EventoTab`, `EventoHeader` | derivado de `pantalla_events.code` |
| Link TV + regenerar | `EventoTab`, `DjConsoleTab` | RPC `pantalla_get_tv_link` / `pantalla_regenerate_tv_token` |
| Modo de votación | `ReglasTab` | `pantalla_events.voting_mode` |
| Candidatas visibles | `ReglasTab` | `pantalla_events.active_candidates_count` |
| Rondas de relegación | `ReglasTab` | `pantalla_events.relegation_rounds_threshold` |
| Score de descarte | `ReglasTab` | `pantalla_events.reject_score_threshold` |
| Súper votos por persona | `ReglasTab` | `pantalla_events.super_votes_per_user` |
| Desactivar votación | `ReglasTab`, `DjConsoleTab` | `pantalla_events.voting_disabled` |
| Sacar Tema (4 campos) | `ReglasTab` | `kick_enabled`, `kick_button_text`, `kick_threshold_pct`, `kick_activity_minutes` |
| Matriz de poderes | `ReglasTab` | `pantalla_vote_powers` (upsert) + RPC `pantalla_reset_vote_powers` |
| Agregar YouTube | `PlaylistTab` | RPC `pantalla_add_items` |
| Importar playlist del bar | `PlaylistTab` | RPC `pantalla_import_playlist` |
| Recalcular candidatas | `PlaylistTab` | RPC `pantalla_refill_candidates` |
| Subir/bajar, fijar, bloquear, on/off, borrar, editar título/artista | `PlaylistTab` | UPDATE/DELETE directo sobre `pantalla_playlist_items` |
| Pasar canción | `DjConsoleTab` | RPC `pantalla_advance_event` |
| Congelar orden | `DjConsoleTab` | RPC `pantalla_freeze_voting` |
| Reiniciar votos | `DjConsoleTab` | RPC `pantalla_reset_votes` |
| Rol de participante / expulsar | `InvitadosTab` | RPC `pantalla_set_participant_role` / `pantalla_remove_participant` |

**No existen hoy**: modo de contenido (`content_mode` está en la base pero sin control en la UI), recorte inicio/fin y volumen por tema (columnas presentes, sin UI), drag para reordenar, posición editable, selección múltiple, limpiar duplicados, exportar lista, confirmación de dos pasos al reiniciar.

### Acceso a Supabase desde el admin

- Cliente único: `src/lib/supabase.js` exporta `supabase` (sesión persistente, `autoRefreshToken`) y `supabaseAnon` (sin sesión, `storageKey:"sb-anon"`, sólo para la TV).
- El admin usa **siempre `supabase`** (autenticado). La autorización real vive en RLS + RPCs `SECURITY DEFINER` (`pantalla_can_manage`).
- Toda la capa de datos del módulo está centralizada en `src/services/pantallaDj.js`. Los hooks de lectura/Realtime: `src/hooks/realtime/usePantallaEvent.js` (evento + items + candidatas) y `usePantallaAdmin.js` (participantes, votos, historial + `usePantallaStats`).

### ¿Existe `src/designers/`?

**Sí.** `src/designers/` existe con:
- `tv/TvDesigner.jsx`, `tv/TvStage.jsx`, `tv/TvPropertiesPanel.jsx`
- `components/Controls.jsx`, `defaults.js`, `theme.js`, `lib/persistence.js`

Está cableado en el sidebar bajo el grupo **«Diseñadores de Pantalla»** (`designerTv` → `<TvDesigner sessionId="default"/>`). El diseñador del **invitado** todavía no existe: `case "designerGuest"` renderiza un placeholder de texto. → **No se toca ni se duplica**; la sección 4.9 sólo engancha el botón.

### Decisión de FASE 1: acordeón inline (no flyout)

El `.sb-nav` es `overflow-y:auto` con `flex:1`. Un flyout `position:absolute` quedaría recortado por ese `overflow` (habría que sacarlo a un portal y calcular coordenadas a mano en cada scroll). El **acordeón inline** empuja los items de abajo y participa del scroll natural del contenedor, que es exactamente cómo está construido el sidebar hoy.

Excepción: con el sidebar **colapsado** (60px) no hay lugar para labels, así que ahí el submenú se muestra como flyout `position:fixed` anclado al botón (fixed, no absolute: no lo recorta el `overflow` del `.sb-nav`), abierto por hover **y** por click.

---

## Ítems

_(se completa a medida que avanza el bucle)_


---

## Cambio de premisa a mitad de camino — FASE 4

**El respaldo de base de la FASE 4 apareció mientras corría el bucle.**

Al arrancar (FASE 0) `pantalla_events` tenía **29 columnas** y las únicas tablas del módulo
eran `pantalla_events`, `_playlist_items`, `_votes`, `_kick_votes`, `_participants`,
`_play_history`, `_reactions`, `_vote_powers` y `_event_secrets`.

Al terminar la FASE 3, la misma consulta devolvía `pantalla_events` con **74 columnas** y
**12 tablas nuevas**: `pantalla_achievements`, `_ad_clips`, `_contacts`, `_emoji_packs`,
`_gifs`, `_granted_rewards`, `_physical_prizes`, `_playlist_presets`, `_prizes`,
`_short_links`, `_teams`, `_vip_gifts`. Todas con RLS habilitada y policy
`pantalla_can_manage(event_id)` para escritura de admin.

La condición que define la FASE 4 en la consigna — *«SIN respaldo en la base todavía»* — dejó
de cumplirse. La consigna también dice, en la FASE 3: *«Verificá cada nombre de columna contra
la base antes de escribir el update; no confíes en este documento como fuente única»*.

**Decisión tomada:** implementar las secciones de FASE 4 **funcionando de verdad** contra el
schema que existe, verificando cada nombre de columna y cada CHECK contra la base. Se deja en
`status="pendiente"` y deshabilitado únicamente lo que sigue sin respaldo real:

- lo que necesita **subida de archivos** a Storage (logo, imagen de fondo, MP3 de tandas),
- lo que necesita un **job de servidor** que no existe (limpieza automática de invitados),
- el **Diseñador de Pantalla del Invitado**, que no existe como componente.

Cada sección de FASE 4 dice en el reporte final contra qué columna/tabla escribe.

---

## Resultado

El detalle ítem por ítem, los archivos tocados, el estado real del schema y los hallazgos
sin tocar están en **[REPORTE_FINAL.md](REPORTE_FINAL.md)**.
