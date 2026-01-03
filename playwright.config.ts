import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
    testDir: path.join(__dirname, 'tests/e2e'),
    reporter: [['list']],
    use: {
        headless: true
    }
});
