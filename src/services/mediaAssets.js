import { supabase } from "../lib/supabase";

/**
 * Biblioteca de imágenes (media_assets + bucket bizarren-media).
 *
 * Los archivos se suben desde el navegador del admin: no hay imports estáticos
 * ni assets hardcodeados. Una imagen subida queda disponible al instante para
 * cualquier novedad, sin recompilar la app.
 *
 * Seguridad: las policies de Supabase permiten lectura pública y escritura
 * sólo a los usuarios presentes en admin_users. Este módulo usa el cliente
 * `supabase` (con sesión) para que auth.uid() llegue al servidor.
 */

export const MEDIA_BUCKET = "bizarren-media";

export const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp"];
export const ALLOWED_LABEL = "PNG, JPG o WEBP";

/** 10 MB — mismo límite que el configurado en el bucket. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Lado mayor del thumbnail generado en el navegador. */
const THUMB_MAX_SIDE = 320;

const SELECT_COLS =
  "id,name,file_url,storage_path,thumb_url,thumb_path,category,mime_type,width,height,size_bytes,created_at";

// ── Helpers ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Nombre legible por defecto: "corona2.png" → "corona2" */
export function prettyName(fileName = "") {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || fileName;
}

function slugify(value = "") {
  return value
    .normalize("NFD").replace(new RegExp("[\u0300-\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "imagen";
}

function extFor(mime, fileName = "") {
  if (mime === "image/png")  return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  const guess = fileName.split(".").pop();
  return guess && guess.length <= 5 ? guess.toLowerCase() : "png";
}

/**
 * Valida tipo y tamaño antes de tocar la red.
 * @returns {string|null} mensaje de error, o null si el archivo sirve.
 */
export function validateFile(file) {
  if (!file) return "No se seleccionó ningún archivo.";
  if (!ALLOWED_MIME.includes(file.type)) {
    return `"${file.name}": formato no permitido. Sólo ${ALLOWED_LABEL}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `"${file.name}" pesa ${formatBytes(file.size)}. El máximo es ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return null;
}

/** Lee las dimensiones reales sin bloquear si el archivo está roto. */
function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const size = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ width: null, height: null }); };
    img.src = url;
  });
}

/**
 * Genera una miniatura webp en el navegador. Mantiene la transparencia del PNG
 * (webp soporta canal alfa) y evita que la grilla descargue 50 archivos de
 * varios MB. Si algo falla devuelve null y la grilla cae al archivo original.
 */
async function makeThumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale  = Math.min(1, THUMB_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width  * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob || blob.type !== "image/webp") return null;
    return { blob, width: w, height: h };
  } catch (err) {
    console.warn("[mediaAssets] no se pudo generar thumbnail:", err);
    return null;
  }
}

function publicUrl(path) {
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Trae la biblioteca completa, más nueva primero. */
export async function listMediaAssets() {
  const { data, error } = await supabase
    .from("media_assets")
    .select(SELECT_COLS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getMediaAsset(id) {
  if (!id) return null;
  const { data, error } = await supabase
    .from("media_assets")
    .select(SELECT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Categorías presentes, ordenadas alfabéticamente. */
export function categoriesOf(assets = []) {
  return [...new Set(assets.map((a) => a.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
}

/** Filtro en memoria: la biblioteca es chica y así el buscador es instantáneo. */
export function filterAssets(assets = [], { search = "", category = "" } = {}) {
  const q = search.trim().toLowerCase();
  return assets.filter((a) => {
    if (category && a.category !== category) return false;
    if (!q) return true;
    return (a.name || "").toLowerCase().includes(q)
        || (a.category || "").toLowerCase().includes(q);
  });
}

// ── Escritura (sólo admin) ──────────────────────────────────────────────────

/**
 * Sube un archivo al bucket y registra su metadata.
 * @param {File}   file
 * @param {object} opts  { name, category }
 * @returns {Promise<object>} la fila de media_assets recién creada
 */
export async function uploadMediaAsset(file, { name, category } = {}) {
  const invalid = validateFile(file);
  if (invalid) throw new Error(invalid);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sesión expirada. Volvé a iniciar sesión para subir imágenes.");

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const slug  = slugify(name || prettyName(file.name));
  const path  = `assets/${stamp}-${slug}.${extFor(file.type, file.name)}`;

  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: "31536000", upsert: false, contentType: file.type });
  if (upErr) throw new Error(`No se pudo subir la imagen: ${upErr.message}`);

  const size  = await readImageSize(file);
  const thumb = await makeThumbnail(file);

  let thumbPath = null;
  if (thumb) {
    thumbPath = `thumbs/${stamp}-${slug}.webp`;
    const { error: thumbErr } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(thumbPath, thumb.blob, { cacheControl: "31536000", upsert: false, contentType: "image/webp" });
    // El thumbnail es una optimización: si falla, seguimos con el original.
    if (thumbErr) { console.warn("[mediaAssets] thumbnail no subido:", thumbErr.message); thumbPath = null; }
  }

  const row = {
    name:         (name || prettyName(file.name)).slice(0, 120),
    file_url:     publicUrl(path),
    storage_path: path,
    thumb_url:    thumbPath ? publicUrl(thumbPath) : null,
    thumb_path:   thumbPath,
    category:     category?.trim() ? category.trim() : null,
    mime_type:    file.type,
    width:        size.width,
    height:       size.height,
    size_bytes:   file.size,
    created_by:   session.user.id,
  };

  const { data, error } = await supabase
    .from("media_assets")
    .insert(row)
    .select(SELECT_COLS)
    .single();

  if (error) {
    // Rollback del storage para no dejar huérfanos si el insert falla.
    await supabase.storage.from(MEDIA_BUCKET).remove([path, thumbPath].filter(Boolean));
    throw new Error(`No se pudo registrar la imagen: ${error.message}`);
  }
  return data;
}

/** Actualiza metadata (nombre / categoría). */
export async function updateMediaAsset(id, patch) {
  const { data, error } = await supabase
    .from("media_assets")
    .update(patch)
    .eq("id", id)
    .select(SELECT_COLS)
    .single();
  if (error) throw new Error(`No se pudo actualizar la imagen: ${error.message}`);
  return data;
}

/**
 * Borra el registro y sus archivos. Las novedades que la usaban quedan con
 * image_asset_id en NULL (ON DELETE SET NULL) y vuelven a mostrar el emoji.
 */
export async function deleteMediaAsset(asset) {
  if (!asset?.id) return;
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
  if (error) throw new Error(`No se pudo eliminar la imagen: ${error.message}`);

  const paths = [asset.storage_path, asset.thumb_path].filter(Boolean);
  if (paths.length) {
    const { error: rmErr } = await supabase.storage.from(MEDIA_BUCKET).remove(paths);
    if (rmErr) console.warn("[mediaAssets] archivos no eliminados del bucket:", rmErr.message);
  }
}
