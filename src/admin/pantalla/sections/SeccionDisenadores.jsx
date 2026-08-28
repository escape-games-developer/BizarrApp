import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";

/**
 * Atajos a los diseñadores de pantalla.
 *
 * El diseñador de TV ya existe (`src/designers/tv/TvDesigner.jsx`) y vive en el
 * sidebar bajo «Diseñadores de Pantalla». Acá no se duplica ni se reimplementa:
 * el botón sólo lleva a esa sección.
 *
 * El diseñador de TV ahora guarda en `pantalla_events.tv_canvas_config`, así que
 * el diseño viaja con el evento y ya no depende del navegador donde se hizo.
 * Sigue escribiendo además una copia en localStorage porque la vista `/tv` de
 * hoy lee de ahí; migrar esa lectura es un cambio del lado de la TV.
 *
 * El diseñador de la pantalla del invitado todavía no existe como componente.
 */
export default function SeccionDisenadores({ event, goTo }) {
  const tvGuardado    = !!event.tv_canvas_config;
  const guestGuardado = !!event.guest_canvas_config;

  return (
    <PanelSection id="disenadores" title="Diseñadores de pantalla" icon="✦">
      <div className="pdj-sec-aviso">
        <span style={{ flexShrink: 0 }}>🕓</span>
        <span>
          El diseño ya se guarda en <code>tv_canvas_config</code> y viaja con el evento. La
          vista <code>/tv</code> todavía lo lee de la copia local del navegador: hasta que se
          migre esa lectura, abrí el diseñador en la misma máquina del proyector o guardá una
          vez desde ahí.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
            fontSize: 11.5, fontWeight: 700, color: P.texto,
          }}>
            📺 Pantalla TV
            <span className="pdj-chip" style={{
              background: tvGuardado ? "rgba(0,245,160,.12)" : "rgba(240,232,255,.06)",
              color: tvGuardado ? P.verde : P.tenue2,
            }}>{tvGuardado ? "CONFIGURADA" : "SIN CONFIGURAR"}</span>
          </div>
          <button type="button" className="pdj-mini pdj-mini-p" disabled={!goTo}
            onClick={() => goTo?.("designerTv")} style={{ padding: "9px 16px" }}>
            ✦ Abrir diseñador de TV
          </button>
        </div>

        <div>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 5,
            fontSize: 11.5, fontWeight: 700, color: P.texto,
          }}>
            📱 Pantalla del invitado
            <span className="pdj-chip" style={{
              background: guestGuardado ? "rgba(0,245,160,.12)" : "rgba(255,214,0,.12)",
              color: guestGuardado ? P.verde : P.amarillo,
            }}>{guestGuardado ? "CONFIGURADA" : "PENDIENTE"}</span>
          </div>
          <button type="button" className="pdj-mini" disabled
            title="El diseñador de la pantalla del invitado todavía no existe"
            style={{ padding: "9px 16px" }}>
            ✦ Abrir diseñador del invitado
          </button>
          <div className="pdj-campo-hint">
            Todavía no está construido. El del sidebar muestra un cartel de «próxima etapa».
          </div>
        </div>
      </div>
    </PanelSection>
  );
}
