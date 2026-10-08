import { describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_LISTENING_PREFERENCES,
	getListeningPreferences,
	parseListeningPreferences,
	parseListeningPreferencesForm,
	type ListeningPreferencesStore
} from './listening-preferences';

function form(fields: Record<string, string>): FormData {
	const data = new FormData();
	for (const [key, value] of Object.entries(fields)) data.set(key, value);
	return data;
}

describe('listening preferences', () => {
	it('defaults to autoplaying ten songs with taste learning on', () => {
		expect(DEFAULT_LISTENING_PREFERENCES).toEqual({
			autoplay: true,
			autoplayCount: 10,
			personalizeSuggestions: true,
			learnFromListening: true,
			useLastfmHistory: true,
			learnFromPlaylists: true
		});
	});

	it('reads unchecked checkboxes as off', () => {
		expect(parseListeningPreferencesForm(form({ autoplayCount: '20', autoplay: 'on' }))).toEqual({
			autoplay: true,
			autoplayCount: 20,
			personalizeSuggestions: false,
			learnFromListening: false,
			useLastfmHistory: false,
			learnFromPlaylists: false
		});
	});

	it('rejects a batch size the form does not offer', () => {
		expect(parseListeningPreferencesForm(form({ autoplayCount: '500' }))).toBeNull();
	});

	it('clamps stored batch sizes into the supported range', () => {
		expect(
			parseListeningPreferences({ ...DEFAULT_LISTENING_PREFERENCES, autoplayCount: 99 })
				.autoplayCount
		).toBe(25);
	});

	it('falls back to the defaults when nothing is saved or storage fails', async () => {
		const empty: ListeningPreferencesStore = { read: vi.fn(async () => null), write: vi.fn() };
		const broken: ListeningPreferencesStore = {
			read: vi.fn(async () => {
				throw new Error('relation does not exist');
			}),
			write: vi.fn()
		};
		expect(await getListeningPreferences('u', empty)).toEqual(DEFAULT_LISTENING_PREFERENCES);
		expect(await getListeningPreferences('u', broken)).toEqual(DEFAULT_LISTENING_PREFERENCES);
	});
});
