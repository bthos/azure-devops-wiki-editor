import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary'],
            /** Core logic modules; extension entrypoints and Milkdown glue are exercised manually / E2E. */
            include: ['src/ado-wiki-api.ts', 'src/services/attachment-service.ts'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
        },
    },
});
