import { useEffect, useRef } from "react";
import { EFECTOS_IMAGEN, EFECTOS_TEXTO } from "../efectos";
import { DATOS } from "../LienzoPantalla";
import ControlesTexto from "./ControlesTexto";
import { ColorInput, Fila, Interruptor, Num, Opcion, Seccion, Slider, nota } from "./controles";

/**
 * Panel derecho del editor: lo que se puede cambiar del elemento elegido, o
 * del fondo si no hay ninguno; abajo, las capas.
 */

export const nombreDe = (el) => el.nombre
  || (el.tipo === "texto" ? (el.texto || "Texto").slice(0, 26) : el.tipo === "imagen" ? "Imagen"
    : el.tipo === "forma" ? "Forma" : DATOS[el.dato]?.nombre || "Dato");

const ICONO = { texto: "T", imagen: "▣", dato: "◆", forma: "▢" };
/** Lo que el evento en vivo dice de ese dato (p. ej. «los equipos están apagados»), o null. */
const avisoDe = (avisos, el) => (el.tipo === "dato" ? avisos?.[el.dato] : null) || null;
const AVISO = { fontSize: 10.5, lineHeight: 1.5, color: "#FFD27A", padding: "8px 10px", marginBottom: 8, borderRadius: 8,
  background: "rgba(255,170,0,.1)", border: "1px solid rgba(255,170,0,.35)" };

function Efectos({ lista, valor, onCambiar }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {lista.map((e) => <Opcion key={e.id} on={valor === e.id} onClick={() => onCambiar(e.id)}>{e.nombre}</Opcion>)}
    </div>
  );
}

