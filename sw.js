// Enhanced Service Worker for full offline capability  
const CACHE_NAME = 'jakmove-github-v2';
const EXTERNAL_CACHE = 'jakmove-external-github-v2';

// Core app files that must be cached for offline functionality
const CORE_CACHE_URLS = [
	'/jakmove/',
	'/jakmove/index.html',
	'/jakmove/manifest.json',
	'/jakmove/main.js',
	'/jakmove/sw.js',
	
	// HTML pages
	'/jakmove/bus-notes.html',
	'/jakmove/tj.html',
	'/jakmove/transportasi-jakarta.html',
	'/jakmove/tentang-pembuat.html',
	'/jakmove/legal.html',
	'/jakmove/gtfs-raw-viewer.html',
	
	// CSS files
	'/jakmove/css/style.css',
	'/jakmove/css/dark-mode.css',
	'/jakmove/css/performance-optimization.css',
	'/jakmove/css/theme.css',
	'/jakmove/css/bus-notes.css',
	'/jakmove/css/pwa.css',
	
	// JavaScript modules
	'/jakmove/modules/gtfs-loader.js',
	'/jakmove/modules/map-manager.js',
	'/jakmove/modules/route-manager.js',
	'/jakmove/modules/stop-manager.js',
	'/jakmove/modules/search-manager.js',
	'/jakmove/modules/location-manager.js',
	'/jakmove/modules/ui-manager.js',
	'/jakmove/modules/settings-manager.js',
	'/jakmove/modules/journey-planner.js',
	
	// JavaScript files
	'/jakmove/js/bus-notes.js',
	'/jakmove/js/dark-mode-switch.js',
	'/jakmove/js/dataKoridor.js',
	'/jakmove/js/gtfs-data.js',
	'/jakmove/js/intermodal.js',
	'/jakmove/js/location-manager.js',
	'/jakmove/js/map-manager.js',
	'/jakmove/js/navbar.js',
	'/jakmove/js/scroll-performance.js',
	'/jakmove/js/tije.js',
	'/jakmove/js/tjNumberSearch.js',
	'/jakmove/js/weather.js',
	
	// GTFS data files
	'/jakmove/gtfs/stops.txt',
	'/jakmove/gtfs/routes.txt',
	'/jakmove/gtfs/trips.txt',
	'/jakmove/gtfs/stop_times.txt',
	'/jakmove/gtfs/shapes.txt',
	'/jakmove/gtfs/frequencies.txt',
	'/jakmove/gtfs/fare_rules.txt',
	'/jakmove/gtfs/fare_attributes.txt',
	'/jakmove/gtfs/transfers.txt',
	'/jakmove/gtfs/calendar.txt',
	'/jakmove/gtfs/calendar_dates.txt',
	'/jakmove/gtfs/agency.txt',
	'/jakmove/gtfs/route_list.txt',
	
	// Images
	'/jakmove/image/jakmoveicon.png',
	'/jakmove/css/image/jakmove.png',
	'/jakmove/css/image/logo_dark.png',
	'/jakmove/css/image/logo_light.png',
	'/jakmove/css/image/animatelogo.gif',
	'/jakmove/image/tije.png',
	'/jakmove/image/skywellbatch2.png',
	
	// Workers
	'/jakmove/workers/gtfs-worker.js'
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
const OFFLINE_PAGE = '/jakmove/index.html';

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