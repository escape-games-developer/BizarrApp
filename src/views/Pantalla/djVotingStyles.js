/**
 * Estilos de la votación musical del cliente (Pantalla › 🎧 Música).
 *
 * Mobile first: funciona desde 360 px, botones cómodos para el dedo, cards a
 * ancho completo y cero tablas. Estética BizarrApp — noche, violeta, fucsia y
 * amarillo — con la arquitectura de pantalla del guest de DJ Democracy.
 *
 * Prefijo `djv-` para no chocar con los estilos globales de la app.
 */
const djVotingCss = `
  /* ── Estado del evento ──────────────────────────────────────────────── */
  .djv-estado{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:20px;
    font-family:'Syne',sans-serif;font-weight:900;font-size:10px;letter-spacing:1.2px;
    background:rgba(0,245,160,.12);border:1px solid rgba(0,245,160,.4);color:#00F5A0;}
  .djv-estado i{width:6px;height:6px;border-radius:50%;background:currentColor;font-style:normal;
    animation:djvLatido 1.6s ease-in-out infinite;}
  @keyframes djvLatido{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}
  .djv-meta{font-size:10.5px;color:rgba(245,230,192,.3);}

  /* ── Reacciones ─────────────────────────────────────────────────────── */
  .djv-reacciones{display:flex;gap:6px;margin-bottom:14px;}
  .djv-reaccion{flex:1;min-width:0;padding:11px 0;font-size:21px;line-height:1;cursor:pointer;
    background:rgba(245,230,192,.04);border:1px solid rgba(245,230,192,.1);border-radius:13px;
    transition:transform .16s ease,background .16s,border-color .16s;
    -webkit-tap-highlight-color:transparent;}
  .djv-reaccion:active{background:rgba(155,47,255,.16);border-color:rgba(155,47,255,.4);}
  .djv-reaccion-pop{transform:scale(1.3);background:rgba(255,45,120,.16);border-color:rgba(255,45,120,.45);}

  /* ── Sonando ahora ──────────────────────────────────────────────────── */
  .djv-ahora{position:relative;overflow:hidden;border-radius:18px;padding:15px;margin-bottom:12px;
    background:linear-gradient(135deg,rgba(255,45,120,.16),rgba(155,47,255,.12) 55%,rgba(13,0,16,.4));
    border:1px solid rgba(255,45,120,.32);box-shadow:0 0 30px rgba(255,45,120,.09) inset;}
  .djv-ahora-lbl{font-family:'Syne',sans-serif;font-weight:900;font-size:9.5px;letter-spacing:2px;
    color:rgba(255,45,120,.8);margin-bottom:11px;}
  .djv-ahora-row{display:flex;gap:13px;align-items:center;}
  .djv-ahora-cover{width:78px;height:78px;border-radius:13px;object-fit:cover;flex-shrink:0;
    border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 22px rgba(0,0,0,.5);}
  .djv-ahora-vacia{width:78px;height:78px;border-radius:13px;flex-shrink:0;display:flex;
    align-items:center;justify-content:center;font-size:30px;opacity:.3;
    background:rgba(245,230,192,.05);border:1px dashed rgba(245,230,192,.14);}
  .djv-ahora-tit{font-family:'Syne',sans-serif;font-weight:900;font-size:17px;color:#FFD700;
    line-height:1.18;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
  .djv-ahora-art{font-size:12.5px;color:rgba(245,230,192,.5);margin-top:4px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

  /* ── Sacar tema ─────────────────────────────────────────────────────── */
  .djv-kick{width:100%;margin-top:13px;padding:13px;border-radius:14px;cursor:pointer;
    font-family:'Syne',sans-serif;font-weight:900;font-size:13px;letter-spacing:.4px;
    background:rgba(245,230,192,.05);border:1.5px solid rgba(245,230,192,.14);
    color:rgba(245,230,192,.6);transition:all .18s;-webkit-tap-highlight-color:transparent;}
  .djv-kick:active{transform:scale(.985);}
  .djv-kick-on{background:rgba(255,45,120,.18);border-color:rgba(255,45,120,.55);color:#FF2D78;
    box-shadow:0 0 22px rgba(255,45,120,.16);}
  .djv-kick:disabled{opacity:.45;cursor:not-allowed;}
  .djv-kick-info{font-family:'Space Grotesk',sans-serif;font-size:10.5px;font-weight:600;
    opacity:.8;margin-top:5px;display:block;letter-spacing:0;}
  .djv-kick-barra{height:5px;border-radius:3px;background:rgba(245,230,192,.1);overflow:hidden;margin-top:9px;}
  .djv-kick-fill{height:100%;border-radius:3px;transition:width .45s ease;
    background:linear-gradient(90deg,#FF2D78,#FF9500);}

  /* ── Encabezado de candidatos ───────────────────────────────────────── */
  .djv-seccion{margin:18px 0 11px;}
  .djv-seccion-tit{font-family:'Syne',sans-serif;font-weight:900;font-size:13.5px;color:#FFD700;
    display:flex;align-items:center;gap:7px;}
  .djv-seccion-sub{font-size:11px;color:rgba(245,230,192,.32);margin-top:3px;}

  /* ── Card de candidato ──────────────────────────────────────────────── */
  .djv-tema{border-radius:16px;padding:11px;margin-bottom:9px;position:relative;
    background:rgba(245,230,192,.032);border:1.5px solid rgba(245,230,192,.08);
    transition:border-color .25s ease,background .25s ease,box-shadow .25s ease;}
  .djv-tema-votado{border-color:rgba(155,47,255,.55);background:rgba(155,47,255,.1);
    box-shadow:0 0 22px rgba(155,47,255,.14);}
  .djv-tema-contra{border-color:rgba(255,45,120,.4);background:rgba(255,45,120,.06);}
  .djv-tema-row{display:flex;gap:11px;align-items:center;}
  .djv-tema-pos{width:20px;flex-shrink:0;text-align:center;font-family:'Syne',sans-serif;
    font-weight:900;font-size:14px;color:rgba(245,230,192,.25);}
  .djv-tema-1 .djv-tema-pos{color:#FFD700;}
  .djv-tema-cover{width:56px;height:56px;border-radius:11px;object-fit:cover;flex-shrink:0;
    background:rgba(245,230,192,.05);}
  .djv-tema-info{flex:1;min-width:0;}
  .djv-tema-tit{font-size:13.5px;font-weight:700;color:#F5E6C0;line-height:1.25;
    overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;}
  .djv-tema-art{font-size:11.5px;color:rgba(245,230,192,.35);margin-top:2px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .djv-tema-pts{flex-shrink:0;text-align:right;min-width:46px;}
  .djv-tema-pts b{font-family:'Syne',sans-serif;font-weight:900;font-size:18px;line-height:1;
    display:block;transition:color .3s ease;}
  .djv-tema-pts span{font-size:8px;color:rgba(245,230,192,.25);letter-spacing:.6px;}

  .djv-chip-voto{position:absolute;top:-7px;right:11px;padding:2px 9px;border-radius:9px;
    font-family:'Syne',sans-serif;font-weight:900;font-size:8.5px;letter-spacing:.8px;
    background:linear-gradient(135deg,#9B2FFF,#FF2D78);color:#fff;
    box-shadow:0 3px 12px rgba(155,47,255,.45);}

  /* ── Botonera de voto ───────────────────────────────────────────────── */
  .djv-acciones{display:flex;gap:7px;margin-top:10px;}
  .djv-voto{flex:1;min-height:44px;border-radius:12px;cursor:pointer;
    display:flex;align-items:center;justify-content:center;gap:5px;
    font-family:'Syne',sans-serif;font-weight:800;font-size:13px;
    background:rgba(245,230,192,.05);border:1.5px solid rgba(245,230,192,.12);
    color:rgba(245,230,192,.5);transition:all .18s;-webkit-tap-highlight-color:transparent;}
  .djv-voto:active:not(:disabled){transform:scale(.96);}
  .djv-voto:disabled{opacity:.4;cursor:not-allowed;}
  .djv-voto-up-on{background:rgba(0,245,160,.18);border-color:rgba(0,245,160,.55);color:#00F5A0;
    box-shadow:0 0 16px rgba(0,245,160,.18);}
  .djv-voto-down-on{background:rgba(255,45,120,.18);border-color:rgba(255,45,120,.55);color:#FF2D78;}
  .djv-super{flex:1.35;background:linear-gradient(135deg,rgba(255,214,0,.16),rgba(255,45,120,.14));
    border-color:rgba(255,214,0,.42);color:#FFD700;}
  .djv-super:active:not(:disabled){transform:scale(.96);}
  .djv-super-usado{background:rgba(245,230,192,.04);border-color:rgba(245,230,192,.1);
    color:rgba(245,230,192,.3);}
  .djv-peso{font-size:9.5px;font-weight:700;opacity:.75;}

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

  @media (max-width:360px){
    .djv-ahora-cover,.djv-ahora-vacia{width:64px;height:64px;}
    .djv-ahora-tit{font-size:15px;}
    .djv-tema-cover{width:48px;height:48px;}
    .djv-voto{font-size:12px;}
  }
`;

export default djVotingCss;
