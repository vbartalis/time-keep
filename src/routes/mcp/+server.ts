import { getDb } from '#lib/server/db/index.js';
import { handleMcp } from '#lib/server/mcp/http.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request, url }) =>
	handleMcp(request, { db: getDb(), origin: url.origin });
