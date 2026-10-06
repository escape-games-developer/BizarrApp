import { anuncioDe } from "./anunciosCatalog";

/**
 * Franja PRÓXIMAMENTE arriba de Escenario cuando una experiencia fue anunciada
 * y todavía no abrió su convocatoria. La dibuja App por fuera de EscenarioView:
 * no toca la lógica de ninguna experiencia. Postularse aparece con la
 * convocatoria, en la vista de cada experiencia.
 */
export default function AnuncioDestacado({ placa }) {
  const a = placa ? anuncioDe(placa) : null;
  if (!a) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 12,
      borderRadius: 14, background: "rgba(255,45,120,.08)", border: "1px solid rgba(255,45,120,.35)",
    }}>
      <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>{a.emoji}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#FF2D78" }}>📢 PRÓXIMAMENTE</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#F5E6C0", lineHeight: 1.25,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</div>
        <div style={{ fontSize: 12, color: "rgba(245,230,192,.5)" }}>
          ⏳ Preparate — el staff abre la convocatoria en breve.
        </div>
      </div>
    </div>
  );
}
