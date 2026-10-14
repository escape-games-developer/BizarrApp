import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../lib/supabase";
import MediaImageField from "../components/media/MediaImageField";
import { IMAGE_DEFAULTS, normalizeImageConfig } from "../components/media/imageLayout";
import {
  NEWS_TYPES, TYPE_LABEL, TYPE_BADGE, ctaModeFor, newsType, newsDate,
  todayISO, formatDateDMY, isHttpUrl, NEWS_EXCERPT_MAX,
} from "../constants/novedades";

/**
 * Panel de Novedades del admin.
 *
 * Publica y edita filas de la tabla `banners`, que es lo que consume el menú
 * Noti de la web app. Listado en tabla con filtros y totales; el alta y la
 * edición van en un modal con la vista previa de la card del cliente.
 *
 * Las novedades se publican como globales (session_id null) para que se vean
 * aunque todavía no haya una sesión activa, igual que las lee useBanners.
 */

const EMOJIS = ["🍺","🍹","🎉","🎰","🍔","🎤","💃","🏆","⭐","🔥","🎵","✨","🍕","🥂","🎁","📣"];

const SELECT_WITH_ASSET =
  "*, image_asset:media_assets(id,name,file_url,thumb_url,category)";

const MIGRATION_HINT =
  "Falta aplicar la migración 20261013220000_banners_tipo_fecha_cta.sql en Supabase.";

const emptyForm = () => ({
  id:          null,
  emoji:       "📣",
  title:       "",
  body:        "",
  type:        "DESTACADO",
  publishedAt: todayISO(),
  ctaLink:     "",
  visible:     true,
  imageUrl:    null,
  image:       { asset: null, ...IMAGE_DEFAULTS },
});

const formFromBanner = (b) => ({
  id:          b.id,
  emoji:       b.emoji || "📣",
  title:       b.title || "",
  body:        b.body  || "",
  type:        newsType(b),
  publishedAt: newsDate(b) || todayISO(),
  ctaLink:     b.cta_link || "",
  visible:     b.visible !== false,
  imageUrl:    b.image_url || null,
  image:       { asset: b.image_asset || null, ...normalizeImageConfig(b) },
});

