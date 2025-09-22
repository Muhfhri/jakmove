// GTFS Data Loader Module - Restructured for Better Cache & Loading Flow
export class GTFSLoader {
    constructor() {
        // Core data structures
        this.data = {
            stops: [], routes: [], trips: [], stop_times: [], shapes: [],
            frequencies: [], fare_rules: [], fare_attributes: [], transfers: [], calendar: [], agency: []
        };
        this.stopToRoutes = {};
        
        // Enhanced caches
        this.nextStopCache = new Map();
        this.tripSequenceCache = new Map();
        this.platformLookup = new Map();
        
        // Configuration
        this.CACHE_KEY = 'jakmove_gtfs_data';
        this.CACHE_VERSION_KEY = 'jakmove_gtfs_version';
        this.CURRENT_VERSION = '2.0'; // Restructured version
        this.CACHE_TIMEOUT = 1500; // Faster cache timeout for better UX
        this._worker = null;
        
        // Global debug function
        window.clearGTFSCache = () => this.clearCache();
    }

    // ======================================
    // MAIN LOADING ENTRY POINT
    // ======================================

    async loadData() {
        try {
            console.log('🚀 Starting GTFS data loading (v2.0)...');
            this.showSlideNotification();
            this.updateSlideNotification(2, '<i class="fas fa-search" style="color: #8b5cf6;"></i> Memeriksa cache...');

            // Try cache first
            const cachedData = await this.attemptCacheLoad();
            
            if (cachedData) {
                await this.processCachedData(cachedData);
            } else {
                await this.processNetworkData();
            }

            // Complete loading process
            await this.finalizeLoading();
            
            console.log('✅ GTFS data loading completed');
            return this.data;
            
        } catch (error) {
            console.error('❌ GTFS loading failed:', error);
            this.showError('Gagal memuat data aplikasi');
            throw error;
        }
    }

    // ======================================
    // CACHE LOADING FLOW
    // ======================================
    
    async attemptCacheLoad() {
        try {
            return await Promise.race([
                this.loadFromCache(),
                new Promise(resolve => setTimeout(() => resolve(null), this.CACHE_TIMEOUT))
            ]);
        } catch (error) {
            console.warn('Cache attempt failed:', error);
            return null;
        }
    }

    async processCachedData(cachedData) {
        console.log('📦 Processing cached GTFS data (optimized)');
        this.updateSlideNotification(15, '<i class="fas fa-bolt" style="color: #3b82f6;"></i> Memuat data dari cache...');
        
        // Assign data quickly
        Object.assign(this.data, cachedData);
        this.stopToRoutes = cachedData.stopToRoutes || {};
        
        this.updateSlideNotification(85, '<i class="fas fa-wrench" style="color: #10b981;"></i> Menyiapkan data cache...');
        console.log(`📋 Cache loaded: ${Object.keys(this.stopToRoutes).length} stop mappings`);
        
        // Process with cache flag (much faster)
        await this.unifiedDataProcessing('cache');
    }

    // ======================================
    // NETWORK LOADING FLOW
    // ======================================
    
    async processNetworkData() {
        console.log('🌐 Processing network GTFS data');
            this.updateSlideNotification(5, '<i class="fas fa-cloud-download-alt" style="color: #6366f1;"></i> Memuat dari server...');

        // Load and parse files
        const texts = await this.loadNetworkFiles();
        const parsed = await this.parseDataFiles(texts);
        
        // Assign data
        Object.assign(this.data, parsed);
        this.stopToRoutes = parsed.stopToRoutes || {};
        
        console.log(`🔄 Network loaded: ${Object.keys(this.stopToRoutes).length} stop mappings`);
        
        // Save to cache
        this.updateSlideNotification(92, '<i class="fas fa-save" style="color: #8b5cf6;"></i> Menyimpan ke cache...');
        await this.saveToCache();
        
        // Process with network flag
        await this.unifiedDataProcessing('network');
    }