function PanelElemento({ el, onCambiar, onAccion, enfocarTexto, onCambiarImagen, onElegirMarco, formato, aviso }) {
  const area = useRef(null);
  useEffect(() => { if (enfocarTexto && area.current) { area.current.focus(); area.current.select(); } }, [enfocarTexto]);
  const set = (patch) => onCambiar(patch);
  const esDato = el.tipo === "dato";
  const dato = esDato ? DATOS[el.dato] : null;

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ICONO[el.tipo]} {nombreDe(el)}
        </span>
        <button type="button" className="btn btn-g" style={{ padding: "4px 9px", fontSize: 10.5 }} onClick={() => set({ visible: !el.visible })}
          title="Ocultarlo en la pantalla sin borrarlo">{el.visible ? "Ocultar" : "Mostrar"}</button>
        <button type="button" className="btn btn-g" style={{ padding: "4px 9px", fontSize: 10.5 }} onClick={() => onAccion("duplicar")}
          disabled={esDato} title={esDato ? "Es parte del juego: hay uno solo" : "Duplicar (Ctrl+D)"}>Duplicar</button>
        <button type="button" className="btn" style={{ padding: "4px 9px", fontSize: 10.5, background: "rgba(255,45,120,.1)",
          border: "1px solid rgba(255,45,120,.3)", color: "#FF2D78" }} onClick={() => onAccion("borrar")}
          disabled={esDato && !dato?.borrable}
          title={esDato && !dato?.borrable ? "Es parte del juego: no se borra (podés ocultarlo en Capas)" : "Borrar (Supr)"}>Borrar</button>
      </div>

      {el.tipo === "texto" && (
        <Seccion titulo="Texto">
          <textarea ref={area} className="inp" rows={3} value={el.texto} maxLength={300}
            onChange={(e) => set({ texto: e.target.value })} style={{ margin: 0, resize: "vertical" }}/>
        </Seccion>
      )}
      {aviso && <div role="note" style={AVISO}>⚠ Ahora no se ve en la TV: {aviso}</div>}
      {!el.visible && <div style={{ ...nota, color: "#FFD600", paddingBottom: 8 }}>Oculto: no se ve en la pantalla. En el editor aparece translúcido.</div>}
      {esDato && <div style={{ ...nota, paddingBottom: 8 }}>{dato?.ayuda} Lo llena el juego en vivo: podés moverlo, cambiarle el tamaño, el formato u ocultarlo.</div>}
      {dato?.leyenda && (
        <Seccion titulo="Texto del QR">
          <Fila label="Posición">
            {[["arriba", "Arriba"], ["abajo", "Abajo"], ["oculta", "Oculto"]].map(([v, t]) => (
              <Opcion key={v} on={el.leyenda === v} onClick={() => set({ leyenda: v })}>{t}</Opcion>
            ))}
          </Fila>
          {el.leyenda !== "oculta" && (<>
            <input className="inp" value={el.texto} maxLength={120} onChange={(e) => set({ texto: e.target.value })}
              placeholder="Sin texto" style={{ margin: 0 }}/>
            <Fila label="Tamaño">
              <Num value={el.estilo.tamano} min={8} max={200} step={1} ancho={58}
                onChange={(v) => set({ estilo: { ...el.estilo, tamano: v } })}/>
              <span style={nota}>px</span>
            </Fila>
          </>)}
        </Seccion>
      )}

      {dato?.titulo && (
        <Seccion titulo="Título">
          <input className="inp" value={el.texto} maxLength={120} onChange={(e) => set({ texto: e.target.value })}
            placeholder="Sin título" style={{ margin: 0 }}/>
        </Seccion>
      )}
      {dato?.plantilla && (
        <Seccion titulo="Texto">
          <input className="inp" value={el.texto} maxLength={120} onChange={(e) => set({ texto: e.target.value })}
            placeholder="{}" style={{ margin: 0 }}/>
          <div style={nota}>{"{}"} es el dato del juego: «Premio: {"{}"}» se ve «Premio: 2×1». Vacío = sólo el dato.</div>
        </Seccion>
      )}

      {dato?.portada && (
        <Seccion titulo="Portada">
          <Interruptor on={el.portada} onClick={() => set({ portada: !el.portada })}>Mostrar la foto de la canción</Interruptor>
        </Seccion>
      )}
      {dato?.ajusteTexto && (
        <Seccion titulo="Texto largo">
          <Fila>
            {[["cortar", "Cortar con …"], ["lineas", "Varias líneas"], ["ajustar", "Ajustar a la caja"]].map(([v, t]) => (
              <Opcion key={v} on={el.ajusteTexto === v} onClick={() => set({ ajusteTexto: v })}>{t}</Opcion>
            ))}
          </Fila>
          <div style={nota}>
            {el.ajusteTexto === "ajustar"
              ? "Si el texto no entra, se achica solo hasta entrar en la caja. Nunca pasa del «Tamaño» de «Formato del texto»: un título corto se ve a ese tamaño."
              : el.ajusteTexto === "lineas" ? "El texto que no entra baja al renglón siguiente."
                : "El texto que no entra se corta con «…». El tamaño es el de «Formato del texto»."}
          </div>
          {dato.cantidad && (
            <Fila label="Canciones">
              <Slider value={el.cantidad} min={1} max={8} onChange={(v) => set({ cantidad: v })} mostrar={(v) => `${v}`}/>
            </Fila>
          )}

        </Seccion>
      )}

      {dato?.avatar && (() => {
        const a = el.avatar;
        const setA = (patch) => set({ avatar: { ...a, ...patch } });
        return (
          <Seccion titulo="Avatar">
            <Fila label="Forma">
              {[["circulo", "Círculo"], ["redondeado", "Redondeado"], ["cuadrado", "Cuadrado"]].map(([v, t]) => (
                <Opcion key={v} on={a.forma === v} onClick={() => setA({ forma: v })}>{t}</Opcion>
              ))}
            </Fila>
            <Interruptor on={!a.color} onClick={() => setA({ color: a.color ? null : (dato.colorAro || "#FF2D78") })}>
              Aro del color de su lado
            </Interruptor>
            {a.color && <Fila label="Aro"><ColorInput value={a.color} onChange={(v) => setA({ color: v })}/></Fila>}
            <Fila label="Grosor"><Slider value={a.grosor} min={0} max={20} step={0.5} onChange={(v) => setA({ grosor: v })} mostrar={(v) => `${v}%`}/></Fila>
            <Fila label="Brillo"><Slider value={a.brillo} min={0} max={60} onChange={(v) => setA({ brillo: v })} mostrar={(v) => `${v}%`}/></Fila>
            <Fila label="Fondo"><ColorInput value={a.fondo} onChange={(v) => setA({ fondo: v })}/></Fila>
            <Fila label="Marco">
              <Opcion onClick={onElegirMarco}>{a.marco ? "Cambiar…" : "Elegir PNG…"}</Opcion>
              {a.marco && <Opcion onClick={() => setA({ marco: null })}>Quitar</Opcion>}
            </Fila>
            <div style={nota}>El marco es una imagen PNG transparente que va encima de la foto (un aro, una corona, un sticker). Ideal cuadrada.</div>
          </Seccion>
        );
      })()}

      {el.tipo === "imagen" && (
        <Seccion titulo="Imagen">
          <button type="button" className="btn btn-g" style={{ padding: "6px 10px", fontSize: 11, justifySelf: "start" }}
            onClick={onCambiarImagen}>Cambiar imagen…</button>
          <Fila label="Ajuste">
            <Opcion on={el.ajuste === "contain"} onClick={() => set({ ajuste: "contain" })}>Entera</Opcion>
            <Opcion on={el.ajuste === "cover"} onClick={() => set({ ajuste: "cover" })}>Llenar caja</Opcion>
          </Fila>
        </Seccion>
      )}

      {el.tipo === "forma" && (
        <Seccion titulo="Forma">
          <Interruptor on={!!el.relleno.degradado} onClick={() => set({ relleno: { ...el.relleno,
            degradado: el.relleno.degradado ? null : { colores: [el.relleno.color, "rgba(255,45,120,.12)"], angulo: 135 } } })}>
            Relleno en degradado
          </Interruptor>
          {el.relleno.degradado ? (<>
            {el.relleno.degradado.colores.map((c, i) => (
              <Fila key={i} label={`Color ${i + 1}`}>
                <ColorInput value={c} onChange={(v) => set({ relleno: { ...el.relleno, degradado: { ...el.relleno.degradado,
                  colores: el.relleno.degradado.colores.map((x, j) => (j === i ? v : x)) } } })}/>
              </Fila>
            ))}
            <Fila label="Ángulo">
              <Slider value={el.relleno.degradado.angulo} min={0} max={360}
                onChange={(v) => set({ relleno: { ...el.relleno, degradado: { ...el.relleno.degradado, angulo: v } } })} mostrar={(v) => `${v}°`}/>
            </Fila>
          </>) : (
            <Fila label="Relleno"><ColorInput value={el.relleno.color} onChange={(v) => set({ relleno: { ...el.relleno, color: v } })}/></Fila>
          )}
          <Fila label="Borde"><ColorInput value={el.borde.color} onChange={(v) => set({ borde: { ...el.borde, color: v } })}/></Fila>
          <Fila label="Grosor"><Slider value={el.borde.ancho} min={0} max={20} step={0.5} onChange={(v) => set({ borde: { ...el.borde, ancho: v } })}/></Fila>
          <Fila label="Esquinas"><Slider value={el.radio} min={0} max={200} onChange={(v) => set({ radio: v })}/></Fila>
        </Seccion>
      )}

      {el.tipo !== "forma" && !dato?.sinEfecto && (
        <Seccion titulo="Efecto">
          <Efectos lista={el.tipo === "imagen" ? EFECTOS_IMAGEN : EFECTOS_TEXTO} valor={el.efecto} onCambiar={(v) => set({ efecto: v })}/>
        </Seccion>
      )}

      {(el.tipo === "texto" || (esDato && !dato?.sinTexto)) && (
        <ControlesTexto estilo={el.estilo} onCambiar={(estilo) => set({ estilo })}
          titulo={!esDato ? "Formato" : dato?.formato || (dato?.leyenda || dato?.plantilla ? "Formato del texto" : "Formato de las letras")}/>
      )}
      {dato?.estiloSecundario && (
        <ControlesTexto estilo={dato.estiloSecundario(el)} onCambiar={(estilo2) => set({ estilo2 })} titulo={dato.secundario}/>
      )}

      {esDato && !dato?.sinFichas && (
        <Seccion titulo={dato?.acento ? "Tarjetas" : "Fichas"}>
          <Fila label="Fondo"><ColorInput value={el.ficha.fondo} onChange={(v) => set({ ficha: { ...el.ficha, fondo: v } })}/></Fila>
          <Fila label="Borde"><ColorInput value={el.ficha.borde} onChange={(v) => set({ ficha: { ...el.ficha, borde: v } })}/></Fila>
          {dato?.acento && <Fila label={dato.acentoNombre || "Letra"}><ColorInput value={el.ficha.acento} onChange={(v) => set({ ficha: { ...el.ficha, acento: v } })}/></Fila>}
        </Seccion>
      )}

      <Seccion titulo="Posición y tamaño">
        <Fila label="X / Y">
          <Num value={el.x} onChange={(v) => set({ x: v })} ancho={58}/>
          <Num value={el.y} onChange={(v) => set({ y: v })} ancho={58}/>
        </Fila>
        <Fila label="Ancho / alto">
          <Num value={el.w} min={8} onChange={(v) => set({ w: v })} ancho={58}/>
          <Num value={el.h} min={8} onChange={(v) => set({ h: v })} ancho={58}/>
        </Fila>
        <Fila label="Centrar">
          <Opcion onClick={() => set({ x: Math.round((formato.ancho - el.w) / 2) })}>Horizontal</Opcion>
          <Opcion onClick={() => set({ y: Math.round((formato.alto - el.h) / 2) })}>Vertical</Opcion>
        </Fila>
        <Fila label="Rotación"><Slider value={el.rot} min={-180} max={180} onChange={(v) => set({ rot: v })} mostrar={(v) => `${v}°`}/></Fila>
        <Fila label="Opacidad"><Slider value={Math.round(el.opacidad * 100)} min={0} max={100} onChange={(v) => set({ opacidad: v / 100 })} mostrar={(v) => `${v}%`}/></Fila>
        <Fila label="Capa">
          <Opcion onClick={() => onAccion("frente")} title="Traer al frente">Al frente</Opcion>
          <Opcion onClick={() => onAccion("fondo")} title="Enviar al fondo">Al fondo</Opcion>
        </Fila>
      </Seccion>
    </>
  );
}

