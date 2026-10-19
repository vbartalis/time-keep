/**
 * `POST /mcp`: the Origin check, the bearer token, then one stateless MCP exchange
 * over the token's user. A fresh server and transport per request, answered as JSON.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateToken } from '#lib/server/auth/tokens.js';
import { openCore } from '#lib/server/core/index.js';
import type { DB } from '#lib/server/db/index.js';
import { createMcpServer } from './server';

// The app-wide body limit is raised for backup uploads; MCP keeps its own cap.
export const MCP_BODY_LIMIT = 524288;

const refuse = (status: number, error: string, headers?: HeadersInit) =>
	Response.json({ error }, { status, headers });

/** The body bytes, or null as soon as more than `limit` have been read. */
async function readCapped(
	request: Request,
	limit: number
): Promise<Uint8Array<ArrayBuffer> | null> {
	if (!request.body) return new Uint8Array(0);
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	return new Uint8Array(Buffer.concat(chunks));
}

export async function handleMcp(
	request: Request,
	deps: { db: DB; origin: string; now?: number }
): Promise<Response> {
	const origin = request.headers.get('origin');
	if (origin !== null && origin !== deps.origin) return refuse(403, 'Forbidden.');

	const auth = authenticateToken(deps.db, request.headers.get('authorization'), deps.now);
	if (!auth) return refuse(401, 'Unauthorized.', { 'WWW-Authenticate': 'Bearer' });

	const bytes = await readCapped(request, MCP_BODY_LIMIT);
	if (!bytes) return refuse(413, 'Too large.');
	const capped = new Request(request, { body: bytes });

	const server = createMcpServer(openCore(deps.db, auth.userId, 'agent'));
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	try {
		await server.connect(transport);
		return await transport.handleRequest(capped);
	} finally {
		await transport.close();
		await server.close();
	}
}
