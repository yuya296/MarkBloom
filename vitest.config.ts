import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/unit/**/*.spec.ts'],
        watch: false,
        reporters: ['default', ['junit', { outputFile: 'out/test-results/vitest/junit.xml' }]]
    }
});
