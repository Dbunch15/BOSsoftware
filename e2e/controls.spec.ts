import { type Page, expect, test } from '@playwright/test';

async function open(page: Page, template = 'lagoon') {
  await page.goto('/?quality=low&e2e');
  await page.getByTestId(`template-${template}`).click();
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', '1');
  await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-mesh-sig', /.+/);
}

const toolOf = (page: Page) => page.locator('[data-testid^=hotbar-][aria-pressed=true]').getAttribute('data-tool');

test('hotbar, tool wheel and scroll-sized brush', async ({ page }) => {
  await open(page);

  // Number keys pick hotbar slots.
  await page.keyboard.press('6');
  await expect(page.getByTestId('hotbar-6')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => toolOf(page)).toBe('rock');
  await page.keyboard.press('1');
  await expect.poll(() => toolOf(page)).toBe('select');

  // Hold Q for the wheel, point at Flatten, release.
  const plan = (await page.getByTestId('plan-svg').boundingBox())!;
  await page.mouse.move(plan.x + plan.width / 2, plan.y + plan.height / 2);
  await page.keyboard.down('q');
  await expect(page.getByTestId('wheel-flatten')).toBeVisible();
  await page.getByTestId('wheel-flatten').hover();
  await page.keyboard.up('q');
  await expect(page.getByTestId('tool-wheel')).toHaveCount(0);
  await expect(page.locator('[data-testid=tool-flatten][aria-pressed=true]')).toHaveCount(1);

  // Alt+9 stores the current tool (flatten) in slot 9.
  await page.keyboard.press('Alt+Digit9');
  await expect(page.getByTestId('hotbar-9')).toHaveAttribute('data-tool', 'flatten');

  // Scrolling over the plan while sculpting resizes the brush instead of zooming.
  const pill = page.getByTestId('brush-pill');
  const before = await pill.locator('b').textContent();
  await page.mouse.move(plan.x + plan.width / 2, plan.y + plan.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => pill.locator('b').textContent()).not.toBe(before);
  await page.getByTestId('shape-flat').click();
  await expect(pill).toContainText('Flat');

  // Shift+1/2/3 still switch layouts.
  await page.keyboard.press('Shift+Digit2');
  await expect(page.locator('section.pane[aria-label="3D view"]')).toBeHidden();
  await page.keyboard.press('Shift+Digit1');
  await expect(page.locator('section.pane[aria-label="3D view"]')).toBeVisible();
});

test('3D: drag an outline handle, fly with right mouse', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Shift+Digit3');
  const view = page.getByTestId('viewport3d');
  await expect.poll(() => page.evaluate(() => !!(window as unknown as { __nps3d?: unknown }).__nps3d)).toBe(true);
  const mesh0 = await view.getAttribute('data-mesh-sig');

  // Grab outline point 4 (south side) and pull it outward.
  // Wait for the camera to settle after the layout change (it re-frames to the new aspect).
  const probe = () =>
    page.evaluate(() => {
      const p = (window as unknown as { __nps3d: { project(x: number, y: number, z: number): { x: number; y: number } } }).__nps3d.project(0, 0, 0);
      return `${Math.round(p.x)},${Math.round(p.y)}`;
    });
  let last = '';
  await expect
    .poll(async () => {
      const now = await probe();
      const same = now === last;
      last = now;
      return same;
    }, { intervals: [500] })
    .toBe(true);
  // Read its exact position from the plan.
  const p4 = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=ctrl-pt][data-index="4"]') as SVGCircleElement | null;
    return el ? { x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy')) } : null;
  });
  const target = p4 ?? { x: -0.9, y: 4.2 };
  const scr = await page.evaluate(
    ([x, z]) => (window as unknown as { __nps3d: { project(x: number, y: number, z: number): { x: number; y: number } } }).__nps3d.project(x, 0.06, z),
    [target.x, target.y] as const,
  );
  const to = await page.evaluate(
    ([x, z]) => (window as unknown as { __nps3d: { project(x: number, y: number, z: number): { x: number; y: number } } }).__nps3d.project(x, 0.06, z),
    [target.x, target.y + 1.5] as const,
  );
  await page.mouse.move(scr.x, scr.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => view.getAttribute('data-mesh-sig')).not.toBe(mesh0);
  await page.keyboard.press('Control+z');
  await expect.poll(() => view.getAttribute('data-mesh-sig')).toBe(mesh0);

  // Hold right mouse to fly; W moves without toggling the water (W's normal shortcut).
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: 'right' });
  await expect(page.getByTestId('fly-hud')).toBeVisible();
  await page.keyboard.down('w');
  await page.waitForTimeout(400);
  await page.keyboard.up('w');
  await page.mouse.up({ button: 'right' });
  await expect(page.getByTestId('fly-hud')).toHaveCount(0);
  await expect(page.locator('button[title="Water (W)"]')).toHaveAttribute('aria-pressed', 'true');
});
