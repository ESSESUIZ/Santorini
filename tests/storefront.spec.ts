import { expect, test } from '@playwright/test';

test('la portada ofrece tienda y acceso de clientes', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /tienda|ver colección/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /iniciar sesión|mi cuenta/i }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Operación clara');
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
