import { error, json } from '@sveltejs/kit';
import { getConnectionStatus, tidalApi } from '#lib/server/tidal';
import { normaliseSearchResults } from '#lib/server/tidal/normalise';
import type { TrackSummary } from '#lib/tidal/models';
import { createUserPlaylist, attemptTidalPlaylistSync } from '#lib/server/playlists';
import { log } from '#lib/server/log';
import type { RequestHandler } from './$types';

interface GeneratorRequest {
	vibe?: string;
	era?: string;
	texture?: string;
	energyArc?: string;
	size?: number | string;
	syncTidal?: boolean;
}

const SOUNDSCAPE_QUERIES: Record<string, Record<string, string[]>> = {
	kinetic: {
		contemporary: [
			'synthwave electro',
			'french touch electro',
			'darkwave modern',
			'hyperpop dance'
		],
		golden: ['2000s electroclash', 'justice daft punk', 'bloghouse electronic', 'indie dance 2008'],
		vintage: ['80s synthpop new wave', 'italo disco 1984', 'kraftwerk electro 80s', 'hi-nrg 80s'],
		foundation: [
			'early synth 70s electronic',
			'giorgio moroder disco',
			'space disco 1977',
			'krautrock electronic'
		],
		timeless: ['electronic synth classics', 'dance electro essentials', 'iconic synth bass']
	},
	postpunk: {
		contemporary: [
			'modern post-punk',
			'fontaines coldwave',
			'black midi dry cleaning',
			'crank wave alternative'
		],
		golden: [
			'interpol strokes post-punk',
			'franz ferdinand bloc party',
			'white stripes garage rock',
			'lcd soundsystem rock'
		],
		vintage: [
			'joy division bauhaus 80s',
			'the cure new wave 1980s',
			'siouxsie the fall post-punk',
			'talking heads 80s'
		],
		foundation: [
			'velvet underground proto-punk',
			'stooges iggy pop 1970s',
			'television cbgb 70s',
			'krautrock can neu'
		],
		timeless: [
			'post punk art rock essential',
			'alternative post punk classics',
			'gothic rock new wave'
		]
	},
	funk: {
		contemporary: [
			'neo soul modern groove',
			'silk sonic anderson paak',
			'khruangbin funk groove',
			'modern cosmic disco'
		],
		golden: [
			'erykah badu d angelo soul',
			'outkast j dilla groove',
			'2000s neo soul classics',
			'nu disco 2000s'
		],
		vintage: [
			'80s boogie funk',
			'prince funk 80s',
			'shalamar gap band 80s',
			'rick james funk groove'
		],
		foundation: [
			'sly the family stone 70s',
			'stevie wonder 70s funk',
			'parliament funkadelic',
			'earth wind fire 70s'
		],
		timeless: ['classic funk soul rare groove', 'motown funk essentials', 'cosmic soul groove']
	},
	noir: {
		contemporary: [
			'ambient modern noir',
			'dark jazz bohren',
			'cinematic electronic downtempo',
			'modern trip hop'
		],
		golden: [
			'massive attack portishead',
			'tricky morcheeba trip hop',
			'dj shadow endtroducing',
			'bonobo early downtempo'
		],
		vintage: [
			'80s dark ambient synth',
			'coldwave minimal tape',
			'ambient 80s film score',
			' Angelo Badalamenti twin peaks'
		],
		foundation: [
			'miles davis ascenseur noir',
			'cool jazz noir 1959',
			'herbie hancock blow up',
			'70s crime film score'
		],
		timeless: ['trip hop ambient noir essentials', 'late night jazz noir', 'cinematic downtempo']
	},
	techno: {
		contemporary: [
			'modern hypnotic techno',
			'berlin club techno',
			'raw dub techno',
			'berghain sound'
		],
		golden: [
			'basic channel dub techno',
			'jeff mills 2000s',
			'minimal techno 2006',
			'richie hawtin plastikman'
		],
		vintage: [
			'detroit techno juan atkins',
			'derrick may belleville',
			'kevin saunderson 1988',
			'early underground resistance'
		],
		foundation: [
			'tangerine dream sequence',
			'early electronic pulse 70s',
			'silver apples synthetic',
			'kraftwerk trans europe'
		],
		timeless: [
			'detroit berlin techno essentials',
			'minimal hypnotic dub techno',
			'classic techno tracks'
		]
	},
	shoegaze: {
		contemporary: [
			'modern shoegaze',
			'dreampop reverb modern',
			'beach house dream pop',
			'alvvays shoegaze fuzz'
		],
		golden: [
			'm83 early dreampop',
			'deerhunter shoegaze',
			'silversun pickups 2006',
			'broadcast dreampop'
		],
		vintage: [
			'my bloody valentine loveless',
			'cocteau twins 4ad',
			'slowdive souvlaki',
			'ride nowhere 1990'
		],
		foundation: [
			'psychedelic dream rock 60s',
			'byrds 12 string reverb',
			'velvet underground velvet',
			'spitfire dream pop 70s'
		],
		timeless: ['shoegaze dreampop essentials', 'ethereal wave 4ad classics', 'fuzz reverb guitars']
	},
	jazz: {
		contemporary: [
			'kamasi washington jazz',
			'shabaka hutchings modern',
			'badbadnotgood jazz',
			'nubya garcia spiritual'
		],
		golden: [
			'roy hargrove rh factor',
			'robert glasper 2000s',
			'brad mehldau trio',
			'esbjorn svenska trio'
		],
		vintage: [
			'80s miles davis tutu',
			'ecm records 80s jazz',
			'weather report 80s',
			'jacob pastorius jazz fusion'
		],
		foundation: [
			'john coltrane spiritual jazz',
			'miles davis kind of blue',
			'charles mingus ah um',
			'thelonious monk blue note'
		],
		timeless: [
			'modal jazz blue note essentials',
			'spiritual jazz classics',
			'bebop hard bop foundation'
		]
	},
	ambient: {
		contemporary: [
			'stars of the lid ambient',
			'tim hecker drone',
			'william basinski disintegration',
			'modern modular ambient'
		],
		golden: [
			'brian eno 2000s ambient',
			'aphex twin selected ambient',
			'fennesz endless summer',
			'labradford ambient drone'
		],
		vintage: [
			'brian eno ambient 1 music for airports',
			'harold budd ambient 80s',
			'steve roach structures',
			'popol vuh ambient'
		],
		foundation: [
			'terry riley in c 60s',
			'la monte young drone',
			'steve reich phase music',
			'wendy carlos early ambient'
		],
		timeless: [
			'ambient meditation drone classics',
			'deep modular drone music',
			'minimalist ambient pieces'
		]
	}
};

