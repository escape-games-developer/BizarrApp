import { useState } from "react";
import { useEscenarioListoAdmin } from "../../../hooks/useEscenarioListo";
import { useVotacionEscenario } from "../../../hooks/useVotacionEscenario";
import { ESCENARIO_JUEGOS } from "../../../constants/escenarioJuegos";
import { CelularJuego, ErrorCarga } from "../../juegos/AjustesDelJuego";
import { AvisoGuardado } from "../../juegos/SeccionConfig";
import VistasJuego from "../VistasJuego";
import EditorListo from "./EditorListo";
import EditorBarometro from "./EditorBarometro";

/**
 * Follow the Leader / Personal Trainer en sus cuatro vistas.
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

  return (
    <VistasJuego juego={tipo} col={col} nav={nav} controles={controles}
      escenaExtra={({ qr, logo }) => (j ? {
        listo: j,
        qr:   qr.config   ? qr.config[tipo]   !== false : true,
        logo: logo.config ? logo.config[tipo] !== false : true,
      } : null)}/>
  );
}
