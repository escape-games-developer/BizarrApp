// ─── CSS global de BizarrApp ─────────────────────────────────────────────────
// Importar una sola vez en App.jsx

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #0A0500;
    font-family: 'DM Sans', sans-serif;
    color: #F5E6C0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overscroll-behavior: none;
  }

  /* ── Animaciones globales ── */
  @keyframes fadeUp   { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
  @keyframes fadeIn   { from { opacity:0 } to { opacity:1 } }
  @keyframes blink    { 0%,100% { opacity:1 } 50% { opacity:.3 } }
  @keyframes spin     { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  @keyframes pulse    { 0%,100% { transform:scale(1) } 50% { transform:scale(1.04) } }
  @keyframes goldGlow { 0%,100% { filter:drop-shadow(0 0 20px rgba(255,215,0,.4)) }
                        50%      { filter:drop-shadow(0 0 50px rgba(255,215,0,.8)) } }
  @keyframes confetti { 0%   { transform:translateY(0) rotate(0deg); opacity:1 }
                        100% { transform:translateY(140px) rotate(540deg); opacity:0 } }
  @keyframes nameIn   { 0%   { letter-spacing:24px; opacity:0 }
                        100% { letter-spacing:2px; opacity:1 } }
  @keyframes ringPulse{ 0%,100% { transform:scale(1); opacity:.6 }
                        50%     { transform:scale(1.08); opacity:1 } }
  @keyframes timerBar { from { width:100% } to { width:0% } }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-thumb { background: rgba(255,215,0,.15); border-radius: 2px; }
  * { scrollbar-width: thin; scrollbar-color: rgba(255,215,0,.15) transparent; }

  /* ── Typography ── */
  .font-syne { font-family: 'Syne', sans-serif; }

  /* ── App shell ── */
  .app-root {
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0A0500;
  }

  /* ── Phone shell ── */
  .phone-shell {
    width: 100%;
    max-width: 430px;
    height: 100dvh;
    background: #0D0700;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-left: 1px solid rgba(255,215,0,.08);
    border-right: 1px solid rgba(255,215,0,.08);
    position: relative;
  }

  /* ── Header ── */
  .app-header {
    position: relative;
    background: rgba(13,7,0,.98);
    backdrop-filter: blur(16px);
    border-bottom: 1px solid rgba(255,215,0,.1);
    padding: 10px 16px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    z-index: 10;
  }
  .app-header-logo { height: 144px; width: auto; object-fit: contain; filter: drop-shadow(0 0 8px rgba(255,215,0,.3)); }

  /* ── Content area ── */
  .app-content {
    flex: 1;
    overflow-y: auto;
    padding: 4px 16px 16px;
    -webkit-overflow-scrolling: touch;
  }

  /* ── Bottom nav ── */
  .app-nav {
    background: rgba(10,5,0,.98);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(255,215,0,.1);
    display: flex;
    padding: 4px 6px 10px;
    gap: 2px;
    flex-shrink: 0;
    z-index: 10;
  }
  .nav-btn {
    flex: 1;
    min-width: 0;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border: none;
    background: transparent;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  /* ── Section header ── */
  .sec-hdr {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
  }
  .sec-hdr h3 {
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 18px;
    color: #FFD700;
  }

  /* ── Card ── */
  .card {
    background: rgba(255,215,0,.04);
    border: 1px solid rgba(255,215,0,.1);
    border-radius: 13px;
    padding: 14px;
    margin-bottom: 12px;
  }
  .card-title {
    font-family: 'Syne', sans-serif;
    font-size: 9.5px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: rgba(255,215,0,.5);
    margin-bottom: 10px;
  }

  /* ── Buttons ── */
  .btn-primary {
    width: 100%;
    padding: 13px;
    background: linear-gradient(135deg, #FFD700, #F59E0B);
    border: none;
    border-radius: 12px;
    color: #1A0A00;
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;
    transition: all .2s;
    -webkit-tap-highlight-color: transparent;
  }
  .btn-primary:disabled { opacity: .3; cursor: not-allowed; }
  .btn-primary:active:not(:disabled) { transform: scale(.97); }

  /* ── Botones circulares Pantalla (Mensajes / Videoclips) ──
     Sin anillo celeste en ningún estado. El press rojo se maneja
     por estado React (onPointerDown) en PantallaView.jsx. */
  .btn-pantalla {
    outline: none;
    box-shadow: none;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    -webkit-user-select: none;
  }
  .btn-pantalla:focus, .btn-pantalla:focus-visible { outline: none; box-shadow: none; }

  /* ── CTA primario Pantalla/Mensajes: rojo sólido + texto amarillo ── */
  .btn-enviar { transition: all 150ms ease; outline: none; -webkit-tap-highlight-color: transparent; }
  .btn-enviar:focus, .btn-enviar:focus-visible { outline: none; }
  .btn-enviar:hover:not(:disabled)  { background: rgba(220,38,38,.9) !important; }
  .btn-enviar:active:not(:disabled) { background: rgba(185,28,28,1) !important; }

  .btn-ghost {
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    color: rgba(245,230,192,.5);
    font-family: 'Syne', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: all .18s;
    padding: 10px 16px;
  }

  /* ── Inputs ── */
  .input-field {
    width: 100%;
    background: rgba(255,215,0,.05);
    border: 1px solid rgba(255,215,0,.12);
    border-radius: 10px;
    padding: 11px 14px;
    color: #F5E6C0;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    outline: none;
    transition: border-color .2s;
    margin-bottom: 8px;
  }
  .input-field:focus { border-color: rgba(255,215,0,.4); }
  .input-field::placeholder { color: rgba(245,230,192,.2); }

  /* ── Live chip ── */
  .live-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(239,68,68,.14);
    border: 1px solid rgba(239,68,68,.28);
    color: #FCA5A5;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 20px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .live-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #EF4444;
    animation: blink 1.2s infinite;
  }

  /* ── Blocked view ── */
  .blocked-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    min-height: 260px;
  }

  /* ── Step bar ── */
  .step-bar { display: flex; align-items: center; margin-bottom: 22px; }
  .step-circle {
    width: 26px; height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    font-family: 'Syne', sans-serif;
    transition: all .3s;
    flex-shrink: 0;
  }
  .step-line { flex: 1; height: 2px; margin: 0 4px 14px; transition: background .4s; }

  /* ── Fade animation helper ── */
  .fade-up { animation: fadeUp .4s ease both; }
`;

export default globalCss;
