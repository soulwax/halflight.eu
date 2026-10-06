import { error, json, type RequestHandler } from '@sveltejs/kit';
import { createOpenApiDocument } from '#lib/api-reference';

/** Owner-only machine-readable counterpart to the in-app API workbench. */
export const GET: RequestHandler = (event) => {
	if (!event.locals.user || !event.locals.isListener) error(401, 'Unauthorized');
	return json(createOpenApiDocument(), { headers: { 'cache-control': 'private, no-store' } });
};
