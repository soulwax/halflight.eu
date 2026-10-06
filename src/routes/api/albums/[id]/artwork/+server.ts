import type { RequestHandler } from '@sveltejs/kit';
import { getAlbumCoverId } from '#lib/server/tidal';
import { proxyArtwork } from '#lib/server/tidal/artwork-response';

export const GET: RequestHandler = (event) => proxyArtwork(event, getAlbumCoverId);
