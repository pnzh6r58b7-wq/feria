// Agregaciones y MSI. Portado 1:1 del dashboard aprobado, parametrizado
// (sin estado global): recibe movs/plans/rules/today/rate.
import {
  CATS,
  amtMXN,
  weekStart,
  inWeek,
  addDays,
  addMonths,
  ud,
  r2,
  type Mov,
  type Plan,
  type Rules,
} from "@/lib/model";

/* movimientos generados desde los planes (pagos), NO viven en BD */
export function genMovs(plans: Plan[]): Mov[] {
  const out: Mov[] = [];
  plans.forEach((p) =>
    (p.pagos || []).forEach((x, j) =>
      out.push({
        id: `k${p.id}_${j}`,
        gen: x.tipo,
        plan: p.id,
        pj: j,
        t: "out",
        cat: p.cat,
        amt: x.monto,
        cur: "MXN",
        fecha: x.fecha,
        concepto: `${x.tipo === "capital" ? "Pago a capital" : "Pago MSI"} · ${p.concepto}`,
        real: p.real,
        _created: `${x.fecha}T23:59:${String(50 + Math.min(9, j)).padStart(2, "0")}`,
      })
    )
  );
  return out;
}
export const buildAll = (movs: Mov[], plans: Plan[]): Mov[] => [...movs, ...genMovs(plans)];

/* ===== MSI ===== */
export function firstCorte(fecha: string, R: Rules) {
  const d = ud(fecha).getUTCDate();
  return addMonths(fecha.slice(0, 8) + "01", d <= R.corte ? 0 : 1, R.corte);
}
export const pagoDe = (corte: string, R: Rules) => addMonths(corte.slice(0, 8) + "01", 1, R.pagoDia);

export type Cuota = {
  k: number;
  date: string;
  pago: string;
  amt: number;
  pagado: number;
  falta: number;
  done: boolean;
  vencida: boolean;
};
export function schedule(p: Plan, R: Rules, today: string): Cuota[] {
  const f = firstCorte(p.fecha, R),
    n = p.meses,
    base = r2(p.total / n);
  const amts: number[] = [];
  for (let k = 0; k < n; k++) amts.push(k === n - 1 ? r2(p.total - base * (n - 1)) : base);
  const pg = p.pagos || [];
  let cap = pg.filter((x) => x.tipo === "capital").reduce((a, x) => a + x.monto, 0);
  for (let k = n - 1; k >= 0 && cap > 0.004; k--) {
    const t = Math.min(amts[k], cap);
    amts[k] = r2(amts[k] - t);
    cap -= t;
  }
  let paid = pg.filter((x) => x.tipo !== "capital").reduce((a, x) => a + x.monto, 0);
  return amts.map((amt, k) => {
    const date = addMonths(f.slice(0, 8) + "01", k, R.corte),
      pago = pagoDe(date, R),
      cub = Math.min(amt, paid);
    paid -= cub;
    const falta = r2(amt - cub);
    return { k, date, pago, amt, pagado: cub, falta, done: falta <= 0.004, vencida: falta > 0.004 && pago < today };
  });
}
export function planInfo(p: Plan, R: Rules, today: string) {
  const s = schedule(p, R, today),
    pag = (p.pagos || []).reduce((a, x) => a + x.monto, 0),
    rem = Math.max(0, r2(p.total - pag)),
    next = s.find((c) => !c.done);
  return { s, pag, rem, frac: p.total ? (p.total - rem) / p.total : 1, active: rem > 0.004, next, nPaid: s.filter((c) => c.done).length };
}
export function msiSummary(plans: Plan[], R: Rules, today: string) {
  const fut: (Cuota & { p: Plan })[] = [];
  plans.forEach((p) => schedule(p, R, today).filter((c) => !c.done).forEach((c) => fut.push({ ...c, p })));
  const by: Record<string, (Cuota & { p: Plan })[]> = {};
  fut.forEach((c) => (by[c.date] = by[c.date] || []).push(c));
  const cortes = Object.keys(by).sort();
  const left = plans.reduce((a, p) => a + planInfo(p, R, today).rem, 0);
  return {
    by,
    cortes,
    next: cortes[0],
    nextAmt: cortes[0] ? by[cortes[0]].reduce((a, c) => a + c.falta, 0) : 0,
    vencida: cortes[0] ? by[cortes[0]].some((c) => c.vencida) : false,
    left,
  };
}

