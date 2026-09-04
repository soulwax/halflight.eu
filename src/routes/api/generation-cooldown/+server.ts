import { error, json, type RequestHandler } from '@sveltejs/kit';
import * as v from 'valibot';
import { recordGenerationCooldown } from '#lib/server/taste/cooldown';

const cooldownRequestSchema = v.object({
	trackIds: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(128))),
		v.minLength(1),
		v.maxLength(100)
	)
});

export const POST: RequestHandler = async (event) => {
	const user = event.locals.user;
	if (!user) throw error(401, 'Unauthorized');

	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid_generation_cooldown' }, { status: 400 });
	}

	const input = v.safeParse(cooldownRequestSchema, body);
	if (!input.success) {
		return json({ error: 'invalid_generation_cooldown' }, { status: 400 });
	}

	try {
		await recordGenerationCooldown(user.id, input.output.trackIds);
		return new Response(null, { status: 204 });
	} catch {
		return json({ error: 'generation_cooldown_unavailable' }, { status: 503 });
	}
};