    async loadNetworkFiles() {
        // Prioritized file loading - essential files first
        const coreFiles = [
            { url: 'gtfs/stops.txt', key: 'stopsTxt', label: '🚏 stops' },
            { url: 'gtfs/routes.txt', key: 'routesTxt', label: '🛣️ routes' },
            { url: 'gtfs/trips.txt', key: 'tripsTxt', label: '🚌 trips' },
            { url: 'gtfs/stop_times.txt', key: 'stopTimesTxt', label: '⏰ stop_times' }
        ];
        
        const optionalFiles = [
            { url: 'gtfs/shapes.txt', key: 'shapesTxt', label: '📐 shapes' },
            { url: 'gtfs/frequencies.txt', key: 'frequenciesTxt', label: '🔄 frequencies' },
            { url: 'gtfs/fare_rules.txt', key: 'fareRulesTxt', label: '💰 fare_rules' },
            { url: 'gtfs/fare_attributes.txt', key: 'fareAttributesTxt', label: '💳 fare_attributes' },
            { url: 'gtfs/transfers.txt', key: 'transfersTxt', label: '🔄 transfers' },
            { url: 'gtfs/calendar.txt', key: 'calendarTxt', label: '📅 calendar' },
            { url: 'gtfs/agency.txt', key: 'agencyTxt', label: '🏢 agency' }
        ];

        this.updateSlideNotification(8, '<i class="fas fa-rocket" style="color: #ec4899;"></i> Memulai pengunduhan paralel...');
        
            const texts = {};
        const allFiles = [...coreFiles, ...optionalFiles];
        let completed = 0;
        
        try {
            // Phase 1: Load core files first (parallel)
            this.updateSlideNotification(15, '<i class="fas fa-box" style="color: #3b82f6;"></i> Memuat file utama...');
            const corePromises = coreFiles.map(async (file) => {
                try {
                    const response = await fetch(file.url);
                    const text = await response.text();
                    texts[file.key] = text;
                    
                    completed++;
                    const progress = 15 + (completed / 4) * 40; // 15-55% for core files
                    this.updateSlideNotification(progress, `${file.label} <i class="fas fa-check" style="color: #22c55e;"></i>`);
                    
                    return { key: file.key, success: true };
                } catch (error) {
                    console.warn(`Failed to load ${file.url}:`, error);
                    texts[file.key] = '';
                    completed++;
                    return { key: file.key, success: false };
                }
            });
            
            await Promise.all(corePromises);
            
            // Phase 2: Load optional files (parallel)
            this.updateSlideNotification(60, '📋 Memuat file tambahan...');
            const optionalPromises = optionalFiles.map(async (file) => {
                try {
                    const response = await fetch(file.url);
                    const text = await response.text();
                    texts[file.key] = text;
                    
                    completed++;
                    const progress = 60 + ((completed - 4) / 7) * 25; // 60-85% for optional files
                    this.updateSlideNotification(progress, `${file.label} <i class="fas fa-check" style="color: #22c55e;"></i>`);
                    
                    return { key: file.key, success: true };
                } catch (error) {
                    console.warn(`Failed to load ${file.url}:`, error);
                    texts[file.key] = '';
                    completed++;
                    return { key: file.key, success: false };
                }
            });
            
            await Promise.all(optionalPromises);
            
            this.updateSlideNotification(87, '<i class="fas fa-check-circle" style="color: #22c55e;"></i> Semua file berhasil dimuat!');
            console.log('🚀 All files loaded with parallel optimization');
            
        } catch (error) {
            console.warn('Optimized loading failed, some files may be missing:', error);
        }

        return texts;
    }

    async parseDataFiles(texts) {
        this.updateSlideNotification(88, '⚙️ Memproses data GTFS...');
        
        const worker = this.ensureWorker();
        if (worker) {
            console.log('🔧 Using Web Worker for fast parsing');
            return await this.parseWithWorker(texts);
                } else {
            console.log('⚠️ Web Worker not available, using main thread');
            this.updateSlideNotification(89, '🔄 Parsing di main thread...');
            return this.parseInMainThread(texts);
        }
    }

    // ======================================
    // UNIFIED DATA PROCESSING
    // ======================================
    
