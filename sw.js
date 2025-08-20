// Simple Service Worker for caching tiles and GTFS assets (stale-while-revalidate)
const CACHE_NAME = 'jakmove-sw-v1';
const ASSET_PATTERNS = [
	/https:\/\/basemaps\.cartocdn\.com\//,
	/https:\/\/services\.arcgisonline\.com\//,
	/https:\/\/api\.maptiler\.com\//,
	/https:\/\/unpkg\.com\//,
	/https:\/\/cdn\.jsdelivr\.net\//,
	/\.png($|\?)/,
	/\.jpg($|\?)/,
	/\.svg($|\?)/,
	/gtfs\/.+\.json$/,
	/gtfs\/.+\.txt$/
];

const PRECACHE_URLS = [
	'gtfs/stops.txt',
	'gtfs/routes.txt',
	'gtfs/trips.txt',
	'gtfs/stop_times.txt',
	'gtfs/shapes.txt',
	'gtfs/frequencies.txt',
	'gtfs/fare_rules.txt',
	'gtfs/fare_attributes.txt',
	'gtfs/transfers.txt',
	'gtfs/calendar.txt',
	'gtfs/agency.txt'
];

self.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		try {
			const cache = await caches.open(CACHE_NAME);
			await cache.addAll(PRECACHE_URLS);
		} catch(_) {}
		await self.skipWaiting();
	})());
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
			await self.clients.claim();
		})()
	);
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = req.url;
	const isMatch = ASSET_PATTERNS.some(rx => rx.test(url));
	if (!isMatch || req.method !== 'GET') return;
	
	event.respondWith((async () => {
		const cache = await caches.open(CACHE_NAME);
		const cached = await cache.match(req);
		const fetchPromise = fetch(req).then((res) => {
			try { if (res && res.status === 200) cache.put(req, res.clone()); } catch(_){}
			return res;
		}).catch(() => cached);
		return cached || fetchPromise;
	})());
}); 