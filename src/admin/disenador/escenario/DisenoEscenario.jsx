import { useState } from "react";
import { useEscenarioListoAdmin } from "../../../hooks/useEscenarioListo";
import { useVotacionEscenario } from "../../../hooks/useVotacionEscenario";
import { ESCENARIO_JUEGOS } from "../../../constants/escenarioJuegos";
import { CelularJuego, ErrorCarga } from "../../juegos/AjustesDelJuego";
import { AvisoGuardado } from "../../juegos/SeccionConfig";
import VistasJuego from "../VistasJuego";
import EditorListo from "./EditorListo";
import EditorBarometro from "./EditorBarometro";
import EditorLienzo from "../../../lienzo/editor/EditorLienzo";
import { ESCENARIO_POR_DEFECTO, PANTALLAS_ESCENARIO, PANTALLAS_ESCENARIO_CEL } from "../../../lienzo/juegos/escenario";
import { usePantallaVisibilidadAdmin } from "../../../hooks/usePantallaQr";

/**
 * Follow the Leader / Personal Trainer en sus cuatro vistas, en el editor libre
 * de pantallas (fila `lienzo_<tipo>`). Arriba de cada vista siguen sus ajustes
 * de siempre: el cartel del participante listo, el barómetro y el vestuario.
 *
 * Una sola instancia de `useEscenarioListoAdmin` para toda la fila
 * `escenario_listo` (cartel + barómetro): dos instancias guardando por
 * separado chocarían en el control de `updated_at`. La vista previa recibe
 * esa misma config en memoria, así refleja cada cambio en el acto.
 */

// Cuadro «Vestuario especial requerido» de la postulación (fila `general`).
const VESTUARIO = { ftl: "vestuarioFtl", pt: "vestuarioPt" };

export default function DisenoEscenario({ tipo, nav }) {
  const col = ESCENARIO_JUEGOS[tipo].colorAdmin;
  const listo = useEscenarioListoAdmin();
  const votacion = useVotacionEscenario()[tipo] || "off";
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);   // { ok, text }

  const j = listo.config?.[tipo] || null;

  const aplicar = async (cambios, okText) => {
    if (guardando || !j) return;
    setGuardando(true); setResultado(null);
    try { await listo.guardar(tipo, cambios); setResultado({ ok: true, text: okText }); }
    catch (e) { setResultado({ ok: false, text: e?.message || String(e) }); }
    finally { setGuardando(false); }
  };

  const sinConfig = listo.error
    ? <div className="card"><ErrorCarga error={listo.error} recargar={listo.recargar}/></div>
    : <div className="card"><div style={{ fontSize: 10.5, color: "rgba(240,232,255,.45)" }}>Cargando…</div></div>;

  const controles = (vista, { guardado }) => {
    if (vista === "celular") return (
      <CelularJuego col={col} onGuardado={guardado} opciones={[{
        id: VESTUARIO[tipo], titulo: "Vestuario especial requerido",
        activo: "La postulación muestra el cuadro de vestuario.",
        inactivo: "La postulación no muestra el cuadro de vestuario.",
      }]}/>
    );
    if (vista === "convocatoria") return null;
    if (!j) return sinConfig;
    return (
      <>
        {vista === "listo"
          ? <EditorListo j={j} col={col} guardando={guardando} aplicar={aplicar} avisar={setResultado}/>
          : <EditorBarometro j={j} col={col} guardando={guardando} aplicar={aplicar} votacion={votacion}/>}
        <AvisoGuardado aviso={resultado}/>
      </>
    );
  };

  // Lo que el editor muestra pero hoy no se ve en la TV / el celular.
  const qr = usePantallaVisibilidadAdmin("qr");
  const avisos = {
    ...(votacion === "off" ? {
      escBarometro: "el juego no tiene votación del público (panel del juego → 🗳️).",
      escVotacion: "el juego no tiene votación del público (panel del juego → 🗳️).",
    } : {}),
    ...(j && j.previa === false ? { escListo: "la pantalla del participante listo está apagada: la TV pasa de la convocatoria al video." } : {}),
    ...(qr.config && qr.config[tipo] === false ? { qr: "el QR del juego está apagado en «QR y logo» (arriba)." } : {}),
  };
  const datos = { listo: j, juego: ESCENARIO_JUEGOS[tipo], qrUrl: `${window.location.origin}/?view=escenario` };
  const editor = (vista) => {
    const pantallas = vista === "celular" ? PANTALLAS_ESCENARIO_CEL : PANTALLAS_ESCENARIO.filter((x) => x.vista === vista);
    if (!pantallas.length) return null;
    return <EditorLienzo key={vista} juego={tipo} formato={vista === "celular" ? "celular" : "tv"} pantallas={pantallas}
      porDefecto={ESCENARIO_POR_DEFECTO[tipo]} datos={datos} avisos={avisos}/>;
  };

  return (
    <VistasJuego juego={tipo} col={col} nav={nav} controles={controles} editor={editor}
      escenaExtra={({ qr, logo }) => (j ? {
        listo: j,
        qr:   qr.config   ? qr.config[tipo]   !== false : true,
        logo: logo.config ? logo.config[tipo] !== false : true,
      } : null)}/>
  );
}
