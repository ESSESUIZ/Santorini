# Integraciones de checkout

Las credenciales son secretos del comercio. Nunca deben guardarse en Git ni exponerse con el prefijo `NEXT_PUBLIC_`.

## Correo Argentino · MiCorreo

La cuenta común de MiCorreo no alcanza por sí sola. Correo Argentino debe habilitar el acceso a la API y entregar el usuario y la contraseña técnicos.

Variables requeridas:

```text
CORREO_ARGENTINO_ENVIRONMENT=test
CORREO_ARGENTINO_USER=<usuario API entregado por Correo Argentino>
CORREO_ARGENTINO_PASSWORD=<contraseña API entregada por Correo Argentino>
CORREO_ARGENTINO_CUSTOMER_ID=<ID de cliente MiCorreo>
CORREO_ARGENTINO_ORIGIN_POSTAL_CODE=<CPA o código postal del depósito>
```

Usar `production` en `CORREO_ARGENTINO_ENVIRONMENT` cuando Correo Argentino confirme las credenciales productivas.

Solicitud de credenciales y documentación oficial: <https://www.correoargentino.com.ar/MiCorreo/public/faqs>

## Mercado Pago · Checkout Pro

1. Crear o abrir la aplicación en **Mercado Pago Developers → Tus integraciones**.
2. Para pruebas, copiar el **Access Token de prueba**. Para cobrar dinero real, activar y copiar el de producción.
3. En **Webhooks → Configurar notificaciones**, registrar:
   `https://<dominio>/api/payments/webhook`
4. Activar el evento **Pagos** y copiar la firma secreta generada.

Variables requeridas:

```text
MERCADO_PAGO_ACCESS_TOKEN=<Access Token del ambiente elegido>
MERCADO_PAGO_WEBHOOK_SECRET=<firma secreta del webhook>
MERCADO_PAGO_ENVIRONMENT=test
NEXT_PUBLIC_SITE_URL=https://<dominio-vercel>
```

Con `MERCADO_PAGO_ENVIRONMENT=test` la aplicación usa la URL sandbox devuelta por Mercado Pago. Para cobrar pagos reales, cambiarla a `production`, reemplazar las credenciales por las productivas y volver a desplegar.

Documentación oficial: <https://www.mercadopago.com.ar/developers/es/docs/getting-started>

## Transferencia bancaria

El checkout puede ofrecer transferencia además de Mercado Pago. Al elegirla se crea una reserva de stock de dos horas, se muestra el alias y se abre un mensaje de WhatsApp con el número de pedido para adjuntar el comprobante. El equipo confirma el pago manualmente antes de preparar el envío.

Variables privadas requeridas:

```text
BANK_TRANSFER_ALIAS=<alias bancario o CVU>
BANK_TRANSFER_WHATSAPP=<código de país + número de WhatsApp, solo dígitos>
```

Opcional para mostrar el titular junto al alias:

```text
BANK_TRANSFER_ACCOUNT_HOLDER=<titular de la cuenta>
```

Después de agregarlas en Vercel, crear un nuevo deployment. No usar el prefijo `NEXT_PUBLIC_`: estos datos se entregan recién después de reservar un pedido por transferencia.

## Vercel

En **Project → Settings → Environment Variables**, agregar todas las variables para el ambiente correspondiente. Después de cambiar cualquier valor hay que crear un nuevo deployment: los deployments existentes no reciben cambios retroactivos.

No mezclar credenciales de prueba y producción en un mismo deployment.

## Probar Mercado Pago sin Correo Argentino

Mientras MiCorreo esté pendiente, el checkout puede usar una tarifa fija configurada únicamente desde el servidor:

```text
SHIPPING_MODE=flat
FLAT_SHIPPING_RATE_ARS=5000
```

El valor es un ejemplo y debe definirse para la prueba. Tanto la cotización mostrada al cliente como la validación previa al pago usan el mismo valor del servidor. Cuando Correo Argentino esté listo, cambiar `SHIPPING_MODE` a `correo` o eliminar la variable y volver a desplegar.
