import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase";

const REDEEM_PIN      = "851";
const COUPON_DURATION = 30 * 60; // 30 minutos en segundos

export function useCoupon(userId) {
  const [coupon,    setCoupon]    = useState(null);
  const [timeLeft,  setTimeLeft]  = useState(0);
  const [pin,       setPin]       = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const timerRef   = useRef(null);
  const channelRef = useRef(null);

  // Arrancar countdown
  const startCountdown = useCallback((expiresAt) => {
    clearInterval(timerRef.current);
    const tick = () => {
      const secs = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setTimeLeft(secs);
      if (secs === 0) {
        clearInterval(timerRef.current);
        // Marcar como expirado en Supabase
        supabase.from("coupons").update({ status: "expired" })
          .eq("id", coupon?.id).then(() => {});
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, [coupon?.id]);

  // Suscribir a cupones del usuario
  useEffect(() => {
    if (!userId) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`coupons-${userId}`)
      .on("postgres_changes", {
        event:  "INSERT",
        schema: "public",
        table:  "coupons",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setCoupon(payload.new);
        setTimeLeft(COUPON_DURATION);
      })
      .on("postgres_changes", {
        event:  "UPDATE",
        schema: "public",
        table:  "coupons",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setCoupon(payload.new);
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      clearInterval(timerRef.current);
    };
  }, [userId]);

  // Arrancar countdown cuando llega el cupón
  useEffect(() => {
    if (coupon?.status === "active" && coupon?.expires_at) {
      startCountdown(coupon.expires_at);
    } else {
      clearInterval(timerRef.current);
    }
  }, [coupon?.id, coupon?.status, coupon?.expires_at, startCountdown]);

  // Canjear
  const redeem = useCallback(async () => {
    if (pin !== REDEEM_PIN || !coupon?.id) return;
    setRedeeming(true);
    await supabase.from("coupons")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
      .eq("id", coupon.id);
    setRedeeming(false);
    setPin("");
  }, [pin, coupon?.id]);

  const pinOk    = pin === REDEEM_PIN;
  const mins     = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const secs     = String(timeLeft % 60).padStart(2, "0");
  const isUrgent = timeLeft <= 300 && timeLeft > 0; // últimos 5 minutos

  return {
    coupon, timeLeft, mins, secs,
    pin, setPin, pinOk,
    redeem, redeeming,
    isUrgent,
    hasCoupon: !!coupon && coupon.status !== "expired",
  };
}