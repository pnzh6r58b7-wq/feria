"use client";

import { useEffect, useState } from "react";
import {
  CATS,
  computeSplit,
  gasLeft,
  money,
  r2,
  todayStr,
  type Mov,
  type Moneda,
  type Rules,
} from "@/lib/model";

type Fx = { rate: number; live: boolean };
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
};

export default function AddSheet({
  initial,
  pre,
  movs,
  rules,
  fx,
  onClose,
  onSubmit,
}: {
  initial: Mov | null;
  pre?: Partial<Draft>;
  movs: Mov[];
  rules: Rules;
  fx: Fx;
  onClose: () => void;
  onSubmit: (m: Mov, editId: string | null) => void;
}) {
  const edit = !!initial;
  const [d, setD] = useState<Draft>(() => ({
    t: initial && initial.t !== "fx" ? initial.t : "out",
    cat: initial?.cat ?? null,
    amt: initial ? String(initial.amt) : "",
    cur: initial?.cur ?? "MXN",
    concepto: initial?.concepto ?? "",
    fecha: initial?.fecha ?? todayStr(),
    real: initial?.real ?? false,
    ov: initial?.ov ?? {},
    ...pre,
  }));
  const [usd, setUsd] = useState<number | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const C = CATS[d.t];
  const chips = Object.entries(C).filter(([, x]) => !x.special && !x.hidden);
  const c = d.cat ? C[d.cat] : null;
  const showReal = !!c && !c.inv && !c.save && !c.special && !c.hidden;
  const showSplit = d.t === "in" && !!c && d.real;

  function setCat(k: string) {
    const x = C[k];
    setD((p) => {
      const n: Draft = { ...p, cat: k, real: x.real, ov: {} };
      if (x.fijo && !edit) {
        n.amt = String(x.fijo.amt);
        n.concepto = x.fijo.concepto;
        n.cur = "MXN";
      }
      return n;
    });
  }

  function doSave() {
    const a = parseFloat(d.amt);
    if (!d.cat) return;
    if (!a || a <= 0) return;
    const origUsd = initial && initial.cur === "USD";
    if (d.t === "in" && d.cur === "USD" && !origUsd) {
      setUsd(a);
      return;
    }
    build({});
  }

  function build(extra: { tc?: number }) {
    const a = parseFloat(d.amt);
    const label = CATS[d.t][d.cat as string].l;
    const mov: Mov = {
      id: initial?.id ?? "tmp",
      t: d.t,
      cat: d.cat as string,
      amt: a,
      cur: d.cur,
      fecha: d.fecha,
      concepto: d.concepto.trim() || label,
      real: d.real,
      ov: d.ov,
    };
    if (extra.tc) {
      mov.usd = a;
      mov.tc = extra.tc;
      mov.amt = r2(a * extra.tc);
      mov.cur = "MXN";
    } else if (initial?.usd && initial.amt === mov.amt && mov.cur === "MXN") {
      mov.usd = initial.usd;
      mov.tc = initial.tc;
    }
    onSubmit(mov, initial?.id ?? null);
  }

  return (
    <div className={`sheet${on ? " on" : ""}`}>
      <div className="sin">
        <div className="grab" />
        <div className="shh">
          <b>{edit ? "Editar movimiento" : "Nuevo movimiento"}</b>
          <button className="ib" aria-label="Cerrar" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="seg">
          <button className={d.t === "out" ? "on" : ""} onClick={() => setD((p) => ({ ...p, t: "out", cat: null, real: false, ov: {} }))}>
            Gasto
          </button>
          <button className={d.t === "in" ? "on" : ""} onClick={() => setD((p) => ({ ...p, t: "in", cat: null, real: false, ov: {} }))}>
            Ingreso
          </button>
        </div>

        <div className="amt">
          <span className="num" style={{ fontSize: 34, color: "var(--mut)" }}>$</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={d.amt}
            onChange={(e) => setD((p) => ({ ...p, amt: e.target.value.replace(/[^0-9.]/g, "") }))}
          />
          <div className="cur">
            <button className={d.cur === "MXN" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "MXN" }))}>MXN</button>
            <button className={d.cur === "USD" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "USD" }))}>USD</button>
          </div>
        </div>
        <div className="amtl">Monto</div>

        <div className="lbl">Categoría</div>
        <div className="cats">
          {chips.map(([k, x]) => (
            <button
              key={k}
              className={`cat${d.cat === k ? " on" : ""}`}
              style={{ ["--c" as string]: vv(x.c), ["--cs" as string]: vs(x.c) }}
              onClick={() => setCat(k)}
            >
              <i />
              {x.l}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Concepto</span>
          <input
            type="text"
            placeholder={d.t === "out" ? "Tacos, gasolina, súper…" : "Semana, viernes, regalo…"}
            value={d.concepto}
            onChange={(e) => setD((p) => ({ ...p, concepto: e.target.value }))}
          />
        </label>

        <label className="field">
          <span>Fecha</span>
          <input type="date" value={d.fecha} onChange={(e) => setD((p) => ({ ...p, fecha: e.target.value || todayStr(), ov: {} }))} />
        </label>

        {showReal && (
          <div className="toggle">
            <div>
              <b>Cuenta para Israel</b>
              <small>
                {d.real
                  ? d.t === "in"
                    ? "Cuenta en el big one y se divide en tus sobres."
                    : "Cuenta en el big one y sale de tu sobre."
                  : "Solo cuenta para wagered, no para ti."}
              </small>
            </div>
            <button className={`sw${d.real ? " on" : ""}`} aria-label="Cuenta para Israel" onClick={() => setD((p) => ({ ...p, real: !p.real }))} />
          </div>
        )}

        {showSplit && <SplitBox d={d} setD={setD} movs={movs} rules={rules} fx={fx} editId={initial?.id} />}

        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn" onClick={doSave}>{edit ? "Guardar cambios" : "Guardar"}</button>
        </div>
      </div>

      {usd != null && <UsdModal amt={usd} fx={fx} onCancel={() => setUsd(null)} onDone={(extra) => { setUsd(null); build(extra); }} />}
    </div>
  );
}

function SplitBox({
  d, setD, movs, rules, fx, editId,
}: {
  d: Draft;
  setD: React.Dispatch<React.SetStateAction<Draft>>;
  movs: Mov[];
  rules: Rules;
  fx: Fx;
  editId?: string;
}) {
  const total = (parseFloat(d.amt) || 0) * (d.cur === "USD" ? fx.rate : 1);
  const gl = gasLeft(d.fecha, movs, rules, editId);
  const pg = d.ov.pctGastos ?? rules.pctGastos;
  const pe = d.ov.pctEmerg ?? rules.pctEmerg;
  const s = computeSplit(total, gl, rules, d.ov);
  const t = total || 1;
  const parts: [keyof typeof s, string][] = [
    ["gas", "--navy"], ["gastos", "--terra"], ["invertir", "--amber"], ["emergencia", "--cu"],
  ];
  const setOv = (k: string, val: number) => setD((p) => ({ ...p, ov: { ...p.ov, [k]: val } }));
  return (
    <div className="box">
      <h4>División de este ingreso</h4>
      <div className="hint">Primero se llena la gasolina de la semana (te faltan {money(gl)}), lo demás se reparte. Lo puedes mover.</div>
      <div className="stack">
        {parts.map(([k, col]) => (
          <i key={k} style={{ ["--c" as string]: `var(${col})`, width: `${(s[k] / t) * 100}%` }} />
        ))}
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--navy)" }}>
        <i /><div>Gasolina<small>monto fijo</small></div>
        <input className="gasin" inputMode="decimal" value={Math.round(s.gas)} onChange={(e) => setOv("gas", parseFloat(e.target.value) || 0)} />
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--terra)" }}>
        <i /><div>Gastos<small>{pg}% de lo que sobra</small></div><b>{money(s.gastos)}</b>
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--amber)" }}>
        <i /><div>Invertir<small>{100 - pg}% menos emergencia</small></div><b>{money(s.invertir)}</b>
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--cu)" }}>
        <i /><div>Emergencia<small>{pe}% de la inversión</small></div><b>{money(s.emergencia)}</b>
      </div>
      <label className="field" style={{ margin: "12px 0 4px" }}>
        <span>Gastos / Inversión: <b>{pg} / {100 - pg}</b></span>
        <input type="range" min={0} max={100} step={5} value={pg} onChange={(e) => setOv("pctGastos", +e.target.value)} />
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span>De la inversión, a emergencia: <b>{pe}%</b></span>
        <input type="range" min={0} max={50} step={5} value={pe} onChange={(e) => setOv("pctEmerg", +e.target.value)} />
      </label>
    </div>
  );
}

