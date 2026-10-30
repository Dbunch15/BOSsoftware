import { writeFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

/**
 * Generates docs/screenshots/* for PR descriptions (`npm run screenshots`) at full render quality.
 * The 3D view is read straight from the WebGL canvas: page screenshots wait for compositor frames,
 * which a software-GL frame loop delivers too slowly to be practical.
 */
async function saveCanvas(page: Page, path: string) {
  const dataUrl = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const canvas = document.querySelector<HTMLCanvasElement>('[data-testid=viewport3d] canvas')!;
        requestAnimationFrame(() => resolve(canvas.toDataURL('image/png')));
      }),
  );
  writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
}

for (const id of ['lagoon', 'kidney-spa']) {
  test(`screenshots: ${id}`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.getByTestId(`template-${id}`).click();
    await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-mesh-sig', /.+/);

    await page.keyboard.press('2');
    await page.waitForTimeout(800);
    const plan = (await page.locator('section.pane[aria-label="Plan"]').boundingBox())!;
    await page.screenshot({ path: `docs/screenshots/${id}-plan.png`, clip: plan, timeout: 300_000 });

    await page.keyboard.press('3');
    await page.waitForTimeout(12_000);
    await saveCanvas(page, `docs/screenshots/${id}-3d.png`);
  });
}
