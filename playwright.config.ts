import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
    testDir: path.join(__dirname, 'tests/e2e'),
    reporter: [
        ['list'],
        ['junit', { outputFile: 'out/test-results/playwright/results.xml' }],
        ['html', { outputFolder: 'out/test-results/playwright/html', open: 'never' }]
    ],
    use: {
        headless: true
    }
});
