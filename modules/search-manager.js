// Search Manager Module
export class SearchManager {
    constructor() {
        this.searchResults = [];
        this._debounceId = null;
        this._searchCache = new Map();
        this._lastQuery = '';
    }

    // Handle search input
    handleSearch(query) {
        const resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv) return;

        // Debounce 100ms untuk pencarian yang lebih responsif
        clearTimeout(this._debounceId);
        this._debounceId = setTimeout(() => {
            resultsDiv.innerHTML = '';
            const q = query.trim().toLowerCase();
            if (q.length < 1) {
                this._lastQuery = '';
                return;
            }
            
            // Check cache first untuk performa yang lebih baik
            if (this._searchCache.has(q)) {
                resultsDiv.innerHTML = this._searchCache.get(q);
                this._lastQuery = q;
                this._reattachEventListeners(resultsDiv);
                return;
            }
            
            // Search for routes (single digit)
            if (q.length === 1 && !isNaN(q)) {
                this.searchRoutes(q, resultsDiv);
                return;
            }
            if (q.length < 2) return;
            // Search for stops and routes
            this.searchStopsAndRoutes(q, resultsDiv);
        }, 100);
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
                right.innerHTML = '<iconify-icon icon="fontisto:paralysis-disability" inline></iconify-icon>';
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
        
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (searchInput) searchInput.value = '';
    }

    // Reset function
    reset() {
        this.clearSearchResults();
        this.searchResults = [];
        this._searchCache.clear();
        this._lastQuery = '';
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
    
    // HTML escape utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
} 
 