import { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabase";

export function useVideoRequests(sessionId, currentUserId = null) {
  const [requests, setRequests] = useState([]);
  const [myVotes, setMyVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trae todos los video_requests activos + ordena por votos
  const fetchRequests = useCallback(async () => {
    if (!sessionId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("video_requests")
      .select("*")
      .eq("session_id", sessionId)
      .in("status", ["pending", "launched"])
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[useVideoRequests] fetch error:", error);
      setRequests([]);
    } else {
      setRequests((data || []).map(r => ({
        ...r,
        name: r.user_name || "Anónimo",
        avatar: r.avatar_emoji || "👤",
        photo: r.photo_url || null,
      })));
    }
    setLoading(false);
  }, [sessionId]);

  // Trae los votos del usuario actual
  const fetchMyVotes = useCallback(async () => {
    if (!currentUserId) {
      setMyVotes([]);
      return;
    }
    const { data, error } = await supabase
      .from("video_votes")
      .select("video_request_id")
      .eq("user_id", currentUserId);
    if (!error && data) {
      setMyVotes(data.map(v => v.video_request_id));
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchRequests();
    fetchMyVotes();
  }, [fetchRequests, fetchMyVotes]);

  // Suscripción realtime a video_requests
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`video_requests_${sessionId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "video_requests",
        filter: `session_id=eq.${sessionId}`
      }, fetchRequests)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchRequests]);

  // Suscripción realtime a video_votes (para actualizar vote_count en vivo)
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`video_votes_${sessionId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "video_votes"
      }, () => { fetchRequests(); fetchMyVotes(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchRequests, fetchMyVotes]);

  // ─── ACCIONES DEL ADMIN ───

  const approve = useCallback(async (id) => {
    if (!sessionId) return;

    // Update optimista en local
    setRequests(prev => prev.map(r => {
      if (r.id === id) return {...r, status: "launched"};
      if (r.status === "launched") return {...r, status: "dismissed"};
      return r;
    }));

    // 1. Archivar los launched previos en DB
    await supabase
      .from("video_requests")
      .update({ status: "dismissed" })
      .eq("session_id", sessionId)
      .eq("status", "launched")
      .neq("id", id);

    // 2. Lanzar el nuevo
    const { error } = await supabase
      .from("video_requests")
      .update({ status: "launched" })
      .eq("id", id);

    if (error) {
      console.error("[useVideoRequests] approve error:", error);
      fetchRequests();
    }
  }, [sessionId, fetchRequests]);

  const reject = useCallback(async (id) => {
    setRequests(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase
      .from("video_requests")
      .update({ status: "dismissed" })
      .eq("id", id);
    if (error) {
      console.error("[useVideoRequests] reject error:", error);
      fetchRequests();
    }
  }, [fetchRequests]);

  // Helper: verifica si hay algún video launched activo
  const hasLiveVideo = useCallback(() => {
    return requests.some(r => r.status === "launched");
  }, [requests]);

  // ─── ACCIONES DEL CLIENTE ───

  // Pide un video de YouTube
  const send = useCallback(async ({ ytId, title, artist, user }) => {
    if (!sessionId || !user) return;
    const { data, error } = await supabase.from("video_requests").insert({
      session_id: sessionId,
      user_id: user.id,
      user_name: user.name,
      avatar_id: user.avatarId || null,
      avatar_emoji: user.avatarEmoji || null,
      photo_url: user.photoUrl || null,
      yt_id: ytId,
      title,
      artist: artist || null,
      source: "youtube",
      status: "pending",
      requested_by_admin: false,
    }).select().single();

    if (error) {
      console.error("[useVideoRequests] send error:", error);
      return null;
    }

    // Auto-lanzar si no hay nada reproduciéndose
    if (!hasLiveVideo() && data?.id) {
      console.log("[send] cola vacía, auto-lanzando:", data.id);
      setTimeout(() => approve(data.id), 100);
    }

    return data;
  }, [sessionId, hasLiveVideo, approve]);

  // Agrega un tema desde el admin (búsqueda YouTube o playlist), con
  // identidad "Bizarren" (la casa)
  const addByAdmin = useCallback(async ({ ytId, title, artist, thumb }, adminUser) => {
    if (!sessionId) {
      console.error("[addByAdmin] ABORT: no sessionId");
      return null;
    }
    if (!adminUser?.id) {
      console.error("[addByAdmin] ABORT: no adminUser");
      return null;
    }

    const payload = {
      session_id: sessionId,
      user_id: adminUser.id,           // ID real del admin (para FK)
      user_name: "Bizarren",            // Identidad pública
      avatar_emoji: "🎵",
      photo_url: null,
      avatar_id: null,
      yt_id: ytId,
      title: title || "Sin título",
      artist: artist || null,
      source: "youtube",
      status: "pending",
      requested_by_admin: true,
    };

    console.log("[addByAdmin] inserting:", payload);

    const { data, error } = await supabase
      .from("video_requests")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("[addByAdmin] insert error:", error);
      return null;
    }

    console.log("[addByAdmin] SUCCESS:", data);

    // Auto-lanzar si no hay nada reproduciendose
    if (!hasLiveVideo() && data?.id) {
      console.log("[addByAdmin] cola vacía, auto-lanzando:", data.id);
      setTimeout(() => approve(data.id), 100);
    }

    return data;
  }, [sessionId, hasLiveVideo, approve]);

  // Votar por un video
  const vote = useCallback(async (videoRequestId) => {
    if (!currentUserId) return;
    // Update optimista
    setMyVotes(prev => [...prev, videoRequestId]);
    setRequests(prev => prev.map(r =>
      r.id === videoRequestId ? {...r, vote_count: (r.vote_count||0) + 1} : r
    ));
    const { error } = await supabase.from("video_votes").insert({
      video_request_id: videoRequestId,
      user_id: currentUserId,
    });
    if (error) {
      console.error("[useVideoRequests] vote error:", error);
      // Rollback
      setMyVotes(prev => prev.filter(id => id !== videoRequestId));
      setRequests(prev => prev.map(r =>
        r.id === videoRequestId ? {...r, vote_count: Math.max((r.vote_count||1) - 1, 0)} : r
      ));
    }
  }, [currentUserId]);

  // Quitar voto
  const unvote = useCallback(async (videoRequestId) => {
    if (!currentUserId) return;
    setMyVotes(prev => prev.filter(id => id !== videoRequestId));
    setRequests(prev => prev.map(r =>
      r.id === videoRequestId ? {...r, vote_count: Math.max((r.vote_count||1) - 1, 0)} : r
    ));
    const { error } = await supabase
      .from("video_votes")
      .delete()
      .eq("video_request_id", videoRequestId)
      .eq("user_id", currentUserId);
    if (error) {
      console.error("[useVideoRequests] unvote error:", error);
      fetchMyVotes();
      fetchRequests();
    }
  }, [currentUserId, fetchMyVotes, fetchRequests]);

  // Sube un MP4 al bucket y crea el video_request con source='local'
  const uploadLocal = useCallback(async (file, { title, user }) => {
    console.log("[uploadLocal] START", {
      sessionId,
      hasUser: !!user,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!sessionId) {
      console.error("[uploadLocal] ABORT: no sessionId");
      return null;
    }
    if (!user) {
      console.error("[uploadLocal] ABORT: no user");
      return null;
    }
    if (!file) {
      console.error("[uploadLocal] ABORT: no file");
      return null;
    }

    // Verificar sesión auth actual
    const { data: { session: authSession } } = await supabase.auth.getSession();
    console.log("[uploadLocal] auth session:", {
      hasSession: !!authSession,
      userId: authSession?.user?.id,
      role: authSession?.user?.role,
      expiresAt: authSession?.expires_at
    });

    if (!authSession) {
      console.error("[uploadLocal] ABORT: no auth session, user not logged in");
      return null;
    }

    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const path = `${sessionId}/${ts}_${safeName}`;

    console.log("[uploadLocal] uploading to path:", path);

    // Subir al bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("videos-locales")
      .upload(path, file, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      console.error("[uploadLocal] STORAGE UPLOAD ERROR:", {
        message: uploadError.message,
        name: uploadError.name,
        stack: uploadError.stack,
        raw: uploadError
      });
      return null;
    }

    console.log("[uploadLocal] upload OK:", uploadData);

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from("videos-locales")
      .getPublicUrl(path);

    console.log("[uploadLocal] publicUrl:", publicUrl);

    // Insertar registro en video_requests
    const insertPayload = {
      session_id: sessionId,
      user_id: user.id,
      user_name: user.name || user.email || "Admin",
      avatar_emoji: user.avatarEmoji || "📁",
      photo_url: user.photoUrl || null,
      yt_id: `local_${ts}`,
      title: title || file.name,
      artist: "Archivo local",
      source: "local",
      video_url: publicUrl,
      status: "pending",
      requested_by_admin: true,
    };

    console.log("[uploadLocal] inserting video_request:", insertPayload);

    const { data, error } = await supabase
      .from("video_requests")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error("[uploadLocal] INSERT ERROR:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        raw: error
      });
      return null;
    }

    console.log("[uploadLocal] SUCCESS, video_request created:", data);

    // Auto-lanzar si no hay nada reproduciendose
    if (!hasLiveVideo() && data?.id) {
      console.log("[uploadLocal] cola vacía, auto-lanzando:", data.id);
      setTimeout(() => approve(data.id), 100);
    }

    return data;
  }, [sessionId, hasLiveVideo, approve]);

  // Lista archivos en el bucket
  const listLocalFiles = useCallback(async () => {
    if (!sessionId) return [];
    const { data, error } = await supabase.storage
      .from("videos-locales")
      .list(sessionId, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
    if (error) {
      console.error("[useVideoRequests] list local error:", error);
      return [];
    }
    return (data || []).map(f => {
      const { data: { publicUrl } } = supabase.storage
        .from("videos-locales")
        .getPublicUrl(`${sessionId}/${f.name}`);
      return {
        name: f.name,
        size: f.metadata?.size || 0,
        url: publicUrl,
        path: `${sessionId}/${f.name}`,
      };
    });
  }, [sessionId]);

  const pending = requests.filter(r => r.status === "pending");
  const launched = requests.filter(r => r.status === "launched");

  return {
    requests, pending, launched, myVotes, loading,
    approve, reject, send, vote, unvote, uploadLocal, listLocalFiles,
    addByAdmin,
  };
}
