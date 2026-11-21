"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SwipeRow from "@/components/SwipeRow";
import MovRow from "@/components/MovRow";
import AddSheet from "@/components/AddSheet";
import {
  CATS, DEF_RULES, catOf, amtMXN, money, money2, computeSplit, gasLeft,
  todayStr, fmtDay, fmtD, MESL, weekStart, inWeek, addMonths, addDays, ud, pad, dow,
  type Mov, type Plan, type Rules,
} from "@/lib/model";
import {
  buildAll, stats, totals, metaEmerg, msiSummary, porCobrar, usdWallet, weekCalc,
  planInfo, schedule, firstCorte, pagoDe, monthEnd,
} from "@/lib/calc";
import {
  fetchMovs, fetchPlans, fetchReglas, insertMov, updateMov, deleteMov,
  insertPlan, updatePlan, deletePlan, saveReglas, borrarTodo,
} from "@/lib/db";
import type { Pago } from "@/lib/model";
import Ring from "@/components/Ring";
import { PlanSheet, PlanEditSheet, RulesSheet, CajitaSheet, exportData } from "@/components/sheets";

type Fx = { rate: number; live: boolean };
type Toast = { text: string; actLabel?: string; onAct?: () => void };
const vv = (c: string) => `var(${c})`;
const vs = (c: string) => `var(${c}-s)`;
const sortMovs = (a: Mov[]) =>
  [...a].sort((x, y) => y.fecha.localeCompare(x.fecha) || (y._created || "").localeCompare(x._created || ""));

