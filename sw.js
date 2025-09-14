// Enhanced Service Worker for full offline capability
const CACHE_NAME = 'jakmove-pwa-v2';
const EXTERNAL_CACHE = 'jakmove-external-v2';

// Core app files that must be cached for offline functionality
const CORE_CACHE_URLS = [
	'/',
	'/index.html',
	'/manifest.json',
	'/main.js',
	'/sw.js',
	
	// HTML pages
	'/bus-notes.html',
	'/tj.html',
	'/transportasi-jakarta.html',
	'/tentang-pembuat.html',
	'/legal.html',
	'/gtfs-raw-viewer.html',
	
	// CSS files
	'/css/style.css',
	'/css/dark-mode.css',
	'/css/performance-optimization.css',
	'/css/theme.css',
	'/css/bus-notes.css',
	
	// JavaScript modules
	'/modules/gtfs-loader.js',
	'/modules/map-manager.js',
	'/modules/route-manager.js',
	'/modules/stop-manager.js',
	'/modules/search-manager.js',
	'/modules/location-manager.js',
	'/modules/ui-manager.js',
	'/modules/settings-manager.js',
	'/modules/journey-planner.js',
	
	// JavaScript files
	'/js/bus-notes.js',
	'/js/dark-mode-switch.js',
	'/js/dataKoridor.js',
	'/js/gtfs-data.js',
	'/js/intermodal.js',
	'/js/location-manager.js',
	'/js/map-manager.js',
	'/js/navbar.js',
	'/js/scroll-performance.js',
	'/js/tije.js',
	'/js/tjNumberSearch.js',
	'/js/weather.js',
	
	// GTFS data files
	'/gtfs/stops.txt',
	'/gtfs/routes.txt',
	'/gtfs/trips.txt',
	'/gtfs/stop_times.txt',
	'/gtfs/shapes.txt',
	'/gtfs/frequencies.txt',
	'/gtfs/fare_rules.txt',
	'/gtfs/fare_attributes.txt',
	'/gtfs/transfers.txt',
	'/gtfs/calendar.txt',
	'/gtfs/calendar_dates.txt',
	'/gtfs/agency.txt',
	'/gtfs/route_list.txt',
	
	// Images
	'/css/image/jakmove.png',
	'/css/image/logo_dark.png',
	'/css/image/logo_light.png',
	'/css/image/animatelogo.gif',
	'/image/tije.png',
	'/image/skywellbatch2.png',
	
	// Workers
	'/workers/gtfs-worker.js'
];

// External resources patterns that should be cached
const EXTERNAL_PATTERNS = [
	/https:\/\/basemaps\.cartocdn\.com\//,
	/https:\/\/services\.arcgisonline\.com\//,
	/https:\/\/api\.maptiler\.com\//,
	/https:\/\/unpkg\.com\//,
	/https:\/\/cdn\.jsdelivr\.net\//,
	/https:\/\/code\.iconify\.design\//,
	/https:\/\/upload\.wikimedia\.org\//
];

// Offline fallback page
const OFFLINE_PAGE = '/index.html';

// Install event - cache core resources
self.addEventListener('install', (event) => {
	event.waitUntil((async () => {
		try {
			console.log('[SW] Installing...');
			const cache = await caches.open(CACHE_NAME);
			
			// Cache core files with error handling for individual files
			const cachePromises = CORE_CACHE_URLS.map(async (url) => {
				try {
					await cache.add(url);
				} catch (error) {
					console.warn(`[SW] Failed to cache ${url}:`, error);
				}
			});
			
			await Promise.allSettled(cachePromises);
			console.log('[SW] Core files cached successfully');
		} catch (error) {
			console.error('[SW] Install failed:', error);
		}
		
		// Force activation
		await self.skipWaiting();
	})());
});

