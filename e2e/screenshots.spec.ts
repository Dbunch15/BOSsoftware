import { expect, test } from '@playwright/test';

/**
 * Generates docs/screenshots/* for PR descriptions (`npm run build && npm run screenshots`) at
 * full render quality. Clipped page screenshots are used because element screenshots wait for a
 * layout-stability check that a slow software-GL frame loop rarely satisfies.
 */
for (const id of ['lagoon', 'kidney-spa']) {
  test(`screenshots: ${id}`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByTestId(`template-${id}`).click();
    await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-mesh-sig', /.+/);

    await page.keyboard.press('2');
    await page.waitForTimeout(800);
    const plan = (await page.locator('section.pane[aria-label="Plan"]').boundingBox())!;
    await page.screenshot({ path: `docs/screenshots/${id}-plan.png`, clip: plan, timeout: 300_000 });

    await page.keyboard.press('3');
    await page.waitForTimeout(8000);
    const view = (await page.locator('section.pane[aria-label="3D view"]').boundingBox())!;
    await page.screenshot({ path: `docs/screenshots/${id}-3d.png`, clip: view, timeout: 300_000 });
  });
}
