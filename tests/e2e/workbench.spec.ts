import { expect, test } from '@playwright/test';

test('renders demo workbench and switches host profile', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('main-ui workbench')).toBeVisible();
  await page.getByTitle('Matheshop').click();
  await expect(page.getByRole('heading', { name: 'Formula canvas viewport' })).toBeVisible();
});
