// Catálogo y lógica de negocio. Portado tal cual del preview aprobado.
// Nombres de campos del modelo en memoria: t, cat, amt, cur, fecha, concepto,
// real, ov, split, usd, tc, msiPart (el mapeo a la BD vive en db.ts).

export type Tipo = "in" | "out" | "fx";
export type Moneda = "MXN" | "USD";

export type Split = {
  gas: number;
  gastos: number;
  invertir: number;
  emergencia: number;
};

export type Mov = {
  id: string;
  t: Tipo;
  cat?: string;
  amt: number;
  cur: Moneda;
  fecha: string; // YYYY-MM-DD
  concepto?: string;
  real: boolean;
  ov?: Record<string, number>;
  split?: Split;
  usd?: number;
  tc?: number;
  msiPart?: { plan: string; monto: number };
  _created?: string; // created_at, solo para ordenar
  // Solo en movimientos generados desde un plan MSI (no se guardan en BD):
  gen?: "cuota" | "capital";
  plan?: string;
  pj?: number;
};

export type Pago = { fecha: string; monto: number; tipo: "cuota" | "capital" };

export type Plan = {
  id: string;
  concepto: string;
  cat: string;
  total: number;
  meses: number;
  fecha: string;
  real: boolean;
  pagos: Pago[];
  _created?: string;
};

export type Rules = {
  gasSemana: number;
  pctGastos: number;
  pctEmerg: number;
  corte: number;
  pagoDia: number;
  msiMeses: number;
};

export const DEF_RULES: Rules = {
  gasSemana: 680,
  pctGastos: 50,
  pctEmerg: 20,
  corte: 11,
  pagoDia: 1,
  msiMeses: 3,
};

export type CatDef = {
  l: string;
  real: boolean;
  c: string;
  ab: string;
  fijo?: { amt: number; concepto: string };
  cobro?: "mama" | "externo";
  sobre?: "gas" | "gastos" | "inv" | "emerg" | "cajita";
  msi?: boolean;
  inv?: boolean;
  save?: boolean;
  special?: boolean;
  hidden?: boolean;
};

export const CATS: { in: Record<string, CatDef>; out: Record<string, CatDef> } = {
  in: {
    semana: { l: "Semana mamá", real: true, c: "--teal", ab: "SM", fijo: { amt: 900, concepto: "Semana" } },
    chamba: { l: "Chamba", real: true, c: "--teal", ab: "CH" },
    regalo: { l: "Regalo", real: true, c: "--cu", ab: "RG" },
    reemb_mama: { l: "Reembolso mamá", real: false, c: "--wine", ab: "RM", cobro: "mama" },
    reemb_externo: { l: "Reembolso externo", real: false, c: "--wine", ab: "RE", cobro: "externo" },
    otro_in: { l: "Otro", real: false, c: "--navy", ab: "OT" },
  },
  out: {
    gasolina: { l: "Gasolina", real: true, c: "--navy", ab: "GA", sobre: "gas", msi: true },
    comida: { l: "Eat/drink", real: true, c: "--terra", ab: "ED", sobre: "gastos", msi: true },
    gastos: { l: "Gastos", real: true, c: "--terra", ab: "GS", sobre: "gastos", msi: true },
    inversion: { l: "Inversión GBM", real: false, inv: true, c: "--amber", ab: "IN", sobre: "inv" },
    emergencia: { l: "Apartar a emergencia", real: false, save: true, c: "--cu", ab: "FE", sobre: "emerg" },
    por_mama: { l: "Pagué por mamá", real: false, c: "--wine", ab: "PM", cobro: "mama", msi: true },
    por_externo: { l: "Pagué por externo", real: false, c: "--wine", ab: "PE", cobro: "externo", msi: true },
    pago_msi: { l: "Pago MSI", real: false, c: "--wine", ab: "MS", special: true },
    capital: { l: "Pago a capital (MSI)", real: false, c: "--navy", ab: "PK", special: true },
    cajita: { l: "Guilt-free (cajita)", real: true, c: "--amber", ab: "★", sobre: "cajita", hidden: true },
  },
};

export function catOf(m: Mov): CatDef {
  if (m.t === "fx") return { l: "Cambio de dólares", c: "--navy", ab: "FX", real: false };
  return CATS[m.t === "in" ? "in" : "out"][m.cat as string];
}

/* ===== dinero ===== */
const nf = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (n: number, cur?: Moneda) =>
  (n < -0.5 ? "−" : "") + "$" + nf.format(Math.abs(Math.round(n))) + (cur === "USD" ? " USD" : "");
export const money2 = (n: number) => (n < -0.004 ? "−" : "") + "$" + nf2.format(Math.abs(n));
export const r2 = (n: number) => Math.round(n * 100) / 100;

/* ===== fechas (zona local = Tijuana del usuario) ===== */
const pad = (n: number) => String(n).padStart(2, "0");
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESL = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const DOW = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export { pad };
export const ud = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addMonths = (s: string, k: number, day: number) => {
  const d = ud(s);
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth() + k;
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(day, dim))));
};
export const fmtD = (s: string) => {
  const d = ud(s);
  return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
};
export const addDays = (s: string, n: number) => {
  const d = ud(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
export const weekStart = (s: string) => {
  const d = ud(s);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return iso(d); // semana domingo→sábado
};
export const dow = (s: string) => ud(s).getUTCDay();
export const inWeek = (m: Mov, ws: string) => m.fecha >= ws && m.fecha <= addDays(ws, 6);
export const fmtDay = (s: string) => {
  const d = ud(s);
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MES[d.getUTCMonth()]}`;
};

/* ===== conversión y división ===== */
export function amtMXN(m: Mov, rate: number) {
  if (m.t === "fx") return (m.usd || 0) * (m.tc || 0);
  return m.cur === "USD" ? m.amt * rate : m.amt;
}

export function gasLeft(fecha: string, movs: Mov[], rules: Rules, excludeId?: string) {
  const ws = weekStart(fecha);
  const filled = movs
    .filter((m) => m.t === "in" && m.split && inWeek(m, ws) && m.id !== excludeId)
    .reduce((a, m) => a + (m.split as Split).gas, 0);
  return Math.max(0, rules.gasSemana - filled);
}

export function computeSplit(
  total: number,
  gl: number,
  rules: Rules,
  ov: Record<string, number> = {}
): Split {
  const gas = Math.min(total, Math.max(0, ov.gas ?? gl));
  const rest = Math.max(0, total - gas);
  const pg = ov.pctGastos ?? rules.pctGastos;
  const pe = ov.pctEmerg ?? rules.pctEmerg;
  const gastos = (rest * pg) / 100;
  const inv = rest - gastos;
  const emergencia = (inv * pe) / 100;
  return { gas, gastos, invertir: inv - emergencia, emergencia };
}