/* ===== sobres por semana ===== */
type WeekCalc = {
  ws: string;
  a: { gas: number; gastos: number; invertir: number; emergencia: number };
  sp: { gas: number; gastos: number; inv: number; emerg: number; cajita: number };
  overflow: number;
  spentG: number;
  bal: number;
  over: number;
  emergProj: number;
  gasCut: number;
  gasAvail: number;
  closed: boolean;
};
const ZW = (ws: string, today: string): WeekCalc => ({
  ws,
  a: { gas: 0, gastos: 0, invertir: 0, emergencia: 0 },
  sp: { gas: 0, gastos: 0, inv: 0, emerg: 0, cajita: 0 },
  overflow: 0,
  spentG: 0,
  bal: 0,
  over: 0,
  emergProj: 0,
  gasCut: 0,
  gasAvail: 0,
  closed: ws < weekStart(today),
});
function weeksRange(all: Mov[], today: string) {
  let w = weekStart(all.reduce((a, m) => (m.fecha < a ? m.fecha : a), today));
  const end = weekStart(today);
  const out: string[] = [];
  for (; w <= end; w = addDays(w, 7)) out.push(w);
  return out;
}
export function weekSeries(all: Mov[], R: Rules, today: string, rate: number): WeekCalc[] {
  let carry = 0;
  const W: WeekCalc[] = [];
  weeksRange(all, today).forEach((ws) => {
    const w = ZW(ws, today),
      a = w.a,
      sp = w.sp;
    all.forEach((m) => {
      if (!inWeek(m, ws)) return;
      if (m.t === "in" && m.split) for (const k in a) (a as Record<string, number>)[k] += (m.split as Record<string, number>)[k];
      if (m.t === "out") {
        const s = CATS.out[m.cat as string]?.sobre;
        if (s) (sp as Record<string, number>)[s] += amtMXN(m, rate);
      }
    });
    const avail = carry + a.gas,
      covered = Math.min(sp.gas, avail);
    w.overflow = sp.gas - covered;
    w.spentG = sp.gastos + w.overflow;
    w.bal = a.gastos - w.spentG;
    w.over = Math.max(0, -w.bal);
    w.emergProj = Math.max(0, a.emergencia - w.over);
    const over2 = Math.max(0, w.over - a.emergencia),
      left = avail - covered;
    w.gasCut = Math.min(over2, left);
    carry = left - w.gasCut;
    w.gasAvail = carry;
    W.push(w);
  });
  return W;
}
export const weekCalc = (all: Mov[], R: Rules, today: string, rate: number, ws: string) =>
  weekSeries(all, R, today, rate).find((w) => w.ws === ws) || ZW(ws, today);

export function totals(all: Mov[], R: Rules, today: string, rate: number) {
  const W = weekSeries(all, R, today, rate);
  const t = { W, invProj: 0, invEf: 0, emProj: 0, emEf: 0, cajIn: 0, cajOut: 0, gas: 0, cajita: 0 };
  W.forEach((w) => {
    t.invProj += w.a.invertir;
    t.invEf += w.sp.inv;
    t.emProj += w.emergProj;
    t.emEf += w.sp.emerg;
    if (w.closed && w.bal > 0) t.cajIn += w.bal;
    t.cajOut += w.sp.cajita;
  });
  t.gas = W.length ? W[W.length - 1].gasAvail : 0;
  t.cajita = t.cajIn - t.cajOut;
  return t;
}

export function stats(all: Mov[], fn: (m: Mov) => boolean, rate: number) {
  const s = {
    ingReal: 0, gasReal: 0, inv: 0, ahorro: 0, wIn: 0, wOut: 0, comida: 0,
    inUSD: 0, inMXN: 0, msi: 0, catIn: {} as Record<string, number>, catOut: {} as Record<string, number>,
  };
  all.filter(fn).forEach((m) => {
    if (m.t === "fx") return;
    const x = amtMXN(m, rate);
    if (m.t === "in") {
      s.wIn += x;
      if (m.real) s.ingReal += x;
      s.catIn[m.cat as string] = (s.catIn[m.cat as string] || 0) + x;
      if (m.cur === "USD") s.inUSD += m.amt;
      else s.inMXN += m.amt;
    } else {
      const c = CATS.out[m.cat as string];
      s.wOut += x;
      if (c.inv) s.inv += x;
      else if (c.save) s.ahorro += x;
      else if (m.real) s.gasReal += x;
      if (m.cat === "comida") s.comida += x;
      if (m.gen && m.real) s.msi += x;
      s.catOut[m.cat as string] = (s.catOut[m.cat as string] || 0) + x;
    }
  });
  return s;
}

