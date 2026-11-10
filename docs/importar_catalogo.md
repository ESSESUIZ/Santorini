# Importar catálogo inicial

La importación usa tres tablas de staging para que los identificadores `PRD-xxx` de la planilla se traduzcan a UUID internos de Supabase sin edición manual.

## 1. Aplicar la migración

Ejecutar `supabase/migrations/003_catalog_import_staging.sql` en SQL Editor.

## 2. Crear CSV UTF-8

Desde el archivo normalizado, crear estos CSV con estos encabezados exactos:

`import_products.csv`

```csv
legacy_id,name,category,brand,status,web_status
PRD-001,Nombre del producto,Hoodies,,active,draft
```

Usar la pestaña **Productos**: `product_id` pasa a llamarse `legacy_id`. No incluir `source_row` ni `legacy_group`.

`import_variants.csv`

```csv
sku,legacy_product_id,color,size,price_ars,cost_usd
SAN-0001,PRD-001,Abbey stone,XL,155000,66.4
```

Usar la pestaña **Variantes**: `product_id` pasa a llamarse `legacy_product_id`. No incluir margen, estado ni columnas de control.

`import_inventory.csv`

```csv
sku,location_name,quantity_on_hand
SAN-0001,Depósito principal,1
```

Crear esta planilla sólo después del recuento físico. Omitir variantes sin unidades y nunca reemplazar un valor desconocido por `0`.

## 3. Cargar staging

En Supabase Dashboard, ir a **Table Editor** y, para cada tabla `import_products`, `import_variants` e `import_inventory`, usar **Insert → Import data from CSV**. Cargar en ese orden.

## 4. Aplicar importación

Iniciar sesión en la app con un usuario `admin`, luego ejecutar en SQL Editor:

```sql
select public.apply_catalog_import();
```

La respuesta indica cuántos productos, variantes y movimientos iniciales se insertaron o actualizaron. Es seguro volver a ejecutarla: no duplica el movimiento inicial de una combinación variante/ubicación.

## 5. Publicar

Revisar los registros en `products`, cargar imágenes en Storage y cambiar `web_status` a `published` sólo para productos con stock confirmado.
