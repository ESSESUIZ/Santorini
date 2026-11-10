# Pagos y envíos: activación

Este incremento conecta el checkout con **MiCorreo (Correo Argentino)** y **Mercado Pago Checkout Pro**. Las credenciales permanecen exclusivamente en el servidor.

## 1. Ejecutar la migración en Supabase

En **Supabase → SQL Editor**, ejecutar completo:

`supabase/migrations/009_shipping_and_payments.sql`

La migración agrega:

- peso y dimensiones por SKU;
- costo y servicio de envío en el pedido;
- identificadores de preferencia y pago;
- reserva transaccional de stock durante 30 minutos;
- confirmación idempotente de la venta mediante webhook.

Los valores iniciales por SKU son 800 g y 35 × 28 × 8 cm. Antes de producción conviene medir cada tipo de prenda y actualizar estos cuatro campos en `product_variants`.

## 2. Solicitar acceso a MiCorreo

Correo Argentino debe entregar las credenciales de API de MiCorreo. Se necesitan:

- usuario API;
- contraseña API;
- `customerId`;
- código postal de origen del depósito.

La cotización a domicilio usa código postal de origen/destino y dimensiones. La dirección completa ya se guarda para crear el envío en un incremento posterior.

## 3. Crear la integración de Mercado Pago

En **Mercado Pago Developers → Tus integraciones**:

1. Crear o abrir la aplicación de Santorini.
2. Obtener el **Access Token** del ambiente que se va a probar.
3. En **Webhooks**, configurar el evento **Pagos** con esta URL:

   `https://TU-DOMINIO.vercel.app/api/payments/webhook`

4. Guardar y copiar la **firma secreta** generada.
5. Repetir la configuración en Producción al pasar de credenciales de prueba a reales.

La URL de retorno no confirma una venta. El backend valida la firma del webhook, vuelve a consultar el pago a Mercado Pago y recién entonces marca el pedido como pagado y convierte la reserva en venta.

## 4. Variables en Vercel

En **Vercel → Project → Settings → Environment Variables**, cargar:

```text
NEXT_PUBLIC_SITE_URL=https://TU-DOMINIO.vercel.app
MERCADO_PAGO_ACCESS_TOKEN=...
MERCADO_PAGO_WEBHOOK_SECRET=...
CORREO_ARGENTINO_ENVIRONMENT=test
CORREO_ARGENTINO_USER=...
CORREO_ARGENTINO_PASSWORD=...
CORREO_ARGENTINO_CUSTOMER_ID=...
CORREO_ARGENTINO_ORIGIN_POSTAL_CODE=...
```

Para producción cambiar `CORREO_ARGENTINO_ENVIRONMENT` a `production` y usar las credenciales productivas. Mantener también las variables de Supabase ya configuradas:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

No exponer claves privadas con el prefijo `NEXT_PUBLIC_`.

## 5. Redesplegar y probar

Después de guardar las variables, hacer un redeploy. Probar primero con credenciales de prueba:

1. agregar un SKU con stock a la bolsa;
2. completar dirección y CPA/código postal;
3. calcular el envío;
4. elegir la tarifa;
5. iniciar el pago con un usuario de prueba de Mercado Pago;
6. verificar en Supabase que `orders.payment_status` pase a `paid` y que existan movimientos `reservation`, `release` y `sale` para el pedido.

No usar una cuenta compradora real perteneciente al mismo titular de la cuenta vendedora durante las pruebas de Mercado Pago.

## Próximo incremento logístico

Una vez aprobado el pago, el siguiente paso es llamar a `/shipping/import` de MiCorreo con la dirección completa, guardar el `shippingId`/tracking y mostrar el seguimiento al cliente y al administrador.
