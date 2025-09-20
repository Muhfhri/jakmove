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
        this.initFilterTabs();
    }

    // Initialize filter tabs
    initFilterTabs() {
        // Initialize filter UI after DOM is ready
        setTimeout(() => {
            const filterButtons = document.querySelectorAll('.filter-btn');
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
        const filterButtons = document.querySelectorAll('.filter-btn');
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
        
        if (this._activeFilter === 'all' || this._activeFilter === 'places') {
            if (this._allResults.places && this._allResults.places.length > 0) {
                this.addPlacesResults(this._allResults.places, ul);
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

        // Debounce 50ms untuk pencarian yang lebih responsif
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
            
            // Search all categories with optimized order
            await this.searchAllCategoriesOptimized(q, resultsDiv);
            this._currentSearchController = null;
        }, 50);
    }

    // Show searching indicator for immediate feedback
    showSearchingIndicator(resultsDiv, query) {
        const ul = this.createResultsList();
        
        // Add searching indicator
        const searchingItem = document.createElement('li');
        searchingItem.className = 'list-group-item text-center py-3 searching-indicator';
        searchingItem.innerHTML = `
            <div class="d-flex align-items-center justify-content-center gap-2">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <span class="text-muted">Mencari "${query}"...</span>
            </div>
        `;
        
        ul.appendChild(searchingItem);
        resultsDiv.appendChild(ul);
    }

    // Optimized search with parallel execution for faster results
    async searchAllCategoriesOptimized(query, resultsDiv) {
        const startTime = Date.now();
        
        try {
            // Start all searches in parallel for better performance
            const [localResults, placesResults] = await Promise.allSettled([
                this.searchLocalData(query),
                this.searchPlacesDataFast(query)
            ]);

            // Process local results (always available)
            let foundStops = [];
            let foundRoutes = [];
            let stopToRoutes = {};
            let allRoutes = [];

            if (localResults.status === 'fulfilled') {
                const { stops, routes, stopToRoutes: str, allRoutes: ar } = localResults.value;
                foundStops = stops;
                foundRoutes = routes;
                stopToRoutes = str;
                allRoutes = ar;
            }

            // Process places results (may fail or be slow)
            let foundPlaces = [];
            if (placesResults.status === 'fulfilled') {
                foundPlaces = placesResults.value;
            } else {
                console.warn('Places search failed:', placesResults.reason);
            }

            // Store all results
            this._allResults = {
                routes: foundRoutes,
                stops: foundStops,
                places: foundPlaces,
                stopToRoutes: stopToRoutes,
                allRoutes: allRoutes
            };

            this._lastQuery = query;
            
            // Clear searching indicator and show results
            resultsDiv.innerHTML = '';
            this.applyFilterToResults();

            // Cache results
            const cacheKey = `${query}_${this._activeFilter}`;
            if (this._searchCache.size >= 50) {
                const firstKey = this._searchCache.keys().next().value;
                this._searchCache.delete(firstKey);
            }
            this._searchCache.set(cacheKey, resultsDiv.innerHTML);

            const endTime = Date.now();
            console.log(`Search completed in ${endTime - startTime}ms`);

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
            const stops = window.transJakartaApp.modules.gtfs.getStops();
            const routes = window.transJakartaApp.modules.gtfs.getRoutes();
            const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();

            // Search stops
            let foundStops = stops
                .filter(s => s.stop_name.toLowerCase().includes(query))
                .filter(s => !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H')));

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
                const fuzzyResult = this.findFuzzyMatches(stops, query);
                foundStops = fuzzyResult.matches;
            }

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
            return [];
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
            'istiqlal': ['masjid istiqlal', 'islamic centre'],
            'katedral': ['gereja katedral', 'cathedral'],
            'ancol': ['taman impian jaya ancol', 'ancol dreamland'],
            'kota tua': ['old town', 'old city', 'jakarta old town'],
            'taman mini': ['taman mini indonesia indah', 'tmii'],
            'tmii': ['taman mini indonesia indah', 'taman mini'],
            'ragunan': ['kebun binatang ragunan', 'ragunan zoo'],
            'planetarium': ['planetarium jakarta', 'planetarium taman ismail marzuki'],
            'tim': ['taman ismail marzuki', 'taman ismail marzuki jakarta'],
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
        const controller = this._currentSearchController || new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), searchQuery.timeout);

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.query)}&limit=10&countrycodes=id&accept-language=id&addressdetails=1&extratags=1`;
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'JakMove/1.0'
                }
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const places = await response.json();
            return places || [];

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
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
            .filter(s => s.stop_name.toLowerCase().includes(query))
            .filter(s => !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H')));

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
            const fuzzyResult = this.findFuzzyMatches(stops, query);
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
            const fuzzyResult = this.findFuzzyMatches(stops, query);
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
        ul.className = 'list-group mt-3 mb-3';
        ul.style.maxHeight = '250px';
        ul.style.overflowY = 'auto';
        return ul;
    }

    // Add routes results
    addRoutesResults(foundRoutes, ul) {
        const routesHeader = document.createElement('li');
        routesHeader.className = 'list-group-item fw-bold bg-light';
        routesHeader.textContent = 'Layanan';
        ul.appendChild(routesHeader);

        foundRoutes.forEach(route => {
            const li = this.createRouteResultItem(route);
            ul.appendChild(li);
        });
    }

    // Add stops results
    addStopsResults(foundStops, stopToRoutes, routes, ul) {
        const stopsHeader = document.createElement('li');
        stopsHeader.className = 'list-group-item fw-bold bg-light text-primary';
        stopsHeader.textContent = 'Halte';
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
        li.className = 'list-group-item d-flex align-items-center gap-2 py-3 lazy-animate';
        
        const badgeColor = route.route_color ? ('#' + route.route_color) : '#6c757d';
        li.innerHTML = `
            <span class='badge badge-koridor-interaktif rounded-pill' 
                  style='background:${badgeColor};color:#fff;font-weight:bold;font-size:1.1em;padding:0.6em 1.2em;'>
                ${route.route_short_name}
            </span>
            <span class='fw-bold plus-jakarta-sans' style='font-size:1.1em;'>
                ${route.route_long_name || ''}
            </span>
        `;
        
        li.style.cursor = 'pointer';
        li.onmouseenter = () => li.style.background = '#f1f5f9';
        li.onmouseleave = () => li.style.background = '';
        li.onclick = () => {
            window.transJakartaApp.modules.routes.selectRoute(route.route_id);
            this.clearSearchResults();
        };
        
        return li;
    }

    // Create stop result item
    createStopResultItem(stop, stopToRoutes, routes) {
        const li = document.createElement('li');
        li.className = 'list-group-item lazy-animate';
        
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
        const filterButtons = document.querySelectorAll('.filter-btn');
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
        const filteredStops = stops.filter(s => 
            !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H'))
        );
        
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
        li.className = 'list-group-item text-center text-muted py-4';
        li.innerHTML = `
            <div class="d-flex flex-column align-items-center gap-2">
                <iconify-icon icon="mdi:magnify-remove-outline" style="font-size: 2rem; opacity: 0.6;"></iconify-icon>
                <div>
                    <div class="fw-bold">Tidak ada hasil ditemukan</div>
                    <div class="small">untuk pencarian "<span class="fw-semibold">${this.escapeHtml(query)}</span>"</div>
                    <div class="small mt-2 text-muted">Coba kata kunci yang berbeda atau periksa ejaan</div>
                </div>
            </div>
        `;
        ul.appendChild(li);
    }
    
    // Add suggestion message
    addSuggestionMessage(ul, suggestion) {
        const li = document.createElement('li');
        li.className = 'list-group-item bg-light border-0';
        li.innerHTML = `
            <div class="d-flex align-items-center gap-2 text-primary">
                <iconify-icon icon="mdi:lightbulb-outline" style="font-size: 1.2rem;"></iconify-icon>
                <small class="fw-semibold">${suggestion}</small>
            </div>
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
        let ul = resultsDiv.querySelector('ul.list-group');
        if (!ul) {
            ul = this.createResultsList();
            resultsDiv.appendChild(ul);
        }
        
        // Add places header
        const placesHeader = document.createElement('li');
        placesHeader.className = 'list-group-item fw-bold bg-light text-success';
        placesHeader.innerHTML = `
            <iconify-icon icon="mdi:map-marker" class="me-2"></iconify-icon>
            Tempat
        `;
        ul.appendChild(placesHeader);
        
        // Add place results
        places.forEach(place => {
            const li = this.createPlaceResultItem(place);
            ul.appendChild(li);
        });
    }
    
    // Create place result item
    createPlaceResultItem(place) {
        const li = document.createElement('li');
        li.className = 'list-group-item lazy-animate place-result';
        li.style.cursor = 'pointer';
        
        const displayName = this.formatPlaceName(place.display_name);
        const type = this.getPlaceType(place);
        
        li.innerHTML = `
            <div class="d-flex align-items-start gap-2">
                <iconify-icon icon="mdi:map-marker" class="text-success mt-1" style="font-size: 1.2em;"></iconify-icon>
                <div class="flex-grow-1">
                    <div class="fw-semibold text-dark">${this.highlight(displayName)}</div>
                    <div class="small text-muted">${type}</div>
                </div>
            </div>
        `;
        
        li.onmouseenter = () => li.style.background = '#f1f5f9';
        li.onmouseleave = () => li.style.background = '';
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
                <div class="stop-item d-flex align-items-center justify-content-between py-2 border-bottom" 
                     style="cursor: pointer;" 
                     data-stop-lat="${stop.stop_lat}" 
                     data-stop-lon="${stop.stop_lon}"
                     data-stop-name="${stop.stop_name}"
                     data-stop-id="${stop.stop_id}">
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${stop.stop_name}</div>
                        <span class="badge ${badgeClass} badge-sm">${stopType}</span>
                    </div>
                    <div class="text-muted small">${distanceText}</div>
                </div>
            `;
        }).join('');
        
        // Get weather info for this location
        const placeWeatherHtml = this.getPlaceWeatherHtml(lat, lon);
        
        const popupHtml = `
            <div class="plus-jakarta-sans" style="min-width: 280px; max-width: 350px;">
                <div class="place-header d-flex align-items-start gap-2 mb-3" style="padding: 12px 12px 0 12px;">
                    <iconify-icon icon="mdi:map-marker" class="text-success mt-1" style="font-size: 1.3em;"></iconify-icon>
                    <div>
                        <div class="fw-bold text-dark">${placeName}</div>
                        <div class="small text-muted">${placeType}</div>
                    </div>
                </div>
                
                ${placeWeatherHtml}
                
                <div class="nearest-stops" style="padding: 0 12px 12px 12px;">
                    <div class="fw-semibold mb-2 text-primary">
                        <iconify-icon icon="mdi:bus-stop" class="me-1"></iconify-icon>
                        Halte Terdekat
                    </div>
                    <div class="stops-list" style="max-height: 200px; overflow-y: auto;">
                        ${stopsHtml}
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
                    const stopLat = parseFloat(item.dataset.stopLat);
                    const stopLon = parseFloat(item.dataset.stopLon);
                    const stopName = item.dataset.stopName;
                    const stopId = item.dataset.stopId;
                    
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
                    item.style.backgroundColor = '#f8f9fa';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.backgroundColor = '';
                });
            });
        }, 50);
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
 