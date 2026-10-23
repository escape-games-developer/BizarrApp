import { useEffect, useRef, useState } from "react";
import { esKickDual } from "../constants/kickModos";

/**
 * Sacar Tema en modo «Amor y Odio» 🌹🍅 o «Guns & Roses» 🔫🌹, en la TV.
 *
 * Cada invitado vota una vez: flor (+1) o tomate / bala (−1). Esto dibuja:
 *   · el MEDIDOR (positivos − negativos), del umbral negativo al positivo, en
 *     el bloque «Contador Sacar Tema» del Diseñador DJ Democracy, con su título;
 *   · cada voto nuevo como un proyectil: la flor vuela y queda PEGADA; el tomate
 *     vuela, revienta y deja la mancha; la bala vuela y deja un agujero (uno al
 *     azar de la galería). Lo pegado se limpia al cambiar de canción;
 *   · el cartel al cortarse el tema (`kick_tv_text`) y el aviso de «a salvo».
 *
 * Las señales son `kick_flower_seq` (flores) y `kick_impact_seq` (tomates /
 * balas): sólo se anima la diferencia contra lo ya visto, así abrir la TV no
 * repite los votos viejos. Sin imágenes cargadas se usan emojis.
 */

const TEXTO_CORTE_POR_DEFECTO = "El pueblo quitó este tema de forma democrática";
const MAX_POR_TANDA = 5;
const VUELO_MS = { flor: 900, tomate: 800, bala: 280 };

const CSS = `
  .kd-medidor{position:absolute;display:flex;flex-direction:column;justify-content:center;gap:1.2vh;
    padding:1.4vh 1.6vw;border-radius:1.6vh;background:rgba(8,4,15,.72);border:1px solid rgba(240,232,255,.15);
    font-family:'Space Grotesk',sans-serif;color:#F0E8FF;pointer-events:none;z-index:60;box-sizing:border-box;}
  .kd-tit{font-family:Syne,sans-serif;font-weight:900;font-size:2.2vh;letter-spacing:.08em;text-align:center;}
  .kd-fila{display:flex;align-items:center;gap:1vw;font-weight:800;font-size:2.2vh;}
  .kd-barra{position:relative;flex:1;height:1.6vh;border-radius:999px;background:rgba(240,232,255,.12);}
  .kd-relleno{position:absolute;top:0;bottom:0;border-radius:999px;transition:all .45s cubic-bezier(.4,0,.2,1);}
  .kd-cero{position:absolute;top:-.6vh;bottom:-.6vh;width:.25vw;background:rgba(240,232,255,.6);}
  .kd-pieza{position:fixed;z-index:58;pointer-events:none;transform:translate(-50%,-50%);
    font-size:6vh;line-height:1;}
  .kd-pieza img{display:block;width:9vh;height:9vh;object-fit:contain;}
  .kd-agujero{width:7vh;height:7vh;border-radius:50%;
    background:radial-gradient(circle,#050308 0 28%,#3a3340 32%,rgba(240,232,255,.35) 40%,transparent 62%);}
  .kd-mancha{width:12vh;height:12vh;border-radius:46% 54% 50% 50%;background:radial-gradient(circle,rgba(220,38,38,.75),rgba(220,38,38,0) 70%);}
  .kd-banner{position:fixed;left:0;right:0;bottom:9vh;z-index:125;display:flex;justify-content:center;padding:0 5vw;pointer-events:none;}
  .kd-banner b{font-family:Syne,sans-serif;font-weight:900;font-size:4.2vh;text-align:center;color:#fff;
    padding:1.6vh 3vw;border-radius:2vh;background:rgba(8,4,15,.85);border:2px solid var(--kd-col);
    box-shadow:0 0 40px var(--kd-col);animation:kdEntra .35s ease both;}
  @keyframes kdEntra{from{opacity:0;transform:translateY(2vh) scale(.96)}to{opacity:1;transform:none}}
  @keyframes kdSale{to{opacity:0;transform:scale(1.3)}}
`;

