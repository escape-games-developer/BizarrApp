import { useCallback, useEffect, useRef, useState } from "react";
import { TV_PREVIEW_PATH, isTvPreviewMessage, tvPreviewMessage } from "../../preview/tvPreviewContract";

/**
 * Tamaño lógico de cada dispositivo: los px CSS del iframe, lo que ven sus
 * vw/vh y @media. El celular es el mismo viewport inicial del Diseñador
 * Cliente (390 × 844); `escalaMax` es lo más grande que se dibuja.
 */
const DISPOSITIVOS = {
  tv:      { ancho: 1920, alto: 1080, escalaMax: 1, marco: 2 },
  celular: { ancho: 390,  alto: 844,  escalaMax: 1, marco: 14 },
};

// Alto que queda libre debajo de la vista previa: la nota de una línea, el
// padding inferior del área del Admin y un respiro. Con esto entra entera en
// la ventana, sin scroll.
const RESERVA_ABAJO = 46;
const ALTO_MINIMO = 220;

/**
 * Vista previa de una pantalla de juego: un iframe de /designer-preview/tv al
 * tamaño real del dispositivo, achicado al ancho disponible. Dibuja `escena`
 * con los mismos componentes que /tv (o que la app, en el celular), sin
 * proyectar nada ni tocar lo que está al aire.
 *
 * La escena viaja por mensaje cada vez que cambia; si el iframe todavía no
 * escuchaba, la pide con "ready" y se le reenvía (ver tvPreviewContract.js).
 */
export default function PreviewTv({ escena, dispositivo = "tv" }) {
  const { ancho, alto, escalaMax, marco } = DISPOSITIVOS[dispositivo];
  const celular = dispositivo === "celular";
  const zonaRef = useRef(null);
  const iframeRef = useRef(null);
  const escenaRef = useRef(null);
  const [escala, setEscala] = useState(0);

  const enviar = useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (win && escenaRef.current) win.postMessage(tvPreviewMessage("render", { escena: escenaRef.current }), window.location.origin);
  }, []);

  // Se reenvía sólo si cambió el contenido, no la identidad del objeto.
  const json = JSON.stringify(escena ?? null);
  useEffect(() => { escenaRef.current = JSON.parse(json); enviar(); }, [json, enviar]);

  useEffect(() => {
    const alRecibir = (e) => {
      if (isTvPreviewMessage(e, iframeRef.current?.contentWindow) && e.data.kind === "ready") enviar();
    };
    window.addEventListener("message", alRecibir);
    return () => window.removeEventListener("message", alRecibir);
  }, [enviar]);

  // La escala es la menor entre el ancho disponible y el alto que queda en la
  // ventana debajo de la vista previa: entra entera, sin scroll. Se mide al
  // montar, al cambiar el ancho, la ventana o la escena (cambia lo que hay
  // arriba: los estados de la vista), no con el scroll, para que no salte mientras
  // se recorren los controles.
  useEffect(() => {
    const el = zonaRef.current;
    if (!el) return undefined;
    const medir = () => {
      const altoLibre = Math.max(ALTO_MINIMO, window.innerHeight - el.getBoundingClientRect().top - RESERVA_ABAJO);
      setEscala(Math.min(escalaMax, (el.clientWidth - marco) / ancho, (altoLibre - marco) / alto));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener("resize", medir);
    return () => { ro.disconnect(); window.removeEventListener("resize", medir); };
  }, [ancho, alto, escalaMax, marco, json]);

  const iframe = (
    <iframe ref={iframeRef} src={TV_PREVIEW_PATH} title={celular ? "Vista previa del celular" : "Vista previa de la TV"}
      tabIndex={-1}
      style={{ position: "absolute", top: 0, left: 0, width: ancho, height: alto, border: 0,
        transform: `scale(${escala})`, transformOrigin: "0 0", pointerEvents: "none",
        visibility: escala ? "visible" : "hidden" }}/>
  );

  if (celular) return (
    // Mismo marco que el preview del Diseñador Cliente.
    <div ref={zonaRef} style={{ display: "flex", justifyContent: "center", padding: "4px 0" }}>
      <div data-preview-frame style={{ flex: "0 0 auto", padding: 6, borderRadius: 22, background: "#05030A",
        border: "1px solid rgba(240,232,255,.16)", boxShadow: "0 12px 40px rgba(0,0,0,.45)" }}>
        <div style={{ position: "relative", width: ancho * escala, height: alto * escala, overflow: "hidden", borderRadius: 4 }}>
          {iframe}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={zonaRef} style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ position: "relative", flex: "0 0 auto", width: ancho * escala, height: alto * escala,
        overflow: "hidden", borderRadius: 10, background: "#000",
        border: "1px solid rgba(240,232,255,.14)", boxShadow: "0 10px 40px rgba(0,0,0,.45)" }}>
        {iframe}
      </div>
    </div>
  );
}