    async unifiedDataProcessing(source) {
        console.log(`🔄 Starting optimized processing for ${source} data`);
        
        if (source === 'cache') {
            // Fast track for cached data - minimal processing
            this.updateSlideNotification(90, '<i class="fas fa-shield-alt" style="color: #10b981;"></i> Memvalidasi data cache...');
            this.validateData();
            
            this.updateSlideNotification(95, '<i class="fas fa-bullseye" style="color: #f59e0b;"></i> Menyelesaikan cache...');
            // Skip heavy processing for cache - data should already be good
            this.performCrossValidation();
            
        } else {
            // Full processing for network data
            this.updateSlideNotification(90, '<i class="fas fa-search" style="color: #3b82f6;"></i> Memvalidasi data...');
            this.validateData();
            
            this.updateSlideNotification(93, '<i class="fas fa-hammer" style="color: #6366f1;"></i> Membangun struktur data...');
            await this.buildEnhancedStructures();
            
            this.updateSlideNotification(96, '<i class="fas fa-gift" style="color: #f59e0b;"></i> Finalisasi data...');
            await this.finalProcessing();
        }
        
        console.log(`✅ Optimized processing completed for ${source}`);
    }

    validateData() {
        const requiredData = ['stops', 'routes', 'trips', 'stop_times'];
        const minCounts = { stops: 100, routes: 10, trips: 100, stop_times: 1000 };
        
        for (const dataType of requiredData) {
            const count = this.data[dataType]?.length || 0;
            const minCount = minCounts[dataType] || 0;
            
            if (count < minCount) {
                throw new Error(`Insufficient ${dataType}: ${count} < ${minCount}`);
            }
        }
        
        // Validate stopToRoutes
        if (Object.keys(this.stopToRoutes).length === 0) {
            console.log('🔧 Building stopToRoutes mapping...');
            this.buildStopToRoutesMapping();
        }
        
        console.log(`✅ Data validated - ${Object.keys(this.stopToRoutes).length} stop mappings`);
    }

    async buildEnhancedStructures() {
        console.log('🏗️ Building optimized structures...');
        
        // Only build essential structures for faster loading
        this.buildTripSequenceCache();
        this.buildPlatformLookup();
        
        // Skip heavy calculations that can be done on-demand
        console.log('✅ Essential structures built (optimized)');
    }

    async finalProcessing() {
        console.log('🎁 Optimized final processing...');
        
        // Cross-validate data relationships (fast validation only)
        this.performCrossValidation();
        
        // Minimal delay for faster completion
        await new Promise(resolve => setTimeout(resolve, 10));
        
        console.log('✅ Processing finalized (optimized)');
    }

    async finalizeLoading() {
        this.updateSlideNotification(100, '<i class="fas fa-check-circle" style="color: #22c55e;"></i> Data berhasil dimuat!');
        this.updateLastModifiedUI();
        
        // Hide loading progress now that data is ready
        setTimeout(() => {
            this.hideSlideNotification();
            console.log('📊 GTFS data loading completed, progress hidden');
        }, 800);
        
        // Background update check
        this.checkForUpdatesInBackground();
        
        // Signal that GTFS is ready
        window.gtfsDataReady = true;
    }

    // ======================================
    // DATA STRUCTURE BUILDERS
    // ======================================
    
    buildStopToRoutesMapping() {
        if (!this.data.stop_times || !this.data.trips) return;
        
        this.stopToRoutes = {};
        const tripToRoute = new Map();
        
        // Map trip to route
        this.data.trips.forEach(trip => {
            tripToRoute.set(String(trip.trip_id), String(trip.route_id));
        });
        
        // Map stop to routes
        this.data.stop_times.forEach(st => {
            const stopId = String(st.stop_id);
            const routeId = tripToRoute.get(String(st.trip_id));
            
            if (routeId) {
                if (!this.stopToRoutes[stopId]) {
                    this.stopToRoutes[stopId] = new Set();
                }
                this.stopToRoutes[stopId].add(routeId);
            }
        });
        
        // Convert Sets to Arrays
        Object.keys(this.stopToRoutes).forEach(stopId => {
            this.stopToRoutes[stopId] = Array.from(this.stopToRoutes[stopId]);
        });
    }

    buildTripSequenceCache() {
        this.tripSequenceCache = new Map();
        
        // Group stop_times by trip
        const tripGroups = new Map();
        this.data.stop_times.forEach(st => {
            const tripId = String(st.trip_id);
            if (!tripGroups.has(tripId)) {
                tripGroups.set(tripId, []);
            }
            tripGroups.get(tripId).push(st);
        });
        
        // Sort and cache
        tripGroups.forEach((stopTimes, tripId) => {
            const sorted = stopTimes.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            this.tripSequenceCache.set(tripId, sorted);
        });
        
        console.log(`📋 Built ${this.tripSequenceCache.size} trip sequences`);
    }

