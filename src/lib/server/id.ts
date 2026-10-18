const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** Bytes as lowercase base32 characters, no padding. */
export function base32(bytes: Uint8Array): string {
	let bits = 0;
	let value = 0;
	let out = '';
	for (const byte of bytes) {
		value = (value << 8) | byte;
		bits += 8;
		while (bits >= 5) {
			out += ALPHABET[(value >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
	return out;
}

/** 16 random bytes as 26 lowercase base32 characters, no padding. */
export function newId(): string {
	return base32(crypto.getRandomValues(new Uint8Array(16)));
}
