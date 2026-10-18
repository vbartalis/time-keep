import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_PATH: {
		description: 'Path to the SQLite database file.',
		schema: (value) => value || './data/time-keep.db'
	},
	ADMIN_USERNAME: {
		description: 'Username of the first admin, used only while no admin exists.',
		schema: (value) => value || undefined
	},
	ADMIN_PASSWORD: {
		description: 'Password of the first admin, used only while no admin exists.',
		schema: (value) => value || undefined
	}
});
