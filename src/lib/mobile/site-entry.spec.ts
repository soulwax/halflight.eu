import { describe, expect, it } from 'vitest';
import { chooseSite, safeProductReturn, switchSitePath } from './site-entry';

describe('entry and view switching', () => {
	it('sends a narrow unqualified visit to Halflight Now while honoring an explicit choice', () => {
		expect(chooseSite('', 430)).toBe('mobile');
		expect(chooseSite('', 1200)).toBe('desktop');
		expect(chooseSite('hf-site=desktop', 430)).toBe('desktop');
		expect(chooseSite('hf-site=mobile', 1200)).toBe('mobile');
	});

	it('accepts only same-origin product returns, including search state', () => {
		expect(safeProductReturn('/search?q=night#tracks')).toBe('/search?q=night#tracks');
		expect(safeProductReturn('/app/albums/42')).toBe('/app/albums/42');
		for (const target of [
			'//evil.test',
			'https://evil.test',
			'/api/playback-state',
			'/\\evil.test'
		]) {
			expect(safeProductReturn(target)).toBeNull();
		}
	});

	it('keeps music destinations when switching shells', () => {
		expect(switchSitePath('/app/tracks/42', 'mobile')).toBe('/tracks/42');
		expect(switchSitePath('/library', 'desktop')).toBe('/app/library');
		expect(switchSitePath('/now/queue', 'desktop')).toBe('/app');
	});
});
