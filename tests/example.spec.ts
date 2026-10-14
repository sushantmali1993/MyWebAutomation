// @ts-check
import { test, expect } from '@playwright/test';

const baseUrl = process.env.BASE_URL;
const expectedTitle = process.env.EXPECTED_TITLE;

test('has expected title', async ({ page }) => {
  test.skip(!baseUrl || !expectedTitle, 'Set BASE_URL and EXPECTED_TITLE to run this test.');

  await page.goto(baseUrl!);
  await expect(page).toHaveTitle(expectedTitle!);
});
