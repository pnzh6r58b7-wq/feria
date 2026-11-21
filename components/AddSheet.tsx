"use client";

import { useEffect, useState } from "react";
import {
  CATS, computeSplit, gasLeft, money, money2, r2, todayStr, fmtD,
  type Mov, type Moneda, type Plan, type Pago, type Rules,
} from "@/lib/model";
import { planInfo, firstCorte, pagoDe, type Cuota } from "@/lib/calc";

type Fx = { rate: number; live: boolean };
type Pc = Record<"mama" | "externo", { planes: { p: Plan; i: ReturnType<typeof planInfo>; pend: number; falta: number }[] }>;
const vv = (c: string) => `var(${c})`;
const vs = (c: string) => `var(${c}-s)`;

type Draft = {
  t: "in" | "out";
  cat: string | null;
  amt: string;
  cur: Moneda;
  concepto: string;
  fecha: string;
  real: boolean;
  ov: Record<string, number>;
  msi: boolean;
  meses: number;
  mesesManual: boolean;
  planId: string | null;
  msiOn: boolean;
  msiPlan: string | null;
  msiMonto: string;
};

export default function AddSheet({
  initial, pre, movs, plans, rules, fx, pc, today,
  onClose, onMov, onPlan, onPago, onToast,
}: {
  initial: Mov | null;
  pre?: Partial<Draft>;
  movs: Mov[];
  plans: Plan[];
  rules: Rules;
  fx: Fx;
  pc: Pc;
  today: string;
  onClose: () => void;
  onMov: (m: Mov, editId: string | null) => void;
  onPlan: (p: Plan) => void;
  onPago: (planId: string, pago: Pago) => void;
  onToast: (t: string) => void;
}) {
  const edit = !!initial;
  const [d, setD] = useState<Draft>(() => {
    const base: Draft = {
      t: initial && initial.t !== "fx" ? initial.t : "out",
      cat: initial?.cat ?? null,
      amt: initial ? String(initial.amt) : "",
      cur: initial?.cur ?? "MXN",
      concepto: initial?.concepto ?? "",
      fecha: initial?.fecha ?? todayStr(),
      real: initial?.real ?? false,
      ov: initial?.ov ?? {},
      msi: false,
      meses: rules.msiMeses,
      mesesManual: rules.msiMeses !== 3,
      planId: null,
      msiOn: !!initial?.msiPart,
      msiPlan: initial?.msiPart?.plan ?? null,
      msiMonto: initial?.msiPart ? String(initial.msiPart.monto) : "",
      ...pre,
    };
    if (base.msi && !base.cat) base.cat = "gastos";
    if (base.cat) base.real = CATS[base.t][base.cat].real;
    if ((base.cat === "capital" || base.cat === "pago_msi") && !base.planId) {
      const a = plans.find((p) => planInfo(p, rules, today).active);
      if (a) {
        base.planId = a.id;
        if (base.cat === "pago_msi" && !base.amt) base.amt = String(planInfo(a, rules, today).next?.falta ?? "");
      }
    }
    return base;
  });
  const [usd, setUsd] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);

  const C = CATS[d.t];
  const c = d.cat ? C[d.cat] : null;
  const chips = Object.entries(C).filter(([k, x]) => (!x.hidden || k === d.cat) && !(edit && x.special));
  const isCap = d.cat === "capital" || d.cat === "pago_msi";
  const isPM = d.cat === "pago_msi";
  const canMsi = d.t === "out" && !!c && !!c.msi && !edit;
  const showReal = !!c && !c.inv && !c.save && !c.special && !c.hidden;
  const showSplit = d.t === "in" && !!c && d.real && !isCap;
  const act = plans.filter((p) => planInfo(p, rules, today).active);
  const capP = isCap ? plans.find((p) => p.id === d.planId) : null;
  const rPlans = d.t === "in" && c && c.cobro ? pc[c.cobro].planes.filter((x) => x.falta > 0.005 || x.p.id === d.msiPlan) : [];
  const pcp = c && c.cobro && d.t === "in" ? (pc[c.cobro] as unknown as { pend: number }).pend : null;

  function setCat(k: string) {
    const x = C[k];
    setD((p) => {
      const n: Draft = { ...p, cat: k, real: x.real, ov: {} };
      if (!x.msi) n.msi = false;
      if (x.fijo && !edit) { n.amt = String(x.fijo.amt); n.concepto = x.fijo.concepto; n.cur = "MXN"; }
      if (k === "capital" || k === "pago_msi") {
        n.msi = false; n.cur = "MXN";
        const a = plans.find((pl) => planInfo(pl, rules, today).active);
        n.planId = a ? a.id : null;
        n.amt = k === "pago_msi" && a ? String(planInfo(a, rules, today).next?.falta ?? "") : "";
      }
      if (!x.cobro) n.msiOn = false;
      return n;
    });
  }

  function doSave() {
    const a = parseFloat(d.amt);
    if (!d.cat) return onToast("Escoge una categoría");
    if (!a || a <= 0) return onToast("Pon un monto");
    if (isCap) {
      const p = plans.find((x) => x.id === d.planId);
      if (!p) return onToast("Escoge el plan");
      const i = planInfo(p, rules, today);
      if (a > i.rem + 0.01) return onToast(`Solo faltan ${money2(i.rem)}`);
      onPago(p.id, { fecha: d.fecha, monto: r2(a), tipo: d.cat === "capital" ? "capital" : "cuota" });
      return;
    }
    if (d.msi) {
      if (!d.meses || d.meses < 1) return onToast("Pon los meses");
      onPlan({
        id: "tmp", concepto: d.concepto.trim() || CATS.out[d.cat].l, cat: d.cat,
        total: r2(a), meses: d.meses, fecha: d.fecha, real: d.real, pagos: [],
      });
      return;
    }
    if (d.msiOn && d.msiPlan && (parseFloat(d.msiMonto) || 0) > a + 0.001) return onToast("Lo de MSI no puede ser más de lo que te dieron");
    const origUsd = initial && initial.cur === "USD";
    if (d.t === "in" && d.cur === "USD" && !origUsd) { setUsd(a); return; }
    commit({});
  }

  function commit(extra: { tc?: number }) {
    const a = parseFloat(d.amt);
    const mov: Mov = {
      id: initial?.id ?? "tmp", t: d.t, cat: d.cat as string, amt: a, cur: d.cur,
      fecha: d.fecha, concepto: d.concepto.trim() || CATS[d.t][d.cat as string].l, real: d.real, ov: d.ov,
    };
    if (extra.tc) { mov.usd = a; mov.tc = extra.tc; mov.amt = r2(a * extra.tc); mov.cur = "MXN"; }
    else if (initial?.usd && initial.amt === mov.amt && mov.cur === "MXN") { mov.usd = initial.usd; mov.tc = initial.tc; }
    if (d.t === "in" && c?.cobro && d.msiOn && d.msiPlan && parseFloat(d.msiMonto) > 0) {
      mov.msiPart = { plan: d.msiPlan, monto: r2(parseFloat(d.msiMonto)) };
    }
    onMov(mov, initial?.id ?? null);
  }

  const aNum = parseFloat(d.amt) || 0;

  return (
    <div className={`sheet${on ? " on" : ""}`}>
      <div className="sin">
        <div className="grab" />
        <div className="shh">
          <b>{edit ? "Editar movimiento" : "Nuevo movimiento"}</b>
          <button className="ib" aria-label="Cerrar" onClick={onClose}>✕</button>
        </div>

        <div className="seg">
          <button className={d.t === "out" ? "on" : ""} onClick={() => setD((p) => ({ ...p, t: "out", cat: null, real: false, ov: {}, msi: false }))}>Gasto</button>
          <button className={d.t === "in" ? "on" : ""} onClick={() => setD((p) => ({ ...p, t: "in", cat: null, real: false, ov: {}, msi: false }))}>Ingreso</button>
        </div>

        <div className="amt">
          <span className="num" style={{ fontSize: 34, color: "var(--mut)" }}>$</span>
          <input inputMode="decimal" placeholder="0" value={d.amt} onChange={(e) => setD((p) => ({ ...p, amt: e.target.value.replace(/[^0-9.]/g, "") }))} />
          {!isCap && !d.msi && (
            <div className="cur">
              <button className={d.cur === "MXN" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "MXN" }))}>MXN</button>
              <button className={d.cur === "USD" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "USD" }))}>USD</button>
            </div>
          )}
        </div>
        <div className="amtl">{d.msi ? "Total de la compra" : isPM ? "Monto de la mensualidad" : isCap ? "Monto a capital" : "Monto"}</div>

        <div className="lbl">Categoría</div>
        <div className="cats">
          {chips.map(([k, x]) => (
            <button key={k} className={`cat${d.cat === k ? " on" : ""}`} style={{ ["--c" as string]: vv(x.c), ["--cs" as string]: vs(x.c) }} onClick={() => setCat(k)}>
              <i />{x.l}
            </button>
          ))}
        </div>

        {pcp != null && (
          <div className="toggle" style={{ background: "var(--wine-s)", color: "var(--wine)" }}>
            <div><b>Pendiente de {c!.cobro === "mama" ? "mamá" : "externos"}: {money(pcp)}</b><small style={{ color: "inherit", opacity: 0.8 }}>Este ingreso se descuenta de lo que te deben.</small></div>
          </div>
        )}

        {isCap && (
          act.length ? (
            <>
              <div className="lbl" style={{ marginBottom: 6 }}>¿A qué plan {isPM ? "pagas" : "abonas"}?</div>
              {act.map((p) => {
                const i = planInfo(p, rules, today), c2 = CATS.out[p.cat];
                return (
                  <button key={p.id} className={`opt${d.planId === p.id ? " on" : ""}`} onClick={() => setD((pp) => { const n = { ...pp, planId: p.id }; if (pp.cat === "pago_msi") n.amt = String(planInfo(p, rules, today).next?.falta ?? ""); return n; })}>
                    <b>{p.concepto}</b>
                    <small>{isPM && i.next ? `Mensualidad ${i.next.k + 1} de ${p.meses}: ${money2(i.next.falta)} · corte ${fmtD(i.next.date)}` : `Faltan ${money2(i.rem)} · ${i.nPaid} de ${p.meses} pagadas`} · {c2.cobro ? "solo wagered" : "sale de tu sobre"}</small>
                  </button>
                );
              })}
              {isPM ? (
                <div className="muted" style={{ fontSize: 12, margin: "2px 0 12px" }}>Paga la mensualidad más próxima: baja el próximo cargo y cuenta como gasto hoy.</div>
              ) : (
                <div className="row" style={{ fontSize: 12, margin: "2px 0 12px" }}>
                  <span className="muted">Pon lo que vas a abonar{capP ? ` (faltan ${money2(planInfo(capP, rules, today).rem)})` : ""}. Se descuenta de las últimas mensualidades.</span>
                  {capP && <button className="btn sm ghost" style={{ flex: "none" }} onClick={() => setD((p) => ({ ...p, amt: String(planInfo(capP, rules, today).rem) }))}>Liquidar todo</button>}
                </div>
              )}
            </>
          ) : <div className="empty">No tienes planes de MSI activos.</div>
        )}

        {rPlans.length > 0 && (
          <>
            <div className="toggle">
              <div><b>Parte es de MSI</b><small>Lo de MSI se descuenta del plan; el resto va a gastos sueltos.</small></div>
              <button className={`sw${d.msiOn ? " on" : ""}`} onClick={() => setD((p) => {
                const n = { ...p, msiOn: !p.msiOn };
                if (n.msiOn && !p.msiMonto) { const x = rPlans[0]; n.msiPlan = x.p.id; const a = parseFloat(p.amt) || 0; n.msiMonto = String(Math.round(Math.min(a || Infinity, x.pend > 0 ? x.pend : x.falta) * 100) / 100); }
                return n;
              })} />
            </div>
            {d.msiOn && (
              <div className="box">
                {rPlans.map((x) => (
                  <button key={x.p.id} className={`opt${d.msiPlan === x.p.id ? " on" : ""}`} onClick={() => setD((p) => ({ ...p, msiPlan: x.p.id }))}>
                    <b>{x.p.concepto}</b><small>Te debe {money(Math.max(0, x.pend))} de lo que ya pagaste · faltan {money(x.falta)} del total</small>
                  </button>
                ))}
                <label className="field" style={{ margin: "6px 0 4px" }}><span>¿Cuánto es de MSI?</span>
                  <input type="number" inputMode="decimal" value={d.msiMonto} onChange={(e) => setD((p) => ({ ...p, msiMonto: e.target.value }))} /></label>
                <div className="muted" style={{ fontSize: 12 }}>
                  {(parseFloat(d.msiMonto) || 0) > aNum ? <b style={{ color: "var(--terra)" }}>Es más de lo que te dieron ({money(aNum)}).</b> : <>{money(parseFloat(d.msiMonto) || 0)} a MSI · el resto, <b>{money(aNum - (parseFloat(d.msiMonto) || 0))}</b>, va a gastos sueltos.</>}
                </div>
              </div>
            )}
          </>
        )}

        {canMsi && (
          <>
            <div className="toggle">
              <div><b>A meses sin intereses</b><small>Cada mensualidad cuenta como gasto cuando la pagas (Pago MSI).</small></div>
              <button className={`sw${d.msi ? " on" : ""}`} onClick={() => setD((p) => ({ ...p, msi: !p.msi, cur: !p.msi ? "MXN" : p.cur }))} />
            </div>
            {d.msi && (
              <div className="box">
                <div className="cats" style={{ margin: "0 0 8px", alignItems: "center" }}>
                  <button className={`chip${!d.mesesManual ? " on" : ""}`} onClick={() => setD((p) => ({ ...p, mesesManual: false, meses: 3 }))}>3 meses</button>
                  <button className={`chip${d.mesesManual ? " on" : ""}`} onClick={() => setD((p) => ({ ...p, mesesManual: true }))}>Manual</button>
                  {d.mesesManual && <input type="number" min={1} max={48} value={d.meses} onChange={(e) => setD((p) => ({ ...p, meses: parseInt(e.target.value) || 0 }))} style={{ width: 80, padding: 8, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", fontSize: 16 }} />}
                </div>
                <div style={{ fontSize: 13 }}>
                  {!d.meses || d.meses < 1 ? <span className="muted">Pon cuántos meses faltan.</span> : <><b>{d.meses} mensualidad{d.meses > 1 ? "es" : ""} de {money2(aNum / d.meses)}</b><br /><span className="muted">Primer cargo: corte {fmtD(firstCorte(d.fecha, rules))} · pagas antes del {fmtD(pagoDe(firstCorte(d.fecha, rules), rules))}.</span></>}
                </div>
              </div>
            )}
          </>
        )}

        {!isCap && (
          <label className="field">
            <span>Concepto{d.cat === "por_externo" ? " (¿de quién es?)" : ""}</span>
            <input type="text" placeholder={d.t === "out" ? "Tacos, gasolina, súper…" : "Semana, viernes, regalo…"} value={d.concepto} onChange={(e) => setD((p) => ({ ...p, concepto: e.target.value }))} />
          </label>
        )}

        <label className="field">
          <span>{d.msi ? "Fecha de compra" : "Fecha"}</span>
          <input type="date" value={d.fecha} onChange={(e) => setD((p) => ({ ...p, fecha: e.target.value || todayStr(), ov: {} }))} />
        </label>

        {showReal && (
          <div className="toggle">
            <div><b>Cuenta para Israel</b><small>{d.real ? (d.t === "in" ? "Cuenta en el big one y se divide en tus sobres." : "Cuenta en el big one y sale de tu sobre.") : "Solo cuenta para wagered, no para ti."}</small></div>
            <button className={`sw${d.real ? " on" : ""}`} onClick={() => setD((p) => ({ ...p, real: !p.real }))} />
          </div>
        )}

        {showSplit && <SplitBox d={d} setD={setD} movs={movs} rules={rules} fx={fx} editId={initial?.id} />}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={doSave}>{edit ? "Guardar cambios" : "Guardar"}</button>
        </div>
      </div>

      {usd != null && <UsdModal amt={usd} fx={fx} onCancel={() => setUsd(null)} onDone={(extra) => { setUsd(null); commit(extra); }} />}
    </div>
  );
}

function SplitBox({ d, setD, movs, rules, fx, editId }: {
  d: Draft; setD: React.Dispatch<React.SetStateAction<Draft>>; movs: Mov[]; rules: Rules; fx: Fx; editId?: string;
}) {
  const total = (parseFloat(d.amt) || 0) * (d.cur === "USD" ? fx.rate : 1);
  const gl = gasLeft(d.fecha, movs, rules, editId);
  const pg = d.ov.pctGastos ?? rules.pctGastos;
  const pe = d.ov.pctEmerg ?? rules.pctEmerg;
  const s = computeSplit(total, gl, rules, d.ov);
  const t = total || 1;
  const parts: [keyof typeof s, string][] = [["gas", "--navy"], ["gastos", "--terra"], ["invertir", "--amber"], ["emergencia", "--cu"]];
  const setOv = (k: string, val: number) => setD((p) => ({ ...p, ov: { ...p.ov, [k]: val } }));
  return (
    <div className="box">
      <h4>División de este ingreso</h4>
      <div className="hint">Primero se llena la gasolina de la semana (te faltan {money(gl)}), lo demás se reparte.</div>
      <div className="stack">{parts.map(([k, col]) => <i key={k} style={{ ["--c" as string]: `var(${col})`, width: `${(s[k] / t) * 100}%` }} />)}</div>
      <div className="srow" style={{ ["--c" as string]: "var(--navy)" }}><i /><div>Gasolina<small>monto fijo</small></div><input className="gasin" inputMode="decimal" value={Math.round(s.gas)} onChange={(e) => setOv("gas", parseFloat(e.target.value) || 0)} /></div>
      <div className="srow" style={{ ["--c" as string]: "var(--terra)" }}><i /><div>Gastos<small>{pg}% de lo que sobra</small></div><b>{money(s.gastos)}</b></div>
      <div className="srow" style={{ ["--c" as string]: "var(--amber)" }}><i /><div>Invertir<small>{100 - pg}% menos emergencia</small></div><b>{money(s.invertir)}</b></div>
      <div className="srow" style={{ ["--c" as string]: "var(--cu)" }}><i /><div>Emergencia<small>{pe}% de la inversión</small></div><b>{money(s.emergencia)}</b></div>
      <label className="field" style={{ margin: "12px 0 4px" }}><span>Gastos / Inversión: <b>{pg} / {100 - pg}</b></span><input type="range" min={0} max={100} step={5} value={pg} onChange={(e) => setOv("pctGastos", +e.target.value)} /></label>
      <label className="field" style={{ margin: 0 }}><span>De la inversión, a emergencia: <b>{pe}%</b></span><input type="range" min={0} max={50} step={5} value={pe} onChange={(e) => setOv("pctEmerg", +e.target.value)} /></label>
    </div>
  );
}

function UsdModal({ amt, fx, onCancel, onDone }: { amt: number; fx: Fx; onCancel: () => void; onDone: (extra: { tc?: number }) => void; }) {
  const [mode, setMode] = useState<"guardar" | "cambie">("guardar");
  const [tc, setTc] = useState<string>((fx.rate - 0.3).toFixed(2));
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const r = parseFloat(tc) || 0, dif = amt * (r - fx.rate);
  return (
    <div className={`modal${on ? " on" : ""}`}>
      <div className="mb">
        <h3>Entraron {money(amt, "USD")}</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>TC {fx.live ? "en vivo" : "manual"}: {fx.rate.toFixed(2)} → ≈ {money(amt * fx.rate)} MXN</p>
        <button className={`opt${mode === "guardar" ? " on" : ""}`} onClick={() => setMode("guardar")}><b>Los guardo en dólares</b><small>Van a tu bolsa de dólares y se valúan con el TC en vivo.</small></button>
        <button className={`opt${mode === "cambie" ? " on" : ""}`} onClick={() => setMode("cambie")}><b>Los cambié a pesos</b><small>Dime a qué tipo de cambio.</small></button>
        {mode === "cambie" && (
          <label className="field"><span>¿A cuánto te los cambiaron?</span>
            <input type="number" step="0.01" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} />
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>Recibiste <b>{money(amt * r)}</b> · vs TC en vivo: <b style={{ color: dif >= 0 ? "var(--teal)" : "var(--terra)" }}>{dif >= 0 ? "+" : ""}{money(dif)}</b></div>
          </label>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={() => { if (mode === "cambie") { if (!r) return; onDone({ tc: r }); } else onDone({}); }}>Listo</button>
        </div>
      </div>
    </div>
  );
}

export type { Cuota };
