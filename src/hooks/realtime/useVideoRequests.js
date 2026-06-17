import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";

export function useVideoRequests(sessionId) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const channelRef = useRef(null);

  const fetchRequests = useCallback(async () => {
    console.log('[useVideoRequests] fetchRequests sessionId:', sessionId);
    if (!sessionId) return;
    const { data } = await supabase
      .from("video_requests")
      .select("*")
      .eq("session_id", sessionId)
      .in("status", ["pending", "launched"])
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    console.log('[useVideoRequests] useEffect sessionId:', sessionId);
    fetchRequests();
    if (!sessionId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`video-requests-${sessionId}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "video_requests",
        filter: `session_id=eq.${sessionId}`,
      }, fetchRequests)
      .subscribe();
    channelRef.current = channel;
    return () => supabase.removeChannel(channel);
  }, [sessionId, fetchRequests]);

  const approve = useCallback(async (id) => {
    await supabase.from("video_requests").update({ status: "launched" }).eq("id", id);
  }, []);

  const reject = useCallback(async (id) => {
    await supabase.from("video_requests").update({ status: "dismissed" }).eq("id", id);
  }, []);

  const send = useCallback(async ({ ytId, title, artist, user }) => {
    if (!sessionId || !user?.id) return { error: "Sin sesión" };
    const { error } = await supabase.from("video_requests").insert({
      session_id: sessionId,
      user_id:    user.id,
      user_name:  user.name,
      avatar_id:  user.avatarId || null,
      yt_id:      ytId,
      title,
      artist,
      status:     "pending",
    });
    return { error };
  }, [sessionId]);

  const pending = requests.filter(r => r.status === "pending");

  return { requests, pending, loading, approve, reject, send };
}
