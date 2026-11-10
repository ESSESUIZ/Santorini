# Producto, cuenta y checkout

## Qué agrega este incremento

- Catálogo agrupado por producto/color, en lugar de una tarjeta por talle.
- Página `/producto/[sku]` con descripción, precio, stock, selector de talle y guía orientativa.
- Integración lista para leer imágenes desde `product_images` y el bucket `product-images`.
- Bolsa persistente en el navegador.
- Checkout como invitado o con cuenta.
- Dirección principal guardada para clientes autenticados.
- Recuperación de contraseña.
- Historial de pedidos asociados a la cuenta.

## Activación

1. Ejecutar `008_customer_checkout.sql` en Supabase después de las migraciones 006 y 007.
2. En **Authentication → URL Configuration**, agregar:
   - `http://localhost:3001/cuenta/restablecer`
   - `https://santorini-mauve.vercel.app/cuenta/restablecer`
3. Verificar que las URLs de `/cuenta` continúen autorizadas para confirmación de email.

## Estado del checkout

El checkout valida productos, precios y stock nuevamente en PostgreSQL. Registra una orden `draft` con pago `pending`; el navegador nunca define el precio final.

Todavía falta conectar Mercado Pago. Hasta entonces, el checkout confirma los datos y genera el número de pedido, pero no debe considerarse una venta pagada.

Antes de una campaña pública conviene agregar protección anti-bots/rate limiting al endpoint de checkout invitado.

## Imágenes

Cuando esté disponible la carpeta, utilizar nombres como:

- `SAN-0001-01.webp`
- `SAN-0001-02.webp`
- `SAN-0001-03.webp`

La primera parte identifica el SKU; el sufijo define el orden de la galería. La ingesta debe resolver la variante del SKU, subir el archivo al bucket y crear la fila correspondiente en `product_images`. Así las galerías quedan separadas por color aunque varias variantes compartan el mismo producto base.
