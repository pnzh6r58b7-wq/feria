-- Feria · Fase 1 (Base)
-- Schema propio `gastos` (nunca en public), tablas, RLS por usuario.
-- Zona horaria de las fechas: America/Tijuana.
-- Correr tal cual en Supabase: Dashboard -> SQL Editor -> pegar -> Run.

create schema if not exists gastos;

-- ============ Exponer el schema a la API (PostgREST) ============
-- Para que la app pueda leer/escribir en `gastos` desde el cliente.
-- (Si esto no toma efecto, en el Dashboard: Settings -> API -> Exposed schemas,
--  agrega "gastos" y guarda.)
alter role authenticator
  set pgrst.db_schemas = 'public, graphql_public, gastos';
notify pgrst, 'reload config';

-- ============ Permisos del schema ============
grant usage on schema gastos to anon, authenticated, service_role;
grant all on all tables    in schema gastos to anon, authenticated, service_role;
grant all on all routines  in schema gastos to anon, authenticated, service_role;
grant all on all sequences in schema gastos to anon, authenticated, service_role;
alter default privileges in schema gastos
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema gastos
  grant all on sequences to anon, authenticated, service_role;

-- ============ MOVIMIENTOS (ingresos, gastos y cambios de dólares) ============
create table if not exists gastos.movimientos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  tipo          text not null check (tipo in ('in', 'out', 'fx')),
  categoria     text,
  monto         numeric(12, 2) not null default 0,
  moneda        text not null default 'MXN' check (moneda in ('MXN', 'USD')),
  fecha         date not null
                default (now() at time zone 'America/Tijuana')::date,
  concepto      text,
  cuenta_israel boolean not null default false,   -- el switch "Cuenta para Israel" (campo "real")
  usd           numeric(12, 2),                    -- monto original en USD (si aplica)
  tc            numeric(12, 4),                    -- tipo de cambio usado
  overrides     jsonb not null default '{}'::jsonb, -- ajustes manuales de la división (ov)
  split         jsonb,                             -- {gas, gastos, invertir, emergencia}
  msi_part      jsonb,                             -- {plan, monto} para reembolsos que son de MSI
  created_at    timestamptz not null default now()
);

create index if not exists movimientos_user_fecha_idx
  on gastos.movimientos (user_id, fecha desc);

-- ============ PLANES MSI (las mensualidades se derivan del plan) ============
create table if not exists gastos.planes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  concepto      text not null,
  categoria     text not null,
  total         numeric(12, 2) not null,
  meses         integer not null check (meses >= 1),
  fecha         date not null,                     -- fecha de compra
  cuenta_israel boolean not null default true,
  pagos         jsonb not null default '[]'::jsonb, -- [{fecha, monto, tipo: 'cuota'|'capital'}]
  created_at    timestamptz not null default now()
);

create index if not exists planes_user_idx on gastos.planes (user_id);

-- ============ REGLAS (una fila por usuario) ============
create table if not exists gastos.reglas (
  user_id    uuid primary key default auth.uid()
             references auth.users (id) on delete cascade,
  gas_semana numeric(12, 2) not null default 680,
  pct_gastos integer not null default 50,
  pct_emerg  integer not null default 20,
  corte      integer not null default 11,
  pago_dia   integer not null default 1,
  msi_meses  integer not null default 3,
  fx_manual  numeric(12, 4) not null default 18.40, -- respaldo si no carga el TC en vivo
  updated_at timestamptz not null default now()
);

-- ============ Row Level Security: cada quien ve solo lo suyo ============
alter table gastos.movimientos enable row level security;
alter table gastos.planes      enable row level security;
alter table gastos.reglas      enable row level security;

drop policy if exists "mov_propias" on gastos.movimientos;
create policy "mov_propias" on gastos.movimientos
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "planes_propios" on gastos.planes;
create policy "planes_propios" on gastos.planes
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "reglas_propias" on gastos.reglas;
create policy "reglas_propias" on gastos.reglas
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
