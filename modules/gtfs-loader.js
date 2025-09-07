// GTFS Data Loader Module
export class GTFSLoader {
    constructor() {
        this.data = {
            stops: [],
            routes: [],
            trips: [],
            stop_times: [],
            shapes: [],
            frequencies: [],
            fare_rules: [],
            fare_attributes: [],
            transfers: [],
            calendar: [],
            agency: []
        };
        this.stopToRoutes = {};
        this._worker = null;
        this.CACHE_KEY = 'jakmove_gtfs_data';
        this.CACHE_VERSION_KEY = 'jakmove_gtfs_version';
        this.CURRENT_VERSION = '1.5'; // Increment when GTFS data changes
        this.db = null;
        
        // Expose clear cache function globally for debugging
        window.clearGTFSCache = () => this.clearCache();
    }

    async loadData() {
        try {
            this.showLoadingProgress();
            this.updateLoadingProgress(2, 'Menyiapkan aplikasi...');

            // Try to load from cache first with timeout
            const cachedData = await Promise.race([
                this.loadFromCache(),
                new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
            ]);
            
            if (cachedData) {
                console.log('📦 Loading GTFS data from cache - instant load');
                
                // Extract stopToRoutes if it exists
                if (cachedData.stopToRoutes) {
                    this.stopToRoutes = cachedData.stopToRoutes;
                    delete cachedData.stopToRoutes;
                    delete cachedData.timestamp;
                }
                
                Object.assign(this.data, cachedData);
                
                // Instant hide for cached data - no loading screen needed
                this.hideLoadingProgress();
                
                // Optional: Background check for updates without blocking UI
                this.checkForUpdatesInBackground();
                
                return this.data;
            }

            console.log('🌐 Cache miss, loading GTFS data from network');
            this.updateLoadingProgress(5, 'Memuat dari server...');

            const files = [{
                    url: 'gtfs/stops.txt',
                    key: 'stopsTxt',
                    label: 'Mengunduh stops.txt',
                    range: [2, 10]
                },
                {
                    url: 'gtfs/routes.txt',
                    key: 'routesTxt',
                    label: 'Mengunduh routes.txt',
                    range: [10, 16]
                },
                {
                    url: 'gtfs/trips.txt',
                    key: 'tripsTxt',
                    label: 'Mengunduh trips.txt',
                    range: [16, 28]
                },
                {
                    url: 'gtfs/stop_times.txt',
                    key: 'stopTimesTxt',
                    label: 'Mengunduh stop_times.txt',
                    range: [28, 50]
                },
                {
                    url: 'gtfs/shapes.txt',
                    key: 'shapesTxt',
                    label: 'Mengunduh shapes.txt',
                    range: [50, 62]
                },
                {
                    url: 'gtfs/frequencies.txt',
                    key: 'frequenciesTxt',
                    label: 'Mengunduh frequencies.txt',
                    range: [62, 66]
                },
                {
                    url: 'gtfs/fare_rules.txt',
                    key: 'fareRulesTxt',
                    label: 'Mengunduh fare_rules.txt',
                    range: [66, 70]
                },
                {
                    url: 'gtfs/fare_attributes.txt',
                    key: 'fareAttributesTxt',
                    label: 'Mengunduh fare_attributes.txt',
                    range: [70, 74]
                },
                {
                    url: 'gtfs/transfers.txt',
                    key: 'transfersTxt',
                    label: 'Mengunduh transfers.txt',
                    range: [74, 78]
                },
                {
                    url: 'gtfs/calendar.txt',
                    key: 'calendarTxt',
                    label: 'Mengunduh calendar.txt',
                    range: [78, 82]
                },
                {
                    url: 'gtfs/agency.txt',
                    key: 'agencyTxt',
                    label: 'Mengunduh agency.txt',
                    range: [82, 86]
                }
            ];

            // Sequential streaming fetch with per-file progress
            const texts = {};
            for (const f of files) {
                texts[f.key] = await this._streamFetchWithProgress(f.url, f.range[0], f.range[1], f.label);
            }

            this.updateLoadingProgress(87, 'Memproses data di latar (tidak membekukan UI)...');

            // Offload parsing to Web Worker for responsiveness
            const parsed = await this._parseInWorker(texts, (p, s) => this.updateLoadingProgress(p, s));

            // Assign parsed data
            this.data.stops = parsed.stops;
            this.data.routes = parsed.routes;
            this.data.trips = parsed.trips;
            this.data.stop_times = parsed.stop_times;
            this.data.shapes = parsed.shapes;
            this.data.frequencies = parsed.frequencies;
            this.data.fare_rules = parsed.fare_rules;
            this.data.fare_attributes = parsed.fare_attributes;
            this.data.transfers = parsed.transfers;
            this.data.calendar = parsed.calendar;
            this.data.agency = parsed.agency;
            this.stopToRoutes = parsed.stopToRoutes || {};

            // Save to cache for future use with timeout
            this.updateLoadingProgress(98, 'Menyimpan ke cache...');
            try {
                await Promise.race([
                    this.saveToCache(),
                    new Promise(resolve => setTimeout(() => resolve(), 5000)) // 5 second timeout for save
                ]);
                console.log('Cache save completed');
            } catch (e) {
                console.log('Cache save failed, continuing anyway:', e);
            }
            
            this.updateLoadingProgress(100, 'Selesai!');
            this.hideLoadingProgress();

            return this.data;
        } catch (error) {
            console.error('Error loading GTFS data:', error);
            this.updateLoadingProgress(0, 'Error: Gagal memuat data');
            setTimeout(() => this.hideLoadingProgress(), 3000);
            throw error;
        }
    }

