// Search Manager Module
export class SearchManager {
    constructor() {
        this.searchResults = [];
        this._debounceId = null;
        this._searchCache = new Map();
        this._lastQuery = '';
        this._activeFilter = 'all';
        this._allResults = null; // Store all results for filtering
        this._currentSearchController = null; // For cancelling ongoing searches
        // Indexed data for fast search
        this._indexBuilt = false;
        this._stopIndex = [];
        this._routeIndex = [];
        // Rail stations (KRL/MRT/LRT/LRTJ)
        this._railIndex = [];
        this._railIndexBuilt = false;
        this._railInitStarted = false;
        // Offline aliases for well-known places (used as fallback)
        this._placeAliasCoords = {
            'gelora bung karno': { lat: -6.2185, lon: 106.8029, name: 'Gelora Bung Karno (Stadion GBK)', type: 'stadium', category: 'attraction' },
            'gbk': { lat: -6.2185, lon: 106.8029, name: 'Gelora Bung Karno (GBK)', type: 'stadium', category: 'attraction' },
            'monas': { lat: -6.175392, lon: 106.827153, name: 'Monumen Nasional (Monas)', type: 'monument', category: 'tourism' },
            'bundaran hi': { lat: -6.193, lon: 106.8239, name: 'Bundaran Hotel Indonesia', type: 'attraction', category: 'tourism' },
            'istiqlal': { lat: -6.1703, lon: 106.8316, name: 'Masjid Istiqlal', type: 'place_of_worship', category: 'amenity' },
            'kota tua': { lat: -6.1352, lon: 106.8133, name: 'Kota Tua Jakarta', type: 'attraction', category: 'tourism' },
            'tmii': { lat: -6.302, lon: 106.895, name: 'Taman Mini Indonesia Indah (TMII)', type: 'attraction', category: 'tourism' },
            'taman mini indonesia indah': { lat: -6.302, lon: 106.895, name: 'Taman Mini Indonesia Indah', type: 'attraction', category: 'tourism' },
            'ragunan': { lat: -6.3111, lon: 106.8206, name: 'Kebun Binatang Ragunan', type: 'zoo', category: 'tourism' },
            'taman ismail marzuki': { lat: -6.1967, lon: 106.8383, name: 'Taman Ismail Marzuki (TIM)', type: 'theatre', category: 'amenity' },
            'tim': { lat: -6.1967, lon: 106.8383, name: 'Taman Ismail Marzuki (TIM)', type: 'theatre', category: 'amenity' }
        };
        this.initFilterTabs();
    }

