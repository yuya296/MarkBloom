import { expect, test } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const fixturePath = path.join(__dirname, '..', 'fixtures', 'core.html');
const fixtureUrl = `file://${fixturePath}`;

const sampleMarkdown = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'markdown', 'sample.md'), 'utf8');

const comprehensiveMarkdown = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'markdown', 'comprehensive.md'), 'utf8');

const editorLocator = '.cm-content';

test('renders markdown content in read-only editor', async ({ page }) => {
    await page.goto(fixtureUrl);

    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));
    await page.evaluate((markdown) => {
        (window as any).MarkBloomCoreTest.render(markdown);
    }, sampleMarkdown);

    const editor = page.locator(editorLocator);
    await expect(editor).toContainText('Preview');
    await expect(editor).toContainText('| h1  | h2  |');
    await expect(editor).toContainText('| a   | b   |');
});

test('can reset core view without errors', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));

    await page.evaluate(() => {
        (window as any).MarkBloomCoreTest.reset();
    });

    await expect(page.locator(editorLocator)).toBeVisible();
    await expect(page.locator(editorLocator)).toHaveText('');
});

test('renders common markdown layouts comprehensively', async ({ page }) => {
    await page.goto(fixtureUrl);
    await page.waitForFunction(() => Boolean((window as any).MarkBloomCoreTest));

    await page.evaluate((markdown) => {
        (window as any).MarkBloomCoreTest.render(markdown);
    }, comprehensiveMarkdown);

    const editor = page.locator(editorLocator);
    await expect(editor).toContainText('H1 Title');
    await expect(editor).toContainText('Paragraph with **bold** and *italic* and `code`');
    await expect(editor).toContainText('quoted line 1');
    await expect(editor).toContainText('const answer = 42');
    await expect(editor).toContainText('cell3');
});