export default function Dashboard({ email }: { email: string }) {
  const router = useRouter();
  const [movs, setMovs] = useState<Mov[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [rules, setRules] = useState<Rules>(DEF_RULES);
  const [fx, setFx] = useState<Fx>({ rate: 18.4, live: false });
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState(false);
  const [month, setMonth] = useState<string>(todayStr().slice(0, 7));
  const [panel, setPanel] = useState<"dash" | "movs" | "cuentas">("dash");
  const [ctab, setCtab] = useState<"msi" | "cobrar">("msi");
  const [filter, setFilter] = useState("todo");
  const [sheet, setSheet] = useState<{ initial: Mov | null; pre?: Record<string, unknown> } | null>(null);
  const [fxOpen, setFxOpen] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planEditId, setPlanEditId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [cajitaOpen, setCajitaOpen] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const tt = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taps = useRef({ n: 0, t: null as ReturnType<typeof setTimeout> | null });

  useEffect(() => {
    setTheme((document.documentElement.getAttribute("data-theme") as "light" | "dark") || "light");
    (async () => {
      try {
        const [m, pl, r] = await Promise.all([fetchMovs(), fetchPlans(), fetchReglas()]);
        setMovs(sortMovs(m));
        setPlans(pl);
        if (r) setRules(r);
        setLoaded(true);
      } catch {
        setLoadErr(true);
        setLoaded(true);
      }
    })();
    (async () => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 3500);
        const res = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctl.signal });
        clearTimeout(t);
        const j = await res.json();
        if (j?.rates?.MXN) setFx({ rate: j.rates.MXN, live: true });
      } catch {}
    })();
  }, []);

  const ALL = useMemo(() => buildAll(movs, plans), [movs, plans]);
  const today = todayStr();
  const rate = fx.rate;

  function showToast(text: string, actLabel?: string, onAct?: () => void) {
    setToast({ text, actLabel, onAct });
    if (tt.current) clearTimeout(tt.current);
    tt.current = setTimeout(() => setToast(null), actLabel ? 4500 : 2600);
  }
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("feria_theme", next); } catch {}
  }
  async function logout() {
    try { await createClient().auth.signOut(); } catch {}
    router.replace("/login");
  }

  async function onSubmit(m: Mov, editId: string | null) {
    const mov: Mov = { ...m };
    if (mov.t === "in" && mov.real) {
      mov.split = computeSplit(amtMXN(mov, rate), gasLeft(mov.fecha, movs, rules, editId || undefined), rules, mov.ov || {});
    } else delete mov.split;
    try {
      if (editId) {
        const saved = await updateMov(editId, mov);
        setMovs((prev) => sortMovs(prev.map((x) => (x.id === editId ? saved : x))));
        showToast("Cambios guardados");
      } else {
        const saved = await insertMov(mov);
        setMovs((prev) => sortMovs([saved, ...prev]));
        showToast(saved.real && saved.split ? "Guardado y repartido en tus sobres" : "Guardado");
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
          const back = await insertMov(m); // movToRow ignora el id viejo
          setMovs((prev) => sortMovs([back, ...prev]));
        } catch { showToast("No se pudo deshacer."); }
      });
    } catch {
      setMovs((prev) => sortMovs([m, ...prev]));
      showToast("No se pudo borrar.");
    }
  }

  async function doFx(u: number, r: number) {
    const mov: Mov = { id: "tmp", t: "fx", amt: r2n(u * r), cur: "MXN", fecha: today, concepto: "Cambio de dólares", real: false, usd: u, tc: r };
    try {
      const saved = await insertMov(mov);
      setMovs((prev) => sortMovs([saved, ...prev]));
      setFxOpen(false);
      showToast(`Cambiaste ${money(u, "USD")} → ${money(u * r)}`);
    } catch { showToast("No se pudo registrar el cambio."); }
  }

  async function onPlan(p: Plan) {
    try {
      const saved = await insertPlan(p);
      setPlans((prev) => [saved, ...prev]);
      setSheet(null);
      const f = firstCorte(saved.fecha, rules);
      showToast(`${saved.meses} MSI de ${money2(saved.total / saved.meses)} · primer cargo ${fmtD(f)}`);
    } catch { showToast("No se pudo crear el plan."); }
  }
  async function onPago(planIdArg: string, pago: Pago) {
    const p = plans.find((x) => x.id === planIdArg);
    if (!p) return;
    const upd = { ...p, pagos: [...(p.pagos || []), pago] };
    try {
      const saved = await updatePlan(planIdArg, upd);
      setPlans((prev) => prev.map((x) => (x.id === planIdArg ? saved : x)));
      setSheet(null);
      const i = planInfo(saved, rules, today);
      showToast(i.active ? (pago.tipo === "capital" ? `Abonaste ${money2(pago.monto)} a capital` : `Pagaste ${money2(pago.monto)}`) : `Liquidaste ${saved.concepto} 🎉`);
    } catch { showToast("No se pudo registrar el pago."); }
  }
  async function onDelPago(planIdArg: string, pj: number) {
    const p = plans.find((x) => x.id === planIdArg);
    if (!p) return;
    const pagos = [...(p.pagos || [])];
    const [x] = pagos.splice(pj, 1);
    const upd = { ...p, pagos };
    try {
      const saved = await updatePlan(planIdArg, upd);
      setPlans((prev) => prev.map((z) => (z.id === planIdArg ? saved : z)));
      showToast(`Pago borrado: ${p.concepto}`, "Deshacer", async () => {
        try {
          const back = await updatePlan(planIdArg, { ...saved, pagos: [...saved.pagos, x] });
          setPlans((prev) => prev.map((z) => (z.id === planIdArg ? back : z)));
        } catch {}
      });
    } catch { showToast("No se pudo borrar el pago."); }
  }
  async function onDeletePlan(p: Plan) {
    setPlanId(null);
    setPlans((prev) => prev.filter((x) => x.id !== p.id));
    try {
      await deletePlan(p.id);
      showToast(`Plan borrado: ${p.concepto}`);
    } catch {
      setPlans((prev) => [p, ...prev]);
      showToast("No se pudo borrar el plan.");
    }
  }
  async function onSavePlanEdit(id: string, patch: Partial<Plan>) {
    const p = plans.find((x) => x.id === id);
    if (!p) return;
    const upd = { ...p, ...patch };
    try {
      const saved = await updatePlan(id, upd);
      setPlans((prev) => prev.map((x) => (x.id === id ? saved : x)));
      setPlanEditId(null);
      showToast("Plan actualizado");
    } catch { showToast("No se pudo guardar."); }
  }
  async function onSaveRules(r: Rules, manualFx?: number) {
    setRules(r);
    if (manualFx && !fx.live) setFx((f) => ({ ...f, rate: manualFx }));
    try { await saveReglas(r); showToast("Reglas guardadas"); } catch { showToast("No se pudieron guardar las reglas."); }
    setRulesOpen(false);
  }
  async function onBorrarTodo() {
    const oldM = movs, oldP = plans;
    setMovs([]); setPlans([]); setRulesOpen(false);
    try {
      await borrarTodo();
      showToast("Se borró todo", "Deshacer", async () => {
        try {
          for (const m of oldM) await insertMov(m);
          for (const p of oldP) await insertPlan(p);
          const [m, pl] = await Promise.all([fetchMovs(), fetchPlans()]);
          setMovs(sortMovs(m)); setPlans(pl);
        } catch { showToast("No se pudo deshacer del todo."); }
      });
    } catch { setMovs(oldM); setPlans(oldP); showToast("No se pudo borrar."); }
  }
  function brandTap() {
    const s = taps.current;
    s.n++;
    if (s.t) clearTimeout(s.t);
    s.t = setTimeout(() => { s.n = 0; }, 600);
    if (s.n >= 3) { s.n = 0; setCajitaOpen(true); }
  }

  return (
    <div className="app">
      <header className="flex items-center justify-between mt-0.5 mb-3.5">
        <button className="num font-bold text-[28px] leading-none tracking-tight text-left" onClick={brandTap}>
          Feria
          <span className="block font-sans text-xs font-semibold text-mut tracking-normal mt-0.5">Tu mes de un vistazo</span>
        </button>
        <div className="flex gap-1.5">
          <button className="ib" aria-label="Modo oscuro" onClick={toggleTheme}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
          </button>
          <button className="ib" aria-label="Reglas" onClick={() => setRulesOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
          </button>
          <button className="ib" aria-label="Cerrar sesión" onClick={logout} title={email}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 17l5-5-5-5M21 12H9M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></svg>
          </button>
        </div>
      </header>

      {!loaded ? (
        <div className="empty">Cargando…</div>
      ) : loadErr ? (
        <div className="empty">No se pudo cargar. Revisa tu conexión y recarga.</div>
      ) : panel === "movs" ? (
        <MovsPanel
          ALL={ALL} rate={rate} today={today} filter={filter} setFilter={setFilter}
          onBack={() => setPanel("dash")}
          onEdit={(m) => setSheet({ initial: m })}
          onDelete={removeMov}
          onToast={showToast}
        />
      ) : panel === "cuentas" ? (
        <CuentasPanel
          ALL={ALL} plans={plans} rules={rules} today={today} rate={rate} ctab={ctab} setCtab={setCtab}
          onBack={() => setPanel("dash")}
          onCobrar={(p) => setSheet({ initial: null, pre: { t: "in", cat: "reemb_" + p } })}
          onNewMsi={() => setSheet({ initial: null, pre: { t: "out", msi: true } })}
          onOpenPlan={(id) => setPlanId(id)}
          onPayNext={(pid, falta) => setSheet({ initial: null, pre: { t: "out", cat: "pago_msi", planId: pid, amt: String(falta) } })}
        />
      ) : (
        <DashView
          ALL={ALL} movs={movs} plans={plans} rules={rules} fx={fx} today={today}
          month={month} setMonth={setMonth}
          onMovs={() => setPanel("movs")}
          onMsi={() => { setCtab("msi"); setPanel("cuentas"); }}
          onCobrar={() => { setCtab("cobrar"); setPanel("cuentas"); }}
          onFx={() => setFxOpen(true)}
          onEditMov={(m) => setSheet({ initial: m })}
          onToast={showToast}
        />
      )}

      <button className="fab" aria-label="Agregar" onClick={() => setSheet({ initial: null })}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
      </button>

      <div className={`scrim${sheet || fxOpen || planId || planEditId || rulesOpen || cajitaOpen ? " on" : ""}`}
        onClick={() => { setSheet(null); setFxOpen(false); setPlanId(null); setPlanEditId(null); setRulesOpen(false); setCajitaOpen(false); }} />
      {sheet && (
        <AddSheet initial={sheet.initial} pre={sheet.pre as never} movs={movs} plans={plans} rules={rules} fx={fx}
          pc={porCobrar(ALL, plans, rules, today, rate)} today={today}
          onClose={() => setSheet(null)} onMov={onSubmit} onPlan={onPlan} onPago={onPago} onToast={showToast} />
      )}
      {fxOpen && <FxModal wallet={usdWallet(movs)} fx={fx} onCancel={() => setFxOpen(false)} onDone={doFx} />}
      {planId && (() => {
        const p = plans.find((x) => x.id === planId);
        return p ? (
          <PlanSheet p={p} rules={rules} today={today} onClose={() => setPlanId(null)}
            onPay={(falta) => { setPlanId(null); setSheet({ initial: null, pre: { t: "out", cat: "pago_msi", planId: p.id, amt: String(falta) } }); }}
            onCapital={() => { setPlanId(null); setSheet({ initial: null, pre: { t: "out", cat: "capital", planId: p.id } }); }}
            onEdit={() => { setPlanEditId(p.id); setPlanId(null); }}
            onDelete={() => onDeletePlan(p)} onDelPago={(pj) => onDelPago(p.id, pj)} />
        ) : null;
      })()}
      {planEditId && (() => {
        const p = plans.find((x) => x.id === planEditId);
        return p ? <PlanEditSheet p={p} onClose={() => setPlanEditId(null)} onSave={(patch) => onSavePlanEdit(p.id, patch)} /> : null;
      })()}
      {rulesOpen && <RulesSheet rules={rules} fx={fx} onClose={() => setRulesOpen(false)} onSave={onSaveRules} onExport={() => exportData(movs, plans, rules)} onBorrar={onBorrarTodo} />}
      {cajitaOpen && <CajitaSheet ALL={ALL} rules={rules} today={today} rate={rate} onClose={() => setCajitaOpen(false)} onUse={() => { setCajitaOpen(false); setSheet({ initial: null, pre: { t: "out", cat: "cajita", real: true } }); }} />}

      <div className={`toast${toast ? " on" : ""}`}>
        {toast && (
          <>
            <span>{toast.text}</span>
            {toast.actLabel && (
              <button onClick={() => { const fn = toast.onAct; setToast(null); fn?.(); }}>{toast.actLabel}</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const r2n = (n: number) => Math.round(n * 100) / 100;
const pct = (x: number) => `${Math.round(x)}%`;

/* ===== Dashboard mensual ===== */
function DashView({
  ALL, movs, plans, rules, fx, today, month, setMonth,
  onMovs, onMsi, onCobrar, onFx, onEditMov, onToast,
}: {
  ALL: Mov[]; movs: Mov[]; plans: Plan[]; rules: Rules; fx: Fx; today: string;
  month: string; setMonth: (m: string) => void;
  onMovs: () => void; onMsi: () => void; onCobrar: () => void; onFx: () => void;
  onEditMov: (m: Mov) => void; onToast: (t: string) => void;
}) {
  const rate = fx.rate, R = rules, cm = today.slice(0, 7);
  const mo = month > cm ? cm : month;
  const isNowM = mo === cm;
  const [y, mm] = mo.split("-").map(Number);
  const mEnd = monthEnd(mo);
  const st = stats(ALL, (m) => m.fecha.startsWith(mo), rate);
  const T = totals(ALL, R, today, rate);
  const ME = metaEmerg(ALL, today, rate);
  const ms = msiSummary(plans, R, today);
  const pc = porCobrar(ALL, plans, R, today, rate);
  const usd = usdWallet(movs);
  const ws = weekStart(today);
  const wc = weekCalc(ALL, R, today, rate, ws);
  const filled = R.gasSemana - gasLeft(ws, movs, R);
  const sobro = st.ingReal - st.gasReal - st.inv - st.ahorro;
  const prevMo = addMonths(mo + "-01", -1, 1).slice(0, 7);
  const firstMo = ALL.reduce((a, m) => (m.fecha < a ? m.fecha : a), today).slice(0, 7);
  const prev = stats(ALL, (m) => m.fecha.startsWith(prevMo), rate);
  const base = Math.max(st.ingReal, st.gasReal + st.inv + st.ahorro, 1);
  const flow: [string, string, number][] = [
    ["--terra", "Gastos", st.gasReal], ["--amber", "GBM", st.inv],
    ["--cu", "Emergencia", st.ahorro], ["--teal", "Sobró", Math.max(0, sobro)],
  ];
  const weeks: string[] = [];
  for (let w = weekStart(mo + "-01"); w <= mEnd && w <= today; w = addDays(w, 7)) weeks.push(w);
  const wv = weeks.map((w) => { const x = stats(ALL, (z) => inWeek(z, w) && z.fecha.startsWith(mo), rate); return { w, i: x.ingReal, g: x.gasReal }; });
  const wmx = Math.max(1, ...wv.map((x) => Math.max(x.i, x.g)));
  const cats = Object.entries(st.catOut).filter(([k]) => CATS.out[k]).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const cmx = Math.max(1, ...cats.map((c) => c[1]));
  let qIn = 0, qOut = 0;
  ALL.forEach((m) => {
    if (!m.fecha.startsWith(mo)) return;
    if (m.t === "in" && m.split) qIn += m.split.gastos;
    if (m.t === "out" && CATS.out[m.cat as string]?.sobre === "gastos") qOut += amtMXN(m, rate);
  });
  T.W.forEach((w) => { if (w.overflow > 0 && ALL.some((m) => m.t === "out" && m.cat === "gasolina" && inWeek(m, w.ws) && m.fecha.startsWith(mo))) qOut += w.overflow; });
  const qBal = qIn - qOut;
  const diasMes = isNowM ? (ud(mEnd).getTime() - ud(today).getTime()) / 864e5 + 1 : 0;
  const porDia = qBal > 0 && diasMes ? qBal / diasMes : 0;
  const gasOk = wc.sp.gas > 0;
  const msiDays = ms.next ? Math.round((ud(pagoDe(ms.next, R)).getTime() - ud(today).getTime()) / 864e5) : null;
  const msiWarn = !!ms.next && !ms.vencida && msiDays != null && msiDays <= 3 && msiDays >= 0;
  let racha = 0;
  { const W = T.W.filter((w) => w.closed && (w.a.gastos > 0 || w.spentG > 0)); for (let i = W.length - 1; i >= 0; i--) { if (W[i].bal >= -0.5) racha++; else break; } }
  const dayN = +today.slice(8, 10), dim = +mEnd.slice(8, 10);
  const projG = isNowM && dayN ? (st.gasReal / dayN) * dim : st.gasReal;
  const projSob = st.ingReal - projG - st.inv - st.ahorro;
  const byDay: Record<string, number> = {};
  ALL.forEach((m) => { if (m.t === "out" && m.real && m.fecha.startsWith(mo)) { const c = CATS.out[m.cat as string]; if (!c.inv && !c.save) byDay[m.fecha] = (byDay[m.fecha] || 0) + amtMXN(m, rate); } });
  const dmx = Math.max(1, ...Object.values(byDay));
  const pad0 = ud(mo + "-01").getUTCDay();
  const ult = ALL.filter((m) => m.fecha.startsWith(mo)).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b._created || "").localeCompare(a._created || "")).slice(0, 6);
  const comDiff = prev.comida ? st.comida / prev.comida - 1 : null;
  const faltaInv = Math.max(0, T.invProj - T.invEf);
  const invDone = T.invProj > 0 && faltaInv <= 0.5;
  const emDone = T.emProj > 0 && T.emEf >= T.emProj - 0.5;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="monthnav">
          <button disabled={mo <= firstMo} onClick={() => setMonth(addMonths(mo + "-01", -1, 1).slice(0, 7))}>‹</button>
          <b>{MESL[mm - 1]} {y}</b>
          <button disabled={isNowM} onClick={() => { if (!isNowM) setMonth(addMonths(mo + "-01", 1, 1).slice(0, 7)); }}>›</button>
        </div>
        {!isNowM && <button className="btn sm ghost" onClick={() => setMonth(cm)}>Ir a hoy</button>}
      </div>

      <div className="bento">
        {/* El big one */}
        <div className="tile s2 r2">
          <div className="lbl">El big one · {MESL[mm - 1].toLowerCase()}</div>
          <div className="s">Te sobró</div>
          <div className={`big${sobro < 0 ? " neg" : ""}`}>{money(sobro)}</div>
          <div className="kv3">
            <div><span>Ingresos</span><b className="pos">{money(st.ingReal)}</b></div>
            <div><span>Gastos</span><b className="neg">{money(st.gasReal)}</b></div>
            <div><span>GBM + emerg.</span><b style={{ color: "var(--amber)" }}>{money(st.inv + st.ahorro)}</b></div>
          </div>
          <div className="lbl" style={{ marginTop: 8 }}>A dónde se fue cada peso</div>
          <div className="flow">{flow.map(([c, , x], i) => <i key={i} style={{ ["--c" as string]: vv(c), width: `${(x / base) * 100}%` }} />)}</div>
          <div className="legend">{flow.map(([c, l, x], i) => <span key={i} style={{ ["--c" as string]: vv(c) }}>{l} {st.ingReal ? pct((x / st.ingReal) * 100) : "—"}</span>)}</div>
          <div className="s" style={{ marginTop: 4 }}>
            {st.msi ? `Incluye ${money(st.msi)} de MSI tuyos. ` : ""}
            {prev.ingReal || prev.gasReal ? `Mes pasado: ingresos ${money(prev.ingReal)} · gastos ${money(prev.gasReal)}` : ""}
          </div>
        </div>

        {/* Te queda para gastar */}
        {isNowM ? (
          <div className="tile s2">
            <div className="lbl">Te queda para gastar · {MESL[mm - 1].toLowerCase()}</div>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div className={`big${qBal < 0 ? " neg" : ""}`}>{money(qBal)}</div>
              <div className="s" style={{ textAlign: "right" }}>
                {qBal > 0 ? <>≈ {money(porDia)} al día<br />{diasMes} día{diasMes > 1 ? "s" : ""} para cerrar el mes</> : qBal < 0 ? <>te pasaste del sobre<br />este mes</> : ""}
              </div>
            </div>
            <div className="s">Entraron {money(qIn)} al sobre de Gastos y gastaste {money(qOut)}.{wc.bal < 0 ? ` Esta semana vas ${money(-wc.bal)} pasado.` : ` Esta semana te quedan ${money(wc.bal)}.`}</div>
          </div>
        ) : (
          <div className="tile s2">
            <div className="lbl">Así cerró el sobre · {MESL[mm - 1].toLowerCase()}</div>
            <div className={`big${qBal < 0 ? " neg" : ""}`}>{money(qBal)}</div>
            <div className="s">Entraron {money(qIn)} al sobre de Gastos y gastaste {money(qOut)}.</div>
          </div>
        )}

        {/* Gasolina */}
        <div className={`tile acc${gasOk ? " ok" : ""}`} style={{ ["--c" as string]: "var(--navy)" }}>
          {gasOk && <span className="chk">✓</span>}
          <div className="lbl">Gasolina</div>
          <div className="n">{money(wc.gasAvail)}</div>
          <div className="s">Apartado {money(filled)} de {money(R.gasSemana)}{wc.sp.gas > 0 ? ` · pagaste ${money(wc.sp.gas)}` : ""}</div>
          <div className="bar"><i style={{ width: `${Math.min(100, (filled / R.gasSemana) * 100)}%` }} /></div>
        </div>

        {/* Próximo cargo MSI */}
        <button className={`tile acc${msiWarn ? " warn" : ""}`} style={{ ["--c" as string]: vv(msiWarn ? "--amber" : "--wine") }} onClick={onMsi}>
          <span className="go">→</span>
          <div className="lbl">Próximo cargo</div>
          <div className="n">{money(ms.nextAmt)}</div>
          <div className="s">{ms.next ? <>{ms.vencida && <b style={{ color: "var(--del)" }}>Vencida · </b>}corte {fmtD(ms.next)} · pagas antes del {fmtD(pagoDe(ms.next, R))}</> : "Sin planes activos"}</div>
          <div className="s">{msiWarn ? <b style={{ color: "var(--amber)" }}>{msiDays === 0 ? "Hoy es el último día de pago" : `Faltan ${msiDays} día${(msiDays || 0) > 1 ? "s" : ""} para pagar`}</b> : `Falta pagar ${money(ms.left)}`}</div>
        </button>

        {/* Invertir */}
        <div className={`tile${invDone ? " ok" : ""}`}>
          {invDone && <span className="chk">✓</span>}
          <div className="lbl">Invertir</div>
          <div className="ringrow"><Ring frac={T.invProj ? Math.min(1, T.invEf / T.invProj) : 0} color="--amber" /><div><div className="n">{money(T.invEf)}</div><div className="s">de {money(T.invProj)} proyectado</div></div></div>
          <div className="s">{faltaInv > 0.5 ? `Te faltan ${money(faltaInv)} por invertir` : "Al corriente ✓"}</div>
        </div>

        {/* Emergencia */}
        <div className={`tile${emDone ? " ok" : ""}`}>
          {emDone && <span className="chk">✓</span>}
          <div className="lbl">Emergencia</div>
          <div className="ringrow"><Ring frac={ME.meta > 0 ? Math.min(1, T.emEf / ME.meta) : 0} color="--cu" /><div><div className="n">{money(T.emEf)}</div><div className="s">{ME.meta > 0 ? `meta ${money(ME.meta)}` : "meta: aún sin gastos"}</div></div></div>
          <div className="s">Proyectado {money(T.emProj)} · 6 meses de gastos</div>
        </div>

        {/* Semana por semana */}
        <div className="tile s2">
          <div className="row"><div className="lbl">Semana por semana</div><div className="legend"><span style={{ ["--c" as string]: "var(--teal)" }}>Ingresos</span><span style={{ ["--c" as string]: "var(--terra)" }}>Gastos</span></div></div>
          {wv.length ? (
            <div className="wk">{wv.map((x) => (
              <div key={x.w} className={`wkc${x.w === ws ? " now" : ""}`}>
                <div className="bars"><i style={{ height: `${(x.i / wmx) * 100}%`, background: "var(--teal)" }} /><i style={{ height: `${(x.g / wmx) * 100}%`, background: "var(--terra)" }} /></div>
                <small>{fmtD(x.w)}</small>
              </div>
            ))}</div>
          ) : <div className="empty">Sin semanas</div>}
        </div>

        {/* Salidas por categoría */}
        <div className="tile s2">
          <div className="lbl">Salidas por categoría</div>
          {cats.length ? cats.map(([k, x]) => { const c = CATS.out[k]; return (
            <div key={k} className="hb" style={{ ["--c" as string]: vv(c.c), margin: "2px 0" }}>
              <div className="row"><span>{c.l}{!c.real && !c.inv && !c.save && <span className="pill" style={{ ["--c" as string]: "var(--mut)", ["--cs" as string]: "var(--bg)" }}> wagered</span>}</span><span className="num" style={{ fontSize: 14 }}>{money(x)}</span></div>
              <div className="bar"><i style={{ width: `${(x / cmx) * 100}%` }} /></div>
            </div>
          ); }) : <div className="empty" style={{ padding: 16 }}>Todavía no hay gastos este mes</div>}
        </div>

        {/* Por cobrar */}
        <button className="tile acc" style={{ ["--c" as string]: "var(--wine)" }} onClick={onCobrar}>
          <span className="go">→</span>
          <div className="lbl">Por cobrar</div>
          <div className="n" style={{ color: "var(--wine)" }}>{money(pc.mama.pend + pc.externo.pend)}</div>
          <div className="s">Mamá {money(pc.mama.pend)} · Externos {money(pc.externo.pend)}</div>
        </button>

        {/* Dólares */}
        <div className="tile">
          <div className="row"><div className="lbl">Dólares</div><span className="tc" style={{ ["--c" as string]: vv(fx.live ? "--teal" : "--amber") }}><i />{fx.rate.toFixed(2)}</span></div>
          <div className="n">{money(usd, "USD")}</div><div className="s">≈ {money(usd * fx.rate)} MXN</div>
          <button className="btn sm ghost" disabled={usd <= 0} style={{ alignSelf: "flex-start" }} onClick={onFx}>Cambiar</button>
        </div>

        {/* Eat/drink */}
        <div className="tile">
          <div className="lbl">Eat/drink del mes</div><div className="n">{money(st.comida)}</div>
          <div className="s" style={{ color: vv(comDiff == null ? "--mut" : comDiff <= 0.1 ? "--teal" : "--terra"), fontWeight: 700 }}>
            {comDiff == null ? "Sin mes anterior para comparar" : comDiff <= 0 ? `${pct(-comDiff * 100)} menos que el mes pasado` : `${pct(comDiff * 100)} más que el mes pasado`}
          </div>
        </div>

        {/* Racha */}
        <div className="tile">
          <div className="lbl">Racha</div>
          <div className="n">{racha} semana{racha === 1 ? "" : "s"}</div>
          <div className="s">{racha ? "seguidas sin pasarte del sobre" : "Cierra una semana sin pasarte del sobre para empezarla"}</div>
        </div>

        {/* Wagered */}
        <div className="tile s2">
          <div className="lbl">Wagered · todo lo que se movió</div>
          <div className="row"><div><div className="s">Entró</div><div className="n pos">+{money(st.wIn)}</div></div><div style={{ textAlign: "right" }}><div className="s">Salió</div><div className="n neg">−{money(st.wOut)}</div></div></div>
          <div className="flow" style={{ background: "var(--terra-s)" }}><i style={{ ["--c" as string]: "var(--teal)", width: `${st.wIn + st.wOut ? (st.wIn / (st.wIn + st.wOut)) * 100 : 50}%` }} /></div>
          <div className="s">Pesos {money(st.inMXN)} · dólares {money(st.inUSD, "USD")} guardados</div>
        </div>

        {/* Últimos movimientos */}
        <div className="tile s4">
          <div className="row"><div className="lbl">Últimos movimientos</div><button className="btn sm ghost" onClick={onMovs}>Ver todos →</button></div>
          {ult.length ? (
            <div className="mini">{ult.map((m) => {
              const c = catOf(m), sign = m.t === "in" ? "+" : m.t === "out" ? "−" : "⇄";
              const cls = m.t === "fx" || (!m.real && !c.inv && !c.save) ? "muted" : m.t === "in" ? "pos" : "neg";
              return (
                <div key={m.id} className="r" onClick={() => { if (!m.gen && m.t !== "fx") onEditMov(m); }}>
                  <div className="dot" style={{ ["--c" as string]: vv(c.c), ["--cs" as string]: vs(c.c) }}>{c.ab}</div>
                  <div className="tx"><b>{m.concepto || c.l}</b><small>{c.l} · {fmtD(m.fecha)}</small></div>
                  <div className={`am ${cls}`}>{sign}{m.t === "fx" ? money((m.usd || 0) * (m.tc || 0)) : money(m.amt, m.cur)}</div>
                </div>
              );
            })}</div>
          ) : <div className="empty">Aquí van a salir tus movimientos. Dale al + para empezar.</div>}
        </div>

        {/* Proyección */}
        <div className="tile s4">
          <div className="lbl">{isNowM ? "Proyección de cierre" : "Cierre del mes"}</div>
          {isNowM ? (st.gasReal ? (
            <>
              <div className="s">Si sigues gastando como hasta hoy ({money(st.gasReal / dayN)} al día):</div>
              <div className="kv3"><div><span>Gastos a fin de mes</span><b className="neg">{money(projG)}</b></div><div><span>Te sobraría</span><b className={projSob < 0 ? "neg" : "pos"}>{money(projSob)}</b></div><div><span>Vs. mes pasado</span><b>{prev.gasReal ? `${projG > prev.gasReal ? "+" : "−"}${Math.abs(Math.round((projG / prev.gasReal - 1) * 100))}%` : "—"}</b></div></div>
            </>
          ) : <div className="s">Cuando registres gastos, aquí te digo con cuánto vas a cerrar el mes.</div>) : (
            <div className="kv3"><div><span>Gastos</span><b className="neg">{money(st.gasReal)}</b></div><div><span>Te sobró</span><b className={sobro < 0 ? "neg" : "pos"}>{money(sobro)}</b></div><div><span>Ingresos</span><b className="pos">{money(st.ingReal)}</b></div></div>
          )}
        </div>

        {/* Calendario */}
        <div className="tile s4">
          <div className="row"><div className="lbl">Calendario de gastos</div><div className="s">Más oscuro = gastaste más</div></div>
          <div className="heat">
            {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => <div key={"h" + i} className="h">{d}</div>)}
            {Array.from({ length: pad0 }, (_, i) => <i key={"p" + i} />)}
            {Array.from({ length: dim }, (_, i) => {
              const dd = `${mo}-${pad(i + 1)}`, x = byDay[dd] || 0, k = x ? 0.15 + (0.85 * x) / dmx : 0;
              return (
                <button key={dd} className={`${k > 0.55 ? "hot" : ""} ${dd === today ? "today" : ""} ${dd > today ? "fut" : ""}`} style={{ ["--i" as string]: k.toFixed(2) }}
                  onClick={() => onToast(`${fmtDay(dd)}: ${x ? money(x) + " de gastos" : "sin gastos"}`)}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== panel Movimientos ===== */
const FILTERS: [string, string][] = [
  ["todo", "Todo"], ["in", "Ingresos"], ["out", "Gastos"], ["isra", "Solo Isra"],
  ["mama", "Mamá"], ["externo", "Externos"], ["msi", "MSI"], ["usd", "Dólares"],
];
function MovsPanel({
  ALL, rate, today, filter, setFilter, onBack, onEdit, onDelete, onToast,
}: {
  ALL: Mov[]; rate: number; today: string; filter: string; setFilter: (f: string) => void;
  onBack: () => void; onEdit: (m: Mov) => void; onDelete: (m: Mov) => void; onToast: (t: string) => void;
}) {
  const f = filter;
  const ok = (m: Mov) =>
    f === "todo" || (f === "in" && m.t === "in") || (f === "out" && m.t === "out") ||
    (f === "isra" && m.real) || (f === "msi" && !!m.gen) ||
    (f === "usd" && (m.cur === "USD" || m.t === "fx" || !!m.usd)) ||
    ((f === "mama" || f === "externo") && m.t !== "fx" && catOf(m).cobro === f);
  const list = ALL.filter(ok).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b._created || "").localeCompare(a._created || ""));
  const out: React.ReactNode[] = [];
  let last = "";
  list.forEach((m) => {
    if (m.fecha !== last) { out.push(<div className="day" key={"d" + m.fecha}>{m.fecha === today ? "Hoy · " : ""}{fmtDay(m.fecha)}</div>); last = m.fecha; }
    out.push(
      <SwipeRow key={m.id}
        onTap={() => { if (m.gen) onToast("Pago MSI: se maneja en Tarjeta → MSI"); else if (m.t === "fx") onToast("Cambio de dólares: deslízalo para borrarlo"); else onEdit(m); }}
        onDelete={() => { if (m.gen) onToast("Pago MSI: se maneja en Tarjeta → MSI"); else onDelete(m); }}
      >
        <MovRow m={m} rate={rate} />
      </SwipeRow>
    );
  });
  return (
    <div>
      <button className="back" onClick={onBack}>← Dashboard</button>
      <h2 className="sec">Movimientos</h2>
      <div className="chips">{FILTERS.map(([k, l]) => <button key={k} className={`chip${f === k ? " on" : ""}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="muted" style={{ fontSize: 12, margin: "-4px 2px 4px" }}>Toca para editar · desliza a la izquierda para borrar</div>
      {list.length ? out : <div className="empty">Nada por aquí todavía.</div>}
    </div>
  );
}

/* ===== panel Tarjeta (lectura) ===== */
function CuentasPanel({
  ALL, plans, rules, today, rate, ctab, setCtab, onBack, onCobrar, onNewMsi, onOpenPlan, onPayNext,
}: {
  ALL: Mov[]; plans: Plan[]; rules: Rules; today: string; rate: number;
  ctab: "msi" | "cobrar"; setCtab: (t: "msi" | "cobrar") => void;
  onBack: () => void; onCobrar: (p: "mama" | "externo") => void;
  onNewMsi: () => void; onOpenPlan: (id: string) => void; onPayNext: (pid: string, falta: number) => void;
}) {
  const ms = msiSummary(plans, rules, today);
  const pc = porCobrar(ALL, plans, rules, today, rate);
  const P = plans.map((p) => ({ p, i: planInfo(p, rules, today) })).sort((a, b) => b.p.fecha.localeCompare(a.p.fecha));
  const act = P.filter((x) => x.i.active), past = P.filter((x) => !x.i.active);
  return (
    <div>
      <button className="back" onClick={onBack}>← Dashboard</button>
      <h2 className="sec">Tarjeta</h2>
      <div className="seg2"><button className={ctab === "msi" ? "on" : ""} onClick={() => setCtab("msi")}>MSI</button><button className={ctab === "cobrar" ? "on" : ""} onClick={() => setCtab("cobrar")}>Por cobrar</button></div>
      {ctab === "msi" ? (
        <>
          <div className="card">
            <div className="lbl">Próximo cargo</div>
            <div className="num" style={{ fontSize: 40, fontWeight: 600, margin: "4px 0" }}>{money2(ms.nextAmt)}</div>
            <div className="muted" style={{ fontSize: 13 }}>{ms.next ? <>{ms.vencida && <b style={{ color: "var(--del)" }}>Vencida · </b>}Corte {fmtDay(ms.next)} · pagas antes del {fmtDay(pagoDe(ms.next, rules))}</> : "No hay mensualidades pendientes"}</div>
            {ms.next && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { const cu = ms.by[ms.next!][0]; onPayNext(cu.p.id, cu.falta); }}>Pagar mensualidad</button>}
            <div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}><span className="muted" style={{ fontWeight: 700, fontSize: 13 }}>Total que falta pagar</span><b className="num" style={{ fontSize: 18 }}>{money2(ms.left)}</b></div>
          </div>
          <div className="card">
            <div className="row"><div className="lbl">Planes activos</div><button className="btn sm ghost" onClick={onNewMsi}>+ Compra a MSI</button></div>
            {act.length ? act.map(({ p, i }) => { const c = CATS.out[p.cat]; return (
              <button key={p.id} className="plan" onClick={() => onOpenPlan(p.id)}>
                <Ring frac={i.frac} color={c.c} />
                <div className="t"><b>{p.concepto}</b><small>{c.l} · {i.nPaid} de {p.meses} pagadas{i.next?.vencida ? " · vencida" : ""} · compra {fmtD(p.fecha)}</small></div>
                <div className="a"><b>{money2(i.next ? i.next.falta : 0)}</b><small>faltan {money2(i.rem)}</small></div>
              </button>
            ); }) : <div className="empty">Sin planes activos</div>}
          </div>
          {past.length > 0 && (
            <div className="card"><div className="lbl">Liquidados</div>{past.map(({ p, i }) => { const c = CATS.out[p.cat]; return (
              <button key={p.id} className="plan" onClick={() => onOpenPlan(p.id)}><Ring frac={i.frac} color={c.c} /><div className="t"><b>{p.concepto}</b><small>{c.l} · Liquidado · compra {fmtD(p.fecha)}</small></div><div className="a"><b>{money2(p.total)}</b><small>total</small></div></button>
            ); })}</div>
          )}
          <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>Corte el {rules.corte} · pago límite el {rules.pagoDia}</div>
        </>
      ) : (
        <>
          <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>Lo que pagas con tu tarjeta por alguien más. Cuenta para wagered, no para ti, y se queda aquí hasta que te lo repongan.</p>
          {(["mama", "externo"] as const).map((p) => {
            const d = pc[p], l = p === "mama" ? "Mamá" : "Externos";
            const pend = d.items.filter((i) => i.falta > 0.5);
            const pl = d.planes.filter((x) => x.falta > 0.5 || x.i.active);
            return (
              <div className="card" key={p}>
                <div className="row"><div><div className="lbl">{l}</div><div className="num" style={{ fontSize: 34, fontWeight: 600, color: "var(--wine)" }}>{money(d.pend)}</div></div><button className="btn sm" onClick={() => onCobrar(p)}>Ya me pagó</button></div>
                {d.viene > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wine)", marginTop: 4 }}>+ {money(d.viene)} que vienen en mensualidades MSI</div>}
                <div className="lbl" style={{ marginTop: 14 }}>Gastos sueltos · {money(d.pendS)}</div>
                {pend.length ? (
                  <table style={{ marginTop: 4 }}><tbody><tr><th>Pendiente</th><th>Falta</th></tr>{pend.map((i, k) => (
                    <tr key={k}><td>{i.m.concepto}<br /><small className="muted">{fmtDay(i.m.fecha)}</small></td><td className="num" style={{ color: "var(--wine)", fontSize: 15 }}>{money(i.falta)}</td></tr>
                  ))}</tbody></table>
                ) : <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{d.items.length ? "Todo cobrado ✓" : "Nada pendiente"}</div>}
                {pl.length > 0 && (
                  <>
                    <div className="lbl" style={{ marginTop: 14 }}>MSI · {money(d.pendM)}</div>
                    {pl.map((x) => (
                      <div key={x.p.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                        <div className="row"><b>{x.p.concepto}</b><span className="num" style={{ fontSize: 16, color: "var(--wine)" }}>{money(Math.max(0, x.pend))}</span></div>
                        <div className="bar" style={{ ["--c" as string]: "var(--teal)" }}><i style={{ width: `${Math.min(100, (x.pag / x.p.total) * 100)}%` }} /></div>
                        <div className="row muted" style={{ fontSize: 12, marginTop: 4 }}><span>Te ha pagado {money(x.pag)} de {money(x.p.total)}</span></div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ===== cambiar dólares ===== */
function FxModal({ wallet, fx, onCancel, onDone }: { wallet: number; fx: Fx; onCancel: () => void; onDone: (u: number, r: number) => void; }) {
  const [u, setU] = useState(String(Math.max(0, Math.round(wallet))));
  const [tc, setTc] = useState((fx.rate - 0.3).toFixed(2));
  const [on, setOn] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id); }, []);
  const uu = parseFloat(u) || 0, r = parseFloat(tc) || 0, dif = uu * (r - fx.rate);
  return (
    <div className={`modal${on ? " on" : ""}`}>
      <div className="mb">
        <h3>Cambiar dólares</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 13 }}>Tienes {money(wallet, "USD")}. No cuenta como ingreso: solo mueve tu feria de dólares a pesos.</p>
        <label className="field"><span>Dólares a cambiar</span><input type="number" inputMode="decimal" value={u} onChange={(e) => setU(e.target.value)} /></label>
        <label className="field"><span>Tipo de cambio que te dieron</span><input type="number" step="0.01" inputMode="decimal" value={tc} onChange={(e) => setTc(e.target.value)} /></label>
        <div className="muted" style={{ fontSize: 13, margin: "-4px 0 12px" }}>Recibes <b>{money(uu * r)}</b> · vs TC en vivo: <b style={{ color: dif >= 0 ? "var(--teal)" : "var(--terra)" }}>{dif >= 0 ? "+" : ""}{money(dif)}</b></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn" onClick={() => { if (!uu || uu > wallet + 0.001 || !r) return; onDone(uu, r); }}>Cambiar</button>
        </div>
      </div>
    </div>
  );
}