    async _streamFetchWithProgress(url, startPercent, endPercent, label) {
        try {
            this.updateLoadingProgress(startPercent, `${label} (mulai)`);
            const res = await fetch(url);
            if (!res.ok) return '';
            const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
            if (!res.body || !window.ReadableStream) {
                const text = await res.text();
                this.updateLoadingProgress(endPercent, `${label} (100%)`);
                return text;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let received = 0;
            let chunks = '';
            while (true) {
                const {
                    done,
                    value
                } = await reader.read();
                if (done) break;
                received += value.byteLength;
                chunks += decoder.decode(value, {
                    stream: true
                });
                const frac = contentLength > 0 ? (received / contentLength) : 0.5; // fallback
                const pct = Math.min(endPercent, startPercent + Math.floor((endPercent - startPercent) * frac));
                this.updateLoadingProgress(pct, `${label} (${contentLength ? Math.min(100, Math.floor(frac * 100)) : '...'}%)`);
            }
            // flush decoder
            chunks += decoder.decode();
            this.updateLoadingProgress(endPercent, `${label} (100%)`);
            return chunks;
        } catch (_) {
            // Fallback simple fetch on error
            const txt = await fetch(url).then(r => r.ok ? r.text() : '');
            this.updateLoadingProgress(endPercent, `${label} (selesai)`);
            return txt;
        }
    }

    _ensureWorker() {
        if (this._worker) return this._worker;
        try {
            this._worker = new Worker('workers/gtfs-worker.js');
        } catch (_) {
            this._worker = null;
        }
        return this._worker;
    }

    _parseInWorker(texts, onProgress) {
        return new Promise((resolve, reject) => {
            const w = this._ensureWorker();
            if (!w) {
                // Fallback: parse in main thread using existing methods
                try {
                    const result = {};
                    onProgress && onProgress(90, 'Memproses data (fallback)...');
                    result.stops = this.parseCSV(texts.stopsTxt);
                    result.routes = this.parseCSV(texts.routesTxt);
                    result.trips = this.parseCSV(texts.tripsTxt);
                    result.stop_times = this.parseCSV(texts.stopTimesTxt);
                    result.shapes = this.parseCSV(texts.shapesTxt);
                    result.frequencies = this.parseCSV(texts.frequenciesTxt);
                    result.fare_rules = this.parseCSV(texts.fareRulesTxt);
                    result.fare_attributes = this.parseCSV(texts.fareAttributesTxt);
                    result.transfers = this.parseCSV(texts.transfersTxt);
                    result.calendar = this.parseCSV(texts.calendarTxt);
                    result.agency = this.parseCSV(texts.agencyTxt);
                    // Build mapping
                    const stopToRoutes = {};
                    result.stop_times.forEach(st => {
                        const trip = result.trips.find(t => t.trip_id === st.trip_id);
                        if (trip) {
                            if (!stopToRoutes[st.stop_id]) stopToRoutes[st.stop_id] = new Set();
                            stopToRoutes[st.stop_id].add(trip.route_id);
                        }
                    });
                    Object.keys(stopToRoutes).forEach(k => stopToRoutes[k] = Array.from(stopToRoutes[k]));
                    result.stopToRoutes = stopToRoutes;
                    onProgress && onProgress(96, 'Finalisasi data...');
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
                return;
            }
            const onMsg = (ev) => {
                const msg = ev.data || {};
                if (msg.type === 'progress') {
                    onProgress && onProgress(msg.percent, msg.status || '');
                } else if (msg.type === 'result') {
                    w.removeEventListener('message', onMsg);
                    resolve(msg.data);
                } else if (msg.type === 'error') {
                    w.removeEventListener('message', onMsg);
                    reject(new Error(msg.error || 'Worker error'));
                }
            };
            w.addEventListener('message', onMsg);
            try {
                w.postMessage({
                    cmd: 'parseAll',
                    payload: texts
                });
            } catch (e) {
                w.removeEventListener('message', onMsg);
                reject(e);
            }
        });
    }

    // Utility functions
    getStops() {
        return this.data.stops;
    }
    getRoutes() {
        return this.data.routes;
    }
    getTrips() {
        return this.data.trips;
    }
    getStopTimes() {
        return this.data.stop_times;
    }
    getShapes() {
        return this.data.shapes;
    }
    getFrequencies() {
        return this.data.frequencies;
    }
    getFareRules() {
        return this.data.fare_rules;
    }
    getFareAttributes() {
        return this.data.fare_attributes;
    }
    getStopToRoutes() {
        return this.stopToRoutes;
    }
    getCalendar() {
        return this.data.calendar;
    }
    getAgency() {
        return this.data.agency;
    }

    // Natural sort function for human-friendly sorting of route names
    naturalSort(a, b) {
        let ax = (typeof a === 'object' && a.route_short_name) ? a.route_short_name : a;
        let bx = (typeof b === 'object' && b.route_short_name) ? b.route_short_name : b;
        
        if (!ax && typeof a === 'object') ax = a.route_id;
        if (!bx && typeof b === 'object') bx = b.route_id;
        
        return ax.localeCompare(bx, undefined, {
            numeric: true,
            sensitivity: 'base'
        });
    }

    // Loading progress functions
    showLoadingProgress() {
        const loadingModal = document.getElementById('loadingProgress');
        if (loadingModal) {
            loadingModal.style.display = 'flex';
            setTimeout(() => loadingModal.classList.add('show'), 10);
        }
        try {
            document.body.classList.add('no-scroll');
        } catch (_) {}
    }

    hideLoadingProgress() {
        const loadingModal = document.getElementById('loadingProgress');
        if (loadingModal) {
            loadingModal.classList.remove('show');
            setTimeout(() => loadingModal.style.display = 'none', 300);
        }
        try {
            document.body.classList.remove('no-scroll');
        } catch (_) {}
    }

    updateLoadingProgress(percent, status) {
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.setAttribute('aria-valuenow', percent);
        }
        if (progressPercent) {
            progressPercent.textContent = Math.round(percent) + '%';
        }
        if (progressStatus && status) {
            progressStatus.textContent = status;
        }
    }

    // Caching functions
    async loadFromCache() {
        try {
            // Check if browser supports IndexedDB and localStorage
            if (!window.indexedDB || !localStorage) {
                console.log('Cache not supported');
                return null;
            }

            // Check version first
            const cachedVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
            if (cachedVersion !== this.CURRENT_VERSION) {
                console.log('Cache version mismatch, clearing old cache');
                await this.clearCache();
                return null;
            }

            // Try localStorage first for faster access
            const localData = localStorage.getItem(this.CACHE_KEY);
            if (localData) {
                try {
                    const parsed = JSON.parse(localData);
                    console.log('✅ Loaded from localStorage cache');
                    return parsed;
                } catch (e) {
                    console.log('localStorage cache corrupted, trying IndexedDB');
                }
            }

            // Fallback to IndexedDB
            return await this.loadFromIndexedDB();
        } catch (error) {
            console.error('Error loading from cache:', error);
            return null;
        }
    }

    async saveToCache() {
        try {
            if (!window.indexedDB || !localStorage) return;

            // Compress data by removing unnecessary fields and optimizing structure
            const cacheData = this.compressDataForCache();

            // Save version
            localStorage.setItem(this.CACHE_VERSION_KEY, this.CURRENT_VERSION);

            // Try localStorage first (faster access)
            try {
                const dataStr = JSON.stringify(cacheData);
                console.log(`Cache data size: ${(dataStr.length / 1024 / 1024).toFixed(2)}MB`);
                
                // Check if data is too large for localStorage (5MB limit)
                if (dataStr.length < 4.5 * 1024 * 1024) { // 4.5MB safety margin
                    localStorage.setItem(this.CACHE_KEY, dataStr);
                    console.log('✅ Saved to localStorage cache');
                    return;
                } else {
                    console.log('Data too large for localStorage, using IndexedDB');
                }
            } catch (e) {
                console.log('localStorage full, using IndexedDB fallback');
            }

            // Fallback to IndexedDB
            await this.saveToIndexedDB(cacheData);
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    compressDataForCache() {
        // Create a more compact version of the data
        return {
            stops: this.data.stops.map(stop => ({
                stop_id: stop.stop_id,
                stop_name: stop.stop_name,
                stop_lat: parseFloat(stop.stop_lat),
                stop_lon: parseFloat(stop.stop_lon),
                location_type: stop.location_type
            })),
            routes: this.data.routes.map(route => ({
                route_id: route.route_id,
                route_short_name: route.route_short_name,
                route_long_name: route.route_long_name,
                route_color: route.route_color,
                route_text_color: route.route_text_color
            })),
            trips: this.data.trips.map(trip => ({
                route_id: trip.route_id,
                service_id: trip.service_id,
                trip_id: trip.trip_id,
                trip_headsign: trip.trip_headsign,
                shape_id: trip.shape_id
            })),
            stop_times: this.data.stop_times.map(st => ({
                trip_id: st.trip_id,
                arrival_time: st.arrival_time,
                departure_time: st.departure_time,
                stop_id: st.stop_id,
                stop_sequence: parseInt(st.stop_sequence)
            })),
            shapes: this.data.shapes.map(shape => ({
                shape_id: shape.shape_id,
                shape_pt_lat: parseFloat(shape.shape_pt_lat),
                shape_pt_lon: parseFloat(shape.shape_pt_lon),
                shape_pt_sequence: parseInt(shape.shape_pt_sequence)
            })),
            frequencies: this.data.frequencies,
            fare_rules: this.data.fare_rules,
            fare_attributes: this.data.fare_attributes,
            transfers: this.data.transfers,
            calendar: this.data.calendar,
            agency: this.data.agency,
            stopToRoutes: this.stopToRoutes,
            timestamp: Date.now()
        };
    }

    async loadFromIndexedDB() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('JakMoveGTFS', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('gtfs')) {
                        db.createObjectStore('gtfs');
                    }
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    try {
                        if (!db.objectStoreNames.contains('gtfs')) {
                            console.log('Object store not found, no cache available');
                            db.close();
                            resolve(null);
                            return;
                        }
                        const transaction = db.transaction('gtfs', 'readonly');
                        const store = transaction.objectStore('gtfs');
                        const getRequest = store.get('data');
                        getRequest.onsuccess = () => {
                            if (getRequest.result) {
                                console.log('✅ Loaded from IndexedDB cache');
                                db.close();
                                resolve(getRequest.result);
                            } else {
                                db.close();
                                resolve(null);
                            }
                        };
                        getRequest.onerror = (e) => {
                            console.log('IndexedDB get failed:', e);
                            db.close();
                            resolve(null);
                        };
                        transaction.onerror = (e) => {
                            console.log('IndexedDB transaction failed:', e);
                            db.close();
                            resolve(null);
                        };
                    } catch (e) {
                        console.log('IndexedDB operation failed:', e);
                        db.close();
                        resolve(null);
                    }
                };
                request.onerror = (e) => {
                    console.log('IndexedDB open failed:', e);
                    resolve(null);
                };
            } catch (e) {
                console.log('IndexedDB error:', e);
                resolve(null);
            }
        });
    }

    async saveToIndexedDB(data) {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('JakMoveGTFS', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('gtfs')) {
                        db.createObjectStore('gtfs');
                    }
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    try {
                        if (!db.objectStoreNames.contains('gtfs')) {
                            console.log('Object store not found, skipping save');
                            db.close();
                            resolve();
                            return;
                        }
                        const transaction = db.transaction('gtfs', 'readwrite');
                        const store = transaction.objectStore('gtfs');
                        const putRequest = store.put(data, 'data');
                        putRequest.onsuccess = () => {
                            console.log('✅ Saved to IndexedDB cache');
                            db.close();
                            resolve();
                        };
                        putRequest.onerror = (e) => {
                            console.log('IndexedDB put failed:', e);
                            db.close();
                            resolve();
                        };
                        transaction.onerror = (e) => {
                            console.log('IndexedDB transaction failed:', e);
                            db.close();
                            resolve();
                        };
                    } catch (e) {
                        console.log('IndexedDB operation failed:', e);
                        db.close();
                        resolve();
                    }
                };
                request.onerror = (e) => {
                    console.log('IndexedDB open failed:', e);
                    resolve();
                };
            } catch (e) {
                console.log('IndexedDB error:', e);
                resolve();
            }
        });
    }

    async clearCache() {
        // Clear localStorage
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.CACHE_VERSION_KEY);
        localStorage.removeItem('jakmove_gtfs_last_modified');
        localStorage.removeItem('jakmove_gtfs_etag');
        
        // Clear IndexedDB
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('JakMoveGTFS', 1);
                request.onupgradeneeded = (e) => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('gtfs')) {
                        db.createObjectStore('gtfs');
                    }
                };
                request.onsuccess = (e) => {
                    const db = e.target.result;
                    if (db.objectStoreNames.contains('gtfs')) {
                        const transaction = db.transaction('gtfs', 'readwrite');
                        const store = transaction.objectStore('gtfs');
                        store.clear();
                        transaction.oncomplete = () => resolve();
                        transaction.onerror = () => resolve();
                    } else {
                        resolve();
                    }
                    db.close();
                };
                request.onerror = () => resolve();
            } catch (e) {
                console.log('IndexedDB clear failed:', e);
                resolve();
            }
        });
    }

    // Background update check (non-blocking)
    checkForUpdatesInBackground() {
        // Run in background without blocking UI
        setTimeout(async () => {
            try {
                console.log('🔄 Checking for GTFS updates in background...');
                
                // Check if any GTFS file has been modified
                const sampleFileResponse = await fetch('gtfs/routes.txt', { method: 'HEAD' });
                const lastModified = sampleFileResponse.headers.get('Last-Modified');
                const eTag = sampleFileResponse.headers.get('ETag');
                
                const storedLastModified = localStorage.getItem('jakmove_gtfs_last_modified');
                const storedETag = localStorage.getItem('jakmove_gtfs_etag');
                
                if (lastModified !== storedLastModified || eTag !== storedETag) {
                    console.log('📥 GTFS update available, will refresh on next visit');
                    // Clear cache so next visit will fetch fresh data
                    await this.clearCache();
                } else {
                    console.log('✅ GTFS data is up to date');
                    // Store current modification info
                    if (lastModified) localStorage.setItem('jakmove_gtfs_last_modified', lastModified);
                    if (eTag) localStorage.setItem('jakmove_gtfs_etag', eTag);
                }
            } catch (error) {
                console.log('Background update check failed:', error);
            }
        }, 5000); // Check after 5 seconds when app has fully loaded
    }

    // Legacy parsers kept for fallback
    parseCSV(text) {
        if (!text || text.trim() === '') return [];
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i]);
            return obj;
        });
    }
}