import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const params = new URLSearchParams();
	for (const key of ['connected', 'disconnected', 'error']) {
		const value = event.url.searchParams.get(key);
		if (value !== null) params.set(key, value);
	}

	const suffix = params.size ? `?${params}` : '';
	redirect(308, `/app/settings/tidal${suffix}`);
};
