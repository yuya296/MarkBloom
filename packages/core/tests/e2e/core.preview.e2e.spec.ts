import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const fixturePath = path.join(__dirname, '..', 'fixtures', 'core.html');
const fixtureUrl = `file://${fixturePath}`;

const sampleMarkdown = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'markdown', 'sample.md'), 'utf8');

const comprehensiveMarkdown = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'markdown', 'comprehensive.md'), 'utf8');

test('renders table and headings in core view', async ({ page }) => {
    await page.goto(fixtureUrl);

    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));
    await page.evaluate((markdown) => {
        (window as any).MarkBloomCoreTest.render(markdown);
    }, sampleMarkdown);

    await expect(page.getByRole('heading', { level: 1, name: 'Preview' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'a' })).toBeVisible();
});

test('can reset core view without errors', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));

    await page.evaluate(() => {
        (window as any).MarkBloomCoreTest.reset();
    });

    await expect(page.locator('#root')).toBeVisible();
});

test('renders common markdown layouts comprehensively', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));

    await page.evaluate((markdown) => {
        (window as any).MarkBloomCoreTest.render(markdown);
    }, comprehensiveMarkdown);

    await expect(page.getByRole('heading', { level: 1, name: 'H1 Title' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'H2 Section' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 3, name: 'H3 Sub' })).toBeVisible();

    await expect(page.locator('p', { hasText: 'Paragraph with' })).toBeVisible();
    await expect(page.locator('p strong', { hasText: 'bold' })).toBeVisible();
    await expect(page.locator('p em', { hasText: 'italic' })).toBeVisible();
    await expect(page.locator('p del', { hasText: 'strike' })).toBeVisible();
    await expect(page.locator('p code', { hasText: 'code' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'link' })).toHaveAttribute('href', 'https://example.com');
    await expect(page.locator('img[alt="pixel"]')).toBeVisible();

    await expect(page.locator('ul li')).toHaveCount(3);
    await expect(page.locator('ol li')).toHaveCount(2);

    await expect(page.locator('blockquote')).toContainText('quoted line 1');
    await expect(page.locator('hr')).toHaveCount(1);

    await expect(page.locator('pre code')).toContainText('const answer = 42');

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    await expect(table.getByRole('cell', { name: 'cell3' })).toBeVisible();
});