const azar = (a, b) => a + Math.random() * (b - a);

/** Imagen si hay URL; si no, el emoji. */
const Pieza = ({ url, emoji }) => (url ? <img src={url} alt=""/> : <span>{emoji}</span>);

export default function KickDualOverlay({ event, area }) {
  const activo = event?.kick_enabled === true && esKickDual(event?.kick_style);
  const guns   = event?.kick_style === "guns_roses";
  const itemId = event?.current_item_id ?? null;
  const flores = Number(event?.kick_flower_seq ?? 0);
  const golpes = Number(event?.kick_impact_seq ?? 0);

  const [piezas, setPiezas] = useState([]);   // volando y pegadas
  const [banner, setBanner] = useState(null); // { texto, color }
  const visto  = useRef(null);                // { flores, golpes } ya animados
  const itemRef  = useRef(null);
  const medidorRef = useRef(null);            // medidor del tema anterior, para saber si se cortó
  const timers = useRef(new Set());
  const id = useRef(0);

  const despues = (fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  };
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);

  // Medidor del tema en curso (el guardado es de otro tema → cero).
  const m = event?.kick_meter?.item_id === itemId ? event.kick_meter : null;
  const valor = Number(m?.value ?? 0);
  const salvado = !!m?.saved;
  const neg = Math.min(-1, Number(event?.kick_negative_threshold ?? -10));
  const pos = Math.max(1, Number(event?.kick_positive_threshold ?? 10));

  // Cambio de canción: se limpia lo pegado; si el tema anterior terminó con el
  // medidor en el umbral negativo, se cortó por votación → cartel.
  useEffect(() => {
    if (!activo) { itemRef.current = null; return; }
    if (itemRef.current && itemRef.current !== itemId) {
      setPiezas([]);
      const anterior = medidorRef.current;
      if (anterior && anterior.value <= anterior.neg) {
        setBanner({ texto: (event?.kick_tv_text || "").trim() || TEXTO_CORTE_POR_DEFECTO, color: guns ? "#94A3B8" : "#DC2626" });
        despues(() => setBanner(null), 4500);
      }
    }
    itemRef.current = itemId;
  }, [activo, itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { medidorRef.current = { value: valor, neg }; }, [valor, neg]);

  // A salvo: aviso breve.
  const salvadoRef = useRef(false);
  useEffect(() => {
    if (activo && salvado && !salvadoRef.current) {
      setBanner({ texto: "🌹 ¡Este tema quedó a salvo! 🌹", color: "#34D399" });
      despues(() => setBanner(null), 3500);
    }
    salvadoRef.current = salvado;
  }, [activo, salvado]);

  // Votos nuevos → proyectiles.
  useEffect(() => {
    if (!activo) { visto.current = null; setPiezas([]); return; }
    if (!visto.current) { visto.current = { flores, golpes }; return; }
    const nuevasFlores = Math.min(MAX_POR_TANDA, Math.max(0, flores - visto.current.flores));
    const nuevosGolpes = Math.min(MAX_POR_TANDA, Math.max(0, golpes - visto.current.golpes));
    visto.current = { flores, golpes };

    const lanzar = (tipo) => {
      const p = { id: ++id.current, tipo, fase: "inicio",
        x0: azar(20, 80), y0: 112, x1: azar(12, 88), y1: azar(14, 70), hueco: null };
      if (tipo === "bala") {
        const huecos = Array.isArray(event?.kick_bullet_holes) ? event.kick_bullet_holes : [];
        p.hueco = huecos.length ? huecos[Math.floor(Math.random() * huecos.length)] : null;
        p.x0 = Math.random() < .5 ? -8 : 108; p.y0 = azar(20, 70);
      }
      setPiezas((ps) => [...ps, p]);
      despues(() => setPiezas((ps) => ps.map((q) => (q.id === p.id ? { ...q, fase: "vuelo" } : q))), 30);
      despues(() => setPiezas((ps) => ps.map((q) => (q.id === p.id ? { ...q, fase: "impacto" } : q))), VUELO_MS[tipo] + 30);
      // El tomate revienta y queda la mancha.
      if (tipo === "tomate") {
        despues(() => setPiezas((ps) => ps.map((q) => (q.id === p.id ? { ...q, fase: "mancha" } : q))), VUELO_MS.tomate + 700);
      }
    };
    for (let i = 0; i < nuevasFlores; i++) despues(() => lanzar("flor"), i * 180);
    for (let i = 0; i < nuevosGolpes; i++) despues(() => lanzar(guns ? "bala" : "tomate"), i * 180);
  }, [activo, flores, golpes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activo) return null;

  const titulo = (event?.kick_meter_title || "").trim();
  const cero  = (-neg / (pos - neg)) * 100;
  const punta = ((Math.max(neg, Math.min(pos, valor)) - neg) / (pos - neg)) * 100;
  const caja  = area || { x: 32, y: 75, w: 36, h: 10 };

  const contenido = (p) => {
    if (p.tipo === "flor") {
      return p.fase === "impacto"
        ? <Pieza url={event?.kick_flower_stuck_url || event?.kick_flower_icon_url} emoji="🌹"/>
        : <Pieza url={event?.kick_flower_flying_url || event?.kick_flower_icon_url} emoji="🌹"/>;
    }
    if (p.tipo === "tomate") {
      if (p.fase === "mancha") {
        return event?.kick_tomato_splat_url ? <img src={event.kick_tomato_splat_url} alt=""/> : <div className="kd-mancha"/>;
      }
      return p.fase === "impacto"
        ? <Pieza url={event?.kick_tomato_exploded_url} emoji="💥"/>
        : <Pieza url={event?.kick_tomato_flying_url} emoji="🍅"/>;
    }
    // Bala: vuela y deja el agujero.
    if (p.fase === "impacto") return p.hueco ? <img src={p.hueco} alt=""/> : <div className="kd-agujero"/>;
    return <Pieza url={event?.kick_bullet_flying_url} emoji="•"/>;
  };

  return (
    <>
      <style>{CSS}</style>

      {piezas.map((p) => {
        const enVuelo = p.fase === "inicio";
        const ms = VUELO_MS[p.tipo];
        return (
          <div key={p.id} className="kd-pieza" aria-hidden="true" style={{
            left: `${enVuelo ? p.x0 : p.x1}%`, top: `${enVuelo ? p.y0 : p.y1}%`,
            transition: p.fase === "vuelo" ? `left ${ms}ms ease-out, top ${ms}ms cubic-bezier(.2,.7,.3,1)` : "none",
          }}>
            {contenido(p)}
          </div>
        );
      })}

      <div className="kd-medidor" aria-hidden="true" style={{
        left: `${caja.x}%`, top: `${caja.y}%`, width: `${caja.w}%`, minHeight: `${caja.h}%`,
      }}>
        {titulo && <div className="kd-tit">{titulo}</div>}
        <div className="kd-fila">
          <span>{guns ? "🔫" : "🍅"}</span>
          <div className="kd-barra">
            <div className="kd-relleno" style={{
              left: `${Math.min(cero, punta)}%`, width: `${Math.abs(punta - cero)}%`,
              background: valor >= 0 ? "#34D399" : "#EF4444",
            }}/>
            <div className="kd-cero" style={{ left: `${cero}%` }}/>
          </div>
          <span>🌹</span>
          <span style={{ minWidth: "3vw", textAlign: "right", color: valor >= 0 ? "#34D399" : "#EF4444" }}>
            {valor > 0 ? `+${valor}` : valor}
          </span>
        </div>
      </div>

      {banner && (
        <div className="kd-banner" aria-hidden="true" style={{ "--kd-col": banner.color }}>
          <b>{banner.texto}</b>
        </div>
      )}
    </>
  );
}
