"use client";

import { catOf, amtMXN, money, money2, type Mov } from "@/lib/model";

const vv = (c: string) => `var(${c})`;
const vs = (c: string) => `var(${c}-s)`;

// Una fila de movimiento (igual que el preview).
export default function MovRow({ m, rate }: { m: Mov; rate: number }) {
  const c = catOf(m);
  const isWagered = !m.real && !c.inv && !c.save;
  const sign = m.t === "in" ? "+" : m.t === "out" ? "−" : "⇄";
  const cls = m.t === "fx" || isWagered ? "muted" : m.t === "in" ? "pos" : "neg";
  const amt =
    m.t === "fx"
      ? money((m.usd || 0) * (m.tc || 0))
      : m.gen
        ? money2(m.amt)
        : money(m.amt, m.cur);
  return (
    <div className="mv">
      <div className="dot" style={{ ["--c" as string]: vv(c.c), ["--cs" as string]: vs(c.c) }}>
        {c.ab}
      </div>
      <div className="t">
        <b>{m.concepto || c.l}</b>
        <small>
          <span>{c.l}</span>
          {m.gen === "cuota" && (
            <span className="pill" style={{ ["--c" as string]: "var(--wine)", ["--cs" as string]: "var(--wine-s)" }}>
              pago MSI
            </span>
          )}
          {m.gen === "capital" && (
            <span className="pill" style={{ ["--c" as string]: "var(--navy)", ["--cs" as string]: "var(--navy-s)" }}>
              pago a capital
            </span>
          )}
          {isWagered && (
            <span className="pill" style={{ ["--c" as string]: "var(--mut)", ["--cs" as string]: "var(--bg)" }}>
              solo wagered
            </span>
          )}
          {m.cur === "USD" && (
            <span className="pill" style={{ ["--c" as string]: "var(--navy)", ["--cs" as string]: "var(--navy-s)" }}>
              USD guardado
            </span>
          )}
        </small>
      </div>
      <div className={`a num ${cls}`}>
        {sign}
        {amt}
        {m.cur === "USD" && <small>≈ {money(amtMXN(m, rate))}</small>}
      </div>
    </div>
  );
}
