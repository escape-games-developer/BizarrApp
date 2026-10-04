/**
 * Esqueleto del Diseñador Cliente: pestañas arriba y, debajo, tres zonas.
 *
 *   left   → navegación/estructura (Diseños Guardados; a futuro Capas,
 *            Componentes, Componentes del sistema, Biblioteca)
 *   center → área de diseño (a futuro canvas, preview responsive, zoom…)
 *   right  → propiedades del elemento seleccionado (a futuro). Si no se pasa,
 *            la columna no existe y el centro ocupa su lugar.
 *
 * Por debajo de 1040 px (el mismo corte que usa el resto del Admin) las zonas
 * se apilan: el panel izquierdo nunca se superpone al centro.
 */
const css = `
  .cd-root{display:flex;flex-direction:column;gap:12px;min-width:0}
  .cd-body{display:grid;gap:12px;align-items:start;min-width:0}
  .cd-body.cd-2col{grid-template-columns:260px minmax(0,1fr)}
  .cd-body.cd-3col{grid-template-columns:260px minmax(0,1fr) 280px}
  .cd-zone{min-width:0}
  @media (max-width:1040px){
    .cd-body.cd-2col,.cd-body.cd-3col{grid-template-columns:minmax(0,1fr)}
  }
`;

export default function ClientDesignerLayout({ tabs, left, center, right = null }) {
  return (
    <div className="cd-root">
      <style>{css}</style>
      {tabs}
      <div className={`cd-body ${right ? "cd-3col" : "cd-2col"}`}>
        <aside className="cd-zone" aria-label="Estructura del diseño">{left}</aside>
        <section className="cd-zone" aria-label="Área de diseño">{center}</section>
        {right && <aside className="cd-zone" aria-label="Propiedades">{right}</aside>}
      </div>
    </div>
  );
}
