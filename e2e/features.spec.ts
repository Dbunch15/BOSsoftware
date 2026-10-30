import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Page, expect, test } from '@playwright/test';

async function newProject(page: Page, template: string, name: string) {
  await page.goto('/?quality=low');
  await expect(page.getByTestId('template-gallery')).toBeVisible();
  await page.getByTestId('new-project-name').fill(name);
  await page.getByTestId(`template-${template}`).click();
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', '1');
  await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-mesh-sig', /.+/);
}

test('rockwork: draw a waterfall, tweak it, undo it', async ({ page }) => {
  await newProject(page, 'blank', 'Rock test');
  const svg = (await page.getByTestId('plan-svg').boundingBox())!;
  const cx = svg.x + svg.width / 2;

  // Three points along the north edge of the oval, just outside the waterline.
  const top = (await page.locator('[data-testid=ctrl-pt][data-index="7"]').boundingBox())!;
  const y = top.y - 30;
  await page.keyboard.press('k');
  await page.getByTestId('preset-waterfall').click();
  await page.mouse.click(cx - 110, y + 10);
  await page.mouse.click(cx, y - 8);
  await page.mouse.click(cx + 110, y + 10);
  await expect(page.getByTestId('rock-draft')).toBeVisible();
  await page.keyboard.press('Enter');

  const rocks = page.getByTestId('plan-rockwork');
  await expect(rocks).toHaveCount(1);
  await expect.poll(async () => Number(await page.getByTestId('viewport3d').getAttribute('data-rock-count'))).toBeGreaterThan(10);
  await expect(page.getByTestId('rock-waterfall')).toBeChecked();

  // Raising the wall restacks the boulders.
  const before = Number(await rocks.getAttribute('data-rocks'));
  await page.getByTestId('rock-height').fill(`7'`);
  await page.getByTestId('rock-height').press('Enter');
  await expect.poll(async () => Number(await rocks.getAttribute('data-rocks'))).toBeGreaterThan(before);

  // Undo twice: height change, then the rockwork itself.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  await expect.poll(async () => Number(await rocks.getAttribute('data-rocks'))).toBe(before);
  await page.keyboard.press('Control+z');
  await expect(rocks).toHaveCount(0);
  await expect(page.getByTestId('viewport3d')).toHaveAttribute('data-rock-count', '0');
});

test('finish: import a sample photo and keep it after reload', async ({ page }) => {
  await newProject(page, 'plunge-shelf', 'Photo test');
  await expect(page.getByTestId('finish-source')).toContainText('Procedural');

  // Make a 1200×900 "photo" of a speckled sample in the browser and save it to disk.
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0, 0, 1200, 900);
    g.addColorStop(0, '#e9e0cc');
    g.addColorStop(1, '#d4c6a8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1200, 900);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40000; i++) {
      ctx.fillStyle = ['#fffaf0', '#b8a582', '#8d7a5a', '#f2eadb'][Math.floor(r() * 4)];
      ctx.beginPath();
      ctx.arc(r() * 1200, r() * 900, 0.6 + r() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  });
  const file = join(tmpdir(), `naturi-sample-${Date.now()}.jpg`);
  writeFileSync(file, Buffer.from(b64, 'base64'));

  await page.getByTestId('import-photo').click();
  await page.getByTestId('photo-file').setInputFiles(file);
  await page.getByRole('button', { name: '2K' }).click();
  await page.getByTestId('photo-process').click();
  await expect(page.getByTestId('photo-apply')).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId('photo-apply').click();
  await expect(page.getByTestId('finish-source')).toContainText('Your sample photo');
  await expect(page.getByTestId('finish-source')).toContainText('512 px');

  await page.reload();
  await expect(page.getByTestId('app')).toHaveAttribute('data-ready', '1');
  await expect(page.getByTestId('finish-source')).toContainText('Your sample photo');
});
