import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const sourceDirectory = process.argv[2];
if (!sourceDirectory) throw new Error('Uso: node scripts/ingest-product-images.mjs <carpeta>');

const envText = await readFile('.env.local', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter((line) => line && !line.trimStart().startsWith('#') && line.includes('=')).map((line) => {
  const separator = line.indexOf('=');
  return [line.slice(0, separator).trim(), line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')];
}));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');

const supabase = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
const supported = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']]);
const files = (await readdir(sourceDirectory)).filter((name) => supported.has(extname(name).toLowerCase())).sort();
const result = { uploaded: 0, skipped: [], failed: [] };

for (const fileName of files) {
  const sku = fileName.replace(/\.[^.]+$/, '').toUpperCase();
  if (sku === 'SAN-0055') { result.skipped.push({ sku, reason: 'debe permanecer sin imagen' }); continue; }
  const { data: variant, error: variantError } = await supabase.from('product_variants').select('id, product_id, sku').eq('sku', sku).maybeSingle();
  if (variantError || !variant) { result.skipped.push({ sku, reason: variantError?.message ?? 'SKU inexistente' }); continue; }
  const extension = extname(fileName).toLowerCase() === '.jpeg' ? '.jpg' : extname(fileName).toLowerCase();
  const storagePath = `products/${sku}${extension}`;
  const bytes = await readFile(join(sourceDirectory, fileName));
  const { error: uploadError } = await supabase.storage.from('product-images').upload(storagePath, bytes, { contentType: supported.get(extname(fileName).toLowerCase()), upsert: true });
  if (uploadError) { result.failed.push({ sku, step: 'storage', reason: uploadError.message }); continue; }
  const { error: rowError } = await supabase.from('product_images').upsert({ product_id: variant.product_id, variant_id: variant.id, storage_path: storagePath, alt_text: `${variant.sku} · imagen de producto`, sort_order: 0 }, { onConflict: 'storage_path' });
  if (rowError) { result.failed.push({ sku, step: 'database', reason: rowError.message }); continue; }
  result.uploaded += 1;
}

console.log(JSON.stringify(result, null, 2));
if (result.failed.length) process.exitCode = 1;