const css = `
  .nv-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
  .nv-h{font-family:'DM Sans',sans-serif;font-size:20px;font-weight:800;color:#F0E8FF;margin:0;}
  .nv-sub{font-size:11.5px;color:rgba(240,232,255,.4);margin-top:4px;}
  .nv-filters{display:grid;grid-template-columns:minmax(200px,2fr) repeat(2,minmax(140px,1fr)) repeat(2,minmax(130px,1fr));gap:8px;}
  .nv-filters .inp{margin-bottom:0;}
  .nv-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px;}
  .nv-stat{background:rgba(240,232,255,.04);border:1px solid rgba(240,232,255,.08);border-radius:12px;padding:10px 12px;}
  .nv-stat-v{font-family:'DM Sans',sans-serif;font-size:22px;font-weight:800;color:#F0E8FF;line-height:1;}
  .nv-stat-l{font-size:10px;color:rgba(240,232,255,.4);margin-top:6px;}
  .nv-tbl-wrap{overflow-x:auto;}
  .nv-tbl{width:100%;min-width:860px;border-collapse:collapse;font-size:12px;color:#F0E8FF;}
  .nv-tbl th{font-size:8.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;
    color:rgba(240,232,255,.35);text-align:left;padding:10px;border-bottom:1px solid rgba(240,232,255,.08);}
  .nv-tbl td{padding:9px 10px;border-bottom:1px solid rgba(240,232,255,.05);vertical-align:middle;}
  .nv-tbl tr.off td{opacity:.5;}
  .nv-thumb{width:72px;aspect-ratio:1440/600;border-radius:7px;overflow:hidden;display:flex;align-items:center;
    justify-content:center;font-size:18px;background:rgba(240,232,255,.05);border:1px solid rgba(240,232,255,.08);}
  .nv-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
  .nv-title{font-weight:700;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .nv-desc{font-size:10.5px;color:rgba(240,232,255,.4);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;}
  .nv-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:700;white-space:nowrap;
    background:rgba(240,232,255,.06);border:1px solid rgba(240,232,255,.12);color:rgba(240,232,255,.7);}
  .nv-badge.acc{background:rgba(255,215,0,.1);border-color:rgba(255,215,0,.25);color:#FFD700;}
  .nv-badge.ok{background:rgba(0,245,160,.1);border-color:rgba(0,245,160,.25);color:#00F5A0;}
  .nv-link{color:#00E5FF;text-decoration:none;font-size:11px;display:inline-block;max-width:180px;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .nv-muted{color:rgba(240,232,255,.28);font-size:11px;}
  .nv-acts{display:flex;gap:5px;justify-content:flex-end;}
  .nv-act{padding:4px 9px;border-radius:7px;font-size:9.5px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;}
  .nv-empty{padding:28px 10px;text-align:center;font-size:11.5px;color:rgba(240,232,255,.35);line-height:1.5;}
  .nv-ovl{position:fixed;inset:0;z-index:800;background:rgba(4,2,8,.78);backdrop-filter:blur(6px);
    display:flex;align-items:center;justify-content:center;padding:16px;}
  .nv-modal{width:100%;max-width:920px;max-height:92vh;display:flex;flex-direction:column;
    background:#0E0818;border:1px solid rgba(155,47,255,.22);border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.5);}
  .nv-mhdr{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:16px 18px 12px;
    border-bottom:1px solid rgba(240,232,255,.07);}
  .nv-mbody{overflow-y:auto;padding:14px 18px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;}
  .nv-mftr{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 18px;border-top:1px solid rgba(240,232,255,.07);}
  .nv-lbl{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:rgba(240,232,255,.5);margin:4px 0 5px;}
  .nv-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .nv-x{background:none;border:none;color:rgba(240,232,255,.45);font-size:18px;cursor:pointer;line-height:1;}
  input[type=date].inp{color-scheme:dark;}
  @media (max-width:860px){
    .nv-filters{grid-template-columns:1fr 1fr;}
    .nv-filters > :first-child{grid-column:1/-1;}
    .nv-stats{grid-template-columns:1fr 1fr;}
    .nv-mbody{grid-template-columns:1fr;}
  }
`;

function Thumb({ b }) {
  const src = b.image_url || b.image_asset?.thumb_url || b.image_asset?.file_url;
  return (
    <div className="nv-thumb">
      {src ? <img src={src} alt="" loading="lazy" decoding="async"/> : (b.emoji || "📣")}
    </div>
  );
}

