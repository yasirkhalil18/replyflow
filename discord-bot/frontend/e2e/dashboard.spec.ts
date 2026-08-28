import { test, expect } from '@playwright/test';

test.describe('Discord Automation SaaS Dashboard E2E Tests', () => {

  test('should load landing page and display Discord OAuth CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Discord Automation Cloud/);
    const ctaButton = page.locator('text=Continue with Discord');
    await expect(ctaButton).toBeVisible();
  });

  test('should navigate to dashboard overview and display server metrics', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.locator('text=Server Overview')).toBeVisible();
    await expect(page.locator('text=Total Members')).toBeVisible();
  });

  test('should open plugin marketplace and filter by category', async ({ page }) => {
    await page.goto('/dashboard/plugins');
    await expect(page.locator('text=Plugin Marketplace')).toBeVisible();
    
    // Test category tab click
    await page.click('button:has-text("Engagement")');
    await expect(page.locator('text=Welcome & Auto Role')).toBeVisible();
  });

  test('should open visual automation builder and execute dry run', async ({ page }) => {
    await page.goto('/dashboard/automation');
    await expect(page.locator('text=Visual Automation Engine')).toBeVisible();
    await page.click('button:has-text("Dry Run Workflow")');
  });

});
