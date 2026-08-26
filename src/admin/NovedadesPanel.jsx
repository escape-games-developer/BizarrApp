import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import MediaImageField from "../components/media/MediaImageField";
import { IMAGE_DEFAULTS, normalizeImageConfig } from "../components/media/imageLayout";

/**
 * Panel de Novedades del admin.
 *
 * Publica y edita filas de la tabla `banners`, que es lo que consume la
 * sección "Bienvenidos" de la web app. Cada novedad puede llevar una imagen
 * elegida de la biblioteca (media_assets) con su encuadre.
 *
 * Las novedades se publican como globales (session_id null) para que se vean
 * aunque todavía no haya una sesión activa, igual que las lee useBanners.
 */

const EMOJIS = ["🍺","🍹","🎉","🎰","🍔","🎤","💃","🏆","⭐","🔥","🎵","✨","🍕","🥂","🎁","📣"];

const SELECT_WITH_ASSET =
  "*, image_asset:media_assets(id,name,file_url,thumb_url,category)";

const emptyForm = () => ({
  id:      null,
  emoji:   "📣",
  title:   "",
  body:    "",
  tag:     "NOVEDAD",
  visible: true,
  image:   { asset: null, ...IMAGE_DEFAULTS },
});

const formFromBanner = (b) => ({
  id:      b.id,
  emoji:   b.emoji || "📣",
  title:   b.title || "",
  body:    b.body  || "",
  tag:     b.tag   || "NOVEDAD",
  visible: b.visible !== false,
  image:   { asset: b.image_asset || null, ...normalizeImageConfig(b) },
});

export default function NovedadesPanel({ sec }) {
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(emptyForm);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [okMsg,   setOkMsg]   = useState(null);

  const flash = (msg) => { setOkMsg(msg); setTimeout(() => setOkMsg(null), 2500); };

  const fetchList = useCallback(async () => {
    setLoading(true);
    const query = (select) => supabase
      .from("banners")
      .select(select)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    let { data, error: err } = await query(SELECT_WITH_ASSET);
    if (err) {
      console.warn("[NovedadesPanel] join con media_assets no disponible:", err.message);
      ({ data, error: err } = await query("*"));
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

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);

    const payload = {
      emoji:          form.emoji,
      title:          form.title.trim(),
      body:           form.body.trim() || null,
      tag:            form.tag.trim() || "NOVEDAD",
      visible:        form.visible,
      image_asset_id: form.image.asset?.id ?? null,
      image_position: form.image.position,
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
      setError(`No se pudo guardar: ${err.message}`);
      return;
    }
    flash(form.id ? "✓ Novedad actualizada" : "✓ Novedad publicada en la app");
    setForm(emptyForm());
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
    if (form.id === banner.id) setForm(emptyForm());
    flash("✓ Novedad eliminada");
    fetchList();
  };

  return (
    <div style={{ "--sg": sec.grad, "--gw": sec.glow }}>
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

      {/* ── Formulario ─────────────────────────────────────────────────── */}
      <div className="card">
        <div className="ctitle">
          {form.id ? "Editar novedad" : "Publicar en la sección Bienvenidos"}
        </div>

        <div className="epick">
          {EMOJIS.map((em) => (
            <button key={em} className={form.emoji === em ? "sel" : ""}
              onClick={() => set({ emoji: em })}>{em}</button>
          ))}
        </div>

        <input className="inp" placeholder="Título *" value={form.title}
          onChange={(e) => set({ title: e.target.value })}/>
        <textarea className="inp" rows={3} placeholder="Descripción" value={form.body}
          onChange={(e) => set({ body: e.target.value })}/>
        <input className="inp" placeholder="Etiqueta (ej: SORTEO, HAPPY HOUR)" value={form.tag}
          onChange={(e) => set({ tag: e.target.value })}/>

        {/* ── Imagen de la novedad ─────────────────────────────────────── */}
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(240,232,255,.07)" }}>
          <MediaImageField
            value={form.image}
            onChange={(image) => set({ image })}
            preview={{
              emoji: form.emoji,
              title: form.title || "Título de la novedad",
              body:  form.body,
              tag:   form.tag,
            }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "14px 0 10px",
          fontSize: 11.5, color: "rgba(240,232,255,.55)", cursor: "pointer" }}>
          <input type="checkbox" checked={form.visible}
            onChange={(e) => set({ visible: e.target.checked })}
            style={{ accentColor: "#9B2FFF", cursor: "pointer" }}/>
          Visible en la app
        </label>

        <button className="btn btn-p btn-full" disabled={!form.title.trim() || saving} onClick={save}>
          {saving ? "Guardando…" : form.id ? "💾 Guardar cambios" : "📣 Publicar"}
        </button>
        {form.id && (
          <button className="btn btn-g btn-full" style={{ marginTop: 6 }}
            onClick={() => setForm(emptyForm())}>
            Cancelar edición
          </button>
        )}
      </div>

      {/* ── Listado ────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="ctitle">Novedades cargadas {loading ? "" : `(${list.length})`}</div>

        {loading && (
          <div style={{ fontSize: 11, color: "rgba(240,232,255,.3)" }}>Cargando…</div>
        )}

        {!loading && list.length === 0 && (
          <div style={{ fontSize: 11, color: "rgba(240,232,255,.3)", lineHeight: 1.5 }}>
            Todavía no hay novedades cargadas. La app muestra las de prueba hasta que publiques la primera.
          </div>
        )}

        {list.map((b) => (
          <div key={b.id} className="menu-item" style={{ opacity: b.visible ? 1 : .45 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              background: "rgba(240,232,255,.05)", border: "1px solid rgba(240,232,255,.08)",
              overflow: "hidden",
            }}>
              {b.image_asset?.thumb_url || b.image_asset?.file_url ? (
                <img src={b.image_asset.thumb_url || b.image_asset.file_url}
                  alt={b.image_asset.name} loading="lazy" decoding="async"
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}/>
              ) : (b.emoji || "📣")}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="menu-name" style={{ overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap" }}>{b.title}</div>
              <div className="menu-cat">
                {b.tag || "NOVEDAD"}
                {b.image_asset ? ` · 🖼 ${b.image_asset.name}` : b.image_url ? " · pieza 1440x600" : ""}
              </div>
            </div>

            <button onClick={() => toggleVisible(b)} style={{
              padding: "4px 9px", borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: "pointer",
              border: "none",
              background: b.visible ? "rgba(0,245,160,.1)" : "rgba(255,45,120,.08)",
              color:      b.visible ? "#00F5A0" : "#FCA5A5",
            }}>
              {b.visible ? "✓ Visible" : "Oculta"}
            </button>

            <button onClick={() => setForm(formFromBanner(b))} style={{
              padding: "4px 9px", borderRadius: 7, fontSize: 9, fontWeight: 700, cursor: "pointer",
              border: "none", background: "rgba(0,229,255,.1)", color: "#00E5FF",
            }}>
              Editar
            </button>

            <button onClick={() => removeBanner(b)} style={{
              background: "none", border: "none", color: "rgba(255,45,120,.35)",
              cursor: "pointer", fontSize: 14,
            }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
