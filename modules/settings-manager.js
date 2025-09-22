// Settings Manager Module
export class SettingsManager {
	constructor() {
		this.defaults = {
			showIntermodalIcons: true,
			showJaklingkoBadge: true,
			filterAccessStops: true,
			showAccessibilityIcon: true,
			batterySaver: false,
			showWeatherInfo: true,
			radiusImageIcons: true,
		};
		this.keys = Object.keys(this.defaults);
	}

	init() {
		this.keys.forEach(k => {
			if (localStorage.getItem('setting_' + k) == null) {
				localStorage.setItem('setting_' + k, String(this.defaults[k]));
			}
		});
	}

	get(key) {
		if (!this.keys.includes(key)) return this.defaults[key];
		const raw = localStorage.getItem('setting_' + key);
		if (raw == null) return this.defaults[key];
		if (raw === 'true') return true;
		if (raw === 'false') return false;
		return raw;
	}

	set(key, value) {
		if (!this.keys.includes(key)) return;
		localStorage.setItem('setting_' + key, String(value));
	}

	isEnabled(key) {
		return !!this.get(key);
	}

	reset() {
		this.keys.forEach(k => localStorage.setItem('setting_' + k, String(this.defaults[k])));
	}

	// Clear all cache and storage
	async clearAllCache() {
		const results = [];
		
		try {
			// 1. Clear localStorage
			const localStorageCount = localStorage.length;
			localStorage.clear();
			results.push(`localStorage: ${localStorageCount} items cleared`);
		} catch (e) {
			results.push(`localStorage: Error - ${e.message}`);
		}

		// Explicitly remove known GTFS keys (in case any storage survived or keys are re-added by extensions)
		try {
			localStorage.removeItem('jakmove_gtfs_last_modified');
			localStorage.removeItem('jakmove_gtfs_latest_file');
			localStorage.removeItem('jakmove_gtfs_etag');
			// Remove GTFS loader keys if present
			try {
				const gtfs = window.transJakartaApp?.modules?.gtfs;
				if (gtfs && gtfs.clearCache) await gtfs.clearCache();
			} catch (_) {}
			results.push('GTFS keys removed from localStorage');
		} catch (e) {
			results.push(`GTFS local keys: Error - ${e.message}`);
		}
		
		try {
			// 2. Clear sessionStorage
			const sessionStorageCount = sessionStorage.length;
			sessionStorage.clear();
			results.push(`sessionStorage: ${sessionStorageCount} items cleared`);
		} catch (e) {
			results.push(`sessionStorage: Error - ${e.message}`);
		}
		
		try {
			// 3. Clear IndexedDB
			if ('indexedDB' in window) {
				const databases = await indexedDB.databases();
				for (const db of databases) {
					if (db.name) {
						try {
							indexedDB.deleteDatabase(db.name);
							results.push(`IndexedDB: ${db.name} deleted`);
						} catch (e) {
							results.push(`IndexedDB ${db.name}: Error - ${e.message}`);
						}
					}
				}
				if (databases.length === 0) {
					results.push('IndexedDB: No databases found');
				}
			} else {
				results.push('IndexedDB: Not supported');
			}
		} catch (e) {
			results.push(`IndexedDB: Error - ${e.message}`);
		}

		// Proactively clear known GTFS IDB database name
		try {
			await new Promise((resolve) => {
				try {
					const req = indexedDB.deleteDatabase('jakmove_cache');
					req.onsuccess = () => resolve();
					req.onerror = () => resolve();
					req.onblocked = () => resolve();
				} catch (_) { resolve(); }
			});
			results.push('IndexedDB: jakmove_cache deleted');
		} catch (e) {
			results.push(`IndexedDB jakmove_cache: Error - ${e.message}`);
		}
		
		try {
			// 4. Clear Cache API (Service Worker caches)
			if ('caches' in window) {
				const cacheNames = await caches.keys();
				for (const cacheName of cacheNames) {
					await caches.delete(cacheName);
					results.push(`Cache API: ${cacheName} deleted`);
				}
				if (cacheNames.length === 0) {
					results.push('Cache API: No caches found');
				}
			} else {
				results.push('Cache API: Not supported');
			}
		} catch (e) {
			results.push(`Cache API: Error - ${e.message}`);
		}
		
		try {
			// 5. Unregister Service Workers
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				for (const registration of registrations) {
					await registration.unregister();
					results.push(`Service Worker: ${registration.scope} unregistered`);
				}
				if (registrations.length === 0) {
					results.push('Service Worker: No registrations found');
				}
			} else {
				results.push('Service Worker: Not supported');
			}
		} catch (e) {
			results.push(`Service Worker: Error - ${e.message}`);
		}

		// Clear in-memory caches (weather, geocode, etc.) if modules expose clear methods
		try { window.transJakartaApp?.modules?.location?.clearVolatileCaches?.(); results.push('In-memory: location caches cleared'); } catch (e) {}
		try { window.transJakartaApp?.modules?.routes?.clearVolatileCaches?.(); results.push('In-memory: routes caches cleared'); } catch (e) {}
		try { window.transJakartaApp?.modules?.gtfs?.clearVolatileCaches?.(); results.push('In-memory: GTFS volatile caches cleared'); } catch (e) {}
		
		// Log results for debugging
		console.log('Cache clearing results:', results);
		
		return results;
	}
} 