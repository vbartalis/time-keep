import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	testMatch: '**/*.test.ts',
	workers: 1,
	use: {
		baseURL: 'http://localhost:4173',
		// adapter-node 6 ignores ORIGIN and takes the scheme from PROTOCOL_HEADER (https if
		// absent). The header stands in for the reverse proxy that sets it in production.
		extraHTTPHeaders: { 'x-forwarded-proto': 'http' }
	},
	webServer: {
		command: 'rm -rf test-results/e2e && npm run build && node build',
		url: 'http://localhost:4173/healthz',
		reuseExistingServer: false,
		timeout: 180_000,
		env: {
			DATABASE_PATH: 'test-results/e2e/time-keep.db',
			ADMIN_USERNAME: 'admin',
			ADMIN_PASSWORD: 'admin-password-1',
			PORT: '4173',
			PROTOCOL_HEADER: 'x-forwarded-proto',
			BODY_SIZE_LIMIT: '100M'
		}
	},
	projects: [
		{ name: 'phone', use: { ...devices['Pixel 7'] } },
		{ name: 'pc', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
	]
});
