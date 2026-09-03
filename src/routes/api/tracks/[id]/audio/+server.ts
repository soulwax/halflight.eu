import { error, type RequestHandler } from '@sveltejs/kit';

/**
 * Audio bytes are served by the self-hosted worker's expiring playback ticket.
 * Keeping this endpoint explicit prevents a future regression to Vercel/CDN
 * proxying, which cannot provide durable conversion or scalable range streaming.
 */
export const GET: RequestHandler = async () => {
	error(410, 'Audio is served by the configured media worker. Request a playback session first.');
};