    async preCalculateNextStops() {
        this.nextStopCache = new Map();
        
        // Focus on major stops (2+ routes)
        const majorStops = this.data.stops.filter(stop => {
            const routes = this.stopToRoutes[String(stop.stop_id)] || [];
            return routes.length >= 2;
        }).slice(0, 100);
        
        for (const stop of majorStops) {
            const stopId = String(stop.stop_id);
            const routes = this.stopToRoutes[stopId] || [];
            
            for (const routeId of routes) {
                const nextStopName = this.calculateNextStopForRoute(stopId, routeId);
                if (nextStopName) {
                    this.nextStopCache.set(`${stopId}-${routeId}`, nextStopName);
                }
            }
            
            // Small delay to prevent blocking
            if (majorStops.indexOf(stop) % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }
        
        console.log(`🎯 Pre-calculated ${this.nextStopCache.size} next stops`);
    }

    buildPlatformLookup() {
        this.platformLookup = new Map();
        
        const stopsWithPlatforms = this.data.stops.filter(stop => 
            stop.platform_code && String(stop.platform_code).trim()
        );
        
        stopsWithPlatforms.forEach(stop => {
            const code = String(stop.platform_code).trim();
            if (!this.platformLookup.has(code)) {
                this.platformLookup.set(code, []);
            }
            this.platformLookup.get(code).push(stop);
        });
        
        console.log(`🚏 Built ${this.platformLookup.size} platform lookups`);
    }

    async preGeneratePlatformMappings() {
        try {
            const mapManager = window.transJakartaApp?.modules?.map;
            if (!mapManager || !mapManager._platformMapCache) return;
            
            const interchangeStops = this.data.stops.filter(stop => {
                const hasPlatform = stop.platform_code && String(stop.platform_code).trim();
                const routes = this.stopToRoutes[String(stop.stop_id)] || [];
                return hasPlatform && routes.length >= 2;
            }).slice(0, 50);
            
            for (const stop of interchangeStops) {
                const stopId = String(stop.stop_id);
                const routes = this.stopToRoutes[stopId] || [];
                const platformCode = String(stop.platform_code).trim();
                
                if (platformCode) {
                    const cacheKey = `platforms-${stopId}-all`;
                    const platformMap = [{
                        code: platformCode,
                        routeIds: routes,
                        nextByRoute: routes.map(rid => ({
                            rid: String(rid),
                            nextName: this.nextStopCache.get(`${stopId}-${rid}`) || ''
                        })),
                        headsign: '', nextName: '', bearingDeg: null, directionArrow: '',
                        lat: parseFloat(stop.stop_lat || 0),
                        lng: parseFloat(stop.stop_lon || 0)
                    }];
                    
                    mapManager._platformMapCache.set(cacheKey, {
                        platformMap: platformMap,
                        ts: Date.now()
                    });
                }
            }
            
            console.log(`🗂️ Pre-generated ${interchangeStops.length} platform mappings`);
        } catch (error) {
            console.warn('Platform mapping generation failed:', error);
        }
    }

    // ======================================
    // WORKER & PARSING
    // ======================================
    
    ensureWorker() {
        if (this._worker) return this._worker;
        try {
            this._worker = new Worker('workers/gtfs-worker.js');
        } catch (error) {
            console.warn('Worker creation failed:', error);
            this._worker = null;
        }
        return this._worker;
    }

    async parseWithWorker(texts) {
        return new Promise((resolve, reject) => {
            const worker = this._worker;
            
            const handleMessage = (msg) => {
                if (msg.data.type === 'progress') {
                    this.updateSlideNotification(msg.data.percent, msg.data.status);
                } else if (msg.data.type === 'result') {
                    worker.removeEventListener('message', handleMessage);
                    resolve(msg.data.data);
                } else if (msg.data.type === 'error') {
                    worker.removeEventListener('message', handleMessage);
                    reject(new Error(msg.data.error));
                }
            };
            
            worker.addEventListener('message', handleMessage);
            worker.postMessage({ cmd: 'parseAll', payload: texts });
        });
    }

    parseInMainThread(texts) {
        console.log('📝 Parsing in main thread (fallback)');
        
        const parseCSV = (text) => {
            if (!text || !text.trim()) return [];
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length === 0) return [];
            const headers = lines[0].split(',').map(h => h.trim());
            return lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((h, i) => obj[h] = values[i] || '');
                return obj;
            });
        };
        
        const result = {
            stops: parseCSV(texts.stopsTxt || ''),
            routes: parseCSV(texts.routesTxt || ''),
            trips: parseCSV(texts.tripsTxt || ''),
            stop_times: parseCSV(texts.stopTimesTxt || ''),
            shapes: parseCSV(texts.shapesTxt || ''),
            frequencies: parseCSV(texts.frequenciesTxt || ''),
            fare_rules: parseCSV(texts.fareRulesTxt || ''),
            fare_attributes: parseCSV(texts.fareAttributesTxt || ''),
            transfers: parseCSV(texts.transfersTxt || ''),
            calendar: parseCSV(texts.calendarTxt || ''),
            agency: parseCSV(texts.agencyTxt || '')
        };
        
        // Build stopToRoutes in main thread
        const stopToRoutes = {};
        const tripToRoute = new Map(result.trips.map(t => [t.trip_id, t.route_id]));
        
        result.stop_times.forEach(st => {
            const routeId = tripToRoute.get(st.trip_id);
            if (routeId) {
                if (!stopToRoutes[st.stop_id]) stopToRoutes[st.stop_id] = new Set();
                stopToRoutes[st.stop_id].add(routeId);
            }
        });
        
        Object.keys(stopToRoutes).forEach(k => {
            stopToRoutes[k] = Array.from(stopToRoutes[k]);
        });
        
        result.stopToRoutes = stopToRoutes;
        return result;
    }

    // ======================================
    // HELPER METHODS
    // ======================================
    
    calculateNextStopForRoute(currentStopId, routeId) {
        try {
            const routeTrips = this.data.trips.filter(t => String(t.route_id) === String(routeId));
            if (!routeTrips.length) return '';
            
            for (const trip of routeTrips.slice(0, 3)) {
                const tripId = String(trip.trip_id);
                const sortedStopTimes = this.tripSequenceCache.get(tripId);
                if (!sortedStopTimes) continue;
                
                const currentIndex = sortedStopTimes.findIndex(st => 
                    String(st.stop_id) === String(currentStopId)
                );
                
                if (currentIndex >= 0 && currentIndex < sortedStopTimes.length - 1) {
                    const nextStopId = sortedStopTimes[currentIndex + 1].stop_id;
                    const nextStop = this.data.stops.find(s => String(s.stop_id) === String(nextStopId));
                    if (nextStop) return nextStop.stop_name || '';
                }
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    performCrossValidation() {
        try {
            const invalidTrips = this.data.trips.filter(trip => {
                return !this.data.routes.some(route => route.route_id === trip.route_id);
            }).length;
            
            const invalidStopTimes = this.data.stop_times.filter(st => {
                const tripExists = this.data.trips.some(trip => trip.trip_id === st.trip_id);
                const stopExists = this.data.stops.some(stop => stop.stop_id === st.stop_id);
                return !tripExists || !stopExists;
            }).length;
            
            if (invalidTrips > 0) {
                console.warn(`⚠️ ${invalidTrips} invalid trip references found`);
            }
            if (invalidStopTimes > 0) {
                console.warn(`⚠️ ${invalidStopTimes} invalid stop_time references found`);
            }
            
            console.log('✅ Cross-validation completed');
        } catch (error) {
            console.warn('Cross-validation failed:', error);
        }
    }

    // ======================================
    // CACHE MANAGEMENT
    // ======================================
    
    async loadFromCache() {
        // Check version
            const cachedVersion = localStorage.getItem(this.CACHE_VERSION_KEY);
            if (cachedVersion !== this.CURRENT_VERSION) {
            console.log('Cache version mismatch, clearing');
                await this.clearCache();
                return null;
            }

        // Try localStorage first
        try {
            const localData = localStorage.getItem(this.CACHE_KEY);
            if (localData) {
                return JSON.parse(localData);
            }
        } catch (error) {
            console.warn('localStorage failed:', error);
        }

        // Try IndexedDB fallback
        try {
            return await this.loadFromIndexedDB();
        } catch (error) {
            console.warn('IndexedDB failed:', error);
        }

            return null;
    }

    async saveToCache() {
        try {
            const cacheData = this.compressDataForCache();
            localStorage.setItem(this.CACHE_VERSION_KEY, this.CURRENT_VERSION);

            // Try localStorage first
            try {
                const dataStr = JSON.stringify(cacheData);
                if (dataStr.length < 5 * 1024 * 1024) { // 5MB limit
                    localStorage.setItem(this.CACHE_KEY, dataStr);
                    console.log('💾 Cached to localStorage');
                } else {
                    throw new Error('Too large for localStorage');
                }
            } catch (error) {
                console.warn('localStorage save failed, using IndexedDB:', error);
            await this.saveToIndexedDB(cacheData);
            }
        } catch (error) {
            console.warn('Cache save failed:', error);
        }
    }

    compressDataForCache() {
        return {
            stops: this.data.stops.map(s => ({
                stop_id: s.stop_id, stop_name: s.stop_name,
                stop_lat: parseFloat(s.stop_lat), stop_lon: parseFloat(s.stop_lon),
                location_type: s.location_type, platform_code: s.platform_code
            })),
            routes: this.data.routes.map(r => ({
                route_id: r.route_id, route_short_name: r.route_short_name,
                route_long_name: r.route_long_name, route_color: r.route_color,
                route_text_color: r.route_text_color, route_desc: r.route_desc
            })),
            trips: this.data.trips.map(t => ({
                route_id: t.route_id, service_id: t.service_id, trip_id: t.trip_id,
                trip_headsign: t.trip_headsign, shape_id: t.shape_id
            })),
            stop_times: this.data.stop_times.map(st => ({
                trip_id: st.trip_id, arrival_time: st.arrival_time, departure_time: st.departure_time,
                stop_id: st.stop_id, stop_sequence: parseInt(st.stop_sequence)
            })),
            shapes: this.data.shapes.map(sh => ({
                shape_id: sh.shape_id, shape_pt_lat: parseFloat(sh.shape_pt_lat),
                shape_pt_lon: parseFloat(sh.shape_pt_lon), shape_pt_sequence: parseInt(sh.shape_pt_sequence)
            })),
            frequencies: this.data.frequencies, fare_rules: this.data.fare_rules,
            fare_attributes: this.data.fare_attributes, transfers: this.data.transfers,
            calendar: this.data.calendar, agency: this.data.agency,
            stopToRoutes: this.stopToRoutes, timestamp: Date.now()
        };
    }

    async loadFromIndexedDB() {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('jakmove_cache', 1);
                
                request.onerror = () => resolve(null);
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['gtfs_data'], 'readonly');
                    const store = transaction.objectStore('gtfs_data');
                        const getRequest = store.get('data');
                    
                    getRequest.onsuccess = () => resolve(getRequest.result?.data || null);
                    getRequest.onerror = () => resolve(null);
                };
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('gtfs_data')) {
                        db.createObjectStore('gtfs_data');
                    }
                };
            } catch (error) {
                resolve(null);
            }
        });
    }

    async saveToIndexedDB(data) {
        return new Promise((resolve) => {
            try {
                const request = indexedDB.open('jakmove_cache', 1);
                
                request.onsuccess = (event) => {
                    const db = event.target.result;
                    const transaction = db.transaction(['gtfs_data'], 'readwrite');
                    const store = transaction.objectStore('gtfs_data');
                    
                    store.put({ data }, 'data');
                    transaction.oncomplete = () => {
                        console.log('💾 Cached to IndexedDB');
                            resolve();
                        };
                    transaction.onerror = () => resolve();
                };
                
                request.onerror = () => resolve();
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('gtfs_data')) {
                        db.createObjectStore('gtfs_data');
                    }
                };
            } catch (error) {
                resolve();
            }
        });
    }

    async clearCache() {
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.CACHE_VERSION_KEY);
        localStorage.removeItem('jakmove_gtfs_last_modified');
        localStorage.removeItem('jakmove_gtfs_latest_file');
        localStorage.removeItem('jakmove_gtfs_etag');
        
        try {
            const request = indexedDB.deleteDatabase('jakmove_cache');
            await new Promise(resolve => {
                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
                request.onblocked = () => resolve();
            });
        } catch (error) {
            console.warn('IndexedDB clear failed:', error);
        }

        console.log('🗑️ Cache cleared');
    }

    // ======================================
    // PUBLIC API
    // ======================================
    
    getStops() { return this.data.stops || []; }
    getRoutes() { return this.data.routes || []; }
    getTrips() { return this.data.trips || []; }
    getStopTimes() { return this.data.stop_times || []; }
    getShapes() { return this.data.shapes || []; }
    getStopToRoutes() { return this.stopToRoutes || {}; }
    getFrequencies() { return this.data.frequencies || []; }
    getFareRules() { return this.data.fare_rules || []; }
    getFareAttributes() { return this.data.fare_attributes || []; }
    getTransfers() { return this.data.transfers || []; }
    getCalendar() { return this.data.calendar || []; }
    getAgency() { return this.data.agency || []; }

    // Enhanced natural sort function for route sorting - NUMBERS FIRST, then LETTERS
    naturalSort(a, b) {
        // Get route short names for comparison
        const aName = a.route_short_name || a.route_id || '';
        const bName = b.route_short_name || b.route_id || '';
        
        // Enhanced regex to properly categorize routes
        const aMatch = aName.match(/^([A-Za-z]*)(\d*)([A-Za-z]?)(.*)$/);
        const bMatch = bName.match(/^([A-Za-z]*)(\d*)([A-Za-z]?)(.*)$/);
        
        if (aMatch && bMatch) {
            const aPrefix = aMatch[1] || '';  // Letter prefix (B, K, etc.)
            const aNum = parseInt(aMatch[2]) || 0;  // Main number
            const aSuffix = aMatch[3] || '';  // Letter suffix (A, B, etc.)
            const aRest = aMatch[4] || '';   // Remaining text
            
            const bPrefix = bMatch[1] || '';
            const bNum = parseInt(bMatch[2]) || 0;
            const bSuffix = bMatch[3] || '';
            const bRest = bMatch[4] || '';
            
            // RULE 1: Pure numbers (1, 2, 3) come FIRST
            const aIsNumeric = aPrefix === '' && aNum > 0;
            const bIsNumeric = bPrefix === '' && bNum > 0;
            
            if (aIsNumeric && !bIsNumeric) return -1; // a comes first
            if (!aIsNumeric && bIsNumeric) return 1;  // b comes first
            
            // RULE 2: Both are numeric routes - sort by number
            if (aIsNumeric && bIsNumeric) {
                if (aNum !== bNum) return aNum - bNum;
                // If same number, compare suffix (1A vs 1B)
                return aSuffix.localeCompare(bSuffix);
            }
            
            // RULE 3: Both are non-numeric routes - sort by prefix first
            if (!aIsNumeric && !bIsNumeric) {
                // Compare prefixes (B vs K)
                if (aPrefix !== bPrefix) {
                    return aPrefix.localeCompare(bPrefix);
                }
                
                // Same prefix, compare numbers (B1 vs B11)
                if (aNum !== bNum) {
                    return aNum - bNum;
                }
                
                // Same prefix and number, compare suffix
                if (aSuffix !== bSuffix) {
                    return aSuffix.localeCompare(bSuffix);
                }
                
                // Same everything, compare rest
                return aRest.localeCompare(bRest);
            }
        }
        
        // Fallback to regular string comparison
        return aName.localeCompare(bName);
    }

    // ======================================
    // UI METHODS
    // ======================================
    
    showSlideNotification() {
        const notification = document.getElementById('slideNotification');
        if (notification) {
            notification.style.display = 'block';
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            console.log('📱 Slide notification shown');
        } else {
            console.warn('⚠️ Slide notification element not found!');
        }
    }


    hideSlideNotification() {
        const notification = document.getElementById('slideNotification');
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.style.display = 'none';
                console.log('📱 Slide notification hidden');
            }, 500);
        }
    }

    updateSlideNotification(percent, status) {
        const notification = document.getElementById('slideNotification');
        if (!notification) return;
        
        const progressBar = notification.querySelector('.slide-progress-bar');
        const title = notification.querySelector('.slide-title');
        const subtitle = notification.querySelector('.slide-subtitle');
        const percentEl = notification.querySelector('.slide-percent');
        const icon = notification.querySelector('.slide-icon');
        
        // Update progress bar
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        
        // Update percentage
        if (percentEl) {
            percentEl.textContent = `${Math.round(percent)}%`;
        }
        
        // Update status text (support HTML icons)
        if (subtitle) {
            if (status.includes('<i class=')) {
                subtitle.innerHTML = status;
            } else {
                subtitle.textContent = status;
            }
        }
        
        // Update icon and title based on progress
        if (icon && title) {
            if (percent >= 100) {
                icon.innerHTML = '<i class="fas fa-check-circle" style="color: #22c55e;"></i>';
                title.textContent = 'Selesai!';
            } else if (percent >= 95) {
                icon.innerHTML = '<i class="fas fa-gift" style="color: #f59e0b;"></i>';
                title.textContent = 'Finalisasi...';
            } else if (percent >= 85) {
                icon.innerHTML = '<i class="fas fa-cogs" style="color: #3b82f6;"></i>';
                title.textContent = 'Memproses...';
            } else if (percent >= 50) {
                icon.innerHTML = '<i class="fas fa-box" style="color: #6366f1;"></i>';
                title.textContent = 'Memuat Data...';
            } else if (percent >= 10) {
                icon.innerHTML = '<i class="fas fa-folder-open" style="color: #8b5cf6;"></i>';
                title.textContent = 'Mengunduh...';
            } else {
                icon.innerHTML = '<i class="fas fa-rocket" style="color: #ec4899;"></i>';
                title.textContent = 'Memuat JakMove';
            }
        }
        
        // Enhanced console logging
        const timestamp = new Date().toLocaleTimeString();
        console.log(`📱 [${timestamp}] ${percent}% - ${status}`);
        
        // Update page title
        if (percent < 100) {
            document.title = `${Math.round(percent)}% Loading - JakMove`;
        } else {
            document.title = 'JakMove - Transportasi Jakarta';
        }
    }

    showError(message) {
        // Hide loading first
        this.hideSlideNotification();
        
        const errorEl = document.getElementById('loading-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        
        // Also show in console
        console.error('GTFS Error:', message);
        
        // Create fallback error display if no error element
        if (!errorEl) {
            const fallbackError = document.createElement('div');
            fallbackError.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #fee2e2; border: 1px solid #fecaca; color: #dc2626;
                padding: 20px; border-radius: 8px; z-index: 10000; text-align: center;
            `;
            fallbackError.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 10px;">❌ Error Loading</div>
                <div>${message}</div>
                <button onclick="this.parentElement.remove()" style="margin-top: 10px; padding: 5px 10px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
            `;
            document.body.appendChild(fallbackError);
        }
    }

    updateLastModifiedUI() {
        try {
            const lastModified = localStorage.getItem('jakmove_gtfs_last_modified');
            const el = document.getElementById('gtfs-last-modified');
            if (el && lastModified) {
                const date = new Date(lastModified);
                el.textContent = date.toLocaleDateString('id-ID');
            }
        } catch (error) {
            console.warn('Failed to update last modified UI:', error);
        }
    }

    async checkForUpdatesInBackground() {
        try {
            const response = await fetch('gtfs/latest.json');
            if (!response.ok) {
                // File doesn't exist, skip background check silently
                return;
            }
            
            const latestInfo = await response.json();
                const storedLastModified = localStorage.getItem('jakmove_gtfs_last_modified');
                
            if (latestInfo.date !== storedLastModified) {
                    console.log('📥 GTFS update available, will refresh on next visit');
                    await this.clearCache();
                    
                    if (latestInfo.date) {
                        localStorage.setItem('jakmove_gtfs_last_modified', latestInfo.date);
                        localStorage.setItem('jakmove_gtfs_latest_file', latestInfo.file);
                    }
                }
            } catch (error) {
            // Silent fail for background check - this is optional functionality
            console.debug('Background update check failed (expected in development):', error.message);
        }
    }
}
