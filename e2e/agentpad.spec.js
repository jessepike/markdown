import { test, expect } from '@playwright/test';

test('library, shelf, and search flows work in browser preview', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Get Started' }).click();

    await page.getByRole('complementary').getByRole('button', { name: 'Library' }).click();
    await page.getByRole('banner').getByRole('button', { name: 'New Prompt' }).click();

    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
    await expect(page.locator('input.surface-title-input')).toHaveValue('# New Prompt');

    await page.getByRole('complementary').getByRole('button', { name: 'Shelf' }).click();
    await page.getByPlaceholder('Capture a note, snippet, or code block directly into the Shelf...').fill('console.log("hello shelf");');
    await page.getByRole('button', { name: 'Save Note' }).click();

    await expect(page.locator('pre.surface-code-block')).toContainText('console.log("hello shelf");');

    await page.getByRole('complementary').getByRole('button', { name: 'Search' }).click();
    await page.getByPlaceholder('Search prompts, shelf, tabs, and files').fill('hello shelf');

    await expect(page.locator('.content-view.active .surface-list .surface-list-item').first()).toContainText('console.log("hello shelf");');
});