function PanelFondo({ fondo, onCambiar, onElegirImagen }) {
  const set = (patch) => onCambiar({ ...fondo, ...patch });
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 800, paddingBottom: 10 }}>Fondo de la pantalla</div>
      <Seccion titulo="Tipo">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {[["ninguno", "Sin fondo"], ["imagen", "Imagen"], ["color", "Color"], ["radial", "Degradado radial"], ["lineal", "Degradado lineal"]].map(([v, t]) => (
            <Opcion key={v} on={fondo.tipo === v} onClick={() => (v === "imagen" && !fondo.imagen ? onElegirImagen() : set({ tipo: v }))}>{t}</Opcion>
          ))}
        </div>
        {(fondo.tipo === "radial" || fondo.tipo === "lineal") && (<>
          <Fila label="Centro"><ColorInput value={fondo.colores[0]} onChange={(v) => set({ colores: [v, fondo.colores[1]] })}/></Fila>
          <Fila label="Borde"><ColorInput value={fondo.colores[1]} onChange={(v) => set({ colores: [fondo.colores[0], v] })}/></Fila>
        </>)}
        {fondo.tipo === "lineal" && (
          <Fila label="Ángulo"><Slider value={fondo.angulo} min={0} max={360} onChange={(v) => set({ angulo: v })} mostrar={(v) => `${v}°`}/></Fila>
        )}
        {fondo.tipo === "color" && <Fila label="Color"><ColorInput value={fondo.color} onChange={(v) => set({ color: v })}/></Fila>}
        {fondo.tipo === "imagen" && (<>
          {fondo.imagen && <img src={fondo.imagen} alt="" style={{ width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8 }}/>}
          <button type="button" className="btn btn-g" style={{ padding: "6px 10px", fontSize: 11, justifySelf: "start" }}
            onClick={onElegirImagen}>Elegir o subir imagen…</button>
          <Fila label="Ajuste">
            <Opcion on={fondo.ajuste === "cover"} onClick={() => set({ ajuste: "cover" })}>Llenar</Opcion>
            <Opcion on={fondo.ajuste === "contain"} onClick={() => set({ ajuste: "contain" })}>Entera</Opcion>
          </Fila>
        </>)}
        {fondo.tipo === "imagen" && <div style={nota}>Los fondos de cada juego están en la biblioteca, categoría «Fondos». También podés subir uno desde la PC.</div>}
        {fondo.tipo !== "ninguno" && <Fila label="Oscurecer"><Slider value={Math.round(fondo.oscurecer * 100)} min={0} max={85} onChange={(v) => set({ oscurecer: v / 100 })} mostrar={(v) => `${v}%`}/></Fila>}
      </Seccion>
      <Seccion titulo="Extras">
        <Interruptor on={fondo.confeti} onClick={() => set({ confeti: !fondo.confeti })}>Lluvia de confeti</Interruptor>
        <Interruptor on={!!fondo.marco} onClick={() => set({ marco: fondo.marco ? null : "rgba(240,232,255,.25)" })}>Marco fino</Interruptor>
        {fondo.marco && <Fila label="Color"><ColorInput value={fondo.marco} onChange={(v) => set({ marco: v })}/></Fila>}
      </Seccion>
      <Seccion titulo="Luces de ambiente">
        <Interruptor on={fondo.orbs} onClick={() => set({ orbs: !fondo.orbs })}>Mostrar luces difuminadas</Interruptor>
        {fondo.orbs && fondo.orbsColores.map((c, i) => (
          <Fila key={i} label={`Luz ${i + 1}`}>
            <ColorInput value={c} onChange={(v) => set({ orbsColores: fondo.orbsColores.map((x, j) => (j === i ? v : x)) })}/>
          </Fila>
        ))}
      </Seccion>
    </>
  );
}

