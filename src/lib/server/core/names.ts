import { z } from 'zod';

export const nameSchema = z
	.string()
	.trim()
	.min(1, 'Name must be 1–100 characters.')
	.max(100, 'Name must be 1–100 characters.');

/** The case-insensitive uniqueness key: Unicode NFC, then lowercased. */
export function nameKey(name: string): string {
	return name.normalize('NFC').toLowerCase();
}