export default function NovedadesPanel({ sec }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [formErr, setFormErr] = useState(null);
  const [okMsg,   setOkMsg]   = useState(null);

  const [q,            setQ]            = useState("");
  const [typeFilter,   setTypeFilter]   = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [fromDate,     setFromDate]     = useState("");
  const [toDate,       setToDate]       = useState("");

  const flash = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 2500); };

  const fetchList = useCallback(async () => {
    setLoading(true);
    // Más nueva primero; si la migración de published_at no está aplicada
    // se cae al orden anterior para no dejar el listado vacío.
    const query = (select, byDate = true) => supabase
      .from("banners")
      .select(select)
      .order(byDate ? "published_at" : "sort_order", { ascending: !byDate })
      .order("created_at", { ascending: false });

    let { data, error: err } = await query(SELECT_WITH_ASSET);
    if (err) {
      console.warn("[NovedadesPanel] select completo no disponible:", err.message);
      ({ data, error: err } = await query("*"));
      if (err) ({ data, error: err } = await query("*", false));
    }
    if (err) {
      console.error("[NovedadesPanel] fetch error:", err);
      setError(err.message);
    } else {
      setError(null);
      setList(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Escape cierra el modal, salvo mientras guarda.
  useEffect(() => {
    if (!form) return;
    const onKey = (e) => { if (e.key === "Escape" && !saving) setForm(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [form, saving]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list.filter((b) => {
      const type = newsType(b);
      const d    = newsDate(b);
      const okSearch = !s
        || (b.title || "").toLowerCase().includes(s)
        || (b.body  || "").toLowerCase().includes(s)
        || TYPE_LABEL[type].toLowerCase().includes(s);
      const okType   = !typeFilter || type === typeFilter;
      const okStatus = !statusFilter
        || (statusFilter === "active" ? b.visible !== false : b.visible === false);
      const okFrom   = !fromDate || d >= fromDate;
      const okTo     = !toDate   || d <= toDate;
      return okSearch && okType && okStatus && okFrom && okTo;
    });
  }, [list, q, typeFilter, statusFilter, fromDate, toDate]);

  const totals = useMemo(() => ({
    total:    filtered.length,
    active:   filtered.filter((b) => b.visible !== false).length,
    inactive: filtered.filter((b) => b.visible === false).length,
    featured: filtered.filter((b) => newsType(b) === "DESTACADO").length,
  }), [filtered]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => { setFormErr(null); setForm(emptyForm()); };
  const openEdit   = (b) => { setFormErr(null); setForm(formFromBanner(b)); };
  const closeModal = () => { if (!saving) setForm(null); };

  const save = async () => {
    if (!form.title.trim())  return setFormErr("Poné un título.");
    if (!form.publishedAt)   return setFormErr("Elegí la fecha de publicación.");
    const ctaLink = form.ctaLink.trim();
    if (ctaLink && !isHttpUrl(ctaLink)) return setFormErr("El link debe ser una URL válida con http/https.");

    setSaving(true);
    setFormErr(null);

    const payload = {
      emoji:          form.emoji,
      title:          form.title.trim(),
      body:           form.body.trim() || null,
      // tag se mantiene en sync con el tipo para lo que todavía lo lea.
      tag:            TYPE_BADGE[form.type],
      type:           form.type,
      published_at:   form.publishedAt,
      cta_mode:       ctaModeFor(form.type),
      cta_link:       ctaLink || null,
      visible:        form.visible,
      image_url:      form.imageUrl || null,
      image_asset_id: form.image.asset?.id ?? null,
      image_position: "background",
      image_scale:    form.image.scale,
      image_x:        form.image.x,
      image_y:        form.image.y,
    };

    const req = form.id
      ? supabase.from("banners").update(payload).eq("id", form.id)
      : supabase.from("banners").insert({ ...payload, session_id: null });

    const { error: err } = await req;
    setSaving(false);

    if (err) {
      console.error("[NovedadesPanel] save error:", err);
      const missingCols = /published_at|cta_|column .*type|schema cache/i.test(err.message || "");
      setFormErr(`No se pudo guardar: ${err.message}${missingCols ? ` — ${MIGRATION_HINT}` : ""}`);
      return;
    }
    flash(form.id ? "✓ Novedad actualizada" : "✓ Novedad publicada en la app");
    setForm(null);
    fetchList();
  };

  const toggleVisible = async (banner) => {
    const { error: err } = await supabase
      .from("banners")
      .update({ visible: !banner.visible })
      .eq("id", banner.id);
    if (err) { setError(`No se pudo actualizar: ${err.message}`); return; }
    fetchList();
  };

  const removeBanner = async (banner) => {
    if (!window.confirm(`¿Eliminar la novedad "${banner.title}"?`)) return;
    const { error: err } = await supabase.from("banners").delete().eq("id", banner.id);
    if (err) { setError(`No se pudo eliminar: ${err.message}`); return; }
    flash("✓ Novedad eliminada");
    fetchList();
  };

  const hasFilters = q || typeFilter || statusFilter || fromDate || toDate;
  const themeVars  = { "--sg": sec.grad, "--gw": sec.glow };

  return (
    <div style={themeVars}>
      <style>{css}</style>

      <div className="nv-top">
        <div>
          <h2 className="nv-h">Novedades</h2>
          <div className="nv-sub">Administrá las novedades publicadas en el menú Noti de la app.</div>
        </div>
        <button className="btn btn-p" onClick={openCreate}>＋ Nueva novedad</button>
      </div>

      {okMsg && (
        <div className="chip chip-ok" style={{ marginBottom: 10, padding: "7px 12px", fontSize: 11 }}>
          {okMsg}
        </div>
      )}
      {error && (
        <div className="card" style={{ borderColor: "rgba(255,45,120,.3)" }}>
          <div style={{ fontSize: 11, color: "#FCA5A5", lineHeight: 1.5 }}>{error}</div>
        </div>
      )}

      {/* ── Filtros ────────────────────────────────────────────────────── */}
      <div className="card nv-filters">
        <input className="inp" placeholder="Buscar por título, descripción o tipo…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Buscar novedades"/>
        <select className="inp" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filtrar por tipo">
          <option value="">Todos los tipos</option>
          {NEWS_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <select className="inp" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado">
          <option value="">Todos los estados</option>
          <option value="active">Solo activas</option>
          <option value="inactive">Solo inactivas</option>
        </select>
        <input className="inp" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
          aria-label="Fecha desde" title="Desde"/>
        <input className="inp" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
          aria-label="Fecha hasta" title="Hasta"/>
      </div>

      {/* ── Totales (sobre lo filtrado) ────────────────────────────────── */}
      <div className="nv-stats">
        {[
          [totals.total,    "Novedades visibles", "#F0E8FF"],
          [totals.active,   "Activas",            "#00F5A0"],
          [totals.inactive, "Inactivas",          "rgba(240,232,255,.6)"],
          [totals.featured, "Destacadas",         "#FFD700"],
        ].map(([v, l, c]) => (
          <div key={l} className="nv-stat">
            <div className="nv-stat-v" style={{ color: c }}>{loading ? "–" : v}</div>
            <div className="nv-stat-l">{l}</div>
          </div>
        ))}
      </div>

      {/* ── Tabla ──────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0 }}>
        <div className="nv-tbl-wrap">
          <table className="nv-tbl">
            <thead>
              <tr>
                <th>Imagen</th><th>Título</th><th>Tipo</th><th>Fecha</th>
                <th>Link</th><th>Estado</th><th style={{ textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.map((b) => {
                const type = newsType(b);
                const on   = b.visible !== false;
                return (
                  <tr key={b.id} className={on ? undefined : "off"}>
                    <td><Thumb b={b}/></td>
                    <td>
                      <div className="nv-title" title={b.title}>{b.title || "—"}</div>
                      <div className="nv-desc" title={b.body || ""}>{b.body || "Sin descripción"}</div>
                    </td>
                    <td>
                      <span className={`nv-badge${type === "DESTACADO" ? " acc" : ""}`}>{TYPE_LABEL[type]}</span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateDMY(newsDate(b))}</td>
                    <td>
                      {b.cta_link
                        ? <a className="nv-link" href={b.cta_link} target="_blank" rel="noreferrer" title={b.cta_link}>🔗 {b.cta_link}</a>
                        : <span className="nv-muted">Sin link</span>}
                    </td>
                    <td>
                      <span className={`nv-badge${on ? " ok" : ""}`}>● {on ? "Activa" : "Inactiva"}</span>
                    </td>
                    <td>
                      <div className="nv-acts">
                        <button className="nv-act" onClick={() => openEdit(b)}
                          style={{ background: "rgba(0,229,255,.1)", color: "#00E5FF" }}>Editar</button>
                        <button className="nv-act" onClick={() => toggleVisible(b)}
                          style={on
                            ? { background: "rgba(255,149,0,.1)", color: "#FF9500" }
                            : { background: "rgba(0,245,160,.1)", color: "#00F5A0" }}>
                          {on ? "Desactivar" : "Activar"}
                        </button>
                        <button className="nv-act" onClick={() => removeBanner(b)}
                          style={{ background: "rgba(255,45,120,.08)", color: "#FCA5A5" }}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && <div className="nv-empty">Cargando novedades…</div>}
        {!loading && filtered.length === 0 && (
          <div className="nv-empty">
            {hasFilters
              ? "No hay novedades con esos filtros. Probá modificando la búsqueda o los filtros."
              : "Todavía no hay novedades cargadas."}
          </div>
        )}
      </div>

      {/* ── Modal alta / edición ───────────────────────────────────────── */}
      {/* Portal al body: las .card del admin animan con transform y eso
          rompería el position:fixed del overlay. */}
      {form && createPortal(
        <div className="nv-ovl" style={themeVars} onMouseDown={closeModal}>
          <div className="nv-modal" role="dialog" aria-modal="true" aria-labelledby="nv-modal-title"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="nv-mhdr">
              <div>
                <h3 id="nv-modal-title" className="nv-h" style={{ fontSize: 17 }}>
                  {form.id ? "Editar novedad" : "Nueva novedad"}
                </h3>
                <div className="nv-sub">
                  {form.id ? "Actualizá la información publicada en la app." : "Completá la información para publicar una novedad."}
                </div>
              </div>
              <button className="nv-x" onClick={closeModal} aria-label="Cerrar">✕</button>
            </div>

            <div className="nv-mbody">
              <div>
                <div className="ctitle">Información</div>

                <div className="nv-lbl"><span>Título *</span></div>
                <input className="inp" placeholder="Título de la novedad" value={form.title}
                  onChange={(e) => set({ title: e.target.value })}/>

                <div className="nv-row2">
                  <div>
                    <div className="nv-lbl"><span>Tipo</span></div>
                    <select className="inp" value={form.type} onChange={(e) => set({ type: e.target.value })}>
                      {NEWS_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="nv-lbl"><span>Fecha</span></div>
                    <input className="inp" type="date" value={form.publishedAt}
                      onChange={(e) => set({ publishedAt: e.target.value })}/>
                  </div>
                </div>

                <div className="nv-lbl">
                  <span>Link del botón</span>
                  <span style={{ fontWeight: 500 }}>
                    {form.type === "PROMO" ? "Botón «Consultar»" : "Botón «Ver detalle»"}
                  </span>
                </div>
                <input className="inp" placeholder="https://… (vacío = sin botón)" value={form.ctaLink}
                  onChange={(e) => set({ ctaLink: e.target.value })}/>

                <div className="nv-lbl">
                  <span>Descripción</span>
                  <span style={{ color: form.body.trim().length > NEWS_EXCERPT_MAX ? "#FF9500" : undefined }}>
                    {form.body.trim().length} / {NEWS_EXCERPT_MAX}
                  </span>
                </div>
                <textarea className="inp" rows={3} placeholder="Escribí el contenido…" value={form.body}
                  onChange={(e) => set({ body: e.target.value })}/>

                <div className="nv-lbl"><span>Emoji (si no hay imagen)</span></div>
                <div className="epick">
                  {EMOJIS.map((em) => (
                    <button key={em} className={form.emoji === em ? "sel" : ""}
                      onClick={() => set({ emoji: em })}>{em}</button>
                  ))}
                </div>

                {form.imageUrl && (
                  <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8,
                    fontSize: 10.5, color: "rgba(240,232,255,.5)" }}>
                    Usa una pieza 1440×600 subida aparte (tiene prioridad sobre la biblioteca).
                    <button className="nv-act" onClick={() => set({ imageUrl: null })}
                      style={{ background: "rgba(255,45,120,.08)", color: "#FCA5A5" }}>Quitar pieza</button>
                  </div>
                )}

                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12,
                  fontSize: 11.5, color: "rgba(240,232,255,.55)", cursor: "pointer" }}>
                  <input type="checkbox" checked={form.visible}
                    onChange={(e) => set({ visible: e.target.checked })}
                    style={{ accentColor: "#9B2FFF", cursor: "pointer" }}/>
                  Activa (visible en la app)
                </label>
              </div>

              <div>
                <MediaImageField
                  value={form.image}
                  onChange={(image) => set({ image })}
                  preview={{
                    emoji:        form.emoji,
                    title:        form.title || "Título de la novedad",
                    body:         form.body,
                    type:         form.type,
                    published_at: form.publishedAt,
                    cta_mode:     ctaModeFor(form.type),
                    cta_link:     form.ctaLink.trim(),
                    image_url:    form.imageUrl,
                  }}
                />
              </div>
            </div>

            <div className="nv-mftr">
              {formErr && (
                <div style={{ flex: 1, fontSize: 11, color: "#FCA5A5", lineHeight: 1.4 }}>{formErr}</div>
              )}
              <button className="btn btn-g" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button className="btn btn-p" onClick={save} disabled={saving || !form.title.trim()}>
                {saving ? "Guardando…" : form.id ? "💾 Guardar cambios" : "📣 Crear novedad"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
