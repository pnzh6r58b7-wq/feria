"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SwipeRow from "@/components/SwipeRow";
import {
  CATS,
  DEF_RULES,
  catOf,
  computeSplit,
  gasLeft,
  amtMXN,
  money,
  r2,
  todayStr,
  fmtDay,
  type Mov,
  type Moneda,
  type Rules,
} from "@/lib/model";
import { fetchMovs, fetchReglas, insertMov, updateMov, deleteMov } from "@/lib/db";

type Fx = { rate: number; live: boolean };
type Toast = { text: string; actLabel?: string; onAct?: () => void };

const vv = (c: string) => `var(${c})`;
const vs = (c: string) => `var(${c}-s)`;
const sortMovs = (a: Mov[]) =>
  [...a].sort(
    (x, y) => y.fecha.localeCompare(x.fecha) || (y._created || "").localeCompare(x._created || "")
  );

export default function MovsApp({ email }: { email: string }) {
  const router = useRouter();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [rules, setRules] = useState<Rules>(DEF_RULES);
  const [fx, setFx] = useState<Fx>({ rate: 18.4, live: false });
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [sheet, setSheet] = useState<{ initial: Mov | null } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTheme(
      (document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light"
    );
    (async () => {
      try {
        const [m, r] = await Promise.all([fetchMovs(), fetchReglas()]);
        setMovs(sortMovs(m));
        if (r) setRules(r);
        setLoaded(true);
      } catch {
        setLoadErr(true);
        setLoaded(true);
      }
    })();
    // TC en vivo
    (async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 3500);
        const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctl.signal });
        clearTimeout(t);
        const j = await res.json();
        if (j?.rates?.MXN) setFx({ rate: j.rates.MXN, live: true });
      } catch {
        /* usa manual */
      }
    })();
  }, []);

  function showToast(text: string, actLabel?: string, onAct?: () => void) {
    setToast({ text, actLabel, onAct });
    if (tt.current) clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(null), actLabel ? 4500 : 2600);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("feria_theme", next);
    } catch {}
  }

  async function logout() {
    try {
      await createClient().auth.signOut();
    } catch {}
    router.replace("/login");
  }

  // Guarda (alta o edición) ya con la moneda/TC resueltos por la hoja.
  async function onSubmit(m: Mov, editId: string | null) {
    const mov: Mov = { ...m };
    if (mov.t === "in" && mov.real) {
      mov.split = computeSplit(
        amtMXN(mov, fx.rate),
        gasLeft(mov.fecha, movs, rules, editId || undefined),
        rules,
        mov.ov || {}
      );
    } else {
      delete mov.split;
    }
    try {
      if (editId) {
        const saved = await updateMov(editId, mov);
        setMovs((prev) => sortMovs(prev.map((x) => (x.id === editId ? saved : x))));
        showToast("Cambios guardados");
      } else {
        const saved = await insertMov(mov);
        setMovs((prev) => sortMovs([saved, ...prev]));
        if (saved.split) {
          const s = saved.split;
          showToast(
            `Guardado · gas ${money(s.gas)} · gastos ${money(s.gastos)} · invertir ${money(
              s.invertir
            )} · emergencia ${money(s.emergencia)}`
          );
        } else showToast(saved.real ? "Gasto guardado" : "Guardado");
      }
      setSheet(null);
    } catch {
      showToast("No se pudo guardar. Revisa tu conexión.");
    }
  }

  async function removeMov(m: Mov) {
    setMovs((prev) => prev.filter((x) => x.id !== m.id));
    try {
      await deleteMov(m.id);
      showToast(`Borrado: ${m.concepto || catOf(m).l}`, "Deshacer", async () => {
        try {
          const { id, _created, ...rest } = m;
          void id;
          void _created;
          const back = await insertMov(rest as Mov);
          setMovs((prev) => sortMovs([back, ...prev]));
        } catch {
          showToast("No se pudo deshacer.");
        }
      });
    } catch {
      setMovs((prev) => sortMovs([m, ...prev]));
      showToast("No se pudo borrar.");
    }
  }

  const today = todayStr();

  return (
    <div className="app">
      <header className="flex items-center justify-between mt-0.5 mb-3.5">
        <div className="num font-bold text-[28px] leading-none tracking-tight">
          Feria
          <span className="block font-sans text-xs font-semibold text-mut tracking-normal mt-0.5">
            Movimientos
          </span>
        </div>
        <div className="flex gap-1.5">
          <button className="ib" aria-label="Modo oscuro" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>
          <button className="ib" aria-label="Cerrar sesión" onClick={logout} title={email}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            </svg>
          </button>
        </div>
      </header>

      {!loaded ? (
        <div className="empty">Cargando…</div>
      ) : loadErr ? (
        <div className="empty">No se pudo cargar. Revisa tu conexión y recarga.</div>
      ) : movs.length === 0 ? (
        <div className="empty">
          Nada por aquí todavía.
          <br />
          Toca <b>+</b> para agregar tu primer movimiento.
        </div>
      ) : (
        <MovList movs={movs} fx={fx} today={today} onEdit={(m) => setSheet({ initial: m })} onDelete={removeMov} />
      )}

      <button className="fab" aria-label="Agregar" onClick={() => setSheet({ initial: null })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <div className={`scrim${sheet ? " on" : ""}`} onClick={() => setSheet(null)} />
      {sheet && (
        <AddSheet
          initial={sheet.initial}
          movs={movs}
          rules={rules}
          fx={fx}
          onClose={() => setSheet(null)}
          onSubmit={onSubmit}
        />
      )}

      <div className={`toast${toast ? " on" : ""}`}>
        {toast && (
          <>
            <span>{toast.text}</span>
            {toast.actLabel && (
              <button
                onClick={() => {
                  const fn = toast.onAct;
                  setToast(null);
                  fn?.();
                }}
              >
                {toast.actLabel}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ===== lista agrupada por día ===== */
function MovList({
  movs,
  fx,
  today,
  onEdit,
  onDelete,
}: {
  movs: Mov[];
  fx: Fx;
  today: string;
  onEdit: (m: Mov) => void;
  onDelete: (m: Mov) => void;
}) {
  const out: React.ReactNode[] = [];
  let last = "";
  movs.forEach((m) => {
    if (m.fecha !== last) {
      out.push(
        <div className="day" key={"d" + m.fecha}>
          {m.fecha === today ? "Hoy · " : ""}
          {fmtDay(m.fecha)}
        </div>
      );
      last = m.fecha;
    }
    out.push(
      <SwipeRow key={m.id} onTap={() => onEdit(m)} onDelete={() => onDelete(m)}>
        <MovRow m={m} fx={fx} />
      </SwipeRow>
    );
  });
  return <>{out}</>;
}

function MovRow({ m, fx }: { m: Mov; fx: Fx }) {
  const c = catOf(m);
  const isWagered = !m.real && !c.inv && !c.save;
  const sign = m.t === "in" ? "+" : m.t === "out" ? "−" : "⇄";
  const cls = m.t === "fx" || isWagered ? "muted" : m.t === "in" ? "pos" : "neg";
  const amt = m.t === "fx" ? money((m.usd || 0) * (m.tc || 0)) : money(m.amt, m.cur);
  return (
    <div className="mv">
      <div className="dot" style={{ ["--c" as string]: vv(c.c), ["--cs" as string]: vs(c.c) }}>
        {c.ab}
      </div>
      <div className="t">
        <b>{m.concepto || c.l}</b>
        <small>
          <span>{c.l}</span>
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
        {m.cur === "USD" && <small>≈ {money(amtMXN(m, fx.rate))}</small>}
      </div>
    </div>
  );
}

/* ===== hoja Agregar / Editar ===== */
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

function AddSheet({
  initial,
  movs,
  rules,
  fx,
  onClose,
  onSubmit,
}: {
  initial: Mov | null;
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
    if (!d.cat) return; // sin categoría
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
          <button
            className={d.t === "out" ? "on" : ""}
            onClick={() => setD((p) => ({ ...p, t: "out", cat: null, real: false, ov: {} }))}
          >
            Gasto
          </button>
          <button
            className={d.t === "in" ? "on" : ""}
            onClick={() => setD((p) => ({ ...p, t: "in", cat: null, real: false, ov: {} }))}
          >
            Ingreso
          </button>
        </div>

        <div className="amt">
          <span className="num" style={{ fontSize: 34, color: "var(--mut)" }}>
            $
          </span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={d.amt}
            onChange={(e) => setD((p) => ({ ...p, amt: e.target.value.replace(/[^0-9.]/g, "") }))}
          />
          <div className="cur">
            <button className={d.cur === "MXN" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "MXN" }))}>
              MXN
            </button>
            <button className={d.cur === "USD" ? "on" : ""} onClick={() => setD((p) => ({ ...p, cur: "USD" }))}>
              USD
            </button>
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
          <input
            type="date"
            value={d.fecha}
            onChange={(e) => setD((p) => ({ ...p, fecha: e.target.value || todayStr(), ov: {} }))}
          />
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
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" onClick={doSave}>
            {edit ? "Guardar cambios" : "Guardar"}
          </button>
        </div>
      </div>

      {usd != null && (
        <UsdModal amt={usd} fx={fx} onCancel={() => setUsd(null)} onDone={(extra) => { setUsd(null); build(extra); }} />
      )}
    </div>
  );
}

/* ===== caja de división del ingreso ===== */
function SplitBox({
  d,
  setD,
  movs,
  rules,
  fx,
  editId,
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
    ["gas", "--navy"],
    ["gastos", "--terra"],
    ["invertir", "--amber"],
    ["emergencia", "--cu"],
  ];
  const setOv = (k: string, val: number) => setD((p) => ({ ...p, ov: { ...p.ov, [k]: val } }));

  return (
    <div className="box">
      <h4>División de este ingreso</h4>
      <div className="hint">
        Primero se llena la gasolina de la semana (te faltan {money(gl)}), lo demás se reparte. Lo puedes mover.
      </div>
      <div className="stack">
        {parts.map(([k, col]) => (
          <i key={k} style={{ ["--c" as string]: `var(${col})`, width: `${(s[k] / t) * 100}%` }} />
        ))}
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--navy)" }}>
        <i />
        <div>
          Gasolina<small>monto fijo</small>
        </div>
        <input
          className="gasin"
          inputMode="decimal"
          value={Math.round(s.gas)}
          onChange={(e) => setOv("gas", parseFloat(e.target.value) || 0)}
        />
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--terra)" }}>
        <i />
        <div>
          Gastos<small>{pg}% de lo que sobra</small>
        </div>
        <b>{money(s.gastos)}</b>
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--amber)" }}>
        <i />
        <div>
          Invertir<small>{100 - pg}% menos emergencia</small>
        </div>
        <b>{money(s.invertir)}</b>
      </div>
      <div className="srow" style={{ ["--c" as string]: "var(--cu)" }}>
        <i />
        <div>
          Emergencia<small>{pe}% de la inversión</small>
        </div>
        <b>{money(s.emergencia)}</b>
      </div>
      <label className="field" style={{ margin: "12px 0 4px" }}>
        <span>
          Gastos / Inversión: <b>{pg} / {100 - pg}</b>
        </span>
        <input type="range" min={0} max={100} step={5} value={pg} onChange={(e) => setOv("pctGastos", +e.target.value)} />
      </label>
      <label className="field" style={{ margin: 0 }}>
        <span>
          De la inversión, a emergencia: <b>{pe}%</b>
        </span>
        <input type="range" min={0} max={50} step={5} value={pe} onChange={(e) => setOv("pctEmerg", +e.target.value)} />
      </label>
    </div>
  );
}

/* ===== popup dólares ===== */
function UsdModal({
  amt,
  fx,
  onCancel,
  onDone,
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
          <b>Los guardo en dólares</b>
          <small>Van a tu bolsa de dólares y se valúan con el TC en vivo.</small>
        </button>
        <button className={`opt${mode === "cambie" ? " on" : ""}`} onClick={() => setMode("cambie")}>
          <b>Los cambié a pesos</b>
          <small>Dime a qué tipo de cambio.</small>
        </button>
        {mode === "cambie" && (
          <label className="field">
            <span>¿A cuánto te los cambiaron?</span>
            <input type="number" step="0.01" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} />
            <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
              Recibiste <b>{money(amt * r)}</b> · vs TC en vivo:{" "}
              <b style={{ color: dif >= 0 ? "var(--teal)" : "var(--terra)" }}>
                {dif >= 0 ? "+" : ""}
                {money(dif)}
              </b>
            </div>
          </label>
        )}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn"
            onClick={() => {
              if (mode === "cambie") {
                if (!r) return;
                onDone({ tc: r });
              } else onDone({});
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
