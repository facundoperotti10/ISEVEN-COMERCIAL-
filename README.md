# ISEVEN — Control Comercial

App real de control comercial del equipo de ventas: mismo diseño y misma
lógica que el prototipo de Claude.ai, reconstruida sobre **Next.js +
TypeScript + Tailwind CSS**, con **Supabase** (Postgres + Auth) como base de
datos permanente y deploy en **Vercel**.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 (paleta y tipografía de marca en `app/globals.css`)
- Supabase: Postgres + Auth + Row Level Security
- Recharts para los gráficos
- Deploy: Vercel (plan gratuito)

## 1. Base de datos (Supabase)

1. Entrá al [SQL editor](https://supabase.com/dashboard/project/_/sql) de tu
   proyecto Supabase y corré `supabase/schema.sql`. Crea las tablas
   (`sellers`, `period`, `contacts`, `profiles`), los enums, las políticas de
   Row Level Security y carga los datos iniciales de vendedores y período.
2. Podés volver a correrlo sin problema — usa `if not exists` / `on conflict`.

### Row Level Security

- Un **vendedor** solo puede leer/escribir sus propios `contacts`, y solo ve
  su propia fila en `sellers`.
- Un **admin** lee y escribe todo.
- `period` es de lectura para cualquier usuario autenticado; solo un admin la
  edita.
- `profiles` vincula cada usuario de Supabase Auth con un `seller_id` (rol
  `seller`) o con el rol `admin`.

## 2. Usuarios (Supabase Auth)

Las contraseñas ya no viven en el código — se migran a usuarios reales de
Supabase Auth. Para crearlos (una sola vez, o cuando cambien las
contraseñas):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ihqulihyqvfuljfeynaq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role key, Project Settings → API> \
npm run seed:users
```

Esto crea (o actualiza) estos usuarios y su fila en `profiles`:

| Nombre | Email | Rol | Contraseña inicial |
|---|---|---|---|
| Agus | agus@iseven.app | seller | `AP1234567` |
| Mateo | mateo@iseven.app | seller | `ML1234567` |
| Fran | fran@iseven.app | seller | `FC1234567` |
| Panel de control | admin@iseven.app | admin | `FM2025` |

Cambiá las contraseñas cuando quieras desde el dashboard de Supabase Auth
(Authentication → Users) — no hace falta tocar código.

**Importante:** `SUPABASE_SERVICE_ROLE_KEY` nunca va en `.env.local` para
desarrollo del front, ni en Vercel. Se usa una sola vez, en tu máquina, solo
para correr `seed:users`.

## 3. Desarrollo local

```bash
cp .env.local.example .env.local   # ya viene con la URL y la anon key del proyecto
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## 4. Deploy en Vercel

1. Conectá el repo de GitHub a Vercel.
2. Cargá las variables de entorno del proyecto en Vercel → Project Settings
   → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Cada push a la rama principal dispara un deploy automático. El dominio
   gratuito queda del tipo `iseven-control.vercel.app`.

## 5. Migración de datos del prototipo

1. Desde el panel admin del prototipo, exportá el CSV de clientes (columnas:
   `vendedor, fecha, nombre_cliente, telefono, estado, observacion`).
2. Importá ese CSV a la tabla `contacts` de Supabase (Table Editor → Import
   data from CSV), mapeando `vendedor` al `seller_id` correspondiente
   (`agus`, `mateo` o `fran`) y `estado` a los valores del enum
   (`consulta`, `respondio`, `presupuesto`, `seguimiento`, `vendido`,
   `perdido`).
3. Desde el panel admin de esta app (tab **Resumen** → *Exportar clientes
   CSV*) comparalo contra el export del prototipo y verificá que los KPIs
   coincidan antes de dar de baja el link viejo.

## Estructura del proyecto

```
app/                    Rutas (login, vendedor, admin)
components/
  ui/                   Piezas reutilizables (PaceGauge, KpiCard, gráficos…)
  login/                Pantalla de login
  vendedor/              Vista de vendedor
  admin/                 Tabs del panel admin
lib/
  calc.ts               Toda la lógica de negocio (ritmo, semáforo, embudo,
                         diagnóstico, comparación semanal, CSV…), pura y
                         testeable, sin dependencias de Supabase.
  auth.ts               Helpers de sesión/rol para Server Components.
  supabase/              Clientes de Supabase (browser, server, middleware).
supabase/schema.sql      Esquema + RLS + datos iniciales.
scripts/seed-users.mjs   Alta de usuarios de Supabase Auth (local, con
                         service role key).
```

## Reglas de negocio

Toda la lógica de cálculo vive en `lib/calc.ts`: ventas actuales, ritmo
actual vs. necesario, semáforo, embudo, diagnóstico automático por
vendedor, proyección de cierre del equipo y comparación semana a semana.
Nada de esto está hardcodeado — se deriva siempre de `contacts`, `sellers` y
`period`.
