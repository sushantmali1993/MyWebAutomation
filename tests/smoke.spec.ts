import { test, expect } from '@playwright/test';

test('SIXT ride landing page loads', async ({ page }) => {
  await page.goto('https://internal-com.sixt.io/ride/');

  await expect(
    page.getByRole('heading', {
      name: /RELIABLE AIRPORT TRANSFERS AND PREMIUM CHAUFFEUR SERVICES/i,
    })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show offers' })).toBeVisible();
});
