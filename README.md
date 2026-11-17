# Feria

App privada de gastos de Israel. Next.js (App Router) + TypeScript + Tailwind + Supabase. PWA instalable en iPhone.

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000

## Variables de entorno

Copia `.env.local.example` a `.env.local` y pon tus valores de Supabase
(Project Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Base de datos

El SQL vive en `supabase/migrations/`. Todo va en el schema `gastos` (nunca en `public`),
con RLS por usuario. Pégalo en Supabase → SQL Editor → Run.

## Fases

Ver `CLAUDE.md`. Esta es la **Fase 1 (Base)**: proyecto, diseño, login, schema + RLS, PWA y deploy.
