// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { EntryFormData } from '#lib/components/entry/types.js';
import type { Session, User } from '#lib/server/db/schema.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		// interface PageData {}
		interface PageState {
			/** The entry form opened in place over the screen (shallow routing), with its address. */
			entryForm?: EntryFormData & { href: string };
		}
		// interface Platform {}
	}
}

export {};
