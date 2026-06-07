import { useState, useEffect, useCallback, useRef } from "react";
import { supabase, supabaseAnon } from "../../lib/supabase";


/**
 * useMessages
 *
 * Para la Pantalla Gigante — escucha mensajes aprobados.
 * Para el Admin Panel — escucha mensajes pendientes para moderar.
 * Para el celular — ve el estado de sus propios mensajes.
 */
export function useMessages(sessionId, role = "screen") {
  // role: "screen" | "admin" | "user"
  const [messages,  setMessages]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const channelRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!sessionId) return;
    const client = role === "admin" ? supabase : supabaseAnon;
    let query = client
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (role === "screen") query = query.eq("status", "approved");
    if (role === "admin")  query = query.in("status", ["pending", "approved"]);

    const { data } = await query;
    setMessages(data || []);
    setLoading(false);
  }, [sessionId, role]);

  useEffect(() => {
    fetchMessages();

    if (!sessionId) return;
    const client = role === "admin" ? supabase : supabaseAnon;
    if (channelRef.current) client.removeChannel(channelRef.current);

    const channel = client
      .channel(`messages-${sessionId}-${role}`)
      .on("postgres_changes", {
        event:  "*",
        schema: "public",
        table:  "messages",
        filter: `session_id=eq.${sessionId}`,
      }, fetchMessages)
      .subscribe();

    channelRef.current = channel;
    return () => client.removeChannel(channel);
  }, [sessionId, role, fetchMessages]);

  // Para el Admin Panel: aprobar / rechazar
  const approve = useCallback(async (messageId) => {
    await supabase
      .from("messages")
      .update({ status: "approved" })
      .eq("id", messageId);
  }, []);

  const reject = useCallback(async (messageId) => {
    await supabase
      .from("messages")
      .update({ status: "rejected" })
      .eq("id", messageId);
  }, []);

  // Para el celular: enviar mensaje
  const send = useCallback(async (text, user) => {
    if (!sessionId || !user?.id) return { error: "Sin sesión o usuario" };
    const { error } = await supabase.from("messages").insert({
      session_id:   sessionId,
      user_id:      user.id,
      user_name:    user.name,
      avatar_id:    user.avatarId    || null,
      avatar_emoji: user.avatarEmoji || null,
      photo_url:    user.photoUrl    || null,
      text,
    });
    return { error };
  }, [sessionId]);

  const pending  = messages.filter((m) => m.status === "pending");
  const approved = messages.filter((m) => m.status === "approved");

  return { messages, pending, approved, loading, approve, reject, send };
}
