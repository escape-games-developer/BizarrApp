import { useState } from "react";

export function CouponScreen({ coupon, mins, secs, pin, setPin, pinOk, redeem, redeeming, isUrgent }) {

  if (coupon.status === "redeemed") return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#08040F", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 900,
        color: "#00F5A0", textAlign: "center", marginBottom: 8,
      }}>
        ¡Cupón canjeado!
      </div>
      <div style={{ fontSize: 14, color: "rgba(245,230,192,.5)", textAlign: "center" }}>
        Disfrutalo 🍹
      </div>
    </div>
  );

  if (coupon.status === "expired") return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#08040F", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>❌</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 900,
        color: "#FF2D78", textAlign: "center", marginBottom: 8,
      }}>
        Cupón vencido
      </div>
      <div style={{ fontSize: 13, color: "rgba(245,230,192,.4)", textAlign: "center" }}>
        Hablá con el staff
      </div>
    </div>
  );

  // Estado active
  const gameLabel = coupon.game_type === "rey_del_orto" ? "Rey del Orto 🎰" : "Desafío Demente 🧠";
  const circumference = 2 * Math.PI * 54;
  const TOTAL = 30 * 60;
  const timeLeft = parseInt(mins) * 60 + parseInt(secs);
  const progress = timeLeft / TOTAL;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "#08040F", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      gap: 20,
    }}>
      {/* Tag del juego */}
      <div style={{
        padding: "4px 14px", borderRadius: 20,
        background: "rgba(255,213,0,.1)", border: "1px solid rgba(255,213,0,.25)",
        fontSize: 11, fontWeight: 700, color: "#FFD600", letterSpacing: "1px",
      }}>
        {gameLabel}
      </div>

      {/* Premio */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.4)", marginBottom: 6 }}>TU PREMIO</div>
        <div style={{
          fontFamily: "Syne, sans-serif", fontSize: 22, fontWeight: 900,
          color: "#F0E8FF", lineHeight: 1.3, textAlign: "center",
        }}>
          {coupon.prize_text}
        </div>
      </div>

      {/* Countdown circular */}
      <div style={{ position: "relative", width: 128, height: 128 }}>
        <svg width="128" height="128" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="64" cy="64" r="54" fill="none"
            stroke="rgba(255,255,255,.08)" strokeWidth="8"/>
          <circle cx="64" cy="64" r="54" fill="none"
            stroke={isUrgent ? "#FF2D78" : "#00E5FF"} strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear, stroke .5s" }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            fontFamily: "Syne, sans-serif", fontSize: 26, fontWeight: 900,
            color: isUrgent ? "#FF2D78" : "#00E5FF", lineHeight: 1,
          }}>
            {mins}:{secs}
          </div>
          <div style={{ fontSize: 10, color: "rgba(245,230,192,.3)", marginTop: 2 }}>
            restantes
          </div>
        </div>
      </div>

      {/* PIN */}
      <div style={{ width: "100%", maxWidth: 280 }}>
        <div style={{ fontSize: 11, color: "rgba(245,230,192,.4)", marginBottom: 6, textAlign: "center" }}>
          PIN DEL STAFF
        </div>
        <input
          type="password"
          inputMode="numeric"
          maxLength={3}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder="···"
          style={{
            width: "100%", padding: "12px 0", textAlign: "center",
            background: "rgba(255,255,255,.06)", border: `1px solid ${pinOk ? "#00F5A0" : "rgba(255,255,255,.12)"}`,
            borderRadius: 12, color: "#F0E8FF", fontSize: 24,
            fontFamily: "Syne, sans-serif", fontWeight: 900,
            outline: "none", letterSpacing: "8px", boxSizing: "border-box",
            transition: "border-color .2s",
          }}
        />
      </div>

      {/* Botón canjear */}
      <button
        onClick={redeem}
        disabled={!pinOk || redeeming}
        style={{
          width: "100%", maxWidth: 280, padding: "16px 0",
          borderRadius: 14, border: "none", cursor: pinOk ? "pointer" : "not-allowed",
          background: pinOk
            ? "linear-gradient(135deg, #00F5A0, #00E5FF)"
            : "rgba(255,255,255,.06)",
          color: pinOk ? "#08040F" : "rgba(245,230,192,.2)",
          fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 900,
          transition: "all .3s",
          transform: pinOk ? "scale(1.02)" : "scale(1)",
        }}
      >
        {redeeming ? "Canjeando..." : "CANJEAR"}
      </button>

      <div style={{ fontSize: 10, color: "rgba(245,230,192,.2)", textAlign: "center" }}>
        Mostrá esta pantalla al personal del bar
      </div>
    </div>
  );
}