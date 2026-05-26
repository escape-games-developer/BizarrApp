import React from "react";
import { ytThumb } from "../constants/theme";

// ─── BlockedView ──────────────────────────────────────────────────────────────
export function BlockedView({ icon, label, reason, onCTA, ctaLabel }) {
  return (
    <div className="blocked-view">
      <div style={{ fontSize: 44, marginBottom: 14, opacity: .22 }}>{icon}</div>
      <div style={{
        fontFamily: "Syne, sans-serif", fontSize: 16, fontWeight: 800,
        color: "rgba(255,215,0,.28)", marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, color: "rgba(245,230,192,.28)",
        lineHeight: 1.6, maxWidth: 220, marginBottom: 22, textAlign: "center",
      }}>
        {reason || "Para participar completá el registro y verificá que estás en el bar."}
      </div>
      {onCTA && (
        <button
          onClick={onCTA}
          style={{
            padding: "10px 22px",
            background: "linear-gradient(135deg, #FFD700, #F59E0B)",
            border: "none", borderRadius: 20, color: "#1A0A00",
            fontFamily: "Syne, sans-serif", fontWeight: 800,
            fontSize: 13, cursor: "pointer",
          }}
        >
          {ctaLabel || "Completar registro"}
        </button>
      )}
    </div>
  );
}

// ─── StepBar ─────────────────────────────────────────────────────────────────
export function StepBar({ steps, current }) {
  return (
    <div className="step-bar">
      {steps.map((label, i) => {
        const n      = i + 1;
        const done   = current > n;
        const active = current === n;
        return (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div
                className="step-circle"
                style={{
                  background: done ? "#22C55E" : active ? "#FFD700" : "rgba(255,255,255,.07)",
                  color:      done || active ? "#0A0500" : "rgba(245,230,192,.2)",
                  border:     done || active ? "none" : "1px solid rgba(255,255,255,.1)",
                }}
              >
                {done ? "✓" : n}
              </div>
              <span style={{
                fontSize: 8, fontWeight: 600, whiteSpace: "nowrap",
                color: active ? "#FFD700" : done ? "#22C55E" : "rgba(245,230,192,.18)",
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="step-line"
                style={{ background: done ? "#22C55E" : "rgba(255,255,255,.07)" }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── VideoRow ────────────────────────────────────────────────────────────────
export function VideoRow({ video, selected, onSelect, color = "#FFD700" }) {
  return (
    <div
      onClick={() => onSelect(video)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", marginBottom: 7,
        borderRadius: 11, cursor: "pointer", transition: "all .18s",
        background: selected ? `rgba(${hexToRgb(color)},.1)` : "rgba(255,255,255,.03)",
        border:     `1px solid ${selected ? color : "rgba(255,255,255,.07)"}`,
      }}
    >
      <img
        src={ytThumb(video.ytId)}
        alt={video.title}
        style={{ width: 56, height: 31, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#F5E6C0" }}>{video.title}</div>
        <div style={{ fontSize: 10, color: "rgba(245,230,192,.38)" }}>{video.artist}</div>
      </div>
      {selected && <span style={{ fontSize: 14, color, flexShrink: 0 }}>✓</span>}
    </div>
  );
}

// ─── LiveChip ────────────────────────────────────────────────────────────────
export function LiveChip() {
  return (
    <div className="live-chip">
      <div className="live-dot" />
      EN VIVO
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────
export function Confetti({ color }) {
  return (
    <>
      {Array.from({ length: 22 }, (_, i) => (
        <div
          key={i}
          style={{
            position:   "absolute",
            borderRadius: 2,
            background: color,
            left:  `${Math.random() * 100}%`,
            top:   `${Math.random() * 20 - 5}%`,
            width:  4 + (i % 5),
            height: 4 + (i % 5),
            pointerEvents: "none",
            zIndex: 50,
            animation: `confetti ${(1.2 + Math.random() * .8).toFixed(1)}s ease-out ${(i * .05).toFixed(2)}s forwards`,
          }}
        />
      ))}
    </>
  );
}

// ─── Util ────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
