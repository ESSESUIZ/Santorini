# Cuentas de clientes

## Flujo definido

1. Cualquier visitante puede entrar a la portada, recorrer la tienda y armar su bolsa sin registrarse.
2. Desde **Iniciar sesión** puede acceder o crear una cuenta con nombre, email y contraseña.
3. Si la confirmación de email está habilitada, Supabase envía el enlace y la cuenta queda activa después de confirmarlo.
4. Los datos comerciales del cliente se guardan en `customer_profiles`, separados de `profiles`, que conserva únicamente los roles internos.
5. El enlace **Operación** solo aparece cuando la sesión corresponde a un registro `profiles.role = 'admin'`.
6. Las tablas privadas usan RLS: cada cliente solo puede leer y actualizar su propia fila.

## Configuración necesaria en Supabase

Después de ejecutar `007_customer_accounts.sql`:

1. Ir a **Authentication → Providers → Email**.
2. Mantener habilitados **Allow new users to sign up** y **Confirm Email**.
3. Ir a **Authentication → URL Configuration**.
4. Configurar **Site URL** con la URL productiva de Vercel.
5. Agregar como Redirect URLs:
   - `http://localhost:3001/cuenta`
   - `https://santorini-mauve.vercel.app/cuenta`
   - el dominio definitivo cuando exista.
6. Antes de producción, configurar SMTP propio. El servicio de prueba de Supabase tiene límites muy bajos.

## Siguiente incremento recomendado

- Recuperación de contraseña.
- Direcciones de envío y teléfono dentro de la cuenta.
- Checkout invitado o autenticado.
- Historial y estado de pedidos.
- Opcional: acceso con Google.

La cuenta debe aportar comodidad, no ser una barrera de entrada a la tienda.
