import { redirect } from '@sveltejs/kit';
import {
	getConnectionStatus,
	tidalApi,
	TidalError,
	type Document,
	type Resource
} from '#lib/server/tidal';
import type { CollectionKind, MixKind } from '#lib/server/tidal/api';
import type { PageServerLoad } from './$types';

const COLLECTION_KINDS: CollectionKind[] = ['albums', 'artists', 'tracks', 'playlists'];
const MIX_KINDS: MixKind[] = ['daily', 'discovery', 'newRelease'];

type Ctx = { fetch: typeof fetch };

async function settle<T>(label: string, run: () => Promise<T>) {
	try {
		return { label, ok: true as const, value: await run() };
	} catch (err) {
		return {
			label,
			ok: false as const,
			error: err instanceof TidalError ? err.message : 'Request failed'
		};
	}
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/demo/better-auth/login');

	const status = await getConnectionStatus();
	const messages = {
		connected: event.url.searchParams.has('connected'),
		disconnected: event.url.searchParams.has('disconnected'),
		error: event.url.searchParams.get('error')
	};

	if (!status.connected) {
		return { status, messages, account: null, collections: [], mixes: [] };
	}

	const ctx: Ctx = { fetch: event.fetch };

	const [account, ...collections] = await Promise.all([
		settle('account', () => tidalApi.getCurrentUser(ctx)),
		...COLLECTION_KINDS.map((kind) =>
			settle(kind, () => tidalApi.getCollectionPage(kind, { include: ['items'] }, ctx))
		)
	]);

	const mixes = await Promise.all(
		MIX_KINDS.map((kind) => settle(kind, () => tidalApi.getMix(kind, {}, ctx)))
	);

	return {
		status,
		messages,
		account,
		collections: collections.map((c) => ({
			...c,
			summary: c.ok ? summarize(c.value) : null
		})),
		mixes: mixes.map((m) => ({ ...m, summary: m.ok ? summarize(m.value) : null }))
	};
};

/** Reduce a JSON:API document to a small, display-ready shape. */
function summarize(doc: Document<Resource | Resource[]>) {
	const data = Array.isArray(doc.data) ? doc.data : [doc.data];
	const included = doc.included ?? [];
	const pick = included.length ? included : data;
	return {
		count: data.length,
		hasMore: Boolean(doc.links?.next),
		items: pick.slice(0, 8).map((r) => ({
			id: r.id,
			type: r.type,
			title:
				(r.attributes?.title as string) ??
				(r.attributes?.name as string) ??
				(r.attributes?.username as string) ??
				r.id
		}))
	};
}
