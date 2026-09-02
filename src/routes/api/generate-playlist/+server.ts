import { error, json } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/server/tidal/models';
import type { RequestHandler } from './$types';

interface GeneratorRequest {
	vibe?: 'energy' | 'rock' | 'warm' | 'noir' | string;
	era?: 'modern' | 'golden' | 'vintage' | 'classics' | string;
	focus?: 'focus' | 'vocal' | 'eclectic' | string;
}

const QUERY_MATRIX: Record<string, Record<string, string[]>> = {
	energy: {
		modern: ['electronic club', 'synth bass dance', 'modern electro'],
		golden: ['2000s electronic dance', 'french house electro', 'indie dance 2010'],
		vintage: ['80s synthwave new wave', 'italo disco 80s', 'classic synth pop'],
		classics: ['krautrock electronic 70s', '70s space disco', 'early electronic']
	},
	rock: {
		modern: ['modern post-punk', 'indie rock alternative', 'psych rock modern'],
		golden: ['2000s indie rock', 'garage rock revival', 'post-punk revival 2000'],
		vintage: ['80s post-punk gothic', 'new wave rock 80s', 'college rock alternative'],
		classics: ['70s classic rock', '70s art rock glam', 'psychedelic rock 60s 70s']
	},
	warm: {
		modern: ['neo soul r&b modern', 'modern groove funk', 'indie soul bedroom pop'],
		golden: ['2000s neo soul', 'downtempo chill groove', 'r&b soul 2000'],
		vintage: ['80s boogie funk soul', 'city pop groove 80s', '80s quiet storm r&b'],
		classics: ['70s soul funk motown', 'classic groove 70s', 'soul jazz 70s']
	},
	noir: {
		modern: ['ambient electronic noir', 'dark jazz cinematic', 'downtempo trip hop'],
		golden: ['trip hop 90s 2000s', 'downtempo ambient chill', 'cinematic electronic'],
		vintage: ['dark ambient synth 80s', 'coldwave minimal synth', 'ambient tape 80s'],
		classics: ['cool jazz noir 50s 60s', 'modal jazz classics', 'cinematic score 70s']
	}
};

const TITLE_VIBES: Record<string, string> = {
	energy: 'HIGH KINETIC',
	rock: 'RAW FREQUENCY',
	warm: 'ORGANIC GROOVE',
	noir: 'LATE NOIR'
};

const TITLE_ERAS: Record<string, string> = {
	modern: 'CONTEMPORARY',
	golden: 'GOLDEN CYCLE',
	vintage: 'ANALOG 80s/90s',
	classics: 'FOUNDATION 70s'
};

function shuffle<T>(array: T[]): T[] {
	const copy = [...array];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		error(401, 'Unauthorized');
	}

	const connection = await getConnectionStatus();
	if (!connection.connected) {
		return json({ error: 'not_connected' }, { status: 503 });
	}

	let body: GeneratorRequest;
	try {
		body = (await event.request.json()) as GeneratorRequest;
	} catch {
		body = {};
	}

	const vibe = body.vibe || 'energy';
	const era = body.era || 'modern';
	const queries = QUERY_MATRIX[vibe]?.[era] ?? ['electronic', 'indie alternative', 'soul groove'];

	const targetTitle = `SYN // ${TITLE_VIBES[vibe] ?? 'SPECTRUM'} [${TITLE_ERAS[era] ?? 'AUTONOMOUS'}]`;
	const targetDescription = `Dynamic generative mix composed on the fly from TIDAL catalogue for ${vibe} / ${era}.`;

	const collectedTracks: TrackSummary[] = [];
	const seenIds = new Set<string>();

	try {
		// Run parallel searches across the chosen keyword matrix
		const searchPromises = queries.map((q) =>
			tidalApi
				.search(q, { types: ['tracks'] }, { fetch: event.fetch, cookies: event.cookies })
				.then((doc) => normaliseSearchResults(doc).tracks)
				.catch(() => [] as TrackSummary[])
		);

		const searchResults = await Promise.all(searchPromises);

		// Interleave results from queries for maximum variety
		const maxLen = Math.max(...searchResults.map((r) => r.length), 0);
		for (let i = 0; i < maxLen; i++) {
			for (const list of searchResults) {
				const track = list[i];
				if (track && !seenIds.has(track.id)) {
					seenIds.add(track.id);
					collectedTracks.push(track);
				}
			}
		}

		// If fewer than 10 tracks found, try a broader fallback search
		if (collectedTracks.length < 10) {
			try {
				const fallbackDoc = await tidalApi.search(
					vibe === 'noir'
						? 'ambient jazz'
						: vibe === 'rock'
							? 'rock alternative'
							: 'electronic dance',
					{ types: ['tracks'] },
					{ fetch: event.fetch, cookies: event.cookies }
				);
				const fallbackTracks = normaliseSearchResults(fallbackDoc).tracks;
				for (const track of fallbackTracks) {
					if (!seenIds.has(track.id)) {
						seenIds.add(track.id);
						collectedTracks.push(track);
					}
				}
			} catch {
				// Ignore fallback error
			}
		}

		const finalTracks = shuffle(collectedTracks).slice(0, 20);

		return json({
			title: targetTitle,
			description: targetDescription,
			tracks: finalTracks
		});
	} catch {
		return json({ error: 'generator_failed' }, { status: 502 });
	}
};
