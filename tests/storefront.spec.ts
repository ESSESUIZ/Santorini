import { expect, test } from '@playwright/test';

test('la portada ofrece tienda y acceso de clientes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /tienda|ver colección/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /iniciar sesión|mi cuenta/i }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Operación clara');
  await expect(page.getByRole('heading', { name: /buscás una pieza especial/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /escribir por instagram/i })).toHaveAttribute('href', 'https://ig.me/m/santorini_oficial1');
  await expect(page.locator('.home-story img[src="/santorini-island-hero.png"]')).toHaveCount(1);
});

test('el carrito respeta el stock real de la variante', async ({ page }) => {
  await page.goto('/tienda');
  const href = await page.locator('.product-image').first().getAttribute('href');
  await page.goto(href!);
  const stockText = await page.locator('.product-stock').innerText();
  const stock = Number(stockText.match(/\d+/)?.[0] ?? 0);
  expect(stock).toBeGreaterThan(0);
  const add = page.locator('.product-add');
  for (let quantity = 0; quantity < stock; quantity += 1) await add.click();
  await expect(add).toBeDisabled();
  await expect(add).toContainText(/máximo disponible en carrito/i);
  await expect(page.locator('.bag-link')).toContainText(String(stock));
});

test('la tienda muestra el catálogo y navega al producto', async ({ page }) => {
  await page.goto('/tienda');
  await expect(page.getByRole('heading', { name: /lo esencial/i })).toBeVisible();
  const productLink = page.locator('.product-image').first();
  await expect(productLink).toBeVisible();
  const href = await productLink.getAttribute('href');
  expect(href).toMatch(/^\/producto\/SAN-/);
  await page.goto(href!);
  await expect(page).toHaveURL(/\/producto\/SAN-/);
  await expect(page.locator('.product-purchase h1')).toBeVisible();
});

test('operación exige autenticación', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole('heading', { name: /panel operativo/i })).toBeVisible();
});

test('pedidos exige autenticación administrativa', async ({ page }) => {
  await page.goto('/admin/pedidos');
  await expect(page).toHaveURL(/\/admin\/login/);
});
