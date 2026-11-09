# Santorini

Tienda online y backoffice de inventario para Santorini, construido con Next.js y preparado para Supabase + Vercel.

## Desarrollo local

1. `npm install`
2. Copiar `.env.example` a `.env.local` y completar las variables de Supabase.
3. `npm run dev`

## Base de datos

La migración inicial está en `supabase/migrations/001_santorini_core.sql`.
Primero ejecutar la migración, luego importar ubicaciones, productos, variantes e inventario inicial desde el archivo de migración normalizado. El stock debe cargarse luego del recuento físico.

## Variables necesarias

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

No exponer `SUPABASE_SERVICE_ROLE_KEY` en componentes del navegador.
