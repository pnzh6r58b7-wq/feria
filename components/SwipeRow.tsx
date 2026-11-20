"use client";

import { useRef } from "react";

const TRASH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
  </svg>
);

// Deslizar a la izquierda para borrar (estilo Gmail). Tocar = editar.
export default function SwipeRow({
  children,
  onTap,
  onDelete,
}: {
  children: React.ReactNode;
  onTap: () => void;
  onDelete: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const st = useRef({ x0: 0, y0: 0, dx: 0, lock: null as null | "x" | "y", down: false });

  function reset() {
    const r = row.current!, b = bg.current!;
    r.style.transition = "transform .25s";
    b.style.transition = "width .25s,opacity .25s";
    r.style.transform = "";
    b.style.width = "0";
    b.style.opacity = "";
    b.classList.remove("arm");
  }

  function onDown(e: React.PointerEvent) {
    if (e.button > 0) return;
    const s = st.current;
    s.down = true; s.x0 = e.clientX; s.y0 = e.clientY; s.dx = 0; s.lock = null;
    row.current!.style.transition = "none";
    bg.current!.style.transition = "none";
  }
  function onMove(e: React.PointerEvent) {
    const s = st.current;
    if (!s.down) return;
    const X = e.clientX - s.x0, Y = e.clientY - s.y0;
    if (!s.lock && (Math.abs(X) > 8 || Math.abs(Y) > 8)) {
      s.lock = Math.abs(X) > Math.abs(Y) ? "x" : "y";
      if (s.lock === "x") { try { wrap.current!.setPointerCapture(e.pointerId); } catch {} }
    }
    if (s.lock === "x") {
      s.dx = Math.min(0, X);
      const w = wrap.current!.offsetWidth, p = Math.min(1, -s.dx / (w * 0.4));
      row.current!.style.transform = `translateX(${s.dx}px)`;
      bg.current!.style.width = -s.dx + "px";
      bg.current!.style.opacity = String(0.35 + 0.65 * p);
      bg.current!.classList.toggle("arm", p >= 1);
    }
  }
  function onUp() {
    const s = st.current;
    if (!s.down) return;
    s.down = false;
    const w = wrap.current!.offsetWidth;
    if (s.lock === null) { onTap(); return; }
    if (s.lock === "x" && -s.dx > w * 0.4) {
      const r = row.current!, b = bg.current!, wr = wrap.current!;
      r.style.transition = "transform .18s"; b.style.transition = "width .18s";
      r.style.transform = `translateX(${-w}px)`; b.style.width = w + "px"; b.style.opacity = "1";
      setTimeout(() => {
        wr.style.height = wr.offsetHeight + "px";
        wr.style.transition = "height .2s,margin .2s";
        requestAnimationFrame(() => { wr.style.height = "0"; wr.style.marginBottom = "0"; });
        setTimeout(onDelete, 210);
      }, 170);
      return;
    }
    reset();
  }

  return (
    <div
      className="swipe"
      ref={wrap}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={() => { st.current.down = false; reset(); }}
    >
      <div className="del" ref={bg}>{TRASH}</div>
      <div ref={row} style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}