    // Initialize filter tabs
    initFilterTabs() {
        // Initialize filter UI after DOM is ready
        setTimeout(() => {
            const filterButtons = document.querySelectorAll('.modern-filter-btn');
            filterButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const filter = e.currentTarget.dataset.filter;
                    this.setActiveFilter(filter);
                });
            });
        }, 500);
    }

    // Set active filter
    setActiveFilter(filter) {
        this._activeFilter = filter;
        
        // Update UI
        const filterButtons = document.querySelectorAll('.modern-filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        // Re-apply current search with new filter
        if (this._allResults && this._lastQuery) {
            this.applyFilterToResults();
        }
    }

    // Apply current filter to stored results
    applyFilterToResults() {
        const resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv || !this._allResults) return;
        
        resultsDiv.innerHTML = '';
        const ul = this.createResultsList();
        let hasResults = false;
        
        // Apply filter
        if (this._activeFilter === 'all' || this._activeFilter === 'routes') {
            if (this._allResults.routes && this._allResults.routes.length > 0) {
                this.addRoutesResults(this._allResults.routes, ul);
                hasResults = true;
            }
        }
        
        if (this._activeFilter === 'all' || this._activeFilter === 'stops') {
            if (this._allResults.stops && this._allResults.stops.length > 0) {
                this.addStopsResults(this._allResults.stops, this._allResults.stopToRoutes, this._allResults.allRoutes, ul);
                hasResults = true;
            }
        }
        
        // Stations are considered places in filter UX, but shown under their own header
        if (this._activeFilter === 'all' || this._activeFilter === 'places') {
            if (this._allResults.places && this._allResults.places.length > 0) {
                this.addPlacesResults(this._allResults.places, ul);
                hasResults = true;
            }
            if (this._allResults.stations && this._allResults.stations.length > 0) {
                this.addStationsResults(this._allResults.stations, ul);
                hasResults = true;
            }
        }
        
        if (!hasResults) {
            this.addNoResultsMessage(ul, this._lastQuery);
        }
        
        resultsDiv.appendChild(ul);
        this._reattachEventListeners(resultsDiv);
    }

    // Handle search input
    handleSearch(query) {
        const resultsDiv = document.getElementById('searchResults');
        const filterTabs = document.getElementById('searchFilterTabs');
        if (!resultsDiv) return;

        // Cancel any ongoing search
        if (this._currentSearchController) {
            this._currentSearchController.abort();
        }

        // Debounce agar pencarian responsif tanpa membanjiri UI (120ms)
        clearTimeout(this._debounceId);
        this._debounceId = setTimeout(async () => {
            // Create new search controller for this search
            this._currentSearchController = new AbortController();
            
            resultsDiv.innerHTML = '';
            const q = query.trim().toLowerCase();
            
            if (q.length < 1) {
                this._lastQuery = '';
                this._allResults = null;
                if (filterTabs) filterTabs.style.display = 'none';
                this._currentSearchController = null;
                return;
            }
            
            // Show filter tabs when searching
            if (filterTabs && q.length >= 2) {
                filterTabs.style.display = 'block';
            }
            
            // Check cache first untuk performa yang lebih baik
            const cacheKey = `${q}_${this._activeFilter}`;
            if (this._searchCache.has(cacheKey)) {
                resultsDiv.innerHTML = this._searchCache.get(cacheKey);
                this._lastQuery = q;
                this._reattachEventListeners(resultsDiv);
                this._currentSearchController = null;
                return;
            }
            
            // Search for routes (single digit)
            if (q.length === 1 && !isNaN(q)) {
                const routes = this.getRoutesForQuery(q);
                this._allResults = { routes, stops: [], places: [], stopToRoutes: {}, allRoutes: [] };
                this.applyFilterToResults();
                this._currentSearchController = null;
                return;
            }
            
            if (q.length < 2) {
                this._currentSearchController = null;
                return;
            }
            
            // Show immediate loading for better UX
            this.showSearchingIndicator(resultsDiv, q);
            
            // Pastikan index telah siap (lazy-build)
            try { this._ensureIndex(); } catch(_) {}
            
            // Search all categories with optimized order
            await this.searchAllCategoriesOptimized(q, resultsDiv);
            this._currentSearchController = null;
        }, 120);
    }

    // Show searching indicator for immediate feedback
    showSearchingIndicator(resultsDiv, query) {
        const ul = this.createResultsList();
        
        // Add searching indicator
        const searchingItem = document.createElement('li');
        searchingItem.className = 'search-result-loading';
        searchingItem.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner">
                    <div class="spinner-ring-small"></div>
                    <div class="spinner-ring-small"></div>
                </div>
                <span>Mencari "${query}"...</span>
            </div>
        `;
        
        ul.appendChild(searchingItem);
        resultsDiv.appendChild(ul);
    }

    // Optimized search: render local instantly, append stations/places later
    async searchAllCategoriesOptimized(query, resultsDiv) {
        const startTime = Date.now();
        try {
            // Local first
            const { stops, routes, stopToRoutes, allRoutes } = await this.searchLocalData(query);
            this._allResults = { routes, stops, places: [], stations: [], stopToRoutes, allRoutes };
            this._lastQuery = query;
            resultsDiv.innerHTML = '';
            this.applyFilterToResults();

            // Cache local render
            const cacheKey = `${query}_${this._activeFilter}`;
            if (this._searchCache.size >= 50) {
                const firstKey = this._searchCache.keys().next().value; this._searchCache.delete(firstKey);
            }
            this._searchCache.set(cacheKey, resultsDiv.innerHTML);

            // Stations (background)
            this.searchRailStations(query).then(stations => {
                if (!stations || stations.length === 0) return;
                if (this._lastQuery !== query) return;
                this._allResults.stations = stations;
                const container = document.getElementById('searchResults');
                if (container) this.addStationsResults(stations, container);
            }).catch(()=>{});

            // Places (background, cap time)
            const placesPromise = this.searchPlacesDataFast(query);
            const timeout = new Promise(resolve => setTimeout(() => resolve([]), 1200));
            const places = await Promise.race([placesPromise, timeout]).catch(()=>[]);
            if (Array.isArray(places) && places.length > 0 && this._lastQuery === query) {
                this._allResults.places = places;
                const container = document.getElementById('searchResults');
                if (container) this.addPlacesResults(places, container);
            }

            const endTime = Date.now();
            console.log(`Search local render in ${endTime - startTime}ms; appended stations/places asynchronously`);
        } catch (error) {
            console.error('Search failed:', error);
            resultsDiv.innerHTML = '';
            const ul = this.createResultsList();
            this.addNoResultsMessage(ul, query);
            resultsDiv.appendChild(ul);
        }
    }

    // Fast local data search (stops & routes)
    async searchLocalData(query) {
        return new Promise((resolve) => {
            const gtfs = window.transJakartaApp.modules.gtfs;
            const stops = gtfs.getStops();
            const routes = gtfs.getRoutes();
            const stopToRoutes = gtfs.getStopToRoutes();

            // Ensure index is built
            this._ensureIndex();

            const normQuery = this._normalizeText(query);
            const queryTokens = this._tokenize(normQuery);

            // Expand queries (aliases)
            const expanded = this.expandSearchKeywords(normQuery);
            const variants = Array.from(new Set([normQuery, ...expanded]));

            // Score stops across query variants
            const stopScores = new Map();
            for (const qv of variants) {
                const tokens = this._tokenize(qv);
                for (const entry of this._stopIndex) {
                    const score = this._scoreTokensMatch(entry, tokens, qv);
                    if (score <= 0) continue;
                    const prev = stopScores.get(entry.ref) || 0;
                    if (score > prev) stopScores.set(entry.ref, score);
                }
            }
            let foundStops = Array.from(stopScores.entries())
                .sort((a,b) => b[1]-a[1])
                .slice(0, 50)
                .map(([ref]) => ref);

            // Fallback to fuzzy
            if (foundStops.length === 0 && normQuery.length >= 3) {
                const filteredForFuzzy = stops.filter(s => this._isSearchableStopId(String(s.stop_id || '')));
                const fuzzy = this.findFuzzyMatches(filteredForFuzzy, normQuery);
                foundStops = fuzzy.matches || [];
            }

            // Routes scoring
            const routeScores = new Map();
            for (const qv of variants) {
                const tokens = this._tokenize(qv);
                for (const r of this._routeIndex) {
                    let score = 0;
                    if (r.normLong.includes(qv)) score += 3;
                    if (r.short && r.short.toLowerCase() === qv) score += 5;
                    if (this._isTokenSubset(tokens, r.tokensLong)) score += 2 + tokens.length * 0.2;
                    if (score > 0) {
                        const prev = routeScores.get(r.ref) || 0;
                        if (score > prev) routeScores.set(r.ref, score);
                    }
                }
            }
            let foundRoutes = Array.from(routeScores.keys());
            foundRoutes = foundRoutes.sort((a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b));

            resolve({
                stops: foundStops,
                routes: foundRoutes,
                stopToRoutes: stopToRoutes,
                allRoutes: routes
            });
        });
    }

    // Enhanced places search with multiple fallback strategies
    async searchPlacesDataFast(query) {
        // Skip if query looks like route number or stop name
        if (/^\d+[a-z]?$/i.test(query) || query.includes('halte') || query.includes('stasiun')) {
            return [];
        }

        if (query.length < 3) {
            return [];
        }

        // Check cache first for better consistency
        const cacheKey = `places_${query.toLowerCase()}`;
        if (this._searchCache.has(cacheKey)) {
            const cached = this._searchCache.get(cacheKey);
            console.log('Using cached places result for:', query);
            return cached;
        }

        try {
            console.log(`🔍 Searching places for: "${query}"`);
            
            // Try multiple search strategies
            let places = await this.searchWithMultipleStrategies(query);

            // Fallback: offline alias if no results
            if (!places || places.length === 0) {
                const aliasPlace = this._matchPlaceAlias(this._normalizeText(query));
                if (aliasPlace) {
                    places = [aliasPlace];
                }
            }
            
            console.log(`✅ Found ${places.length} places for: "${query}"`);
            
            // Cache the result for better consistency
            if (this._searchCache.size >= 100) {
                const firstKey = this._searchCache.keys().next().value;
                this._searchCache.delete(firstKey);
            }
            this._searchCache.set(cacheKey, places);
            
            return places;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn('❌ Places search cancelled or timeout for:', query);
            } else {
                console.warn('❌ Places search failed for:', query, error);
            }
            // Try offline alias on failure
            const aliasPlace = this._matchPlaceAlias(this._normalizeText(query));
            return aliasPlace ? [aliasPlace] : [];
        }
    }

    // Search with multiple strategies for better coverage
    async searchWithMultipleStrategies(query) {
        const searchQueries = this.generateSearchQueries(query);
        let allResults = [];

        for (const searchQuery of searchQueries) {
            try {
                const results = await this.performSinglePlaceSearch(searchQuery);
                if (results.length > 0) {
                    allResults = allResults.concat(results);
                    // If we got good results from primary search, don't need to continue
                    if (searchQuery.isPrimary && results.length >= 3) {
                        break;
                    }
                }
            } catch (error) {
                console.warn(`Search failed for query: ${searchQuery.query}`, error);
                continue; // Try next strategy
            }
        }

        // Remove duplicates and filter by area
        const uniqueResults = this.deduplicateAndFilter(allResults);
        
        // Sort by relevance
        return uniqueResults
            .sort((a, b) => {
                const aImportance = parseFloat(a.importance || 0);
                const bImportance = parseFloat(b.importance || 0);
                const aTypeBoost = this.getPlaceTypeBoost(a);
                const bTypeBoost = this.getPlaceTypeBoost(b);
                return (bImportance + bTypeBoost) - (aImportance + aTypeBoost);
            })
            .slice(0, 8); // More results for better coverage
    }

    // Generate multiple search query variations
    generateSearchQueries(originalQuery) {
        const queries = [];
        const cleanQuery = originalQuery.toLowerCase().trim();
        
        // Expand keywords with aliases and full names
        const expandedQueries = this.expandSearchKeywords(cleanQuery);

        for (const expandedQuery of expandedQueries) {
            // Primary search - specific to Jakarta
            queries.push({
                query: `${expandedQuery}, Jakarta, Indonesia`,
                isPrimary: true,
                timeout: 2500
            });

            // Secondary search - broader Jakarta area
            queries.push({
                query: `${expandedQuery}, DKI Jakarta`,
                isPrimary: false,
                timeout: 2000
            });

            // Alternative search without location (for famous landmarks)
            if (this.isFamousLandmark(expandedQuery)) {
                queries.push({
                    query: expandedQuery,
                    isPrimary: false,
                    timeout: 1500
                });
            }
        }

        // Fallback search - Indonesia wide but filtered later
        queries.push({
            query: `${cleanQuery}, Indonesia`,
            isPrimary: false,
            timeout: 1500
        });

        return queries;
    }

    // Expand search keywords with aliases and variations
    expandSearchKeywords(query) {
        const expansions = [];
        const normalizedQuery = query.toLowerCase().trim();
        
        // Add original query
        expansions.push(normalizedQuery);
        
        // Common aliases and expansions for Jakarta landmarks
        const aliases = {
            'monas': ['monumen nasional', 'national monument'],
            'monumen nasional': ['monas', 'national monument'],
            'gbk': ['gelora bung karno', 'gelora senayan'],
            'gelora bung karno': ['gbk', 'gelora senayan'],
            'senayan': ['gelora bung karno', 'gbk'],
            'bundaran hi bank jakarta': ['bundaran hi', 'bundaran hi astra'],
            'istiqlal': ['masjid istiqlal', 'islamic centre'],
            'katedral': ['gereja katedral', 'cathedral'],
            'ancol': ['taman impian jaya ancol', 'ancol dreamland'],
            'kota tua': ['old town', 'old city', 'jakarta old town'],
            'taman mini': ['taman mini indonesia indah', 'tmii'],
            'tmii': ['taman mini indonesia indah', 'taman mini'],
            'ragunan': ['kebun binatang ragunan', 'ragunan zoo'],
            'planetarium': ['planetarium jakarta', 'planetarium taman ismail marzuki'],
            'tim': ['taman ismail marzuki', 'taman ismail marzuki jakarta', 'taman ismail marzuki (tim)'],
            'balai kota': ['balai kota jakarta', 'jakarta city hall'],
            'bundaran hi': ['hotel indonesia roundabout', 'bundaran hotel indonesia'],
            'grand indonesia': ['grand indonesia mall', 'gi mall'],
            'plaza indonesia': ['plaza indonesia mall', 'pi mall'],
            'central park': ['central park mall', 'cp mall'],
            'pondok indah': ['pondok indah mall', 'pim']
        };
        
        // Check for exact matches and add expansions
        for (const [key, values] of Object.entries(aliases)) {
            if (normalizedQuery.includes(key)) {
                values.forEach(value => {
                    if (!expansions.includes(value)) {
                        expansions.push(value);
                    }
                });
            }
        }
        
        // Remove duplicates and return unique expansions
        return [...new Set(expansions)];
    }

    // Check if query is for a famous landmark
    isFamousLandmark(query) {
        const landmarks = [
            'monumen', 'monas', 'stadium', 'gbk', 'gelora',
            'museum', 'taman', 'istiqlal', 'katedral', 'ancol',
            'kota tua', 'planetarium', 'balai kota', 'bundaran'
        ];
        
        return landmarks.some(landmark => query.includes(landmark));
    }

    // Perform single place search with timeout
    async performSinglePlaceSearch(searchQuery) {
        // Use per-request controller and link to global abort
        const globalController = this._currentSearchController;
        const localController = new AbortController();
        const onGlobalAbort = () => { try { localController.abort(); } catch(_) {} };
        try {
            if (globalController && globalController.signal && globalController.signal.aborted) {
                throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
            }
            if (globalController && globalController.signal) {
                globalController.signal.addEventListener('abort', onGlobalAbort, { once: true });
            }
            const timeoutId = setTimeout(() => localController.abort(), searchQuery.timeout);
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.query)}&limit=10&countrycodes=id&accept-language=id&addressdetails=1&extratags=1`;
            const response = await fetch(url, {
                signal: localController.signal,
                headers: { 'User-Agent': 'JakMove/1.0' }
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const places = await response.json();
            return places || [];
        } catch (error) {
            throw error;
        } finally {
            try { if (globalController && globalController.signal) globalController.signal.removeEventListener('abort', onGlobalAbort); } catch(_) {}
        }
    }

    // Remove duplicates and filter by Jakarta area
    deduplicateAndFilter(places) {
        const seen = new Set();
        const filtered = [];

        for (const place of places) {
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);
            
            // More generous bounds for Greater Jakarta area
            if (lat < -6.5 || lat > -5.8 || lon < 106.5 || lon > 107.2) {
                continue;
            }

            // Create unique key based on coordinates and name
            const key = `${Math.round(lat * 1000)}_${Math.round(lon * 1000)}_${(place.display_name || '').toLowerCase()}`;
            if (seen.has(key)) {
                continue;
            }
            
            seen.add(key);
            filtered.push(place);
        }

        return filtered;
    }

    // Boost certain place types for better relevance
    getPlaceTypeBoost(place) {
        const type = (place.type || '').toLowerCase();
        const category = (place.category || '').toLowerCase();
        const name = (place.display_name || '').toLowerCase();
        
        // Extra boost for famous Jakarta landmarks
        if (name.includes('monumen nasional') || name.includes('monas')) return 0.5;
        if (name.includes('gelora bung karno') || name.includes('gbk')) return 0.5;
        if (name.includes('istiqlal') || name.includes('katedral')) return 0.4;
        if (name.includes('kota tua') || name.includes('museum fatahillah')) return 0.4;
        if (name.includes('ancol') || name.includes('taman impian')) return 0.4;
        
        // Higher boost for important landmarks
        if (type.includes('monument') || type.includes('memorial')) return 0.3;
        if (type.includes('stadium') || type.includes('arena') || type.includes('sports')) return 0.25;
        if (type.includes('mall') || type.includes('shopping')) return 0.2;
        if (type.includes('hospital') || type.includes('clinic')) return 0.2;
        if (type.includes('university') || type.includes('school')) return 0.15;
        if (type.includes('museum') || type.includes('gallery')) return 0.15;
        if (type.includes('park') || type.includes('garden')) return 0.1;
        
        // Category-based boosts
        if (category.includes('tourism') || category.includes('historic')) return 0.2;
        if (category.includes('amenity')) return 0.1;
        
        return 0;
    }

    // Search all categories and store results
    async searchAllCategories(query, resultsDiv) {
        const stops = window.transJakartaApp.modules.gtfs.getStops();
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();

        // Search stops
        let foundStops = stops
            .filter(s => this._isSearchableStopId(String(s.stop_id || '')))
            .filter(s => {
                const ns = this._normalizeText(s.stop_name);
                if (ns.includes(query)) return true;
                return this._isTokenSubset(this._tokenize(query), this._tokenize(ns));
            });

        // Search routes
        let foundRoutes = routes.filter(r =>
            (r.route_short_name && r.route_short_name.toLowerCase().includes(query)) ||
            (r.route_long_name && r.route_long_name.toLowerCase().includes(query))
        );

        // Sort routes naturally
        foundRoutes = foundRoutes.sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        // If no exact matches for stops, try fuzzy matches
        if (foundStops.length === 0 && query.length >= 3) {
            const filteredForFuzzy = stops.filter(s => this._isSearchableStopId(String(s.stop_id || '')));
            const fuzzyResult = this.findFuzzyMatches(filteredForFuzzy, query);
            foundStops = fuzzyResult.matches;
        }

        // Search places
        let foundPlaces = [];
        try {
            if (query.length >= 3 && 
                !(/^\d+[a-z]?$/i.test(query) || query.includes('halte') || query.includes('stasiun'))) {
                foundPlaces = await this.searchPlacesData(query);
            }
        } catch (error) {
            console.warn('Place search failed:', error);
        }

        // Store all results
        this._allResults = {
            routes: foundRoutes,
            stops: foundStops,
            places: foundPlaces,
            stopToRoutes: stopToRoutes,
            allRoutes: routes
        };

        this._lastQuery = query;
        this.applyFilterToResults();

        // Cache results
        const cacheKey = `${query}_${this._activeFilter}`;
        if (this._searchCache.size >= 50) {
            const firstKey = this._searchCache.keys().next().value;
            this._searchCache.delete(firstKey);
        }
        this._searchCache.set(cacheKey, resultsDiv.innerHTML);
    }

    // Get routes for single digit query
    getRoutesForQuery(query) {
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        return routes.filter(r =>
            r.route_short_name && r.route_short_name.toLowerCase() === query
        );
    }

    // Legacy search places data (kept for compatibility)
    async searchPlacesData(query) {
        return this.searchPlacesDataFast(query);
    }

    // Search routes by number
    searchRoutes(query, resultsDiv) {
        // Check cache first
        if (this._searchCache.has(query)) {
            resultsDiv.innerHTML = this._searchCache.get(query);
            this._lastQuery = query;
            this._reattachEventListeners(resultsDiv);
            return;
        }

        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const foundRoutes = routes.filter(r =>
            r.route_short_name && r.route_short_name.toLowerCase() === query
        );

        const ul = this.createResultsList();
        
        if (foundRoutes.length === 0) {
            this.addNoResultsMessage(ul, query);
        } else {
            // Add routes header
            const routesHeader = document.createElement('li');
            routesHeader.className = 'list-group-item fw-bold bg-light';
            routesHeader.textContent = 'Layanan';
            ul.appendChild(routesHeader);

            // Add route results
            foundRoutes.forEach(route => {
                const li = this.createRouteResultItem(route);
                ul.appendChild(li);
            });
        }

        resultsDiv.appendChild(ul);
        
        // Optimize performance untuk elemen baru
        if (typeof window.scrollOptimizer !== 'undefined') {
            window.scrollOptimizer.optimizeNewElements(ul);
        }
        
        // Cache hasil (max 50 entries)
        if (this._searchCache.size >= 50) {
            const firstKey = this._searchCache.keys().next().value;
            this._searchCache.delete(firstKey);
        }
        this._searchCache.set(query, resultsDiv.innerHTML);
        this._lastQuery = query;
    }

    // Search stops and routes
    searchStopsAndRoutes(query, resultsDiv) {
        const stops = window.transJakartaApp.modules.gtfs.getStops();
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();

        let foundStops = stops
            .filter(s => s.stop_name.toLowerCase().includes(query))
            .filter(s => !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H')));

        let foundRoutes = routes.filter(r =>
            (r.route_short_name && r.route_short_name.toLowerCase().includes(query)) ||
            (r.route_long_name && r.route_long_name.toLowerCase().includes(query))
        );

        // Sort routes naturally
        foundRoutes = foundRoutes.sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        const ul = this.createResultsList();
        let hasResults = false;
        let suggestionMessage = '';

        // Add routes results
        if (foundRoutes.length > 0) {
            this.addRoutesResults(foundRoutes, ul);
            hasResults = true;
        }

        // If no exact matches for stops, try fuzzy matches
        if (foundStops.length === 0 && query.length >= 3) {
            const filteredForFuzzy = stops.filter(s => this._isSearchableStopId(String(s.stop_id||'')));
            const fuzzyResult = this.findFuzzyMatches(filteredForFuzzy, query);
            foundStops = fuzzyResult.matches;
            suggestionMessage = fuzzyResult.suggestion;
        }

        // Add stops results
        if (foundStops.length > 0) {
            this.addStopsResults(foundStops, stopToRoutes, routes, ul);
            hasResults = true;
        }

        // Tampilkan pesan saran jika ada
        if (suggestionMessage && foundStops.length > 0) {
            this.addSuggestionMessage(ul, suggestionMessage);
        }

        // Jika tidak ada hasil sama sekali
        if (!hasResults) {
            this.addNoResultsMessage(ul, query);
        }

        resultsDiv.appendChild(ul);
        
        // Optimize performance untuk elemen baru
        if (typeof window.scrollOptimizer !== 'undefined') {
            window.scrollOptimizer.optimizeNewElements(ul);
        }
        
        // Cache hasil untuk performa yang lebih baik (max 50 entries)
        if (this._searchCache.size >= 50) {
            const firstKey = this._searchCache.keys().next().value;
            this._searchCache.delete(firstKey);
        }
        this._searchCache.set(query, resultsDiv.innerHTML);
        this._lastQuery = query;
    }

    // Create results list
    createResultsList() {
        const ul = document.createElement('ul');
        ul.className = 'search-results-list';
        return ul;
    }

    // Add routes results
    addRoutesResults(foundRoutes, ul) {
        const routesHeader = document.createElement('li');
        routesHeader.className = 'search-result-header';
        routesHeader.innerHTML = `
            <iconify-icon icon="mdi:bus" class="me-2"></iconify-icon>
            <span>Layanan</span>
        `;
        ul.appendChild(routesHeader);

        foundRoutes.forEach(route => {
            const li = this.createRouteResultItem(route);
            ul.appendChild(li);
        });
    }

    // Add stops results
    addStopsResults(foundStops, stopToRoutes, routes, ul) {
        const stopsHeader = document.createElement('li');
        stopsHeader.className = 'search-result-header';
        stopsHeader.innerHTML = `
            <iconify-icon icon="mdi:bus-stop" class="me-2"></iconify-icon>
            <span>Halte</span>
        `;
        ul.appendChild(stopsHeader);

        // Remove duplicates based on name and coordinates
        const uniqueStops = this.getUniqueStops(foundStops, stopToRoutes);

        uniqueStops.forEach(stop => {
            const li = this.createStopResultItem(stop, stopToRoutes, routes);
            ul.appendChild(li);
        });
    }

    // Get unique stops
    getUniqueStops(stops, stopToRoutes) {
        const stopMap = new Map();
        const normalizeName = (n) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const buildKey = (s) => {
            const sid = String(s.stop_id || '');
            if (s.parent_station) return `PARENT:${String(s.parent_station)}`;
            if (sid.startsWith('H')) return `H:${sid}`;
            return `NAME:${normalizeName(s.stop_name)}`;
        };
        stops.forEach(stop => {
            const key = buildKey(stop);
            if (!stopMap.has(key)) {
                stopMap.set(key, { ...stop, koridors: new Set(), _cluster: [stop] });
            } else {
                stopMap.get(key)._cluster.push(stop);
            }
            if (stopToRoutes[stop.stop_id]) {
                Array.from(stopToRoutes[stop.stop_id]).forEach(rid => 
                    stopMap.get(key).koridors.add(rid)
                );
            }
        });
        return Array.from(stopMap.values()).map(v => {
            // compute representative lat/lon as average of cluster
            try {
                const lat = (v._cluster.map(s => parseFloat(s.stop_lat)).filter(n=>!isNaN(n)).reduce((a,b)=>a+b,0) / v._cluster.length) || parseFloat(v.stop_lat);
                const lon = (v._cluster.map(s => parseFloat(s.stop_lon)).filter(n=>!isNaN(n)).reduce((a,b)=>a+b,0) / v._cluster.length) || parseFloat(v.stop_lon);
                v.stop_lat = lat; v.stop_lon = lon;
            } catch(_){}
            return v;
        });
    }

    // Create route result item
    createRouteResultItem(route) {
        const li = document.createElement('li');
        li.className = 'search-result-item';
        
        const badgeColor = route.route_color ? ('#' + route.route_color) : '#6c757d';
        li.innerHTML = `
            <div class="search-result-content">
                <span class='route-badge' style='background:${badgeColor};'>
                    ${route.route_short_name}
                </span>
                <span class='route-name plus-jakarta-sans'>
                    ${route.route_long_name || ''}
                </span>
            </div>
            <iconify-icon icon="mdi:chevron-right" class="search-result-arrow"></iconify-icon>
        `;
        
        li.onclick = () => {
            window.transJakartaApp.modules.routes.selectRoute(route.route_id);
            this.clearSearchResults();
        };
        
        return li;
    }

    // Create stop result item
    createStopResultItem(stop, stopToRoutes, routes) {
        const li = document.createElement('li');
        li.className = 'search-result-item stop-result-item';
        
        // Add data attributes for caching support
        li.setAttribute('data-stop-id', stop.stop_id || '');
        li.setAttribute('data-stop-name', stop.stop_name || '');
        li.setAttribute('data-stop-lat', stop.stop_lat || '');
        li.setAttribute('data-stop-lon', stop.stop_lon || '');

        // Header: name + intermodal icons (left), accessibility icon (right)
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';

        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '6px';

        const nameSpan = document.createElement('span');
        nameSpan.innerHTML = this.highlight(stop.stop_name);
        nameSpan.className = 'pt-sans fw-semibold';
        left.appendChild(nameSpan);

        // Intermodal icons using RouteManager mapping
        try {
            const routesMgr = window.transJakartaApp.modules.routes;
            const interHtml = routesMgr && routesMgr.buildIntermodalIconsForStop ? routesMgr.buildIntermodalIconsForStop(stop) : '';
            if (interHtml) {
                const iconsSpan = document.createElement('span');
                iconsSpan.className = 'intermodal-icons';
                iconsSpan.innerHTML = interHtml;
                iconsSpan.querySelectorAll('img').forEach(img => {
                    img.style.width = '16px';
                    img.style.height = '16px';
                    img.style.borderRadius = '50%';
                    img.style.objectFit = 'cover';
                    img.style.marginLeft = '4px';
                });
                left.appendChild(iconsSpan);
            }
        } catch (e) {}

        const right = document.createElement('div');
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (stop.wheelchair_boarding === '1' && (!settings || settings.isEnabled('showAccessibilityIcon'))) {
                right.innerHTML = '<i class="fa-solid fa-wheelchair" style="color: #059669;"></i>';
                right.title = 'Ramah kursi roda';
            }
        } catch (e) {}

        header.appendChild(left);
        header.appendChild(right);
        li.appendChild(header);

        // Route badges: clickable to switch route (use union set from getUniqueStops)
        if (stop.koridors && stop.koridors.size > 0) {
            const badgesWrap = document.createElement('div');
            badgesWrap.className = 'mt-1';
            Array.from(stop.koridors).forEach(rid => {
                const route = routes.find(r => String(r.route_id) === String(rid));
                if (!route) return;
                const badge = document.createElement('span');
                const color = route.route_color ? ('#' + route.route_color) : '#6c757d';
                badge.className = 'badge badge-koridor-interaktif rounded-pill me-2';
                badge.style.background = color;
                badge.style.color = '#fff';
                badge.style.fontWeight = 'bold';
                badge.style.padding = '0.35em 1.1em';
                badge.textContent = route.route_short_name || route.route_id;
                badge.setAttribute('data-routeid', route.route_id);
                badge.style.cursor = 'pointer';
                badge.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    window.transJakartaApp.modules.routes.selectRoute(route.route_id);
                    this.clearSearchResults();
                });
                badgesWrap.appendChild(badge);
            });
            li.appendChild(badgesWrap);
        }

        li.onclick = () => {
            if (stop.stop_lat && stop.stop_lon) {
                this.showStopOnMap(stop);
            }
            this.clearSearchResults();
        };

        return li;
    }

    // Show stop on map
    showStopOnMap(stop) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;

        // Set map view to stop location
        mapManager.setView(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon), 17);

        // Show stop popup with union (use pseudo feature; map popup re-unions too)
        try {
            const f = {
                properties: {
                    stopId: stop.stop_id,
                    stopName: stop.stop_name,
                    stopType: mapManager.getStopType ? mapManager.getStopType(String(stop.stop_id)) : '',
                    routeIds: (stop.koridors ? Array.from(stop.koridors) : (window.transJakartaApp.modules.gtfs.getStopToRoutes()[stop.stop_id] ? Array.from(window.transJakartaApp.modules.gtfs.getStopToRoutes()[stop.stop_id]) : []))
                }
            };
            mapManager.showStopPopup(f, { lng: parseFloat(stop.stop_lon), lat: parseFloat(stop.stop_lat) });
        } catch (e) {
            // Fallback to marker if popup fails
            try { if (window.searchResultMarker) { mapManager.removeSearchResultMarker(); } } catch(_){ }
            window.searchResultMarker = mapManager.addSearchResultMarker(
                parseFloat(stop.stop_lat), 
                parseFloat(stop.stop_lon), 
                stop.stop_name
            );
        }
    }

    // Clear search results
    clearSearchResults() {
        const resultsDiv = document.getElementById('searchResults');
        const searchInput = document.getElementById('searchStop');
        const filterTabs = document.getElementById('searchFilterTabs');
        
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (searchInput) searchInput.value = '';
        if (filterTabs) filterTabs.style.display = 'none';
        
        // Keep the reopen chip to allow reopening place popup after close
        // but remove if user explicitly clears via clear button (handled elsewhere)
        
        this._allResults = null;
        this._lastQuery = '';
    }

    // Reset function
    reset() {
        // Cancel any ongoing search
        if (this._currentSearchController) {
            this._currentSearchController.abort();
            this._currentSearchController = null;
        }
        
        this.clearSearchResults();
        this.searchResults = [];
        this._searchCache.clear();
        this._lastQuery = '';
        this._allResults = null;
        this._activeFilter = 'all';
        
        // Hide filter tabs
        const filterTabs = document.getElementById('searchFilterTabs');
        if (filterTabs) filterTabs.style.display = 'none';
        
        // Reset filter buttons
        const filterButtons = document.querySelectorAll('.modern-filter-btn');
        filterButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === 'all');
        });
    }

    // Highlight query terms in a text
    highlight(text) {
        try {
            const input = document.getElementById('searchStop');
            if (!input) return text;
            const q = (input.value || '').trim();
            if (!q) return text;
            const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(${esc})`, 'ig');
            return String(text).replace(re, '<mark>$1</mark>');
        } catch (e) { return text; }
    }

    // =============================
    // Indexing & Token utilities
    // =============================
    _normalizeText(text) {
        try {
            let t = String(text || '').toLowerCase();
            // remove diacritics if supported
            try { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch(_) {}
            // keep alnum and spaces
            t = t.replace(/[^a-z0-9\s]/g, ' ');
            // remove common stopwords/prefixes
            const stopwords = ['halte', 'stasiun', 'terminal', 'koridor', 'transjakarta', 'tj', 'busway', 'jalan', 'jl', 'jln'];
            stopwords.forEach(w => { t = t.replace(new RegExp(`\\b${w}\\b`, 'g'), ' '); });
            t = t.replace(/\s+/g, ' ').trim();
            return t;
        } catch (_) { return String(text || '').toLowerCase().trim(); }
    }

    _tokenize(text) {
        const norm = this._normalizeText(text);
        return norm ? norm.split(/\s+/).filter(Boolean) : [];
    }

    _isTokenSubset(needles, haystack) {
        if (!needles || needles.length === 0) return false;
        if (!haystack || haystack.length === 0) return false;
        return needles.every(n => haystack.some(h => h.includes(n)));
    }

    _isSearchableStopId(stopId) {
        try {
            const id = String(stopId || '');
            return id.startsWith('H') || id.startsWith('B');
        } catch(_) { return false; }
    }

    _ensureIndex() {
        if (this._indexBuilt) return;
        try { this._buildIndex(); } catch(_) {}
    }

    _buildIndex() {
        const gtfs = window.transJakartaApp && window.transJakartaApp.modules && window.transJakartaApp.modules.gtfs;
        if (!gtfs) return;
        const stops = gtfs.getStops() || [];
        const routes = gtfs.getRoutes() || [];
        this._stopIndex = stops
            .filter(s => this._isSearchableStopId(String(s.stop_id || '')))
            .map(s => {
                const normName = this._normalizeText(s.stop_name);
                const tokens = this._tokenize(normName);
                return { ref: s, normName, tokens };
            });
        this._routeIndex = routes.map(r => {
            const short = r.route_short_name || '';
            const long = r.route_long_name || '';
            const normLong = this._normalizeText(long);
            const tokensLong = this._tokenize(normLong);
            return { ref: r, short, long, normLong, tokensLong };
        });
        this._indexBuilt = true;
    }

    async _ensureRailInit() {
        if (this._railInitStarted) return;
        this._railInitStarted = true;
        try {
            const app = window.transJakartaApp;
            if (!app || !app.modules) return;
            const krl = app.modules.krl; const mrt = app.modules.mrt; const lrt = app.modules.lrt; const lrtj = app.modules.lrtj;
            const tasks = [];
            if (krl && typeof krl.isLoaded === 'function' && !krl.isLoaded()) tasks.push(krl.init());
            if (mrt && typeof mrt.isLoaded === 'function' && !mrt.isLoaded() && mrt.init) tasks.push(mrt.init());
            if (lrt && typeof lrt.isLoaded === 'function' && !lrt.isLoaded() && lrt.init) tasks.push(lrt.init());
            if (lrtj && typeof lrtj.isLoaded === 'function' && !lrtj.isLoaded() && lrtj.init) tasks.push(lrtj.init());
            await Promise.allSettled(tasks);
            this._buildRailIndex();
        } catch (_) {}
    }

    _buildRailIndex() {
        try {
            const app = window.transJakartaApp;
            if (!app || !app.modules) return;
            const list = [];
            const norm = (t) => this._normalizeText(t);
            const pushStations = (arr, mode) => {
                (arr || []).forEach(st => {
                    const name = st.name || st.properties?.name || '';
                    const coords = st.coordinates || st.geometry?.coordinates || [];
                    if (!name || !Array.isArray(coords) || coords.length < 2) return;
                    const normName = norm(name);
                    const tokens = this._tokenize(normName);
                    list.push({
                        ref: { name, lat: coords[1], lon: coords[0], mode },
                        normName,
                        tokens
                    });
                });
            };
            try { const krl = app.modules.krl; if (krl && (krl.getAllStations || krl.stations)) pushStations((krl.getAllStations ? krl.getAllStations() : krl.stations), 'KRL'); } catch(_) {}
            try { const mrt = app.modules.mrt; if (mrt && mrt.stations) pushStations(mrt.stations, 'MRT'); } catch(_) {}
            try { const lrt = app.modules.lrt; if (lrt && lrt.stations) pushStations(lrt.stations, 'LRT'); } catch(_) {}
            try { const lrtj = app.modules.lrtj; if (lrtj && lrtj.stations) pushStations(lrtj.stations, 'LRTJ'); } catch(_) {}
            this._railIndex = list;
            this._railIndexBuilt = list.length > 0;
        } catch (_) {}
    }

    async searchRailStations(query) {
        try {
            const normQuery = this._normalizeText(query);
            const tokens = this._tokenize(normQuery);
            if (!this._railIndexBuilt) {
                // kick off async load but do not block
                this._ensureRailInit();
                // Try building immediately with whatever is loaded
                this._buildRailIndex();
                if (!this._railIndexBuilt) return [];
            }
            const scores = new Map();
            const variants = Array.from(new Set([normQuery, ...this.expandSearchKeywords(normQuery)]));
            for (const v of variants) {
                const vt = this._tokenize(v);
                for (const entry of this._railIndex) {
                    let s = 0;
                    if (entry.normName.includes(v)) s += 3;
                    if (this._isTokenSubset(vt, entry.tokens)) s += 2 + vt.length * 0.2;
                    if (s > 0) scores.set(entry.ref, Math.max(scores.get(entry.ref) || 0, s));
                }
            }
            return Array.from(scores.entries())
                .sort((a,b) => b[1]-a[1])
                .slice(0, 30)
                .map(([ref]) => ref);
        } catch (_) {
            return [];
        }
    }

    _scoreTokensMatch(entry, queryTokens, queryNorm) {
        if (!entry || (!queryTokens || queryTokens.length === 0)) return 0;
        let score = 0;
        // direct substring gives higher weight
        if (queryNorm && entry.normName.includes(queryNorm)) score += 3;
        // token subset match
        if (this._isTokenSubset(queryTokens, entry.tokens)) score += 2 + (queryTokens.length * 0.2);
        // prefix bonus
        try {
            const first = queryTokens[0] || '';
            if (first && entry.normName.startsWith(first)) score += 0.8;
        } catch(_) {}
        return score;
    }

    _matchPlaceAlias(normQuery) {
        try {
            if (!normQuery) return null;
            const keys = Object.keys(this._placeAliasCoords || {});
            for (const key of keys) {
                if (normQuery.includes(key) || key.includes(normQuery)) {
                    const a = this._placeAliasCoords[key];
                    return {
                        lat: String(a.lat),
                        lon: String(a.lon),
                        display_name: a.name,
                        type: a.type,
                        category: a.category,
                        importance: 0.5
                    };
                }
            }
        } catch(_) {}
        return null;
    }

    // Enhanced fuzzy match with better typo tolerance
    isFuzzyMatch(text, query) {
        const t = String(text || '').toLowerCase();
        const q = String(query || '').toLowerCase();
        
        // Exact substring match
        if (t.includes(q)) return true;
        
        // Check for common typo patterns
        if (this.checkCommonTypos(t, q)) return true;
        
        // Word-based matching for better results
        const textWords = t.split(/\s+/);
        const queryWords = q.split(/\s+/);
        
        // Check if query matches any word with typos
        for (const word of textWords) {
            if (this.wordSimilarity(word, q) >= 0.7) return true;
        }
        
        // Check word-by-word similarity
        if (queryWords.length > 1) {
            let matchedWords = 0;
            for (const qWord of queryWords) {
                for (const tWord of textWords) {
                    if (this.wordSimilarity(tWord, qWord) >= 0.8) {
                        matchedWords++;
                        break;
                    }
                }
            }
            if (matchedWords >= Math.ceil(queryWords.length * 0.7)) return true;
        }
        
        // Fallback to edit distance
        const threshold = Math.max(1, Math.floor(q.length * 0.3));
        return this.levenshtein(t, q) <= threshold;
    }
    
    // Check for common typo patterns
    checkCommonTypos(text, query) {
        // Handle missing first character (e.g., 'wlikota' -> 'walikota')
        if (query.length >= 3) {
            const withFirstChar = this.generateFirstCharCandidates(query);
            for (const candidate of withFirstChar) {
                if (text.includes(candidate)) return true;
            }
        }
        
        // Handle swapped characters (e.g., 'halte' -> 'halte')
        if (query.length >= 4) {
            const swapped = this.generateSwappedCandidates(query);
            for (const candidate of swapped) {
                if (text.includes(candidate)) return true;
            }
        }
        
        // Handle extra character (e.g., 'haltte' -> 'halte')
        if (query.length >= 3) {
            const withoutExtra = this.generateWithoutExtraCandidates(query);
            for (const candidate of withoutExtra) {
                if (text.includes(candidate)) return true;
            }
        }
        
        return false;
    }
    
    // Generate candidates with first character added
    generateFirstCharCandidates(query) {
        // Focus on common Indonesian prefixes and characters
        const commonFirstChars = ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'w'];
        const candidates = commonFirstChars.map(char => char + query);
        
        // Special handling for Indonesian words
        const specialPrefixes = {
            'wlikota': ['walikota'], // Handle the specific example
            'alimkopi': ['halimkopi'], // Common pattern
            'onor': ['honor'], // Missing 'h'
            'alim': ['halim'], // Missing 'h'
            'arta': ['harta'], // Missing 'h'
        };
        
        if (specialPrefixes[query]) {
            candidates.push(...specialPrefixes[query]);
        }
        
        return candidates;
    }
    
    // Generate candidates with swapped adjacent characters
    generateSwappedCandidates(query) {
        const candidates = [];
        for (let i = 0; i < query.length - 1; i++) {
            const chars = query.split('');
            [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
            candidates.push(chars.join(''));
        }
        return candidates;
    }
    
    // Generate candidates with one character removed
    generateWithoutExtraCandidates(query) {
        const candidates = [];
        for (let i = 0; i < query.length; i++) {
            candidates.push(query.slice(0, i) + query.slice(i + 1));
        }
        return candidates;
    }
    
    // Calculate word similarity using multiple metrics
    wordSimilarity(word1, word2) {
        if (word1 === word2) return 1.0;
        if (word1.length === 0 || word2.length === 0) return 0.0;
        
        const maxLen = Math.max(word1.length, word2.length);
        const editDistance = this.levenshtein(word1, word2);
        const editSimilarity = 1 - (editDistance / maxLen);
        
        // Bonus for common prefixes/suffixes
        let prefixBonus = 0;
        let suffixBonus = 0;
        
        for (let i = 0; i < Math.min(word1.length, word2.length); i++) {
            if (word1[i] === word2[i]) {
                prefixBonus += 0.1;
            } else {
                break;
            }
        }
        
        for (let i = 1; i <= Math.min(word1.length, word2.length); i++) {
            if (word1[word1.length - i] === word2[word2.length - i]) {
                suffixBonus += 0.1;
            } else {
                break;
            }
        }
        
        return Math.min(1.0, editSimilarity + prefixBonus + suffixBonus);
    }

    levenshtein(a, b) {
        const m = a.length, n = b.length;
        if (m === 0) return n; if (n === 0) return m;
        const dp = new Array(n + 1);
        for (let j = 0; j <= n; j++) dp[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = dp[0]; dp[0] = i;
            for (let j = 1; j <= n; j++) {
                const temp = dp[j];
                const cost = (a[i - 1] === b[j - 1]) ? 0 : 1;
                dp[j] = Math.min(
                    dp[j] + 1,       // deletion
                    dp[j - 1] + 1,   // insertion
                    prev + cost      // substitution
                );
                prev = temp;
            }
        }
        return dp[n];
    }

    // Improved fuzzy matching with better typo tolerance
    findFuzzyMatches(stops, query) {
        const cleanQuery = query.toLowerCase().trim();
        const filteredStops = stops.filter(s => this._isSearchableStopId(String(s.stop_id || '')));
        
        let bestMatches = [];
        let suggestionText = '';
        
        // First try: exact fuzzy matches
        const fuzzyMatches = filteredStops.filter(s => 
            this.isFuzzyMatch(s.stop_name.toLowerCase(), cleanQuery)
        );
        
        if (fuzzyMatches.length > 0) {
            bestMatches = fuzzyMatches;
        } else {
            // Advanced typo correction - check for common patterns
            const suggestions = this.findTypoSuggestions(filteredStops, cleanQuery);
            if (suggestions.length > 0) {
                const bestSuggestion = suggestions[0];
                suggestionText = `Mungkin maksud Anda: ${bestSuggestion.name}`;
                bestMatches = [bestSuggestion.stop];
            }
        }
        
        return {
            matches: bestMatches,
            suggestion: suggestionText
        };
    }
    
    // Advanced typo suggestion finder
    findTypoSuggestions(stops, query) {
        const suggestions = [];
        const queryLen = query.length;
        
        stops.forEach(stop => {
            const stopName = stop.stop_name.toLowerCase();
            const words = stopName.split(/\s+/);
            
            // Check each word for typo similarity
            words.forEach(word => {
                if (Math.abs(word.length - queryLen) <= 2) {
                    const distance = this.levenshtein(word, query);
                    const similarity = 1 - (distance / Math.max(word.length, queryLen));
                    
                    // More lenient threshold for better typo detection
                    if (similarity >= 0.6 || distance <= 2) {
                        suggestions.push({
                            stop: stop,
                            name: stop.stop_name,
                            similarity: similarity,
                            distance: distance
                        });
                    }
                }
            });
            
            // Also check full name similarity
            const fullDistance = this.levenshtein(stopName, query);
            const fullSimilarity = 1 - (fullDistance / Math.max(stopName.length, queryLen));
            if (fullSimilarity >= 0.5) {
                suggestions.push({
                    stop: stop,
                    name: stop.stop_name,
                    similarity: fullSimilarity,
                    distance: fullDistance
                });
            }
        });
        
        // Sort by similarity (highest first) and remove duplicates
        const uniqueSuggestions = suggestions
            .filter((item, index, arr) => 
                arr.findIndex(s => s.stop.stop_id === item.stop.stop_id) === index
            )
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3); // Top 3 suggestions
            
        return uniqueSuggestions;
    }
    
    // Add no results message
    addNoResultsMessage(ul, query) {
        const li = document.createElement('li');
        li.className = 'search-result-empty';
        li.innerHTML = `
            <div class="empty-state">
                <iconify-icon icon="mdi:magnify-remove-outline" class="empty-icon"></iconify-icon>
                <div class="empty-title">Tidak ada hasil ditemukan</div>
                <div class="empty-subtitle">untuk pencarian "<span class="fw-semibold">${this.escapeHtml(query)}</span>"</div>
                <div class="empty-hint">Coba kata kunci yang berbeda atau periksa ejaan</div>
            </div>
        `;
        ul.appendChild(li);
    }
    
    // Add suggestion message
    addSuggestionMessage(ul, suggestion) {
        const li = document.createElement('li');
        li.className = 'search-result-suggestion';
        li.innerHTML = `
            <iconify-icon icon="mdi:lightbulb-outline"></iconify-icon>
            <span>${suggestion}</span>
        `;
        ul.insertBefore(li, ul.firstChild);
    }
    
    // Reattach event listeners after loading from cache
    _reattachEventListeners(container) {
        // Reattach click events for route badges
        container.querySelectorAll('.badge[data-routeid]').forEach(badge => {
            badge.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const routeId = badge.getAttribute('data-routeid');
                window.transJakartaApp.modules.routes.selectRoute(routeId);
                this.clearSearchResults();
            });
        });
        
        // Reattach click events for list items
        container.querySelectorAll('.list-group-item').forEach(item => {
            if (item.onclick) {
                // Item already has onclick, skip
                return;
            }
            
            // Check if this is a stop item (has data attributes or coordinates)
            const stopLat = item.getAttribute('data-stop-lat');
            const stopLon = item.getAttribute('data-stop-lon');
            if (stopLat && stopLon) {
                item.onclick = () => {
                    const stop = {
                        stop_lat: parseFloat(stopLat),
                        stop_lon: parseFloat(stopLon),
                        stop_name: item.getAttribute('data-stop-name') || '',
                        stop_id: item.getAttribute('data-stop-id') || ''
                    };
                    this.showStopOnMap(stop);
                    this.clearSearchResults();
                };
            }
        });
    }
    
    // Search for places using geocoding
    async searchPlaces(query, resultsDiv) {
        try {
            // Skip if query looks like a route number or stop name pattern
            if (/^\d+[a-z]?$/i.test(query) || query.includes('halte') || query.includes('stasiun')) {
                return;
            }
            
            // Use Nominatim for geocoding
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}, Jakarta, Indonesia&limit=5&countrycodes=id&accept-language=id`;
            
            const response = await fetch(url);
            if (!response.ok) return;
            
            const places = await response.json();
            if (!places || places.length === 0) return;
            
            // Filter results to Jakarta area only
            const jakartaPlaces = places.filter(place => {
                const lat = parseFloat(place.lat);
                const lon = parseFloat(place.lon);
                // Rough bounds for Greater Jakarta area
                return lat >= -6.4 && lat <= -5.9 && lon >= 106.6 && lon <= 107.1;
            });
            
            if (jakartaPlaces.length === 0) return;
            
            this.addPlacesResults(jakartaPlaces, resultsDiv);
            
        } catch (error) {
            console.warn('Place search failed:', error);
        }
    }
    
    // Add places results to the UI
    addPlacesResults(places, resultsDiv) {
        // Check if we already have results, if so append places section
        let ul = resultsDiv.querySelector('ul.search-results-list');
        if (!ul) {
            ul = this.createResultsList();
            resultsDiv.appendChild(ul);
        }
        
        // Add places header
        const placesHeader = document.createElement('li');
        placesHeader.className = 'search-result-header';
        placesHeader.innerHTML = `
            <iconify-icon icon="mdi:map-marker" class="me-2"></iconify-icon>
            <span>Tempat</span>
        `;
        ul.appendChild(placesHeader);
        
        // Add place results
        places.forEach(place => {
            const li = this.createPlaceResultItem(place);
            ul.appendChild(li);
        });
    }

    // Add rail stations results to the UI
    addStationsResults(stations, resultsDiv) {
        // Ensure list exists
        let ul = resultsDiv.querySelector('ul.search-results-list');
        if (!ul) { ul = this.createResultsList(); resultsDiv.appendChild(ul); }

        // Header
        const header = document.createElement('li');
        header.className = 'search-result-header';
        header.innerHTML = `
            <iconify-icon icon="mdi:train" class="me-2"></iconify-icon>
            <span>Stasiun</span>
        `;
        ul.appendChild(header);

        stations.forEach(st => {
            const li = this.createStationResultItem(st);
            ul.appendChild(li);
        });
    }

    createStationResultItem(st) {
        const li = document.createElement('li');
        li.className = 'search-result-item place-result-item';

        const mode = String(st.mode || '').toUpperCase();
        const modeColor = mode === 'KRL' ? '#dc2626' : (mode === 'MRT' ? '#0066cc' : (mode === 'LRTJ' ? '#e31e24' : '#8b5cf6'));
        const modeLabel = mode === 'KRL' ? 'KRL' : (mode === 'MRT' ? 'MRT' : (mode === 'LRTJ' ? 'LRTJ' : 'LRT'));

        li.innerHTML = `
            <div class="search-result-content">
                <div class="place-icon-wrapper" style="background:${modeColor}15;border-color:${modeColor}55;display:flex;align-items:center;justify-content:center;">
                    <span style="background:${modeColor};color:#fff;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:800;">${modeLabel}</span>
                </div>
                <div class="place-info">
                    <div class="place-name">${this.highlight(st.name || '')}</div>
                    <div class="place-type">Stasiun ${modeLabel}</div>
                </div>
            </div>
            <iconify-icon icon="mdi:chevron-right" class="search-result-arrow"></iconify-icon>
        `;

        li.onclick = () => {
            try {
                const mapManager = window.transJakartaApp.modules.map;
                if (mapManager && st.lat && st.lon) {
                    mapManager.setView(parseFloat(st.lat), parseFloat(st.lon), 16);
                    mapManager.addSearchResultMarker(parseFloat(st.lat), parseFloat(st.lon), `${st.name} (Stasiun ${mode})`);
                }
            } catch(_) {}
            this.clearSearchResults();
        };
        return li;
    }
    
    // Create place result item
    createPlaceResultItem(place) {
        const li = document.createElement('li');
        li.className = 'search-result-item place-result-item';
        
        const displayName = this.formatPlaceName(place.display_name);
        const type = this.getPlaceType(place);
        
        li.innerHTML = `
            <div class="search-result-content">
                <div class="place-icon-wrapper">
                    <iconify-icon icon="mdi:map-marker"></iconify-icon>
                </div>
                <div class="place-info">
                    <div class="place-name">${this.highlight(displayName)}</div>
                    <div class="place-type">${type}</div>
                </div>
            </div>
            <iconify-icon icon="mdi:chevron-right" class="search-result-arrow"></iconify-icon>
        `;
        
        li.onclick = () => {
            this.showPlaceOnMap(place);
            this.clearSearchResults();
        };
        
        return li;
    }
    
    // Format place name for display
    formatPlaceName(displayName) {
        // Extract relevant parts and clean up
        const parts = displayName.split(',');
        if (parts.length > 0) {
            // Take first part (main name) and possibly second part if it's descriptive
            let name = parts[0].trim();
            if (parts.length > 1 && parts[1].trim().length < 50) {
                name += ', ' + parts[1].trim();
            }
            return name;
        }
        return displayName;
    }
    
    // Get place type for display
    getPlaceType(place) {
        const type = place.type || '';
        const category = place.category || '';
        
        // Indonesian translations for common place types
        const typeMap = {
            'mall': 'Pusat Perbelanjaan',
            'shop': 'Toko',
            'shopping_centre': 'Pusat Perbelanjaan',
            'hospital': 'Rumah Sakit',
            'clinic': 'Klinik',
            'school': 'Sekolah',
            'university': 'Universitas',
            'college': 'Perguruan Tinggi',
            'museum': 'Museum',
            'monument': 'Monumen',
            'park': 'Taman',
            'stadium': 'Stadion',
            'hotel': 'Hotel',
            'restaurant': 'Restoran',
            'cafe': 'Kafe',
            'bank': 'Bank',
            'office': 'Kantor',
            'government': 'Instansi Pemerintah',
            'attraction': 'Tempat Wisata',
            'building': 'Bangunan'
        };
        
        return typeMap[type] || typeMap[category] || 'Tempat';
    }
    
    // Show place on map and find nearest stops
    async showPlaceOnMap(place) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;
        
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        const placeName = this.formatPlaceName(place.display_name);
        
        // Close any existing popups and clear temporary layers
        mapManager.closePopupAndTemp();
        
        // Set map view to place location
        mapManager.setView(lat, lon, 16);
        
        // Add place marker
        const placeMarkerId = mapManager.addSearchResultMarker(lat, lon, placeName);
        // Persist last place context for easy reopen
        this._lastPlaceContext = { place, lat, lon, placeName, markerId: placeMarkerId };
        
        // Find and show nearest stops
        try {
            const nearestStops = await this.findNearestStops(lat, lon, 800); // 800m radius
            
            if (nearestStops.length > 0) {
                // Add markers for nearest stops
                nearestStops.forEach(stopData => {
                    const { stop, distance } = stopData;
                    mapManager.addNearestStopMarker(
                        parseFloat(stop.stop_lat),
                        parseFloat(stop.stop_lon),
                        stop,
                        distance
                    );
                });
                
                // Show popup with place info and nearest stops
                this.showPlacePopupWithStops(place, nearestStops, mapManager);
            } else {
                // Show popup with just place info
                mapManager.showPlacePopupAt(lon, lat, `
                    <div class="plus-jakarta-sans" style="padding: 12px; min-width: 200px;">
                        <div class="fw-bold text-success mb-2">
                            <iconify-icon icon="mdi:map-marker" class="me-2"></iconify-icon>
                            ${placeName}
                        </div>
                        <div class="text-muted small">
                            Tidak ada halte dalam radius 800m
                        </div>
                    </div>
                `);
                // Reopen handled via clicking search marker
            }
        } catch (error) {
            console.warn('Failed to find nearest stops:', error);
            mapManager.showPlacePopupAt(lon, lat, `
                <div class="plus-jakarta-sans" style="padding: 12px; min-width: 200px;">
                    <div class="fw-bold text-success">
                        <iconify-icon icon="mdi:map-marker" class="me-2"></iconify-icon>
                        ${placeName}
                    </div>
                </div>
            `);
            // Reopen handled via clicking search marker
        }
    }
    
    // Find nearest TransJakarta stops
    async findNearestStops(lat, lon, radiusMeters = 800) {
        const gtfs = window.transJakartaApp.modules.gtfs;
        if (!gtfs) return [];
        
        const stops = gtfs.getStops() || [];
        const mapManager = window.transJakartaApp.modules.map;
        
        // Filter and calculate distances
        const nearbyStops = stops
            .filter(stop => {
                const stopId = String(stop.stop_id || '');
                // Exclude access stops (E/H) and platform stops (G), include main halte (H) and feeder (B)
                return (stopId.startsWith('H') || stopId.startsWith('B')) && 
                       stop.stop_lat && stop.stop_lon;
            })
            .map(stop => {
                const stopLat = parseFloat(stop.stop_lat);
                const stopLon = parseFloat(stop.stop_lon);
                const distance = mapManager._haversine(lat, lon, stopLat, stopLon);
                return { stop, distance };
            })
            .filter(item => item.distance <= radiusMeters)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 5); // Limit to 5 nearest stops
        
        return nearbyStops;
    }
    
    // Show popup with place info and nearest stops
    showPlacePopupWithStops(place, nearestStops, mapManager) {
        const placeName = this.formatPlaceName(place.display_name);
        const placeType = this.getPlaceType(place);
        const lat = parseFloat(place.lat);
        const lon = parseFloat(place.lon);
        
        // Build stops list
        const stopsHtml = nearestStops.map(({ stop, distance }) => {
            const distanceText = distance < 1000 ? 
                `${Math.round(distance)}m` : 
                `${(distance/1000).toFixed(1)}km`;
            
            const stopType = stop.stop_id.startsWith('B') ? 'Pengumpan' : 'Koridor';
            const badgeClass = stopType === 'Pengumpan' ? 'badge-warning' : 'badge-primary';
            
            return `
                <div class="stop-item" 
                     style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-radius:10px;border:1px solid #e5e7eb;margin-bottom:8px;background:#fff;">
                    <div class="flex-grow-1" style="min-width:0;">
                        <div class="fw-semibold" style="color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${stop.stop_name}</div>
                        <span class="badge ${badgeClass} badge-sm" style="margin-top:4px;">${stopType}</span>
                    </div>
                    <div class="text-muted small" style="margin-left:10px;white-space:nowrap;">${distanceText}</div>
                    <span class="ms-2" style="color:#2563eb;"><i class="fa-solid fa-chevron-right"></i></span>
                    <div style="display:none" data-stop-lat="${stop.stop_lat}" data-stop-lon="${stop.stop_lon}" data-stop-name="${stop.stop_name}" data-stop-id="${stop.stop_id}"></div>
                </div>
            `;
        }).join('');
        
        // Get weather info for this location
        const placeWeatherHtml = this.getPlaceWeatherHtml(lat, lon);
        
        const popupHtml = `
            <div class="plus-jakarta-sans" style="min-width: 300px; max-width: 380px;">
                <div class="d-flex align-items-start gap-3" style="padding: 12px 12px 8px 12px; border-bottom: 1px solid #e5e7eb;">
                    <div style="width:36px;height:36px;border-radius:10px;background:#10b981;display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 2px 6px rgba(16,185,129,0.3)"><i class="fa-solid fa-map-marker-alt"></i></div>
                    <div style="flex:1;min-width:0;">
                        <div class="fw-bold" style="color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${placeName}</div>
                        <div class="small text-muted">${placeType}</div>
                    </div>
                </div>
                ${placeWeatherHtml}
                <div class="nearest-stops" style="padding: 8px 12px 12px 12px;">
                    <div class="fw-semibold mb-2" style="color:#2563eb;display:flex;align-items:center;gap:6px;">
                        <i class="fa-solid fa-bus"></i>
                        Halte Terdekat
                    </div>
                    <div class="stops-list" style="max-height: 240px; overflow-y: auto;">
                        ${stopsHtml || '<div class="text-muted small">Tidak ada halte dalam radius 800m</div>'}
                    </div>
                </div>
            </div>
        `;
        
        const popup = mapManager.showPlacePopupAt(lon, lat, popupHtml);
        
        // Add click handlers for stops
        setTimeout(() => {
            const popupEl = popup && popup.getElement();
            if (!popupEl) return;
            
            popupEl.querySelectorAll('.stop-item').forEach(item => {
                item.addEventListener('click', () => {
                    const hidden = item.querySelector('div[data-stop-id]');
                    const stopLat = parseFloat(hidden?.dataset.stopLat || 'NaN');
                    const stopLon = parseFloat(hidden?.dataset.stopLon || 'NaN');
                    const stopName = hidden?.dataset.stopName || '';
                    const stopId = hidden?.dataset.stopId || '';
                    
                    // Focus map on the selected stop
                    mapManager.setView(stopLat, stopLon, 17);
                    
                    // Create a pseudo feature for the stop popup
                    const stopFeature = {
                        properties: {
                            stopId: stopId,
                            stopName: stopName,
                            stopType: stopId.startsWith('B') ? 'Pengumpan' : 'Koridor'
                        }
                    };
                    
                    // Show stop popup
                    mapManager.showStopPopup(stopFeature, { lng: stopLon, lat: stopLat });
                });
                
                // Hover effects
                item.addEventListener('mouseenter', () => {
                    item.style.backgroundColor = '#f3f4f6';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                });
            });
        }, 50);
    }

    // Ensure a small floating chip exists to reopen the last place popup after close
    _ensurePlaceReopenChip(place, onReopen) {
        try {
            const mapEl = document.getElementById('map');
            if (!mapEl) return;
            // Create container if not exists
            let chip = document.getElementById('placeReopenChip');
            if (!chip) {
                chip = document.createElement('button');
                chip.id = 'placeReopenChip';
                chip.type = 'button';
                chip.style.position = 'absolute';
                chip.style.zIndex = '1001';
                chip.style.top = '12px';
                chip.style.right = '12px';
                chip.style.background = 'rgba(255,255,255,0.95)';
                chip.style.backdropFilter = 'blur(6px)';
                chip.style.border = '1px solid #e5e7eb';
                chip.style.borderRadius = '999px';
                chip.style.padding = '8px 12px';
                chip.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
                chip.style.fontSize = '12px';
                chip.style.fontWeight = '700';
                chip.style.color = '#111827';
                chip.style.display = 'flex';
                chip.style.alignItems = 'center';
                chip.style.gap = '6px';
                chip.style.cursor = 'pointer';
                chip.title = 'Buka kembali informasi tempat';
                mapEl.appendChild(chip);
            }
            const name = this.formatPlaceName(place.display_name || place.name || 'Tempat');
            chip.innerHTML = `<i class="fa-solid fa-map-location-dot" style="color:#2563eb"></i><span style="max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(name)}</span>`;
            // Bind click
            chip.onclick = () => { try { onReopen && onReopen(); } catch(_){} };
        } catch (_) {}
    }

    // HTML escape utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get weather HTML for place popup
    getPlaceWeatherHtml(lat, lon) {
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (!settings || !settings.isEnabled('showWeatherInfo')) return '';
        } catch (e) {}
        
        if (!lat || !lon) return '';
        
        const weatherId = `place-weather-${lat.toFixed(3)}_${lon.toFixed(3)}`;
        
        // Start loading weather data asynchronously
        this.loadPlaceWeather(lat, lon, weatherId);
        
        return `
            <div class='place-weather-info' id='${weatherId}'>
                <div class='weather-loading'>
                    <iconify-icon icon="mdi:loading" class="weather-loading-icon"></iconify-icon>
                    <span class='weather-text'>Memuat cuaca...</span>
                </div>
            </div>
        `;
    }

    // Load weather data for place popup
    async loadPlaceWeather(lat, lon, weatherId) {
        try {
            // Use balanced grid system - 2 decimal places (≈1.1km grid)
            const roundedLat = Math.round(parseFloat(lat) * 100) / 100;
            const roundedLon = Math.round(parseFloat(lon) * 100) / 100;
            const cacheKey = `place_weather_${roundedLat}_${roundedLon}`;
            
            // Check cache first
            const cached = this.getPlaceWeatherFromCache(cacheKey);
            if (cached) {
                // Apply place-specific variation
                const variedData = this.applyPlaceVariation(cached, lat, lon, weatherId);
                this.updatePlaceWeatherDisplay(weatherId, variedData);
                return;
            }

            // Prevent duplicate requests
            if (!this._placeWeatherLoadingSet) this._placeWeatherLoadingSet = new Set();
            if (this._placeWeatherLoadingSet.has(cacheKey)) {
                setTimeout(() => {
                    const cachedAfterWait = this.getPlaceWeatherFromCache(cacheKey);
                    this.updatePlaceWeatherDisplay(weatherId, cachedAfterWait || this.getFallbackWeatherData());
                }, 2000);
                return;
            }

            this._placeWeatherLoadingSet.add(cacheKey);

            // Minimal delay for places
            setTimeout(async () => {
                try {
                    const WEATHER_API_KEY = '962322a87800402e0b9d7052cb5e8f16';
                    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${roundedLat}&lon=${roundedLon}&appid=${WEATHER_API_KEY}&units=metric&lang=id`;
                    
                    // Add timeout
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const response = await fetch(url, { signal: controller.signal });
                    clearTimeout(timeoutId);
                    
                    if (!response.ok) throw new Error(`Weather API error: ${response.status}`);
                    
                    const data = await response.json();
                    
                    // Enhancement for grid data
                    const enhancedData = this.enhancePlaceWeatherData(data, roundedLat, roundedLon);
                    
                    // Cache for 45 minutes
                    this.cachePlaceWeatherData(cacheKey, enhancedData);
                    
                    // Apply place-specific variation before display
                    const variedData = this.applyPlaceVariation(enhancedData, lat, lon, weatherId);
                    this.updatePlaceWeatherDisplay(weatherId, variedData);
                    
                } catch (error) {
                    console.warn('Error loading place weather:', error);
                    this.updatePlaceWeatherDisplay(weatherId, this.getFallbackWeatherData());
                } finally {
                    this._placeWeatherLoadingSet.delete(cacheKey);
                }
            }, Math.random() * 300); // Reduced delay 0-300ms
            
        } catch (error) {
            console.warn('Error in loadPlaceWeather:', error);
            this.updatePlaceWeatherDisplay(weatherId, null);
        }
    }

    // Update weather display in place popup
    updatePlaceWeatherDisplay(weatherId, weatherData) {
        const weatherElement = document.getElementById(weatherId);
        if (!weatherElement) return;

        if (!weatherData) {
            weatherElement.innerHTML = `
                <div class='weather-error'>
                    <iconify-icon icon="mdi:weather-cloudy"></iconify-icon>
                    <span class='weather-text'>Cuaca tidak tersedia</span>
                </div>
            `;
            return;
        }

        try {
            const weather = weatherData.weather[0];
            const temp = Math.round(weatherData.main.temp);
            const humidity = Math.round(weatherData.main.humidity);
            
            const iconCode = weather.icon || '01d';
            const iconUrl = `https://openweathermap.org/img/wn/${iconCode}.png`;
            const description = this.capitalizeWords(weather.description || 'Cerah');
            
            weatherElement.innerHTML = `
                <div class='weather-content'>
                    <div class='weather-icon'>
                        <img src="${iconUrl}" alt="${description}" class="weather-icon-img" style="width: 32px; height: 32px;" />
                    </div>
                    <div class='weather-info'>
                        <div class='weather-temp'>${temp}°C</div>
                        <div class='weather-desc'>${description}</div>
                    </div>
                    <div class='weather-humidity'>${humidity}%</div>
                </div>
            `;
            
        } catch (error) {
            console.error('Error updating place weather display:', error);
            weatherElement.innerHTML = `
                <div class='weather-error'>
                    <iconify-icon icon="mdi:weather-cloudy"></iconify-icon>
                    <span class='weather-text'>Error cuaca</span>
                </div>
            `;
        }
    }

    // Cache methods for place weather
    cachePlaceWeatherData(cacheKey, data) {
        try {
            if (!this._placeWeatherCache) this._placeWeatherCache = new Map();
            this._placeWeatherCache.set(cacheKey, {
                data: data,
                timestamp: Date.now()
            });
        } catch (e) {
            console.warn('Failed to cache place weather data:', e);
        }
    }

    getPlaceWeatherFromCache(cacheKey) {
        try {
            if (!this._placeWeatherCache) this._placeWeatherCache = new Map();
            const cached = this._placeWeatherCache.get(cacheKey);
            if (cached) {
                const age = Date.now() - cached.timestamp;
                if (age < 2700000) { // 45 minutes
                    return cached.data;
                } else {
                    this._placeWeatherCache.delete(cacheKey);
                }
            }
        } catch (e) {
            console.warn('Failed to get cached place weather:', e);
        }
        return null;
    }

    // Enhanced weather data for place grid
    enhancePlaceWeatherData(data, lat, lon) {
        try {
            const enhanced = JSON.parse(JSON.stringify(data));
            const latFloat = parseFloat(lat);
            const lonFloat = parseFloat(lon);
            
            // Grid-based variation for places
            const gridSeed = Math.abs(Math.round(latFloat * 50) + Math.round(lonFloat * 50)) % 10;
            
            // Small temperature variation (±1°C)
            if (gridSeed % 3 === 0) {
                const tempVariation = (gridSeed % 3) - 1;
                enhanced.main.temp = Math.round((enhanced.main.temp + tempVariation) * 10) / 10;
            }
            
            // Small humidity variation (±3%)
            const humidityVariation = (gridSeed % 7) - 3;
            enhanced.main.humidity = Math.round(Math.max(50, Math.min(75, enhanced.main.humidity + humidityVariation)));
            
            return enhanced;
        } catch (error) {
            return data;
        }
    }

    // Apply subtle variation for individual places based on exact coordinates
    applyPlaceVariation(baseData, exactLat, exactLon, weatherId) {
        try {
            const varied = JSON.parse(JSON.stringify(baseData));
            const latFloat = parseFloat(exactLat);
            const lonFloat = parseFloat(exactLon);
            
            // Create place-specific seed
            const placeSeed = Math.abs(
                Math.round(latFloat * 6000) + 
                Math.round(lonFloat * 6000) + 
                (weatherId ? weatherId.length : 0)
            ) % 30;
            
            // Very small temperature variation (±0.2°C)
            const tempVariation = ((placeSeed % 5) - 2) * 0.1; // -0.2 to +0.2
            varied.main.temp = Math.round((varied.main.temp + tempVariation) * 10) / 10;
            
            // Minimal humidity variation (±1%)
            const humidityVariation = (placeSeed % 3) - 1; // -1 to +1
            varied.main.humidity = Math.round(Math.max(45, Math.min(75, varied.main.humidity + humidityVariation)));
            
            return varied;
            
        } catch (error) {
            console.warn('Error applying place variation:', error);
            return baseData;
        }
    }

    // Fallback weather data for places
    getFallbackWeatherData() {
        const currentHour = new Date().getHours();
        const isDay = currentHour >= 6 && currentHour <= 18;
        
        return {
            weather: [{
                icon: isDay ? '02d' : '02n',
                description: 'berawan sebagian'
            }],
            main: {
                temp: 28,
                humidity: 74
            },
            wind: {
                speed: 2
            },
            name: 'Jakarta'
        };
    }

    // Capitalize words helper
    capitalizeWords(str) {
        if (!str || typeof str !== 'string') return '';
        return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
} 
 