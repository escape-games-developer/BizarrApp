import { useEffect, useLayoutEffect, useRef, useState } from "react";
import globalCss from "../constants/styles";
import ClientShell from "../client/shell/ClientShell";
import { clientNavItems, CLIENT_LOGO_URL, NAV_ID_BY_DESIGN_SECTION } from "../client/shell/clientShellData";
import { hasProfileDesign, resolveProfileDesign } from "../views/Perfil/designs/registry";
import { clientDesignRegistry } from "../client/design/clientDesignRegistry";
import ClientDesignRenderer from "../design-engine/ClientDesignRenderer";
import { validateDocument } from "../design-engine/validateDocument";
import { previewProfile, previewShellState } from "./fixtures/profile";
import DjVotingView from "../views/Pantalla/DjVotingView";
import { hasPantallaDesign, resolvePantallaTheme } from "../views/Pantalla/themes/registry";
import { previewPantallaProps, previewPantallaShellState } from "./fixtures/pantalla";
import { PREVIEW_ACTION_DISABLED, isPreviewMessage, previewMessage } from "./previewContract";

/**
 * /designer-preview/client — el Cliente dentro del iframe del Diseñador Cliente.
 *
 * Mismo CSS global, mismo ClientShell y mismos renderers que la app real;
 * cambian los datos (fixtures) y las acciones (inertes). No monta App ni nada
 * con efectos: sin Supabase, Auth, Realtime, presencia, GPS, push ni storage.
 * main.jsx carga este módulo sin evaluar el resto de las rutas.
 *
 * Dos modos:
 *   native    renderer nativo registrado (ProfileDesignOriginal, o la vista
 *             de DJ Democracy con el tema del diseño de Pantalla).
 *   document  DesignDocument del motor (ClientDesignRenderer). Acá vive también
 *             la parte de edición que necesita el DOM: click → "node-selected"
 *             y el contorno del nodo seleccionado. Va por fuera del renderer.
 */
const NATIVE = {
  profile: { has: hasProfileDesign, resolve: resolveProfileDesign, props: () => ({ profile: previewProfile }), shell: previewShellState },
  pantalla: { has: hasPantallaDesign, resolve: () => DjVotingView,
    props: (rendererKey) => ({ ...previewPantallaProps, theme: resolvePantallaTheme(rendererKey) }),
    shell: previewPantallaShellState },
};
const DEFAULT_SHELL = { isLoggedIn: true, isRestricted: false };
const ID_RE = /^[A-Za-z][\w-]{0,63}$/;

function validNative(section, rendererKey) {
  const entry = Object.hasOwn(NATIVE, section) ? NATIVE[section] : null;
  if (!entry || typeof rendererKey !== "string" || !entry.has(rendererKey)) return null;
  return { kind: "native", section, rendererKey };
}

function validDocument(document, fixtureId, selectedId) {
  const { ok } = validateDocument(document, clientDesignRegistry);
  if (!ok) return null;
  const scene = clientDesignRegistry.scene(document.scene);
  const fixture = scene.fixtures.find((f) => f.id === fixtureId) ?? scene.fixtures[0];
  if (!fixture) return null;
  return { kind: "document", document, scene, fixture, selectedId: ID_RE.test(selectedId ?? "") ? selectedId : null };
}

function requestFromQuery() {
  const q = new URLSearchParams(window.location.search);
  if (q.get("mode") === "document") {
    const scene = clientDesignRegistry.scene(q.get("scene"));
    return scene ? { kind: "waiting", scene } : null;
  }
  return validNative(q.get("section"), q.get("renderer"));
}

/** Acciones inertes de una escena: devuelven el aviso, nunca ejecutan nada. */
const inertActions = (scene) =>
  Object.fromEntries(scene.actions.map((k) => [k, async () => ({ ok: false, error: PREVIEW_ACTION_DISABLED })]));

const noop = () => {};

export default function ClientPreviewRoute() {
  const [request, setRequest] = useState(requestFromQuery);

  useEffect(() => {
    const onMessage = (event) => {
      if (!isPreviewMessage(event, window.parent)) return;
      const d = event.data;
      const next = d.kind === "native" ? validNative(d.section, d.rendererKey)
        : d.kind === "document" ? validDocument(d.document, d.fixtureId, d.selectedId) : null;
      if (next) setRequest(next);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  let section = null, shell = DEFAULT_SHELL, content;
  if (request?.kind === "native") {
    const entry = NATIVE[request.section];
    const Design = entry.resolve(request.rendererKey);
    section = request.section; shell = entry.shell;
    content = <Design {...entry.props(request.rendererKey)}/>;
  } else if (request?.kind === "document") {
    section = request.scene.section; shell = request.fixture.shell ?? DEFAULT_SHELL;
    content = <ClientDesignRenderer document={request.document} registry={clientDesignRegistry}
      data={request.fixture.data} actions={inertActions(request.scene)}/>;
  } else if (request?.kind === "waiting") {
    section = request.scene.section;
    content = <div className="blocked-view" style={{ color: "rgba(245,230,192,.45)", fontSize: 12 }}>Cargando diseño…</div>;
  } else {
    content = <div className="blocked-view" style={{ color: "rgba(245,230,192,.45)", fontSize: 12 }}>
      Vista previa no disponible para este diseño.
    </div>;
  }

  return (
    <>
      <style>{globalCss}</style>
      <div className="app-root">
        {/* Navegación visualmente real pero inerte: no cambia de vista ni de URL. */}
        <ClientShell logoSrc={CLIENT_LOGO_URL} notificationSlot={null}
          navItems={clientNavItems(shell)} activeNavId={section ? NAV_ID_BY_DESIGN_SECTION[section] ?? null : null}
          onNavigate={noop}>
          {content}
        </ClientShell>
      </div>
      {request?.kind === "document" && <EditingLayer selectedId={request.selectedId} document={request.document}/>}
    </>
  );
}

/**
 * Edición sobre el preview (fuera del renderer): un click sobre un nodo lo
 * selecciona en el Admin, y el nodo seleccionado se marca con un contorno.
 * En este modo los clicks no llegan al diseño (no abren formularios).
 */
function EditingLayer({ selectedId, document }) {
  const [rect, setRect] = useState(null);
  const raf = useRef(0);

  useEffect(() => {
    const onClick = (e) => {
      const el = e.target.closest?.("[data-design-id]");
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      window.parent.postMessage(previewMessage("node-selected", { nodeId: el.getAttribute("data-design-id") }), window.location.origin);
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const el = selectedId ? window.document.querySelector(`[data-design-id="${selectedId}"]`) : null;
      const r = el?.getBoundingClientRect();
      setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null);
    };
    const schedule = () => { clearTimeout(raf.current); raf.current = setTimeout(measure, 16); };
    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => { clearTimeout(raf.current); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule); };
  }, [selectedId, document]);

  if (!rect) return null;
  return <div data-preview-selection aria-hidden="true" style={{ position: "fixed", top: rect.top - 2, left: rect.left - 2,
    width: rect.width + 4, height: rect.height + 4, outline: "2px solid #00E5FF", outlineOffset: 0, borderRadius: 4,
    pointerEvents: "none", zIndex: 2147483647 }}/>;
}
