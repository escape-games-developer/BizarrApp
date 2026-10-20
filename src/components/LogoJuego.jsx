/**
 * Logo oficial de un juego (la imagen de /placas) con su movimiento: late
 * suave y continuo (escala 1 → 1,05 → 1 cada 1,5 s).
 *
 * Es el MISMO en la placa de anuncio y en la convocatoria de cada juego, así
 * el logo se mueve igual en las dos pantallas. Cada pantalla pasa su tamaño y
 * su brillo por `style`; la animación no se toca desde afuera.
 */
const KEYFRAMES = "@keyframes latidoJuego{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}";

export default function LogoJuego({ src, alt, style, className, onError }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <img src={src} alt={alt} className={className}
        onError={onError || ((e) => { e.currentTarget.style.display = "none"; })}
        style={{ objectFit: "contain", ...style, animation: "latidoJuego 1.5s ease-in-out infinite" }}/>
    </>
  );
}
