/**
 * Estilos del módulo Pantalla/Escenario dentro del Admin.
 *
 * Arquitectura de pantalla tomada de DJ Democracy (cabecera de evento, consola
 * a dos columnas, ranking en vivo, curaduría de playlist) con la identidad de
 * BizarrApp: noche, violeta, fucsia y amarillo. Prefijo `pdj-` para no pisar
 * ninguna clase del panel existente.
 *
 * Se inyecta una sola vez, igual que el resto del proyecto.
 */
const pantallaCss = `
  /* ── Cabecera global del evento ─────────────────────────────────────── */
  .pdj-hdr{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
    padding:13px 16px;margin-bottom:12px;border-radius:16px;position:relative;overflow:hidden;
    background:linear-gradient(135deg,rgba(155,47,255,.16),rgba(255,45,120,.08) 60%,rgba(8,4,15,0));
    border:1px solid rgba(155,47,255,.3);}
  .pdj-hdr-live{border-color:rgba(0,245,160,.4);
    background:linear-gradient(135deg,rgba(0,245,160,.13),rgba(155,47,255,.12) 60%,rgba(8,4,15,0));}
  .pdj-hdr-main{flex:1 1 210px;min-width:0;}
  .pdj-hdr-name{font-family:'Syne',sans-serif;font-weight:900;font-size:19px;color:#F0E8FF;
    line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-hdr-meta{font-size:10.5px;color:rgba(240,232,255,.42);margin-top:4px;
    display:flex;gap:9px;flex-wrap:wrap;align-items:center;}
  .pdj-hdr-meta b{color:rgba(240,232,255,.7);font-weight:700;}
  .pdj-hdr-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;}

  .pdj-estado{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:20px;
    font-family:'Syne',sans-serif;font-weight:900;font-size:11px;letter-spacing:1.2px;flex-shrink:0;}
  .pdj-estado .pdj-punto{width:7px;height:7px;border-radius:50%;background:currentColor;flex-shrink:0;}
  .pdj-estado-live .pdj-punto{animation:pdjLatido 1.6s ease-in-out infinite;}
  @keyframes pdjLatido{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}

  /* ── Código del evento ──────────────────────────────────────────────── */
  .pdj-codigo{font-family:'Syne',sans-serif;font-weight:900;letter-spacing:6px;color:#FFD600;
    text-shadow:0 0 22px rgba(255,214,0,.35);line-height:1;}

  /* ── Cards del módulo ───────────────────────────────────────────────── */
  .pdj-card{background:rgba(240,232,255,.035);border:1px solid rgba(240,232,255,.09);
    border-radius:16px;padding:14px 16px;margin-bottom:11px;position:relative;overflow:hidden;}
  .pdj-card-acento::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;
    background:linear-gradient(90deg,#9B2FFF,#FF2D78);opacity:.7;}
  .pdj-card-titulo{display:flex;align-items:center;gap:7px;margin-bottom:11px;}
  .pdj-card-titulo h4{font-family:'Syne',sans-serif;font-weight:900;font-size:12.5px;
    letter-spacing:.4px;color:#F0E8FF;margin:0;flex:1;}
  .pdj-card-titulo .pdj-hint{font-size:9.5px;color:rgba(240,232,255,.3);font-weight:600;}
  .pdj-sub{font-size:10.5px;color:rgba(240,232,255,.35);line-height:1.55;margin-bottom:10px;}

  /* ── Métricas ───────────────────────────────────────────────────────── */
  .pdj-metricas{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:7px;}
  .pdj-metrica{border-radius:12px;padding:10px 11px;border:1px solid transparent;}
  .pdj-metrica-v{font-family:'Syne',sans-serif;font-size:23px;font-weight:900;line-height:1;
    transition:color .25s ease;}
  .pdj-metrica-l{font-size:9px;color:rgba(240,232,255,.4);margin-top:4px;letter-spacing:.3px;}

  /* ── Consola DJ: 70/30 ──────────────────────────────────────────────── */
  .pdj-consola{display:grid;grid-template-columns:minmax(0,7fr) minmax(260px,3fr);gap:12px;align-items:start;}
  .pdj-consola-col{min-width:0;}
  @media (max-width:1080px){ .pdj-consola{grid-template-columns:1fr;} }

  /* ── Sonando ahora ──────────────────────────────────────────────────── */
  .pdj-ahora{border-radius:18px;padding:16px;position:relative;overflow:hidden;margin-bottom:11px;
    background:linear-gradient(135deg,rgba(255,45,120,.14),rgba(155,47,255,.1) 55%,rgba(8,4,15,.2));
    border:1px solid rgba(255,45,120,.34);box-shadow:0 0 34px rgba(255,45,120,.1) inset;}
  .pdj-ahora-row{display:flex;gap:15px;align-items:center;}
  .pdj-ahora-cover{width:96px;height:96px;border-radius:14px;object-fit:cover;flex-shrink:0;
    border:1px solid rgba(255,255,255,.12);box-shadow:0 8px 26px rgba(0,0,0,.5);}
  .pdj-ahora-cover-vacia{width:96px;height:96px;border-radius:14px;flex-shrink:0;display:flex;
    align-items:center;justify-content:center;font-size:34px;opacity:.3;
    background:rgba(240,232,255,.05);border:1px dashed rgba(240,232,255,.14);}
  .pdj-ahora-tit{font-family:'Syne',sans-serif;font-weight:900;font-size:22px;color:#FFD600;
    line-height:1.14;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-ahora-art{font-size:13px;color:rgba(240,232,255,.55);margin-top:3px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-barra{height:5px;border-radius:3px;background:rgba(240,232,255,.09);overflow:hidden;margin-top:11px;}
  .pdj-barra-fill{height:100%;border-radius:3px;transition:width .45s linear;
    background:linear-gradient(90deg,#FFD600,#FF9500);}
  .pdj-tiempos{display:flex;justify-content:space-between;font-size:10px;
    color:rgba(240,232,255,.35);margin-top:5px;font-variant-numeric:tabular-nums;}

  /* ── A continuación ─────────────────────────────────────────────────── */
  .pdj-next{display:flex;gap:11px;align-items:center;padding:10px 12px;border-radius:13px;
    background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);margin-bottom:11px;}
  .pdj-next-cover{width:44px;height:44px;border-radius:9px;object-fit:cover;flex-shrink:0;}

  /* ── Controles del DJ ───────────────────────────────────────────────── */
  .pdj-controles{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:8px;}
  .pdj-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
    padding:13px 10px;border-radius:13px;cursor:pointer;text-align:center;
    font-family:'Syne',sans-serif;font-weight:800;font-size:11.5px;letter-spacing:.3px;
    border:1.5px solid rgba(240,232,255,.12);background:rgba(240,232,255,.05);color:#F0E8FF;
    transition:transform .12s ease,background .18s,border-color .18s;}
  .pdj-btn .pdj-btn-ico{font-size:19px;line-height:1;}
  .pdj-btn:hover:not(:disabled){background:rgba(155,47,255,.16);border-color:rgba(155,47,255,.45);}
  .pdj-btn:active:not(:disabled){transform:scale(.96);}
  .pdj-btn:disabled{opacity:.32;cursor:not-allowed;}
  .pdj-btn-principal{background:linear-gradient(135deg,#9B2FFF,#FF2D78);border-color:transparent;color:#fff;
    box-shadow:0 6px 22px rgba(155,47,255,.32);}
  .pdj-btn-principal:hover:not(:disabled){background:linear-gradient(135deg,#A94BFF,#FF4A8C);
    border-color:transparent;}
  .pdj-btn-peligro{background:rgba(255,45,120,.09);border-color:rgba(255,45,120,.3);color:#FCA5A5;}
  .pdj-btn-peligro:hover:not(:disabled){background:rgba(255,45,120,.18);border-color:rgba(255,45,120,.5);}
  .pdj-btn-on{background:rgba(0,229,255,.14);border-color:rgba(0,229,255,.45);color:#00E5FF;}

  /* ── Ranking en vivo ────────────────────────────────────────────────── */
  .pdj-rank{display:flex;align-items:center;gap:11px;padding:9px 11px;margin-bottom:6px;
    border-radius:13px;background:rgba(240,232,255,.035);border:1px solid rgba(240,232,255,.07);
    transition:background .3s ease,border-color .3s ease,transform .3s ease;}
  .pdj-rank-1{background:linear-gradient(90deg,rgba(255,214,0,.13),rgba(240,232,255,.03));
    border-color:rgba(255,214,0,.35);}
  .pdj-rank-pos{width:26px;flex-shrink:0;text-align:center;font-family:'Syne',sans-serif;
    font-weight:900;font-size:16px;color:rgba(240,232,255,.25);}
  .pdj-rank-1 .pdj-rank-pos{color:#FFD600;}
  .pdj-rank-cover{width:42px;height:42px;border-radius:9px;object-fit:cover;flex-shrink:0;}
  .pdj-rank-info{flex:1;min-width:0;}
  .pdj-rank-tit{font-size:13px;font-weight:700;color:#F0E8FF;line-height:1.25;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-rank-art{font-size:11px;color:rgba(240,232,255,.35);
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-rank-votos{display:flex;gap:9px;font-size:11px;margin-top:3px;
    color:rgba(240,232,255,.45);font-variant-numeric:tabular-nums;}
  .pdj-rank-score{flex-shrink:0;text-align:right;min-width:52px;}
  .pdj-rank-score b{font-family:'Syne',sans-serif;font-weight:900;font-size:19px;line-height:1;
    display:block;transition:color .3s ease;}
  .pdj-rank-score span{font-size:8.5px;color:rgba(240,232,255,.28);letter-spacing:.6px;}

  /* ── Sacar tema ─────────────────────────────────────────────────────── */
  .pdj-kick{border-radius:15px;padding:13px 14px;margin-bottom:11px;
    background:rgba(255,45,120,.06);border:1px solid rgba(255,45,120,.22);}
  .pdj-kick-num{font-family:'Syne',sans-serif;font-weight:900;font-size:26px;color:#FF2D78;line-height:1;
    font-variant-numeric:tabular-nums;}
  .pdj-kick-barra{height:8px;border-radius:5px;background:rgba(240,232,255,.08);overflow:hidden;margin-top:10px;}
  .pdj-kick-fill{height:100%;border-radius:5px;transition:width .4s ease;
    background:linear-gradient(90deg,#FF2D78,#FF9500);}

  /* ── Panel lateral: QR y accesos ────────────────────────────────────── */
  .pdj-qr{background:#fff;padding:10px;border-radius:13px;display:inline-block;line-height:0;}
  .pdj-lateral-cta{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;}

  /* ── Playlist ───────────────────────────────────────────────────────── */
  .pdj-tema{display:flex;align-items:center;gap:10px;padding:9px 11px;margin-bottom:6px;
    border-radius:13px;background:rgba(240,232,255,.032);border:1px solid rgba(240,232,255,.07);
    transition:border-color .18s,background .18s;}
  .pdj-tema:hover{border-color:rgba(155,47,255,.3);background:rgba(155,47,255,.06);}
  .pdj-tema-sonando{border-color:rgba(255,45,120,.5);background:rgba(255,45,120,.08);
    box-shadow:0 0 20px rgba(255,45,120,.12);}
  .pdj-tema-off{opacity:.42;}
  .pdj-tema-pos{width:24px;flex-shrink:0;text-align:center;font-size:11px;font-weight:700;
    color:rgba(240,232,255,.28);font-variant-numeric:tabular-nums;}
  .pdj-tema-cover{width:46px;height:46px;border-radius:9px;object-fit:cover;flex-shrink:0;
    background:rgba(240,232,255,.05);}
  .pdj-tema-info{flex:1;min-width:0;}
  .pdj-tema-tit{font-size:13px;font-weight:700;color:#F0E8FF;line-height:1.25;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-tema-art{font-size:11px;color:rgba(240,232,255,.35);margin-top:1px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .pdj-tema-acts{display:flex;gap:3px;flex-shrink:0;align-items:center;}
  .pdj-ico{width:26px;height:26px;border-radius:8px;cursor:pointer;flex-shrink:0;font-size:12px;
    display:flex;align-items:center;justify-content:center;
    background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.08);
    color:rgba(240,232,255,.42);transition:all .15s;}
  .pdj-ico:hover{background:rgba(155,47,255,.18);border-color:rgba(155,47,255,.4);color:#F0E8FF;}
  .pdj-ico-on{background:rgba(255,214,0,.16);border-color:rgba(255,214,0,.4);color:#FFD600;}
  .pdj-ico-peligro:hover{background:rgba(255,45,120,.18);border-color:rgba(255,45,120,.45);color:#FCA5A5;}

  /* ── Chips de estado ────────────────────────────────────────────────── */
  .pdj-chip{display:inline-flex;align-items:center;gap:4px;padding:2.5px 8px;border-radius:9px;
    font-size:8.5px;font-weight:800;letter-spacing:.6px;white-space:nowrap;flex-shrink:0;}

  /* ── Campos ─────────────────────────────────────────────────────────── */
  .pdj-campo{margin-bottom:12px;}
  .pdj-campo-lbl{font-size:11px;font-weight:600;color:rgba(240,232,255,.6);margin-bottom:5px;display:block;}
  .pdj-campo-hint{font-size:9.5px;color:rgba(240,232,255,.28);line-height:1.5;margin-top:4px;}
  .pdj-input{width:100%;background:rgba(240,232,255,.05);border:1.5px solid rgba(240,232,255,.1);
    border-radius:11px;padding:10px 12px;color:#F0E8FF;font-family:'Space Grotesk',sans-serif;
    font-size:12.5px;outline:none;transition:border-color .18s,background .18s;}
  .pdj-input:focus{border-color:rgba(155,47,255,.55);background:rgba(155,47,255,.06);}
  .pdj-input::placeholder{color:rgba(240,232,255,.2);}
  textarea.pdj-input{resize:vertical;min-height:96px;line-height:1.55;}
  select.pdj-input{cursor:pointer;}
  select.pdj-input option{background:#110820;color:#F0E8FF;}
  .pdj-num{width:70px;text-align:center;font-variant-numeric:tabular-nums;}

  .pdj-switch{display:flex;align-items:center;justify-content:space-between;gap:10px;
    padding:10px 12px;border-radius:12px;cursor:pointer;
    background:rgba(240,232,255,.035);border:1px solid rgba(240,232,255,.08);margin-bottom:8px;}
  .pdj-switch:hover{border-color:rgba(155,47,255,.3);}
  .pdj-switch-txt{font-size:12px;font-weight:600;color:rgba(240,232,255,.7);}
  .pdj-switch input{accent-color:#9B2FFF;cursor:pointer;width:16px;height:16px;flex-shrink:0;}

  /* ── Matriz de poderes ──────────────────────────────────────────────── */
  .pdj-matriz{width:100%;border-collapse:separate;border-spacing:0 5px;min-width:400px;}
  .pdj-matriz th{font-size:9px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;
    color:rgba(240,232,255,.32);text-align:center;padding:0 6px 4px;}
  .pdj-matriz th:first-child{text-align:left;}
  .pdj-matriz td{padding:8px 6px;background:rgba(240,232,255,.032);}
  .pdj-matriz td:first-child{border-radius:11px 0 0 11px;padding-left:12px;
    font-size:12px;font-weight:700;color:#F0E8FF;}
  .pdj-matriz td:last-child{border-radius:0 11px 11px 0;padding-right:12px;}
  .pdj-celda{display:flex;align-items:center;justify-content:center;gap:6px;}
  .pdj-celda input[type=checkbox]{accent-color:#9B2FFF;cursor:pointer;width:15px;height:15px;}
  .pdj-celda input[type=number]{width:46px;padding:4px 5px;border-radius:8px;font-size:11.5px;
    text-align:center;font-weight:700;color:#FFD600;background:rgba(240,232,255,.06);
    border:1px solid rgba(240,232,255,.1);outline:none;font-family:'Space Grotesk',sans-serif;}
  .pdj-celda input[type=number]:disabled{opacity:.3;}

  /* ── Participantes ──────────────────────────────────────────────────── */
  .pdj-part{display:flex;align-items:center;gap:11px;padding:9px 12px;margin-bottom:6px;
    border-radius:13px;background:rgba(240,232,255,.032);border:1px solid rgba(240,232,255,.07);}
  .pdj-avatar{width:36px;height:36px;border-radius:50%;flex-shrink:0;overflow:hidden;font-size:17px;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,rgba(155,47,255,.25),rgba(255,45,120,.18));
    border:1px solid rgba(240,232,255,.12);}
  .pdj-avatar img{width:100%;height:100%;object-fit:cover;}
  .pdj-online{width:7px;height:7px;border-radius:50%;flex-shrink:0;}

  /* ── Historial ──────────────────────────────────────────────────────── */
  .pdj-hist{display:flex;align-items:center;gap:11px;padding:10px 12px;margin-bottom:6px;
    border-radius:13px;background:rgba(240,232,255,.032);border:1px solid rgba(240,232,255,.07);}
  .pdj-hist-n{width:24px;flex-shrink:0;text-align:center;font-family:'Syne',sans-serif;
    font-weight:900;font-size:13px;color:rgba(240,232,255,.22);}
  .pdj-hist-cover{width:44px;height:44px;border-radius:9px;object-fit:cover;flex-shrink:0;}

  /* ── Vacíos y skeletons ─────────────────────────────────────────────── */
  .pdj-vacio{text-align:center;padding:34px 18px;}
  .pdj-vacio-ico{font-size:38px;opacity:.2;margin-bottom:11px;}
  .pdj-vacio-tit{font-family:'Syne',sans-serif;font-weight:800;font-size:13.5px;
    color:rgba(240,232,255,.45);margin-bottom:6px;}
  .pdj-vacio-txt{font-size:11.5px;color:rgba(240,232,255,.28);line-height:1.6;max-width:340px;
    margin:0 auto;}
  .pdj-skel{border-radius:13px;background:linear-gradient(90deg,
    rgba(240,232,255,.04) 25%,rgba(240,232,255,.08) 50%,rgba(240,232,255,.04) 75%);
    background-size:200% 100%;animation:pdjSkel 1.3s ease-in-out infinite;margin-bottom:6px;}
  @keyframes pdjSkel{0%{background-position:200% 0}100%{background-position:-200% 0}}

  /* ── Botón compacto reutilizable ────────────────────────────────────── */
  .pdj-mini{padding:7px 12px;border-radius:10px;cursor:pointer;flex-shrink:0;
    font-family:'Syne',sans-serif;font-weight:800;font-size:10.5px;letter-spacing:.3px;
    background:rgba(240,232,255,.06);border:1.5px solid rgba(240,232,255,.12);
    color:rgba(240,232,255,.65);transition:all .16s;}
  .pdj-mini:hover:not(:disabled){background:rgba(155,47,255,.16);border-color:rgba(155,47,255,.42);color:#F0E8FF;}
  .pdj-mini:active:not(:disabled){transform:scale(.97);}
  .pdj-mini:disabled{opacity:.32;cursor:not-allowed;}
  .pdj-mini-p{background:linear-gradient(135deg,#9B2FFF,#FF2D78);border-color:transparent;color:#fff;}
  .pdj-mini-p:hover:not(:disabled){filter:brightness(1.12);border-color:transparent;}
  .pdj-mini-a{background:rgba(255,214,0,.12);border-color:rgba(255,214,0,.32);color:#FFD600;}
  .pdj-mini-r{background:rgba(255,45,120,.1);border-color:rgba(255,45,120,.28);color:#FCA5A5;}

  /* ── Pestañas del módulo ────────────────────────────────────────────── */
  .pdj-tabs{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:12px;}
  .pdj-tab{flex:1 1 auto;padding:9px 12px;border-radius:11px;cursor:pointer;white-space:nowrap;
    font-family:'Space Grotesk',sans-serif;font-size:11.5px;font-weight:700;
    background:rgba(240,232,255,.035);border:1.5px solid rgba(240,232,255,.08);
    color:rgba(240,232,255,.45);transition:all .16s;}
  .pdj-tab:hover{border-color:rgba(155,47,255,.32);color:rgba(240,232,255,.75);}
  .pdj-tab-on{background:linear-gradient(135deg,rgba(155,47,255,.28),rgba(255,45,120,.18));
    border-color:rgba(155,47,255,.55);color:#FFD600;}

  @media (max-width:720px){
    .pdj-ahora-cover,.pdj-ahora-cover-vacia{width:70px;height:70px;}
    .pdj-ahora-tit{font-size:17px;}
    .pdj-hdr-acts{width:100%;}
  }
`;

export default pantallaCss;
