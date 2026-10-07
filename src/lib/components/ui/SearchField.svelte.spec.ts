import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { m } from '#lib/paraglide/messages.js';
import SearchField from './SearchField.svelte';

describe('SearchField', () => {
	it('provides a touch-sized clear control that returns focus to the input', async () => {
		const clear = vi.fn();
		render(SearchField, {
			id: 'search',
			label: 'Find music',
			placeholder: 'Search',
			value: 'ambient',
			oninput: vi.fn(),
			onclear: clear
		});
		const button = page.getByRole('button', { name: m.search_clear() });
		await button.click();
		expect(clear).toHaveBeenCalledOnce();
		await expect.element(page.getByRole('searchbox')).toHaveFocus();
		expect(button.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	it('waits for composed text and handles its final input event once', async () => {
		const inputValues: string[] = [];
		render(SearchField, {
			id: 'search',
			label: 'Find music',
			placeholder: 'Search',
			value: '',
			oninput: (event) => inputValues.push((event.currentTarget as HTMLInputElement).value),
			onclear: vi.fn()
		});
		const input = page.getByRole('searchbox').element() as HTMLInputElement;
		input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
		input.value = '東京';
		input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
		expect(inputValues).toEqual([]);
		input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
		input.dispatchEvent(new InputEvent('input', { bubbles: true }));
		expect(inputValues).toEqual(['東京']);
	});

	it('focuses and selects the query with the desktop shortcut', async () => {
		render(SearchField, {
			id: 'search',
			label: 'Find music',
			placeholder: 'Search',
			value: 'ambient',
			oninput: vi.fn(),
			onclear: vi.fn(),
			shortcut: true
		});
		window.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
		);
		const input = page.getByRole('searchbox').element() as HTMLInputElement;
		await expect.element(input).toHaveFocus();
		expect(input.selectionStart).toBe(0);
		expect(input.selectionEnd).toBe(7);
	});
});