const TEXTURE_MODIFIERS: Record<string, string> = {
	synthesizers: 'analog synthesizers',
	organic: 'acoustic organic instruments',
	motorik: 'hypnotic motorik groove',
	atmospheric: 'reverb atmospheric cinematic'
};

const SOUNDSCAPE_NAMES: Record<string, string> = {
	kinetic: 'KINETIC SYNTH & CLUB',
	postpunk: 'POST-PUNK & ART ROCK',
	funk: 'COSMIC FUNK & SOUL',
	noir: 'CINEMATIC NOIR & TRIP-HOP',
	techno: 'DETROIT TECHNO & MINIMAL',
	shoegaze: 'ETHEREAL SHOEGAZE & DREAM POP',
	jazz: 'MODAL JAZZ & FUSION',
	ambient: 'AVANT-GARDE & AMBIENT DRONE'
};

const ERA_NAMES: Record<string, string> = {
	contemporary: 'CONTEMPORARY 2020s',
	golden: 'GOLDEN CYCLE 2000s',
	vintage: 'ANALOG 80s/90s',
	foundation: 'FOUNDATION 60s/70s',
	timeless: 'CONTINUUM'
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

	const vibe = body.vibe || 'kinetic';
	const era = body.era || 'contemporary';
	const texture = body.texture || 'synthesizers';
	const energyArc = body.energyArc || 'steady';
	const requestedSize =
		typeof body.size === 'number' ? body.size : parseInt(body.size || '20', 10) || 20;
	const targetCount = Math.min(Math.max(requestedSize, 8), 100);

	const queries = SOUNDSCAPE_QUERIES[vibe]?.[era] ?? SOUNDSCAPE_QUERIES.kinetic.contemporary;

	const targetTitle = `SYN // ${SOUNDSCAPE_NAMES[vibe] ?? vibe.toUpperCase()} [${ERA_NAMES[era] ?? era.toUpperCase()}]`;
	const targetDescription = `Curated generative Bauhaus mix from TIDAL: ${SOUNDSCAPE_NAMES[vibe] || vibe} • ${ERA_NAMES[era] || era} • ${TEXTURE_MODIFIERS[texture] || texture} • Flow: ${energyArc.toUpperCase()}.`;

	const collectedTracks: TrackSummary[] = [];
	const seenIds = new Set<string>();

	try {
		// Parallel searches across the targeted queries
		const searchPromises = queries.map((q) => {
			const queryWithTexture = texture ? `${q} ${TEXTURE_MODIFIERS[texture] || ''}`.trim() : q;
			return tidalApi
				.search(
					queryWithTexture,
					{ types: ['tracks'] },
					{ fetch: event.fetch, cookies: event.cookies }
				)
				.then((doc) => normaliseSearchResults(doc).tracks)
				.catch(() => [] as TrackSummary[]);
		});

		const searchResults = await Promise.all(searchPromises);

		// Interleave results from queries for balanced sonic variety
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

		// Broad fallback if fewer tracks were retrieved
		if (collectedTracks.length < targetCount) {
			try {
				const fallbackQuery = `${vibe} music`;
				const fallbackDoc = await tidalApi.search(
					fallbackQuery,
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

		const finalTracks = shuffle(collectedTracks).slice(0, targetCount);

		// Apply Energy Arc ordering
		if (energyArc === 'accelerando') {
			// Sort from shorter/gentler to longer/higher intensity
			finalTracks.sort((a, b) => (a.duration || 180) - (b.duration || 180));
		} else if (energyArc === 'chill') {
			// Keep smoother, longer introspective tracks first
			finalTracks.sort((a, b) => (b.duration || 180) - (a.duration || 180));
		}

		// 1. Attempt optional TIDAL export if user is connected
		let tidalPlaylistId: string | undefined;
		if (body.syncTidal !== false && finalTracks.length > 0) {
			const trackIds = finalTracks.map((t) => t.id).filter(Boolean);
			const syncedUuid = await attemptTidalPlaylistSync(targetTitle, targetDescription, trackIds, {
				fetch: event.fetch,
				cookies: event.cookies
			});
			if (syncedUuid) {
				tidalPlaylistId = syncedUuid;
			}
		}

		// 2. Persist to user's database account immediately upon creation
		const savedPlaylist = await createUserPlaylist({
			userId: event.locals.user.id,
			title: targetTitle,
			description: targetDescription,
			items: finalTracks,
			tidalPlaylistId
		});

		return json({
			playlist: savedPlaylist,
			title: targetTitle,
			description: targetDescription,
			tracks: finalTracks,
			savedToAccount: true,
			tidalPlaylistId
		});
	} catch (err) {
		log.error('playlist generator failed', { cause: err });
		return json({ error: 'generator_failed' }, { status: 502 });
	}
};
