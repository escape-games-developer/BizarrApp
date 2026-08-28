import { useCallback, useEffect, useState } from "react";
import { getTvLink, regenerateTvToken, tvUrl } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonCopiar, Campo } from "../panelControls";

/**
 * Acceso de la TV / vMix.
 *
 * El token no se lee nunca por REST desde `pantalla_events`: vive en
 * `pantalla_event_secrets`, al que el cliente no llega, y sale sólo por la RPC
 * `pantalla_get_tv_link`. Regenerar lo rota y el link anterior deja de servir
 * en el acto — que es todo el punto de tener un token.
 */
export default function SeccionTvLink({ event, onError }) {
  const [link,      setLink]      = useState(null);
  const [cargando,  setCargando]  = useState(false);
  const [rotando,   setRotando]   = useState(false);

  useEffect(() => { setLink(null); }, [event.id]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setLink(await getTvLink(event.id)); }
    catch (err) { onError?.(err); }
    finally { setCargando(false); }
  }, [event.id, onError]);

  const regenerar = async () => {
    if (!window.confirm(
      "¿Regenerar el acceso de la TV?\n\n" +
      "El link anterior deja de funcionar al instante. Si la TV está reproduciendo, " +
      "hay que volver a abrirla con el link nuevo.")) return;
    setRotando(true);
    try { setLink(await regenerateTvToken(event.id)); }
    catch (err) { onError?.(err); }
    finally { setRotando(false); }
  };

  const url = link ? tvUrl(link.code || event.code, link.token) : "";

  return (
    <PanelSection id="link-tv" title="Link TV / vMix" icon="📺">
      <div className="pdj-sub">
        La TV es el motor de reproducción y la única salida de audio. Abrila en la máquina
        conectada al proyector, o pegá el link como entrada de navegador en vMix.
      </div>

      {!link ? (
        <button type="button" className="pdj-mini pdj-mini-a" disabled={cargando}
          style={{ padding: "11px 18px" }} onClick={cargar}>
          {cargando ? "Generando…" : "🔑 Generar / mostrar el link"}
        </button>
      ) : (
        <>
          <Campo label="Link completo (no requiere sesión)"
            hint="Incluye el token. Cualquiera con este link puede abrir la TV: no lo publiques.">
            <input className="pdj-input" readOnly value={url} style={{ fontSize: 10 }}
              onFocus={(e) => e.target.select()} />
          </Campo>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <BotonCopiar valor={url} texto="⧉ Copiar link" className="pdj-mini pdj-mini-p" />
            <button type="button" className="pdj-mini"
              onClick={() => window.open(url, "_blank", "noopener")}>📺 Abrir TV</button>
            <button type="button" className="pdj-mini pdj-mini-r" disabled={rotando}
              onClick={regenerar}>
              {rotando ? "Regenerando…" : "↺ Regenerar token"}
            </button>
          </div>

          <div className="pdj-campo-hint" style={{ marginTop: 9, color: P.tenue }}>
            Estado de la TV:{" "}
            <strong style={{
              color: event.tv_connected_at &&
                Date.now() - new Date(event.tv_connected_at).getTime() < 20_000 ? P.verde : P.tenue2,
            }}>
              {event.tv_connected_at &&
                Date.now() - new Date(event.tv_connected_at).getTime() < 20_000
                ? "conectada" : "sin reportar"}
            </strong>
          </div>
        </>
      )}
    </PanelSection>
  );
}
