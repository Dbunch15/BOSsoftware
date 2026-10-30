import { type Page, expect, test } from '@playwright/test';

const meshSig = (page: Page) => page.getByTestId('viewport3d').getAttribute('data-mesh-sig');
const contourSig = (page: Page) => page.getByTestId('plan-svg').getAttribute('data-contour-sig');

async function waitForModel(page: Page) {
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', '1');
  await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-mesh-sig', /.+/);
}

async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-state', 'saved');
}

test('new project → template → edit → warnings → undo → switch → reload', async ({ page }) => {
  // Low render quality keeps software-WebGL CI fast; the pipeline is the same.
  await page.goto('/?quality=low');

  // New project from the lagoon template.
  await expect(page.getByTestId('template-gallery')).toBeVisible();
  await page.getByTestId('new-project-name').fill('Smoke lagoon');
  await page.getByTestId('template-lagoon').click();
  await waitForModel(page);
  await expect(page.getByTestId('project-name')).toHaveText('Smoke lagoon');
  await expect(page.getByTestId('warnings-empty')).toBeVisible();

  const mesh0 = await meshSig(page);
  const contours0 = await contourSig(page);
  expect(mesh0).toBeTruthy();
  expect(contours0).toBeTruthy();

  // Drag the far (east) outline point halfway toward the beach: the pool gets too short for its
  // beach, the run compresses and the slope steepens.
  const east = page.locator('[data-testid=ctrl-pt][data-index="0"]');
  const west = page.locator('[data-testid=ctrl-pt][data-index="8"]');
  const a = (await east.boundingBox())!;
  const b = (await west.boundingBox())!;
  const from = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const to = { x: from.x + (b.x + b.width / 2 - from.x) * 0.5, y: from.y };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();

  // Both views re-derive from the model.
  await expect.poll(() => meshSig(page)).not.toBe(mesh0);
  await expect.poll(() => contourSig(page)).not.toBe(contours0);

  // Steep-beach warning in the plan, in 3D and in the warnings panel.
  await expect(page.locator('[data-testid=plan-warning][data-rule=maxBeachSlope]').first()).toBeVisible();
  await expect(page.locator('[data-testid="3d-warning"][data-rule=maxBeachSlope]').first()).toBeAttached();
  await expect(page.locator('[data-testid=warning-item][data-rule=maxBeachSlope]').first()).toBeVisible();

  // Undo restores the exact previous geometry and clears the warning.
  await page.keyboard.press('Control+z');
  await expect.poll(() => meshSig(page)).toBe(mesh0);
  await expect.poll(() => contourSig(page)).toBe(contours0);
  await expect(page.locator('[data-testid=plan-warning][data-rule=maxBeachSlope]')).toHaveCount(0);
  await expect(page.locator('[data-testid="3d-warning"][data-rule=maxBeachSlope]')).toHaveCount(0);
  await waitSaved(page);

  // Create a second project, then switch back.
  await page.getByTestId('project-switcher').click();
  await page.getByTestId('new-project').click();
  await page.getByTestId('new-project-name').fill('Smoke kidney');
  await page.getByTestId('template-kidney-spa').click();
  await expect(page.getByTestId('project-name')).toHaveText('Smoke kidney');
  await expect.poll(() => meshSig(page)).not.toBe(mesh0);
  await waitSaved(page);

  await page.getByTestId('project-switcher').click();
  await page.locator('[data-testid=project-item][data-name="Smoke lagoon"]').click();
  await expect(page.getByTestId('project-name')).toHaveText('Smoke lagoon');
  await expect.poll(() => meshSig(page)).toBe(mesh0);
  await expect.poll(() => contourSig(page)).toBe(contours0);

  // Reload: the last-open project and its geometry persist.
  await page.reload();
  await waitForModel(page);
  await expect(page.getByTestId('project-name')).toHaveText('Smoke lagoon');
  await expect.poll(() => meshSig(page)).toBe(mesh0);
  await expect.poll(() => contourSig(page)).toBe(contours0);
  await page.getByTestId('project-switcher').click();
  await expect(page.getByTestId('project-item')).toHaveCount(2);
});
