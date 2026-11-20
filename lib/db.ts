// Capa de datos: lee/escribe en el schema `gastos` de Supabase y mapea
// entre el modelo en memoria (Mov) y las columnas de la BD.
import { createClient } from "@/lib/supabase/client";
import type { Mov, Rules } from "@/lib/model";

type Row = {
  id: string;
  tipo: Mov["t"];
  categoria: string | null;
  monto: number | string;
  moneda: Mov["cur"];
  fecha: string;
  concepto: string | null;
  cuenta_israel: boolean;
  usd: number | string | null;
  tc: number | string | null;
  overrides: Record<string, number> | null;
  split: Mov["split"] | null;
  msi_part: Mov["msiPart"] | null;
  created_at: string;
};

const num = (v: number | string | null | undefined) =>
  v == null ? undefined : typeof v === "string" ? parseFloat(v) : v;

function rowToMov(r: Row): Mov {
  return {
    id: r.id,
    t: r.tipo,
    cat: r.categoria ?? undefined,
    amt: num(r.monto) ?? 0,
    cur: r.moneda,
    fecha: r.fecha,
    concepto: r.concepto ?? undefined,
    real: r.cuenta_israel,
    usd: num(r.usd),
    tc: num(r.tc),
    ov: r.overrides ?? undefined,
    split: r.split ?? undefined,
    msiPart: r.msi_part ?? undefined,
    _created: r.created_at,
  };
}

function movToRow(m: Mov) {
  return {
    tipo: m.t,
    categoria: m.cat ?? null,
    monto: m.amt,
    moneda: m.cur,
    fecha: m.fecha,
    concepto: m.concepto ?? null,
    cuenta_israel: m.real,
    usd: m.usd ?? null,
    tc: m.tc ?? null,
    overrides: m.ov ?? {},
    split: m.split ?? null,
    msi_part: m.msiPart ?? null,
  };
}

export async function fetchMovs(): Promise<Mov[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(rowToMov);
}

export async function insertMov(m: Mov): Promise<Mov> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos")
    .insert(movToRow(m))
    .select()
    .single();
  if (error) throw error;
  return rowToMov(data as Row);
}

export async function updateMov(id: string, m: Mov): Promise<Mov> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movimientos")
    .update(movToRow(m))
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToMov(data as Row);
}

export async function deleteMov(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("movimientos").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchReglas(): Promise<Rules | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("reglas").select("*").limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, number | string>;
  return {
    gasSemana: num(r.gas_semana as number) ?? 680,
    pctGastos: Number(r.pct_gastos),
    pctEmerg: Number(r.pct_emerg),
    corte: Number(r.corte),
    pagoDia: Number(r.pago_dia),
    msiMeses: Number(r.msi_meses),
  };
}
