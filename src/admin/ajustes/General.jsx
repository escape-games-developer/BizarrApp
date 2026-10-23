import { useState } from "react";
import { useGeneralConfigAdmin } from "../../hooks/useGeneralConfig";
import { Interruptor } from "./RegistroClientes";

/**
 * Ajustes → General. Cada opción se prende o apaga con su interruptor y se
 * guarda al instante (ver hooks/useGeneralConfig.js).
 */

const OPCIONES = [
  {
    id: "geoObligatoria", icon: "📍", titulo: "Localización obligatoria",
    activo:   "Para entrar a Juegos, Escenario y Pantalla el cliente tiene que verificar su ubicación en el bar.",
    inactivo: "Cualquier cliente logueado puede participar en Juegos, Escenario y Pantalla, esté donde esté.",
  },
  {
    id: "modoInvitado", icon: "🎟️", titulo: "Modo invitado",
    activo:   "La pantalla de ingreso muestra el botón «Entrar como invitado», para participar sin crear cuenta.",
    inactivo: "El botón «Entrar como invitado» no aparece: para participar hay que tener cuenta.",
  },
  {
    id: "catalogoJuegos", icon: "🃏", titulo: "Cards de juegos",
    activo:   "Sin nada activo, Juegos y Escenario muestran las cards con el logo de cada juego, para que el cliente sepa qué hay.",
    inactivo: "Sin nada activo, Juegos y Escenario quedan con la pantalla de espera, sin cards.",
  },
  {
    id: "estiloCards", icon: "🎨", titulo: "Estilo de cards en los juegos",
    activo:   "El contenedor de postulación de Follow the Leader, Personal Trainer y el Duelo usa el estilo de las cards: borde neón con el color del juego y fondo casi transparente.",
    inactivo: "El contenedor de postulación usa los colores propios de cada juego. Sigue ocupando toda la pantalla con el botón adentro.",
  },
  {
    id: "titulos", icon: "🔤", titulo: "Títulos de juegos y secciones",
    activo:   "Arriba de cada juego y sección se ve su título (por ejemplo «💃 Follow the Leader», «Mi Perfil», «Carta del Bar»).",
    inactivo: "Los juegos y secciones se muestran sin título: va directo el contenido.",
  },
];

export default function General({ puedeEditar }) {
  const { config, error, guardar, recargar } = useGeneralConfigAdmin();
  const [guardando, setGuardando] = useState(null);   // id de la opción que se está guardando
  const [aviso, setAviso] = useState(null);           // { tono, texto }

  const cambiar = async (id, valor) => {
    setGuardando(id); setAviso(null);
    try {
      await guardar({ ...config, [id]: valor });
      setAviso({ tono: "ok", texto: "Guardado. Los clientes lo ven la próxima vez que abran la app." });
    } catch (e) {
      setAviso({ tono: "error", texto: e.message });
    } finally {
      setGuardando(null);
    }
  };

  if (error) return (
    <div role="alert" style={{ fontSize: 12.5, color: "#FCA5A5" }}>
      {error}{" "}
      <button type="button" className="btn btn-g" style={{ padding: "5px 10px", fontSize: 10, marginLeft: 8 }} onClick={recargar}>Reintentar</button>
    </div>
  );
  if (!config) return <div style={{ fontSize: 12, color: "rgba(240,232,255,.45)" }}>Cargando…</div>;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {OPCIONES.map((o) => (
        <div key={o.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderRadius: 14,
          background: config[o.id] ? "rgba(155,47,255,.08)" : "rgba(240,232,255,.03)",
          border: `1px solid ${config[o.id] ? "rgba(155,47,255,.4)" : "rgba(240,232,255,.1)"}` }}>
          <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden="true">{o.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 14 }}>{o.titulo}</strong>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: .6, textTransform: "uppercase",
                color: config[o.id] ? "#00F5A0" : "rgba(240,232,255,.4)" }}>
                {guardando === o.id ? "Guardando…" : config[o.id] ? "Activo" : "Inactivo"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.6, color: "rgba(240,232,255,.55)" }}>
              {config[o.id] ? o.activo : o.inactivo}
            </p>
          </div>
          <Interruptor encendido={config[o.id]} etiqueta={o.titulo}
            deshabilitado={!puedeEditar || guardando !== null}
            onCambiar={(v) => cambiar(o.id, v)}/>
        </div>
      ))}

      {!puedeEditar && (
        <div style={{ fontSize: 11.5, color: "rgba(240,232,255,.45)" }}>Tu usuario no puede cambiar esta configuración.</div>
      )}
      {aviso && (
        <div role={aviso.tono === "error" ? "alert" : "status"}
          style={{ fontSize: 11.5, color: aviso.tono === "error" ? "#FCA5A5" : "#00F5A0" }}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