function UsdModal({
  amt, fx, onCancel, onDone,
}: {
  amt: number;
  fx: Fx;
  onCancel: () => void;
  onDone: (extra: { tc?: number }) => void;
}) {
  const [mode, setMode] = useState<"guardar" | "cambie">("guardar");
  const [tc, setTc] = useState<string>((fx.rate - 0.3).toFixed(2));
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const r = parseFloat(tc) || 0;
  const dif = amt * (r - fx.rate);
  return (
    <div className={`modal${on ? " on" : ""}`}>
      <div className="mb">
        <h3>Entraron {money(amt, "USD")}</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>
          TC {fx.live ? "en vivo" : "manual"}: {fx.rate.toFixed(2)} → ≈ {money(amt * fx.rate)} MXN
        </p>
        <button className={`opt${mode === "guardar" ? " on" : ""}`} onClick={() => setMode("guardar")}>
          <b>Los guardo en dólares</b><small>Van a tu bolsa de dólares y se valúan con el TC en vivo.</small>
        </button>
        <button className={`opt${mode === "cambie" ? " on" : ""}`} onClick={() => setMode("cambie")}>
          <b>Los cambié a pesos</b><small>Dime a qué tipo de cambio.</small>
        </button>
        {mode === "cambie" && (
          <label className="field">
            <span>¿A cuánto te los cambiaron?</span>
            <input type="number" step="0.01" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} />
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Recibiste <b>{money(amt * r)}</b> · vs TC en vivo:{" "}
              <b style={{ color: dif >= 0 ? "var(--teal)" : "var(--terra)" }}>{dif >= 0 ? "+" : ""}{money(dif)}</b>
            </div>
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
