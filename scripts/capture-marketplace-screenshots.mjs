// Capture only our synthetic local layouts in a fresh browser profile.
// Install Chrome first, or set SCREENSHOT_BROWSER to its executable path.
import { chromium } from 'playwright-core';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import './marketplace-screenshots.mjs';

const source = resolve('output/slack-listing/october-2026');
const destination = resolve('public/assets/slack-marketplace/2026-10');
const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.SCREENSHOT_BROWSER ? { executablePath: process.env.SCREENSHOT_BROWSER } : { channel: 'chrome' }),
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: manifest.width, height: manifest.height }, deviceScaleFactor: 1 });
  for (const slide of manifest.slides) {
    await page.goto(pathToFileURL(resolve(source, slide.file.replace('.png', '.html'))).href);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.locator('.blocks').evaluate(el => ({ content: el.scrollHeight, available: el.clientHeight }));
    if (overflow.content > overflow.available) throw new Error(`${slide.file}: cropped content (${JSON.stringify(overflow)})`);
    const path = resolve(destination, slide.file);
    await page.screenshot({ path });
    const bytes = (await stat(path)).size;
    if (bytes >= manifest.maxBytes) throw new Error(`${slide.file}: exceeds size budget`);
    console.log(`${slide.file}: ${manifest.width} × ${manifest.height}, ${bytes} bytes, no content overflow`);
  }
} finally {
  await browser.close();
}
// -FS synchronizes the archive, removing obsolete entries from this specific bundle.
execFileSync('zip', ['-j', '-FS', resolve(destination, 'kick-slack-listing-images.zip'),
  ...manifest.slides.map(s => resolve(destination, s.file)), resolve(source, 'README.txt')]);
