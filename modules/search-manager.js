// Search Manager Module
export class SearchManager {
    constructor() {
        this.searchResults = [];
        this._debounceId = null;
    }

    // Handle search input
    handleSearch(query) {
        const resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv) return;

        // Debounce 250ms
        clearTimeout(this._debounceId);
        this._debounceId = setTimeout(() => {
            resultsDiv.innerHTML = '';
            const q = query.trim().toLowerCase();
            if (q.length < 1) return;
            // Search for routes (single digit)
            if (q.length === 1 && !isNaN(q)) {
                this.searchRoutes(q, resultsDiv);
                return;
            }
            if (q.length < 2) return;
            // Search for stops and routes
            this.searchStopsAndRoutes(q, resultsDiv);
        }, 250);
    }

    // Search routes by number
    searchRoutes(query, resultsDiv) {
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const foundRoutes = routes.filter(r =>
            r.route_short_name && r.route_short_name.toLowerCase() === query
        );

        if (foundRoutes.length === 0) return;

        const ul = this.createResultsList();
        
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

        resultsDiv.appendChild(ul);
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

        // Add routes results
        if (foundRoutes.length > 0) {
            this.addRoutesResults(foundRoutes, ul);
        }

        // If no exact matches for stops, try fuzzy matches (edit distance <= 1)
        if (foundStops.length === 0 && query.length >= 3) {
            const fuzzyStops = stops
                .filter(s => !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H')))
                .filter(s => this.isFuzzyMatch(s.stop_name.toLowerCase(), query));
            if (fuzzyStops.length > 0) foundStops = fuzzyStops;
        }

        // Add stops results
        if (foundStops.length > 0) {
            this.addStopsResults(foundStops, stopToRoutes, routes, ul);
        }

        resultsDiv.appendChild(ul);
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
        li.className = 'list-group-item d-flex align-items-center gap-2 py-3';
        
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
        li.className = 'list-group-item';

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

    // Basic fuzzy match: allow edit distance <= 1 or prefix within 1 error
    isFuzzyMatch(text, query) {
        const t = String(text || '').toLowerCase();
        const q = String(query || '').toLowerCase();
        if (t.includes(q)) return true;
        // Quick prefix check with one typo allowed
        if (this.levenshtein(t.substring(0, q.length + 1), q) <= 1) return true;
        // Full distance threshold 1 for short queries, 2 for longer
        const thr = q.length >= 6 ? 2 : 1;
        return this.levenshtein(t, q) <= thr;
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
} 
 