export function metaEmerg(all: Mov[], today: string, rate: number) {
  const cm = today.slice(0, 7),
    ks = new Set<string>();
  all.forEach((m) => {
    const k = m.fecha.slice(0, 7);
    if (k < cm) ks.add(k);
  });
  const closed = [...ks].map((k) => stats(all, (m) => m.fecha.startsWith(k), rate).gasReal).filter((x) => x > 0);
  const cur = stats(all, (m) => m.fecha.startsWith(cm), rate).gasReal;
  const base = closed.length ? closed : [cur];
  const mensual = base.reduce((a, b) => a + b, 0) / base.length;
  return { meta: mensual * 6, mensual, n: closed.length };
}

export const usdWallet = (movs: Mov[]) =>
  movs.reduce((a, m) => {
    if (m.t === "in" && m.cur === "USD") a += m.amt;
    if (m.t === "out" && m.cur === "USD") a -= m.amt;
    if (m.t === "fx") a -= m.usd || 0;
    return a;
  }, 0);

export function avgComidaBefore(all: Mov[], ws: string, rate: number) {
  const wk: Record<string, number> = {};
  all.forEach((m) => {
    const w = weekStart(m.fecha);
    if (w < ws) {
      wk[w] = wk[w] || 0;
      if (m.t === "out" && m.cat === "comida") wk[w] += amtMXN(m, rate);
    }
  });
  const vals = Object.values(wk).filter((x) => x > 0);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

export function porCobrar(all: Mov[], plans: Plan[], R: Rules, today: string, rate: number) {
  const res: Record<string, ReturnType<typeof perPerson>> = {};
  function perPerson(p: "mama" | "externo") {
    const pls = plans.filter((pl) => CATS.out[pl.cat].cobro === p);
    const pids = new Set(pls.map((pl) => pl.id));
    const msiPaid: Record<string, number> = {};
    let ab = 0;
    all
      .filter((m) => m.t === "in" && CATS.in[m.cat as string]?.cobro === p)
      .forEach((m) => {
        const x = amtMXN(m, rate),
          mp = m.msiPart && pids.has(m.msiPart.plan) ? Math.min(x, m.msiPart.monto) : 0;
        if (mp) msiPaid[m.msiPart!.plan] = (msiPaid[m.msiPart!.plan] || 0) + mp;
        ab += x - mp;
      });
    const cargos = all
      .filter((m) => m.t === "out" && !m.gen && CATS.out[m.cat as string]?.cobro === p)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const items = cargos.map((c) => {
      const t = amtMXN(c, rate);
      const cub = Math.min(t, ab);
      ab -= cub;
      return { m: c, total: t, falta: t - cub };
    });
    const planes = pls.map((pl) => {
      const i = planInfo(pl, R, today),
        cobrado = i.pag,
        pag = msiPaid[pl.id] || 0;
      return { p: pl, i, cobrado, pag, pend: cobrado - pag, falta: pl.total - pag };
    });
    const pendS = Math.max(0, items.reduce((a, i) => a + i.falta, 0));
    const pendM = planes.reduce((a, x) => a + Math.max(0, x.pend), 0);
    return {
      items,
      planes,
      pendS,
      pendM,
      pend: pendS + pendM,
      cargado: items.reduce((a, i) => a + i.total, 0),
      viene: planes.reduce((a, x) => a + Math.max(0, x.p.total - x.cobrado), 0),
    };
  }
  res.mama = perPerson("mama");
  res.externo = perPerson("externo");
  return res as { mama: ReturnType<typeof perPerson>; externo: ReturnType<typeof perPerson> };
}

export const monthEnd = (mo: string) => addDays(addMonths(mo + "-01", 1, 1), -1);