function Capas({ elementos, sel, onElegir, onCambiar, avisos }) {
  return (
    <Seccion titulo="Capas">
      <div style={{ display: "grid", gap: 3 }}>
        {[...elementos].reverse().map((el) => (
          <div key={el.id} onClick={() => onElegir(el.id)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, cursor: "pointer",
              background: sel === el.id ? "rgba(155,47,255,.22)" : "rgba(240,232,255,.03)",
              border: `1px solid ${sel === el.id ? "#9B2FFF" : "transparent"}`, opacity: el.visible ? 1 : .5 }}>
            <span style={{ width: 18, textAlign: "center", fontSize: 11, color: "rgba(240,232,255,.5)" }}>{ICONO[el.tipo]}</span>
            {avisoDe(avisos, el) && <span title={`Ahora no se ve en la TV: ${avisoDe(avisos, el)}`} style={{ color: "#FFB020", fontSize: 11 }}>⚠</span>}
            <span style={{ flex: 1, fontSize: 11.5, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nombreDe(el)}</span>
            <button type="button" title={el.visible ? "Ocultar" : "Mostrar"}
              onClick={(e) => { e.stopPropagation(); onCambiar(el.id, { visible: !el.visible }); }}
              style={{ background: "none", border: "none", color: "rgba(240,232,255,.6)", cursor: "pointer", fontSize: 11 }}>
              {el.visible ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        ))}
      </div>
    </Seccion>
  );
}

/**
 * `avisos` = { <id de dato>: texto }: lo que el evento en vivo hace que hoy no
 * se vea en la TV (equipos apagados, votación abierta…). Se marca con ⚠.
 */
export default function PanelPropiedades({ pantalla, sel, onCambiarElemento, onCambiarFondo, onAccion, onElegir,
  enfocarTexto, onPedirImagen, formato, avisos }) {
  const el = pantalla.elementos.find((x) => x.id === sel);
  return (
    <div>
      {el ? (
        <PanelElemento key={el.id} el={el} enfocarTexto={enfocarTexto} formato={formato} aviso={avisoDe(avisos, el)}
          onCambiar={(patch) => onCambiarElemento(el.id, patch)} onAccion={onAccion}
          onCambiarImagen={() => onPedirImagen("cambiar")} onElegirMarco={() => onPedirImagen("marco")}/>
      ) : (
        <PanelFondo fondo={pantalla.fondo} onCambiar={onCambiarFondo} onElegirImagen={() => onPedirImagen("fondo")}/>
      )}
      <Capas elementos={pantalla.elementos} sel={sel} onElegir={onElegir} onCambiar={onCambiarElemento} avisos={avisos}/>
    </div>
  );
}
