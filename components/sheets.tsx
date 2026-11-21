"use client";

import { useEffect, useState } from "react";
import {
  CATS, money, money2, r2, todayStr, fmtD, fmtDay, addDays,
  type Mov, type Plan, type Pago, type Rules,
} from "@/lib/model";
import { planInfo, schedule, totals } from "@/lib/calc";

type Fx = { rate: number; live: boolean };
const vv = (c: string) => `var(${c})`;
const vs = (c: string) => `var(${c}-s)`;

function Ring({ frac, color }: { frac: number; color: string }) {
  const C = 2 * Math.PI * 18;
  return (
    <svg className="ringsvg" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle cx="22" cy="22" r="18" fill="none" stroke={`var(${color})`} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="11" fontWeight="800" fill={`var(${color})`} fontFamily="Manrope">{Math.round(frac * 100)}%</text>
    </svg>
  );
}
void Ring;

/* ===== detalle de un plan MSI ===== */
export function PlanSheet({ p, rules, today, onClose, onPay, onCapital, onEdit, onDelete, onDelPago }: {
  p: Plan; rules: Rules; today: string; onClose: () => void;
  onPay: (falta: number) => void; onCapital: () => void; onEdit: () => void; onDelete: () => void; onDelPago: (pj: number) => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const i = planInfo(p, rules, today), s = schedule(p, rules, today), c = CATS.out[p.cat];
  return (
    <div className={`sheet${on ? " on" : ""}`}><div className="sin">
      <div className="grab" />
      <div className="shh"><b>{p.concepto}</b><button className="ib" onClick={onClose}>✕</button></div>
      <div className="row" style={{ marginBottom: 10 }}><span className="pill" style={{ ["--c" as string]: vv(c.c), ["--cs" as string]: vs(c.c) }}>{c.l}</span><span className="muted" style={{ fontSize: 13 }}>Compra {fmtDay(p.fecha)}</span></div>
      <div className="kv" style={{ marginBottom: 12 }}><div><span>Total</span><b className="num">{money2(p.total)}</b></div><div><span>Meses</span><b className="num">{p.meses}</b></div><div><span>Falta</span><b className="num" style={{ color: "var(--wine)" }}>{money2(i.rem)}</b></div></div>
      <table><tbody>
        <tr><th>#</th><th>Corte</th><th>Monto</th><th>Estado</th></tr>
        {s.map((x) => (
          <tr key={x.k}><td>{x.k + 1}</td><td>{fmtD(x.date)}</td><td className="num" style={{ fontSize: 15 }}>{money2(x.amt)}</td>
            <td>{x.done ? <span className="pill" style={{ ["--c" as string]: "var(--teal)", ["--cs" as string]: "var(--teal-s)" }}>pagada</span> : x.vencida ? <span className="pill" style={{ ["--c" as string]: "var(--del)", ["--cs" as string]: "var(--wine-s)" }}>vencida</span> : <small className="muted">pagas antes del {fmtD(x.pago)}</small>}</td></tr>
        ))}
      </tbody></table>
      {(p.pagos || []).length > 0 && (
        <>
          <div className="lbl" style={{ margin: "14px 0 4px" }}>Tus pagos</div>
          <table><tbody>{p.pagos.map((x, j) => (
            <tr key={j}><td>{fmtD(x.fecha)}</td><td>{x.tipo === "capital" ? "a capital" : "mensualidad"}</td><td className="num" style={{ fontSize: 15 }}>{money2(x.monto)}</td><td><button className="ib" style={{ width: 28, height: 28 }} aria-label="Borrar pago" onClick={() => { onDelPago(j); onClose(); }}>✕</button></td></tr>
          ))}</tbody></table>
        </>
      )}
      {i.active && <button className="btn" style={{ marginTop: 16 }} onClick={() => onPay(i.next ? i.next.falta : 0)}>Pagar mensualidad · {money2(i.next ? i.next.falta : 0)}</button>}
      <div className="row" style={{ gap: 8, marginTop: 8 }}><button className="btn ghost" onClick={onEdit}>Editar</button>{i.active && <button className="btn ghost" onClick={onCapital}>Pago a capital</button>}</div>
      <button className="btn ghost" style={{ color: "var(--del)", marginTop: 8, fontSize: 14 }} onClick={onDelete}>Borrar plan</button>
    </div></div>
  );
}

/* ===== editar plan ===== */
export function PlanEditSheet({ p, onClose, onSave }: { p: Plan; onClose: () => void; onSave: (patch: Partial<Plan>) => void; }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const [total, setTotal] = useState(String(p.total));
  const [cat, setCat] = useState(p.cat);
  const [meses, setMeses] = useState(p.meses);
  const [manual, setManual] = useState(p.meses !== 3);
  const [concepto, setConcepto] = useState(p.concepto);
  const [fecha, setFecha] = useState(p.fecha);
  const [real, setReal] = useState(p.real);
  const C = Object.entries(CATS.out).filter(([, x]) => x.msi);
  const c = CATS.out[cat];
  function save() {
    const tot = parseFloat(total);
    if (!tot || tot <= 0 || !meses || meses < 1) return;
    onSave({ concepto: concepto.trim() || CATS.out[cat].l, cat, total: r2(tot), meses, fecha, real });
  }
  return (
    <div className={`sheet${on ? " on" : ""}`}><div className="sin">
      <div className="grab" />
      <div className="shh"><b>Editar plan MSI</b><button className="ib" onClick={onClose}>✕</button></div>
      <div className="amt"><span className="num" style={{ fontSize: 34, color: "var(--mut)" }}>$</span><input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
      <div className="amtl">Total del plan</div>
      <div className="lbl">Categoría</div>
      <div className="cats">{C.map(([k, x]) => (
        <button key={k} className={`cat${cat === k ? " on" : ""}`} style={{ ["--c" as string]: vv(x.c), ["--cs" as string]: vs(x.c) }} onClick={() => { setCat(k); setReal(x.real); }}><i />{x.l}</button>
      ))}</div>
      <div className="lbl" style={{ marginBottom: 6 }}>Meses</div>
      <div className="cats" style={{ marginTop: 0, alignItems: "center" }}>
        <button className={`chip${!manual ? " on" : ""}`} onClick={() => { setManual(false); setMeses(3); }}>3 meses</button>
        <button className={`chip${manual ? " on" : ""}`} onClick={() => setManual(true)}>Manual</button>
        {manual && <input type="number" min={1} max={48} value={meses} onChange={(e) => setMeses(parseInt(e.target.value) || 0)} style={{ width: 80, padding: 8, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", fontSize: 16 }} />}
      </div>
      <label className="field"><span>Concepto</span><input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></label>
      <label className="field"><span>Fecha de compra</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value || fecha)} /></label>
      {!c.cobro && (
        <div className="toggle"><div><b>Cuenta para Israel</b><small>{real ? "Cada mensualidad cuenta en el big one." : "Solo cuenta para wagered."}</small></div><button className={`sw${real ? " on" : ""}`} onClick={() => setReal(!real)} /></div>
      )}
      <div className="row" style={{ gap: 8 }}><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn" onClick={save}>Guardar cambios</button></div>
    </div></div>
  );
}

/* ===== reglas ===== */
export function RulesSheet({ rules, fx, onClose, onSave, onExport, onBorrar }: {
  rules: Rules; fx: Fx; onClose: () => void; onSave: (r: Rules, manualFx?: number) => void; onExport: () => void; onBorrar: () => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const [gas, setGas] = useState(String(rules.gasSemana));
  const [pg, setPg] = useState(rules.pctGastos);
  const [pe, setPe] = useState(rules.pctEmerg);
  const [corte, setCorte] = useState(String(rules.corte));
  const [pagoDia, setPagoDia] = useState(String(rules.pagoDia));
  const [msiMeses, setMsiMeses] = useState(String(rules.msiMeses));
  const [manualFx, setManualFx] = useState(fx.rate.toFixed(2));
  const [confirm, setConfirm] = useState(false);
  function save() {
    onSave({
      gasSemana: +gas || 0, pctGastos: pg, pctEmerg: pe,
      corte: Math.min(28, Math.max(1, +corte || 11)), pagoDia: Math.min(28, Math.max(1, +pagoDia || 1)),
      msiMeses: +msiMeses || 3,
    }, fx.live ? undefined : +manualFx || fx.rate);
  }
  return (
    <div className={`sheet${on ? " on" : ""}`}><div className="sin">
      <div className="grab" />
      <div className="shh"><b>Reglas</b><button className="ib" onClick={onClose}>✕</button></div>
      <p className="muted" style={{ fontSize: 13, marginTop: -6 }}>Aplican a los ingresos nuevos que cuentan para ti. En cada ingreso las puedes mover a mano.</p>
      <label className="field"><span>Gasolina por semana (monto fijo)</span><input type="number" value={gas} onChange={(e) => setGas(e.target.value)} /></label>
      <label className="field"><span>Lo que sobra · Gastos / Inversión: <b>{pg} / {100 - pg}</b></span><input type="range" min={0} max={100} step={5} value={pg} onChange={(e) => setPg(+e.target.value)} /></label>
      <label className="field"><span>De la inversión, a emergencia: <b>{pe}%</b></span><input type="range" min={0} max={50} step={5} value={pe} onChange={(e) => setPe(+e.target.value)} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label className="field"><span>Día de corte</span><input type="number" value={corte} onChange={(e) => setCorte(e.target.value)} /></label>
        <label className="field"><span>Día límite de pago</span><input type="number" value={pagoDia} onChange={(e) => setPagoDia(e.target.value)} /></label>
      </div>
      <label className="field"><span>Meses default de MSI</span><input type="number" value={msiMeses} onChange={(e) => setMsiMeses(e.target.value)} /></label>
      <label className="field"><span>Tipo de cambio manual (si no carga el en vivo)</span><input type="number" step="0.01" value={manualFx} onChange={(e) => setManualFx(e.target.value)} disabled={fx.live} /></label>
      <div className="row" style={{ gap: 8 }}><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn" onClick={save}>Guardar</button></div>
      <button className="btn ghost" style={{ marginTop: 8, fontSize: 13 }} onClick={onExport}>Exportar todo (JSON)</button>
      {confirm ? (
        <div className="box" style={{ marginTop: 8, borderColor: "var(--del)" }}>
          <div className="s" style={{ marginBottom: 8 }}>¿Seguro? Esto borra todos tus movimientos y planes. (Tienes Deshacer unos segundos.)</div>
          <div className="row" style={{ gap: 8 }}><button className="btn ghost" onClick={() => setConfirm(false)}>No</button><button className="btn" style={{ background: "var(--del)" }} onClick={onBorrar}>Sí, borrar todo</button></div>
        </div>
      ) : (
        <button className="btn ghost" style={{ marginTop: 8, fontSize: 13, color: "var(--del)" }} onClick={() => setConfirm(true)}>Borrar todo y empezar de cero</button>
      )}
    </div></div>
  );
}

/* ===== cajita escondida ===== */
export function CajitaSheet({ ALL, rules, today, rate, onClose, onUse }: {
  ALL: Mov[]; rules: Rules; today: string; rate: number; onClose: () => void; onUse: () => void;
}) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const T = totals(ALL, rules, today, rate);
  const W = T.W.filter((w) => w.closed && w.bal > 0.5).reverse();
  const usos = ALL.filter((m) => m.t === "out" && m.cat === "cajita").sort((a, b) => b.fecha.localeCompare(a.fecha));
  return (
    <div className={`sheet${on ? " on" : ""}`}><div className="sin">
      <div className="grab" />
      <div className="shh"><b>La cajita ★</b><button className="ib" onClick={onClose}>✕</button></div>
      <p className="muted" style={{ fontSize: 13, margin: "-4px 0 10px" }}>Se llena sola: lo que te sobra del sobre de Gastos al cerrar cada semana cae aquí. Feria guilt-free.</p>
      <div className="num" style={{ fontSize: 48, fontWeight: 600, color: "var(--amber)" }}>{money(T.cajita)}</div>
      <table style={{ marginTop: 10 }}><tbody>
        <tr><th>Semana</th><th>Movimiento</th></tr>
        {W.length || usos.length ? (
          <>
            {W.map((w) => (<tr key={"w" + w.ws}><td>{fmtD(w.ws)} – {fmtD(addDays(w.ws, 6))}</td><td className="num" style={{ fontSize: 15 }}>+{money(w.bal)}</td></tr>))}
            {usos.map((m) => (<tr key={m.id}><td>{m.concepto} <small className="muted">{fmtD(m.fecha)}</small></td><td className="num neg" style={{ fontSize: 15 }}>−{money(m.amt)}</td></tr>))}
          </>
        ) : <tr><td colSpan={2} className="muted">Todavía nada</td></tr>}
      </tbody></table>
      <button className="btn" style={{ marginTop: 14 }} disabled={T.cajita <= 0} onClick={onUse}>Usar feria de la cajita</button>
    </div></div>
  );
}

export function exportData(movs: Mov[], plans: Plan[], rules: Rules) {
  try {
    const data = { exportado: new Date().toISOString(), movimientos: movs, planes: plans, reglas: rules };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `feria-backup-${todayStr()}.json`; a.click();
    URL.revokeObjectURL(url);
  } catch {}
}

export type { Pago };
