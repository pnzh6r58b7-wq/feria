# Feria — app de gastos de Israel

Lee esto al inicio de cada sesión. El usuario (Israel) no es programador: explícale en español, simple y corto, qué hiciste y qué tiene que hacer él (con clics exactos) cuando algo dependa de él.

## Fuente de verdad
- `docs/GASTOS_APP_ARRANQUE.md` → todos los requisitos y reglas de negocio.
- `docs/feria_preview.html` → **diseño y lógica aprobados**. Copia la UI (colores, fuentes, layout, tabs, sheets, swipe para borrar) y **porta la lógica de su `<script>`** (división de ingresos, semanas domingo→sábado, apartado de gasolina, proyectado vs efectivo, cajita, MSI con `pagos [{fecha, monto, tipo: cuota|capital}]`, por cobrar con `msiPart`, meta de emergencia mensual). Si algo no está claro, el preview manda. No inventes reglas nuevas.

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deploy en **Vercel** (Hobby).
- **Supabase** (Postgres + Auth). Proyecto `isra-apps`, compartido con futuras apps de Israel → todo lo de esta app va en el schema **`gastos`** (nunca en `public`).
- PWA instalable en iPhone (manifest + íconos + `apple-touch-icon`, `display: standalone`). Mobile-first, max-width ~460px.
- UI 100% en español. Fuentes: Fraunces (números) + Manrope (UI).

## Reglas
- Usuario único. Login con email y contraseña de Supabase; registros públicos desactivados. RLS en todas las tablas: `user_id = auth.uid()`.
- Sin datos de ejemplo ni seeds. Arranca vacía.
- Las llaves secretas (service role) solo del lado del servidor. Nunca en el cliente ni en git. Usa `.env.local` (ignorado por git) y las variables de entorno de Vercel.
- Tipo de cambio USD→MXN en vivo desde el servidor (ruta API con caché ~1 h; Banxico FIX u open.er-api.com), con respaldo manual.
- **Keep-alive:** Supabase free pausa el proyecto tras 7 días sin actividad → Vercel Cron diario (`vercel.json`) que llama una ruta `/api/cron/keepalive` que hace una consulta mínima. Protegida con `CRON_SECRET`.
- **Backup:** botón en Reglas "Exportar todo (JSON y CSV)".
- Montos en `numeric(12,2)`. Fechas como `date` (zona America/Tijuana).
- Después de cada cambio: corre `npm run build` y arregla errores antes de decir que terminaste. Commits pequeños con mensajes en español.

## Fases (una a la vez; al terminar cada una, dile a Israel cómo probarla)
1. **Base:** proyecto Next.js, Tailwind con la paleta del preview, Supabase client, login, schema `gastos` + tablas + RLS (migración SQL en `supabase/migrations/`), PWA, deploy en Vercel funcionando.
2. **Movimientos:** botón "+", ingresos/gastos con todas las categorías, división de ingresos, USD (pop-up guardé/cambié), editar al tocar, deslizar para borrar con Deshacer.
3. **Semana:** hero "Te queda para gastar", sobres (gasolina, invertir, emergencia, MSI), big one vs wagered, ritmo eat/drink, bolsa de dólares, cajita escondida (3 toques al logo).
4. **Tarjeta:** MSI (planes, Pago MSI, pago a capital, editar plan, vencidas) y Por cobrar (sueltos vs MSI, `msiPart`).
5. **Mes + Reglas:** vista Mes, reglas editables, exportar, keep-alive cron, modo oscuro.
6. (Después) Endpoint `/api/gastos` para el atajo de iPhone.
