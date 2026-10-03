/**
 * Estilos de la votación musical del cliente (Pantalla = DJ Democracy).
 *
 * Mobile first: funciona desde 320 px, botones cómodos para el dedo, cards a
 * ancho completo y cero tablas. Estética BizarrApp — noche, violeta, fucsia y
 * amarillo — con la arquitectura de pantalla del guest de DJ Democracy.
 *
 * Prefijo `djv-` para no chocar con los estilos globales de la app.
 */
const djVotingCss = `
  /* ── Estado del evento ──────────────────────────────────────────────── */
  .djv-meta{font-size:10.5px;color:rgba(245,230,192,.3);}

  /* Densidad: la vista es una lista musical para escanear rápido. En un
     celular de ~860 px de alto entran 4 candidatas completas sin
     scrollear, con todos sus controles. Botones de voto de 46 px. */

  /* ── Layout: cabecera fija + lista con scroll ───────────────────────── */
  /* La vista ocupa justo el alto de .app-content (que entonces no scrollea).
     La lista se come el padding lateral e inferior de .app-content (16 px)
     para scrollear hasta los bordes; el padding-top deja lugar al chip
     "TU VOTO" de la primera card. */
  .djv-vista{display:flex;flex-direction:column;height:100%;min-height:0;}
  .djv-fijo{flex-shrink:0;}
  .djv-lista{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;margin:0 -16px -16px;padding:8px 16px 16px;}

  /* ── Reacciones ─────────────────────────────────────────────────────── */
  .djv-reacciones{display:flex;gap:6px;margin-bottom:10px;}
  .djv-reaccion{flex:1;min-width:0;padding:10px 0;font-size:29px;line-height:1;cursor:pointer;
    background:rgba(245,230,192,.04);border:1px solid rgba(245,230,192,.1);border-radius:13px;
    transition:transform .16s ease,background .16s,border-color .16s;
    -webkit-tap-highlight-color:transparent;}
  .djv-reaccion:active{background:rgba(155,47,255,.16);border-color:rgba(155,47,255,.4);}
  .djv-reaccion-pop{transform:scale(1.3);background:rgba(255,45,120,.16);border-color:rgba(255,45,120,.45);}

  /* ── Sonando ahora ──────────────────────────────────────────────────── */
  /* Sin portada. Arriba, a todo el ancho, la etiqueta. Debajo: tema y artista a
     la izquierda, el botón para sacar el tema a la derecha. El progreso es una
     franja fina sobre el borde inferior, así no suma una fila. */
  .djv-ahora{position:relative;overflow:hidden;border-radius:18px;padding:8px 14px 13px;margin-bottom:10px;
    background:linear-gradient(135deg,rgba(255,45,120,.16),rgba(155,47,255,.12) 55%,rgba(13,0,16,.4));
    border:1px solid rgba(255,45,120,.32);box-shadow:0 0 30px rgba(255,45,120,.09) inset;}
  .djv-ahora-row{display:flex;gap:12px;align-items:center;}
  .djv-ahora-info{flex:1;min-width:0;}
  .djv-ahora-lbl{font-family:"Syne",sans-serif;font-weight:900;font-size:12px;letter-spacing:1.4px;
    color:rgba(255,45,120,.85);line-height:1.2;margin-bottom:5px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .djv-ahora-tit{font-family:"Syne",sans-serif;font-weight:900;font-size:11.8px;color:#FFFFFF;
    line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .djv-ahora-art{font-size:15.4px;line-height:1.25;color:rgba(245,230,192,.5);margin-top:1px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

  /* ── Sacar tema ─────────────────────────────────────────────────────── */
  .djv-kick{flex-shrink:0;max-width:52%;min-height:39px;padding:6px 11px;border-radius:14px;cursor:pointer;
    font-family:"Syne",sans-serif;font-weight:900;font-size:13.3px;line-height:1.25;letter-spacing:.3px;white-space:nowrap;
    background:rgba(245,230,192,.05);border:1.5px solid rgba(245,230,192,.14);
    color:rgba(245,230,192,.65);transition:all .18s;-webkit-tap-highlight-color:transparent;}
  .djv-kick:active{transform:scale(.97);}
  .djv-kick-on{background:rgba(255,45,120,.18);border-color:rgba(255,45,120,.55);color:#FF2D78;
    box-shadow:0 0 16px rgba(255,45,120,.16);}
  .djv-kick:disabled{opacity:.45;cursor:not-allowed;}
  .djv-kick-barra{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(245,230,192,.1);}
  .djv-kick-fill{height:100%;transition:width .45s ease;
    background:linear-gradient(90deg,#FF2D78,#FF9500);}

  /* ── Encabezado de candidatos ───────────────────────────────────────── */
  .djv-seccion{margin:10px 0 0;}
  .djv-seccion-tit{font-family:'Syne',sans-serif;font-weight:900;font-size:13px;color:#FFD700;
    display:flex;align-items:center;gap:6px;line-height:1.2;}
  .djv-copa{filter:drop-shadow(0 0 4px rgba(255,215,0,.35));}

  /* ── Card de candidato ──────────────────────────────────────────────── */
  /* Grilla: [pos] [portada] [tema + artista] [puntos], y la botonera debajo
     del texto. La portada ocupa las dos filas, así la card no crece. */
  .djv-tema{border-radius:14px;padding:9px 10px 11px;margin-bottom:8px;position:relative;
    background:rgba(245,230,192,.032);border:1px solid #FFD700;
    transition:border-color .25s ease,background .25s ease,box-shadow .25s ease;}
  .djv-tema-votado{border-color:rgba(155,47,255,.55);background:rgba(155,47,255,.1);
    box-shadow:0 0 18px rgba(155,47,255,.14);}
  .djv-tema-contra{border-color:rgba(255,45,120,.4);background:rgba(255,45,120,.06);}
  .djv-tema-grid{display:grid;grid-template-columns:18px 64px minmax(0,1fr) auto;
    grid-template-areas:"pos cover info pts" "pos cover acc acc";
    column-gap:10px;row-gap:9px;align-items:center;}
  .djv-tema-grid-solo{grid-template-areas:"pos cover info pts";}
  .djv-tema-pos{grid-area:pos;text-align:center;font-family:'Syne',sans-serif;
    font-weight:900;font-size:15px;color:rgba(245,230,192,.25);}
  .djv-tema-1 .djv-tema-pos{color:#FFD700;}
  .djv-tema-cover{grid-area:cover;width:64px;height:64px;border-radius:11px;object-fit:cover;
    background:rgba(245,230,192,.05);}
  .djv-tema-info{grid-area:info;min-width:0;}
  .djv-tema-tit{font-size:15px;font-weight:700;color:#F5E6C0;line-height:1.25;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .djv-tema-art{font-size:13px;color:rgba(245,230,192,.4);margin-top:1px;line-height:1.25;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .djv-tema-pts{grid-area:pts;text-align:right;min-width:30px;}
  /* DM Sans y no Syne: el 0 de Syne es ancho y se ve ovalado. */
  .djv-tema-pts b{font-family:'DM Sans',sans-serif;font-weight:600;font-size:19px;line-height:1;
    font-variant-numeric:tabular-nums;display:block;transition:color .3s ease;}

  .djv-chip-voto{position:absolute;top:-7px;right:9px;padding:1px 8px;border-radius:8px;
    font-family:'Syne',sans-serif;font-weight:900;font-size:8px;letter-spacing:.8px;
    background:linear-gradient(135deg,#9B2FFF,#FF2D78);color:#fff;
    box-shadow:0 3px 10px rgba(155,47,255,.45);}

  /* ── Botonera de voto ───────────────────────────────────────────────── */
  .djv-acciones{grid-area:acc;display:flex;gap:6px;min-width:0;}
  .djv-voto{position:relative;flex:1;min-width:0;height:46px;padding:0 6px;border-radius:12px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;
    font-family:'Syne',sans-serif;font-weight:800;font-size:22px;
    background:rgba(245,230,192,.05);border:1px solid rgba(245,230,192,.12);
    color:rgba(245,230,192,.5);transition:all .18s;-webkit-tap-highlight-color:transparent;}
  .djv-voto:active:not(:disabled){transform:scale(.96);}
  .djv-voto:disabled{opacity:.4;cursor:not-allowed;}
  /* Contorno por tipo: verde el positivo, rojo el negativo (mismos colores
     que sus indicadores +1 / -1). El color de texto va sin transparencia:
     Chrome se la aplica también al emoji y lo dejaba apagado. */
  .djv-voto-up{border-color:#00F5A0;color:#00F5A0;}
  .djv-voto-down{border-color:#FF3B30;color:#FF3B30;}
  .djv-voto-up-on{background:rgba(0,245,160,.18);border-color:rgba(0,245,160,.55);color:#00F5A0;
    box-shadow:0 0 12px rgba(0,245,160,.18);}
  .djv-voto-down-on{background:rgba(255,59,48,.18);border-color:#FF3B30;color:#FF3B30;}
  .djv-super{font-size:29px;background:linear-gradient(135deg,rgba(255,214,0,.16),rgba(255,45,120,.14));
    border-color:rgba(255,214,0,.42);color:#FFD700;}
  .djv-super:active:not(:disabled){transform:scale(.96);}
  .djv-super-usado{background:rgba(245,230,192,.04);border-color:rgba(245,230,192,.1);
    color:rgba(245,230,192,.3);}
  /* +1 / -1: valor del voto, apoyado sobre el borde superior del botón. */
  .djv-valor{position:absolute;top:-8px;left:50%;transform:translateX(-50%);
    padding:0 4px;border-radius:5px;background:#120B04;pointer-events:none;
    font-family:"Space Grotesk",sans-serif;font-size:10.5px;font-weight:800;line-height:14px;}
  .djv-valor-up{color:#00F5A0;}
  .djv-valor-down{color:#FF3B30;}
  .djv-valor-super{color:#FFD700;}
  /* Cantidad de super votos disponibles, sobre el borde inferior. */
  .djv-valor-abajo{top:auto;bottom:-8px;}

  /* ── Avisos, vacíos y skeletons ─────────────────────────────────────── */
  .djv-aviso{padding:11px 13px;margin-bottom:11px;border-radius:13px;font-size:11.5px;line-height:1.5;}
  .djv-aviso-info{background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.22);
    color:rgba(245,230,192,.65);}
  .djv-aviso-error{background:rgba(255,45,120,.09);border:1px solid rgba(255,45,120,.28);color:#FCA5A5;}
  .djv-aviso-ok{background:rgba(0,245,160,.09);border:1px solid rgba(0,245,160,.28);color:#00F5A0;}
  .djv-aviso-cta{margin-top:9px;padding:9px 16px;border-radius:11px;cursor:pointer;
    font-family:'Syne',sans-serif;font-weight:800;font-size:11.5px;
    background:rgba(255,215,0,.14);border:1px solid rgba(255,215,0,.35);color:#FFD700;}

  .djv-vacio{text-align:center;padding:42px 22px;}
  .djv-vacio-ico{font-size:46px;opacity:.2;margin-bottom:14px;}
  .djv-vacio-tit{font-family:'Syne',sans-serif;font-weight:800;font-size:15px;
    color:rgba(255,215,0,.4);margin-bottom:8px;line-height:1.35;}
  .djv-vacio-txt{font-size:12px;color:rgba(245,230,192,.28);line-height:1.6;max-width:270px;margin:0 auto;}

  .djv-skel{border-radius:16px;margin-bottom:9px;background:linear-gradient(90deg,
    rgba(245,230,192,.035) 25%,rgba(245,230,192,.075) 50%,rgba(245,230,192,.035) 75%);
    background-size:200% 100%;animation:djvSkel 1.3s ease-in-out infinite;}
  @keyframes djvSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}

  .djv-pie{text-align:center;font-size:10.5px;color:rgba(245,230,192,.28);
    margin-top:14px;line-height:1.6;}

  /* Celulares angostos: achica lo que tiene texto largo en una línea. */
  @media (max-width:360px){
    .djv-tema-grid{grid-template-columns:16px 56px minmax(0,1fr) auto;column-gap:8px;}
    .djv-tema-cover{width:56px;height:56px;}
    .djv-kick{padding:6px 9px;}
    .djv-seccion-tit{font-size:11px;white-space:nowrap;}
  }
  /* "Top - Votá lo que suena después" en una línea también a 320 px. */
  @media (max-width:340px){
    .djv-seccion-tit{font-size:10px;}
  }
`;

export default djVotingCss;
