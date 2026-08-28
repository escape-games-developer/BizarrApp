import { saveEventFields } from "../../../services/pantallaDj";
import { P } from "../../../components/pantalla/pantallaUi";
import PanelSection from "../PanelSection";
import { BotonGuardar, Campo, CampoSwitch, useBorrador, useGuardado } from "../panelControls";

/**
 * Filtro de contenido para lo que llega a la pantalla grande.
 *
 * La lista se guarda en minúsculas y sin espacios sobrantes en
 * `content_filter_words` (`text[]`): quien compare del lado del servidor lo hace
 * contra un formato ya normalizado y no tiene que adivinar.
 *
 * Es una lista de bloqueo, no un moderador: filtra lo que está escrito tal cual.
 */

const aLista = (txt) => [...new Set(
  String(txt || "").split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean),
)];

export default function SeccionFiltro({ event, refresh }) {
  const [b, set] = useBorrador(
    {
      content_filter_enabled: !!event.content_filter_enabled,
      // El array va serializado en las deps: como identidad cambiaría en cada
      // UPDATE del evento y borraría el borrador mientras alguien escribe.
      palabras: (event.content_filter_words || []).join(", "),
    },
    [event.id, event.content_filter_enabled, JSON.stringify(event.content_filter_words)],
  );

  const { estado, mensaje, guardar } = useGuardado(async () => {
    await saveEventFields(event.id, {
      content_filter_enabled: b.content_filter_enabled,
      content_filter_words:   aLista(b.palabras),
    });
    await refresh();
  });

  const lista = aLista(b.palabras);
  const cambiado = b.content_filter_enabled !== !!event.content_filter_enabled
    || lista.join("|") !== (event.content_filter_words || []).join("|");
  const off = !b.content_filter_enabled;

  return (
    <PanelSection id="filtro-contenido" title="Filtro de contenido" icon="🚧"
      badge={lista.length || null}>
      <CampoSwitch label="Filtro habilitado" checked={b.content_filter_enabled}
        onChange={(v) => set("content_filter_enabled", v)} />

      <div style={{ marginTop: 11, opacity: off ? .5 : 1 }}>
        <Campo label="Palabras bloqueadas"
          hint="Separadas por coma o por línea. Se guardan en minúsculas y sin repetir; un mensaje que contenga alguna no llega a la pantalla.">
          <textarea className="pdj-input" value={b.palabras} disabled={off}
            placeholder="palabra, otra palabra"
            aria-label="Palabras bloqueadas"
            onChange={(e) => set("palabras", e.target.value)}
            style={{ minHeight: 70, fontSize: 11 }} />
        </Campo>

        {lista.length > 0 && (
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: -4, marginBottom: 9 }}>
            {lista.slice(0, 24).map((w) => (
              <span key={w} className="pdj-chip" style={{
                background: "rgba(255,45,120,.1)", color: "rgba(255,45,120,.8)",
              }}>{w}</span>
            ))}
            {lista.length > 24 && (
              <span style={{ fontSize: 9.5, color: P.tenue2, alignSelf: "center" }}>
                +{lista.length - 24} más
              </span>
            )}
          </div>
        )}

        {!off && lista.length === 0 && (
          <div className="pdj-campo-hint" style={{ color: P.amarillo, marginTop: -4 }}>
            El filtro está prendido pero la lista está vacía: no bloquea nada.
          </div>
        )}
      </div>

      <BotonGuardar estado={estado} mensaje={mensaje} disabled={!cambiado} onClick={guardar} />
    </PanelSection>
  );
}