// Activate event - clean old caches and take control
self.addEventListener('activate', (event) => {
	event.waitUntil((async () => {
		try {
			console.log('[SW] Activating...');
			
			// Clean up old caches
			const cacheNames = await caches.keys();
			const deletePromises = cacheNames
				.filter(name => name !== CACHE_NAME && name !== EXTERNAL_CACHE)
				.map(name => caches.delete(name));
			
			await Promise.all(deletePromises);
			console.log('[SW] Old caches cleaned');
			
			// Take control of all clients
			await self.clients.claim();
			console.log('[SW] Activated successfully');
		} catch (error) {
			console.error('[SW] Activation failed:', error);
		}
	})());
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
	const request = event.request;
	const url = new URL(request.url);
	
	// Skip non-GET requests
	if (request.method !== 'GET') return;
	
	// Skip chrome-extension and other non-http requests
	if (!url.protocol.startsWith('http')) return;
	
	event.respondWith(handleFetch(request));
});

// Enhanced fetch handler with different strategies
async function handleFetch(request) {
	const url = new URL(request.url);
	const isExternal = url.origin !== location.origin;
	
	try {
		// Strategy 1: Core app files - Cache First with network fallback
		if (!isExternal) {
			return await cacheFirstStrategy(request, CACHE_NAME);
		}
		
		// Strategy 2: External resources - Stale While Revalidate
		if (EXTERNAL_PATTERNS.some(pattern => pattern.test(request.url))) {
			return await staleWhileRevalidateStrategy(request, EXTERNAL_CACHE);
		}
		
		// Strategy 3: Everything else - Network First with cache fallback
		return await networkFirstStrategy(request, EXTERNAL_CACHE);
		
	} catch (error) {
		console.error('[SW] Fetch failed:', error);
		
		// Return offline fallback for navigation requests
		if (request.mode === 'navigate') {
			const cache = await caches.open(CACHE_NAME);
			return await cache.match(OFFLINE_PAGE);
		}
		
		// Return a generic offline response for other requests
		return new Response('Offline', { 
			status: 503, 
			statusText: 'Service Unavailable' 
		});
	}
}

// Cache First Strategy - for core app files
async function cacheFirstStrategy(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	
	if (cached) {
		return cached;
	}
	
	try {
		const response = await fetch(request);
		if (response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		// If this is a navigation request and we can't fetch it, return the offline page
		if (request.mode === 'navigate') {
			return await cache.match(OFFLINE_PAGE);
		}
		throw error;
	}
}

// Stale While Revalidate Strategy - for external resources
async function staleWhileRevalidateStrategy(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	
	// Always try to fetch and update cache in background
	const fetchPromise = fetch(request).then(response => {
		if (response.status === 200) {
			cache.put(request, response.clone());
		}
		return response;
	}).catch(() => null);
	
	// Return cached version immediately if available, otherwise wait for network
	return cached || await fetchPromise || new Response('Offline', { 
		status: 503, 
		statusText: 'Service Unavailable' 
	});
}

// Network First Strategy - for other requests
async function networkFirstStrategy(request, cacheName) {
	try {
		const response = await fetch(request);
		if (response.status === 200) {
			const cache = await caches.open(cacheName);
			cache.put(request, response.clone());
		}
		return response;
	} catch (error) {
		const cache = await caches.open(cacheName);
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}
		throw error;
	}
}

// Message handler for manual cache updates
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
	
	if (event.data && event.data.type === 'CACHE_UPDATE') {
		event.waitUntil(updateCache());
	}
});

// Manual cache update function
async function updateCache() {
	try {
		console.log('[SW] Updating cache...');
		const cache = await caches.open(CACHE_NAME);
		await Promise.allSettled(
			CORE_CACHE_URLS.map(url => 
				fetch(url).then(response => {
					if (response.status === 200) {
						return cache.put(url, response);
					}
				}).catch(error => {
					console.warn(`[SW] Failed to update ${url}:`, error);
				})
			)
		);
		console.log('[SW] Cache updated successfully');
	} catch (error) {
		console.error('[SW] Cache update failed:', error);
	}
} 