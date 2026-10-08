import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

// Capture real local UI, without saving credentials or changing account settings.
const baseURL = process.env.SCREENSHOT_BASE_URL || 'http://127.0.0.1:5173';
const output = 'artifacts/login-collage';
const routes = [
	'/app',
	'/app/search',
	'/app/library',
	'/app/mixes',
	'/app/generate',
	'/app/settings/appearance',
	'/app/settings/taste',
	'/app/api'
];
const themes = ['blue-hour', 'warm-night', 'terrarium', 'electric', 'riso'];
await mkdir(output, { recursive: true });
await mkdir('static/artwork', { recursive: true });
const browser = await chromium.launch();
try {
	const context = await browser.newContext({
		viewport: { width: 1440, height: 1000 },
		reducedMotion: 'reduce'
	});
	const page = await context.newPage();
	await page.goto(`${baseURL}/debug/sign-in`, { waitUntil: 'domcontentloaded', timeout: 180000 });
	if (!new URL(page.url()).pathname.startsWith('/app'))
		throw new Error('Local debug sign-in did not succeed');
	const shots = [];
	if (process.argv.includes('--reuse-desktop')) {
		const previous = JSON.parse(await readFile(`${output}/manifest.json`, 'utf8'));
		for (const shot of previous.screenshots.filter((shot) => !shot.mobile)) {
			shots.push({ ...shot, data: (await readFile(`${output}/${shot.file}`)).toString('base64') });
		}
	}

	for (const [routeIndex, route] of (shots.length ? [] : routes).entries()) {
		await page.goto(`${baseURL}${route}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
		await page.waitForTimeout(800);
		// Artwork should showcase the interface, without the owner's identity.
		await page.evaluate(() => {
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			const nodes = [];
			while (walker.nextNode()) nodes.push(walker.currentNode);
			for (const node of nodes) {
				node.textContent = node.textContent
					.replace(/soulwax/gi, 'Listener')
					.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, 'listener@example.com');
			}
		});
		for (const [themeIndex, theme] of themes.entries()) {
			await page.evaluate((theme) => {
				document.documentElement.dataset.theme = theme;
			}, theme);
			await page.waitForTimeout(100);
			const file = `${String(routeIndex * themes.length + themeIndex + 1).padStart(2, '0')}-${route.split('/').filter(Boolean).join('-')}-${theme}.png`;
			const buffer = await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
			shots.push({ file, route, theme, data: buffer.toString('base64') });
		}
		console.log(`Captured ${route} (${themes.length} themes)`);
	}
	// Use real catalogue metadata and the actual mobile player. Preview state stays
	// inside this disposable browser; no audio or playback commands are sent.
	const songs = [
		{ query: 'Soulwax NY Excuse', artist: 'Soulwax', title: 'NY Excuse' },
		{ query: 'Goldfrapp Strict Machine', artist: 'Goldfrapp', title: 'Strict Machine' },
		{ query: 'Franz Ferdinand Take Me Out', artist: 'Franz Ferdinand', title: 'Take Me Out' },
		{ query: 'Gorillaz Feel Good Inc.', artist: 'Gorillaz', title: 'Feel Good Inc.' },
		{ query: 'Cibo Matto Sugar Water', artist: 'Cibo Matto', title: 'Sugar Water' },
		{ query: 'Daft Punk Get Lucky', artist: 'Daft Punk', title: 'Get Lucky' },
		{ query: 'The Weeknd Blinding Lights', artist: 'The Weeknd', title: 'Blinding Lights' },
		{ query: 'Fleetwood Mac Dreams', artist: 'Fleetwood Mac', title: 'Dreams' }
	];
	const tracks = [];
	for (const song of songs) {
		const results = await page.evaluate(async (query) => {
			const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
			if (!response.ok) throw new Error(`Catalogue search failed: ${response.status}`);
			return (await response.json()).results;
		}, song.query);
		const track = results.tracks.find(
			(track) =>
				track.title.toLowerCase().startsWith(song.title.toLowerCase()) &&
				track.artists.some((artist) => artist.name === song.artist)
		);
		if (!track)
			throw new Error(
				`Missing catalogue track: ${song.query}; found ${results.tracks.map((track) => track.title + ' by ' + track.artists.map((artist) => artist.name).join(',')).join('; ')}`
			);
		tracks.push(track);
	}
	await context.route('**/api/**', (route) => {
		if (route.request().method() !== 'GET') return route.abort();
		return route.continue();
	});
	await page.setViewportSize({ width: 430, height: 932 });
	await page.goto(`${baseURL}/now`, { waitUntil: 'domcontentloaded', timeout: 180000 });
	await page.waitForTimeout(1200);
	// Freeze synchronization in the screenshot browser only, after the UI has loaded.
	await context.route('**/api/playback-state**', (route) => route.abort());
	for (const [index, track] of tracks.entries()) {
		for (const theme of ['blue-hour', 'warm-night']) {
			await page.evaluate(
				async ({ track, tracks, theme }) => {
					const moduleURL = performance
						.getEntriesByType('resource')
						.map((entry) => entry.name)
						.find((url) => /\/src\/lib\/player\/player\.svelte\.ts(?:\?|$)/.test(url));
					if (!moduleURL) throw new Error('Player module has not loaded');
					const { player } = await import(moduleURL);
					player.stopSessionSync();
					player.restorePlaybackState = () => {};
					player.currentTrack = track;
					player.queue = tracks.filter((item) => item.id !== track.id);
					player.history = [];
					player.isPlaying = true;
					player.isLoading = false;
					player.isBuffering = false;
					player.resumeStatus = 'ready';
					player.activeDevice = null;
					player.currentTime = 78;
					player.duration = track.duration;
					player.audioQuality = 'LOSSLESS';
					document.documentElement.dataset.theme = theme;
				},
				{ track, tracks, theme }
			);
			await page.waitForTimeout(1000);
			await page.locator('img').evaluateAll(async (images) => {
				await Promise.all(images.map((image) => image.decode().catch(() => {})));
			});
			if (!(await page.locator('body').innerText()).includes(track.title))
				throw new Error(
					`Mobile player did not render: ${page.url()} ${(await page.locator('body').innerText()).slice(0, 500)}`
				);
			const file = `mobile-${index + 1}-${theme}.png`;
			const buffer = await page.screenshot({ path: `${output}/${file}`, animations: 'disabled' });
			shots.push({
				file,
				route: '/now',
				theme,
				mobile: true,
				title: track.title,
				artist: track.artists.map((artist) => artist.name).join(', '),
				data: buffer.toString('base64')
			});
		}
		console.log(`Captured mobile player: ${track.title}`);
	}
	// Canvas composition keeps the source screenshots crisp and the build reproducible.
	const canvasPage = await browser.newPage();
	await canvasPage.setContent('<canvas width="2560" height="1440"></canvas>');
	const dataURL = await canvasPage.evaluate(async (shots) => {
		const canvas = document.querySelector('canvas');
		const ctx = canvas.getContext('2d');
		ctx.fillStyle = '#0b1019';
		ctx.fillRect(0, 0, 2560, 1440);
		ctx.translate(1280, 720);
		ctx.rotate(-0.13);
		ctx.translate(-1280, -720);
		const columns = 7,
			width = 456,
			height = 317,
			gap = 14;
		for (let index = 0; index < 42; index++) {
			// Alternate route and theme so neighbouring tiles have different visual rhythms.
			const desktop = shots.filter((shot) => !shot.mobile);
			const shot = desktop[(index * 13) % desktop.length];
			const img = new Image();
			img.src = `data:image/png;base64,${shot.data}`;
			await img.decode();
			const row = Math.floor(index / columns),
				col = index % columns;
			const x = -390 + col * (width + gap) + (row % 2 ? -120 : 0),
				y = -300 + row * (height + gap);
			ctx.save();
			ctx.shadowColor = '#0009';
			ctx.shadowBlur = 22;
			ctx.shadowOffsetY = 8;
			ctx.fillStyle = '#181e27';
			ctx.beginPath();
			ctx.roundRect(x, y, width, height, 9);
			ctx.fill();
			ctx.shadowColor = 'transparent';
			ctx.clip();
			ctx.drawImage(img, x, y, width, height);
			ctx.restore();
		}
		// Portrait panels are deliberately larger than the desktop tiles, with a
		// quiet device rim that makes the two form factors immediately recognizable.
		const mobiles = shots.filter((shot) => shot.mobile).filter((_, index) => index % 2 === 0);
		const positions = [
			[510, 60],
			[80, 410],
			[1740, 60],
			[2170, 420],
			[1730, 850],
			[70, -330],
			[530, 880],
			[2130, -340]
		];
		for (const [index, shot] of mobiles.entries()) {
			const [x, y] = positions[index];
			const width = 310,
				height = (width * 932) / 430;
			const img = new Image();
			img.src = `data:image/png;base64,${shot.data}`;
			await img.decode();
			ctx.save();
			ctx.rotate(index % 2 ? 0.025 : -0.018);
			ctx.shadowColor = index % 2 ? '#ea5d6b66' : '#54c9d866';
			ctx.shadowBlur = 36;
			ctx.shadowOffsetY = 16;
			ctx.fillStyle = '#11131d';
			ctx.beginPath();
			ctx.roundRect(x - 7, y - 7, width + 14, height + 14, 30);
			ctx.fill();
			ctx.shadowColor = 'transparent';
			ctx.beginPath();
			ctx.roundRect(x, y, width, height, 24);
			ctx.clip();
			ctx.drawImage(img, x, y, width, height);
			ctx.restore();
		}
		// Screen-printed poster treatment: ink tint, coloured light, fine grain,
		// and sparse registration marks. The real interfaces remain recognizable.
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.globalCompositeOperation = 'soft-light';
		const ink = ctx.createLinearGradient(0, 0, 2560, 1440);
		ink.addColorStop(0, '#54bac7');
		ink.addColorStop(0.48, '#33324d');
		ink.addColorStop(1, '#e88669');
		ctx.fillStyle = ink;
		ctx.fillRect(0, 0, 2560, 1440);
		ctx.globalCompositeOperation = 'screen';
		for (const [x, y, color] of [
			[100, 150, '#409dad55'],
			[2400, 1100, '#c5566455']
		]) {
			const glow = ctx.createRadialGradient(x, y, 0, x, y, 900);
			glow.addColorStop(0, color);
			glow.addColorStop(1, '#0000');
			ctx.fillStyle = glow;
			ctx.fillRect(0, 0, 2560, 1440);
		}
		ctx.globalCompositeOperation = 'soft-light';
		let seed = 71;
		for (let index = 0; index < 190000; index++) {
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const x = seed % 2560;
			seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
			const y = seed % 1440;
			ctx.fillStyle = index % 2 ? '#ffffff38' : '#00000048';
			ctx.fillRect(x, y, 1, 1);
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.strokeStyle = '#b9dfdb55';
		ctx.lineWidth = 1;
		for (const [x, y] of [
			[35, 35],
			[2525, 1405]
		]) {
			ctx.beginPath();
			ctx.moveTo(x - 14, y);
			ctx.lineTo(x + 14, y);
			ctx.moveTo(x, y - 14);
			ctx.lineTo(x, y + 14);
			ctx.stroke();
		}
		return canvas.toDataURL('image/webp', 0.9);
	}, shots);
	await writeFile(
		'static/artwork/login-collage-2k.webp',
		Buffer.from(dataURL.split(',')[1], 'base64')
	);
	await writeFile(
		`${output}/manifest.json`,
		JSON.stringify(
			{
				canvas: { width: 2560, height: 1440 },
				screenshots: shots.map(({ data: _data, ...shot }) => shot)
			},
			null,
			2
		) + '\n'
	);
	console.log(`Composed ${shots.length} screenshots into static/artwork/login-collage-2k.webp`);
} finally {
	await browser.close();
}
