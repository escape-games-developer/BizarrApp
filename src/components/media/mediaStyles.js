/**
 * Estilos de la biblioteca de imágenes.
 *
 * Reusa la paleta, tipografías y radios del AdminPanel (Syne / Space Grotesk,
 * violeta #9B2FFF, amarillo #FFD600, superficies rgba(240,232,255,.04)) para
 * que el modal se sienta parte del panel y no de otro design system.
 * Se inyecta una sola vez, como el resto del proyecto.
 */
const mediaCss = `
  @keyframes mlFade{from{opacity:0}to{opacity:1}}
  @keyframes mlPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
  @keyframes mlSpin{to{transform:rotate(360deg)}}

  .ml-overlay{position:fixed;inset:0;z-index:900;display:flex;align-items:center;justify-content:center;
    padding:20px;background:rgba(4,1,8,.78);backdrop-filter:blur(6px);animation:mlFade .16s ease both;}

  .ml-modal{width:100%;max-width:780px;max-height:88vh;display:flex;flex-direction:column;
    background:#110820;border:1px solid rgba(155,47,255,.28);border-radius:18px;overflow:hidden;
    box-shadow:0 18px 60px rgba(0,0,0,.6);animation:mlPop .2s ease both;
    font-family:'Space Grotesk',sans-serif;color:#F0E8FF;}

  .ml-head{display:flex;align-items:center;gap:10px;padding:14px 16px;flex-shrink:0;
    border-bottom:1px solid rgba(155,47,255,.16);background:rgba(8,4,15,.6);}
  .ml-title{font-family:'Syne',sans-serif;font-weight:900;font-size:15px;color:#FFD600;flex:1;line-height:1.2;}
  .ml-count{font-size:10px;color:rgba(240,232,255,.32);}
  .ml-x{background:none;border:none;color:rgba(240,232,255,.4);font-size:18px;cursor:pointer;
    width:28px;height:28px;border-radius:8px;flex-shrink:0;transition:all .15s;}
  .ml-x:hover{background:rgba(240,232,255,.07);color:#F0E8FF;}

  .ml-tools{display:flex;gap:8px;flex-wrap:wrap;padding:12px 16px;flex-shrink:0;
    border-bottom:1px solid rgba(240,232,255,.07);}
  .ml-tools .ml-search{flex:1 1 200px;min-width:150px;}
  .ml-tools .ml-cat{flex:0 1 170px;}
  .ml-field{width:100%;background:rgba(240,232,255,.05);border:1.5px solid rgba(240,232,255,.09);
    border-radius:9px;padding:8px 11px;color:#F0E8FF;font-family:'Space Grotesk',sans-serif;
    font-size:12px;outline:none;transition:border-color .18s;}
  .ml-field:focus{border-color:rgba(155,47,255,.45);}
  .ml-field::placeholder{color:rgba(240,232,255,.2);}
  select.ml-field{cursor:pointer;}
  select.ml-field option{background:#110820;color:#F0E8FF;}

  .ml-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 16px;
    scrollbar-width:thin;scrollbar-color:rgba(155,47,255,.25) transparent;-webkit-overflow-scrolling:touch;}
  .ml-body::-webkit-scrollbar{width:6px;}
  .ml-body::-webkit-scrollbar-thumb{background:rgba(155,47,255,.3);border-radius:3px;}

  .ml-grid{display:grid;gap:9px;grid-template-columns:repeat(auto-fill,minmax(126px,1fr));}

  .ml-item{position:relative;background:rgba(240,232,255,.04);border:1.5px solid rgba(240,232,255,.08);
    border-radius:12px;padding:7px;cursor:pointer;text-align:left;font-family:inherit;color:inherit;
    display:flex;flex-direction:column;gap:6px;transition:border-color .15s,background .15s,transform .12s;}
  .ml-item:hover{border-color:rgba(155,47,255,.4);background:rgba(155,47,255,.08);}
  .ml-item:active{transform:scale(.98);}
  .ml-item.sel{border-color:rgba(0,229,255,.6);background:rgba(0,229,255,.09);
    box-shadow:0 0 0 1px rgba(0,229,255,.25),0 4px 18px rgba(0,229,255,.14);}
  .ml-thumb{position:relative;width:100%;aspect-ratio:1/1;border-radius:8px;overflow:hidden;
    background:
      linear-gradient(45deg,rgba(240,232,255,.05) 25%,transparent 25%,transparent 75%,rgba(240,232,255,.05) 75%),
      linear-gradient(45deg,rgba(240,232,255,.05) 25%,transparent 25%,transparent 75%,rgba(240,232,255,.05) 75%),
      #0C0616;
    background-size:14px 14px;background-position:0 0,7px 7px;}
  .ml-thumb img{width:100%;height:100%;object-fit:contain;display:block;}
  .ml-name{font-size:10.5px;font-weight:600;line-height:1.25;color:#F0E8FF;
    display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}
  .ml-cat-chip{display:inline-flex;align-self:flex-start;padding:2px 7px;border-radius:9px;font-size:8px;
    font-weight:800;letter-spacing:.4px;text-transform:uppercase;
    background:rgba(155,47,255,.14);border:1px solid rgba(155,47,255,.26);color:#C9A6FF;}
  .ml-tick{position:absolute;top:11px;right:11px;width:20px;height:20px;border-radius:50%;
    background:#00E5FF;color:#08040F;font-size:11px;font-weight:900;display:flex;
    align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,229,255,.5);}
  .ml-del{position:absolute;top:11px;left:11px;width:22px;height:22px;border-radius:7px;cursor:pointer;
    background:rgba(8,4,15,.82);border:1px solid rgba(255,45,120,.35);color:#FCA5A5;font-size:11px;
    display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
  .ml-item:hover .ml-del,.ml-item:focus-within .ml-del{opacity:1;}

  .ml-empty{padding:32px 16px;text-align:center;color:rgba(240,232,255,.3);font-size:12px;line-height:1.6;}
  .ml-err{background:rgba(255,45,120,.09);border:1px solid rgba(255,45,120,.28);color:#FCA5A5;
    border-radius:10px;padding:9px 11px;font-size:11px;line-height:1.45;margin-bottom:10px;white-space:pre-line;}

  .ml-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;flex-shrink:0;
    border-top:1px solid rgba(240,232,255,.07);background:rgba(8,4,15,.6);}
  .ml-foot .ml-spacer{flex:1;}
  .ml-btn{padding:9px 14px;border:none;border-radius:10px;font-family:'Syne',sans-serif;
    font-size:11px;font-weight:800;cursor:pointer;transition:all .18s;}
  .ml-btn:active{transform:scale(.97);}
  .ml-btn:disabled{opacity:.3;cursor:not-allowed;}
  .ml-btn-p{background:linear-gradient(135deg,#9B2FFF,#00E5FF);color:#08040F;box-shadow:0 2px 12px rgba(155,47,255,.3);}
  .ml-btn-g{background:rgba(240,232,255,.06);border:1.5px solid rgba(240,232,255,.12);color:rgba(240,232,255,.6);}
  .ml-btn-a{background:rgba(255,214,0,.12);border:1px solid rgba(255,214,0,.28);color:#FFD600;}
  .ml-btn-r{background:rgba(255,45,120,.1);border:1px solid rgba(255,45,120,.24);color:#FCA5A5;}

  /* Uploader */
  .ml-up{border:1.5px dashed rgba(155,47,255,.35);border-radius:12px;padding:12px;margin-bottom:12px;
    background:rgba(155,47,255,.05);}
  .ml-up-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
  .ml-up-row .ml-field{flex:1 1 150px;}
  .ml-up-hint{font-size:9.5px;color:rgba(240,232,255,.3);margin-top:7px;line-height:1.5;}
  .ml-up-list{margin-top:8px;display:flex;flex-direction:column;gap:4px;}
  .ml-up-file{display:flex;align-items:center;gap:7px;font-size:10.5px;color:rgba(240,232,255,.55);}
  .ml-up-file .ml-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
  .ml-spin{width:12px;height:12px;border-radius:50%;flex-shrink:0;
    border:2px solid rgba(240,232,255,.15);border-top-color:#00E5FF;animation:mlSpin .7s linear infinite;}
  .ml-bar{height:4px;border-radius:2px;background:rgba(240,232,255,.07);overflow:hidden;margin-top:9px;}
  .ml-bar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,#9B2FFF,#00E5FF);transition:width .25s ease;}

  /* Campo "Imagen de la novedad" dentro del formulario */
  .mf-prev{position:relative;width:100%;aspect-ratio:12/5;border-radius:12px;overflow:hidden;
    background:linear-gradient(135deg,#0D0010 0%,#130018 100%);border:1.5px solid rgba(255,45,149,.35);}
  .mf-prev-empty{display:flex;align-items:center;justify-content:center;text-align:center;
    font-size:10.5px;color:rgba(240,232,255,.25);padding:12px;line-height:1.5;}
  .mf-row{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px;}
  .mf-seg{display:flex;gap:5px;flex-wrap:wrap;}
  .mf-seg button{flex:1 1 0;min-width:72px;padding:7px 8px;border-radius:9px;cursor:pointer;
    font-family:'Space Grotesk',sans-serif;font-size:10.5px;font-weight:700;transition:all .15s;
    background:rgba(240,232,255,.04);border:1.5px solid rgba(240,232,255,.08);color:rgba(240,232,255,.5);}
  .mf-seg button.sel{border-color:rgba(0,229,255,.5);background:rgba(0,229,255,.1);color:#00E5FF;}
  .mf-slider{display:flex;align-items:center;gap:9px;margin-top:9px;}
  .mf-slider label{font-size:9px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;
    color:rgba(240,232,255,.3);width:74px;flex-shrink:0;}
  .mf-slider input[type=range]{flex:1;min-width:80px;accent-color:#9B2FFF;cursor:pointer;}
  .mf-slider .mf-num{width:54px;flex-shrink:0;text-align:center;background:rgba(240,232,255,.05);
    border:1.5px solid rgba(240,232,255,.09);border-radius:8px;padding:5px 4px;color:#FFD600;
    font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;outline:none;}
  .mf-slider .mf-num:focus{border-color:rgba(155,47,255,.45);}

  @media (max-width:560px){
    .ml-overlay{padding:0;}
    .ml-modal{max-width:none;max-height:100vh;height:100vh;border-radius:0;border:none;}
    .ml-grid{grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:7px;}
    .ml-tools{gap:6px;}
    .ml-tools .ml-cat{flex:1 1 100%;}
    .ml-foot{position:sticky;bottom:0;}
    .mf-slider label{width:62px;}
  }
  @media (max-width:900px) and (min-width:561px){
    .ml-grid{grid-template-columns:repeat(auto-fill,minmax(108px,1fr));}
  }
`;

export default mediaCss;
