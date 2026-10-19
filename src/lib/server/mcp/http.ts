/**
 * `POST /mcp`: the Origin check, the bearer token, then one stateless MCP exchange
 * over the token's user. A fresh server and transport per request, answered as JSON.
 */
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { authenticateToken } from '#lib/server/auth/tokens.js';
import { openCore } from '#lib/server/core/index.js';
import type { DB } from '#lib/server/db/index.js';
import { createMcpServer } from './server';

const refuse = (status: number, error: string, headers?: HeadersInit) =>
	Response.json({ error }, { status, headers });

export async function handleMcp(
	request: Request,
	deps: { db: DB; origin: string; now?: number }
): Promise<Response> {
	const origin = request.headers.get('origin');
	if (origin !== null && origin !== deps.origin) return refuse(403, 'Forbidden.');

	const auth = authenticateToken(deps.db, request.headers.get('authorization'), deps.now);
	if (!auth) return refuse(401, 'Unauthorized.', { 'WWW-Authenticate': 'Bearer' });

	const server = createMcpServer(openCore(deps.db, auth.userId, 'agent'));
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});
	try {
		await server.connect(transport);
		return await transport.handleRequest(request);
	} finally {
		await transport.close();
		await server.close();
	}
}
