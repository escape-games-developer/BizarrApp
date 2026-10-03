/**
 * Icono — biblioteca local de 100 íconos SVG (Lucide, licencia ISC: ver
 * LICENSE-lucide.txt). Los archivos viven en ./svg y el nombre es el del
 * archivo sin `.svg` (ej: "trophy", "thumbs-up", "beer").
 *
 *   <Icono nombre="trophy" />
 *   <Icono nombre="beer" size={24} strokeWidth={1.75} style={{ color: "#FFD700" }} />
 *   <Icono nombre="bell" titulo="Notificaciones" />   // con texto accesible
 *
 * Se dibujan inline (no <img>) para que tomen el color del texto con
 * `currentColor`. Sin `titulo` son decorativos (aria-hidden).
 *
 * Para sumar uno: copiar el .svg de lucide-static a ./svg. No hace falta
 * registrarlo en ningún lado.
 */

const archivos = import.meta.glob("./svg/*.svg", { query: "?raw", import: "default", eager: true });

// "./svg/thumbs-up.svg" → "thumbs-up". Sin el comentario de licencia y con
// tamaño 100% para que mande el contenedor.
const ICONOS = Object.fromEntries(
  Object.entries(archivos).map(([ruta, svg]) => [
    ruta.slice(6, -4),
    svg.replace(/<!--[\s\S]*?-->/, "")
       .replace('width="24"', 'width="100%"')
       .replace('height="24"', 'height="100%"')
       .trim(),
  ]),
);

export default function Icono({ nombre, size = 20, strokeWidth, titulo, className, style }) {
  let svg = ICONOS[nombre];
  if (!svg) {
    if (import.meta.env.DEV) console.warn(`[Icono] no existe "${nombre}" en src/components/iconos/svg`);
    return null;
  }
  if (strokeWidth != null) svg = svg.replace('stroke-width="2"', `stroke-width="${strokeWidth}"`);

  return (
    <span
      className={className}
      role={titulo ? "img" : undefined}
      aria-label={titulo || undefined}
      aria-hidden={titulo ? undefined : true}
      style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, lineHeight: 0, ...style }}
      // Contenido local y fijo (archivos del repo), no viene del usuario.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
