// Search Manager Module
export class SearchManager {
    constructor() {
        this.searchResults = [];
    }

    // Handle search input
    handleSearch(query) {
        const resultsDiv = document.getElementById('searchResults');
        if (!resultsDiv) return;

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

        const foundStops = stops.filter(s => 
            s.stop_name.toLowerCase().includes(query)
        );

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
        
        stops.forEach(stop => {
            const normName = stop.stop_name.trim().toLowerCase();
            const lat = parseFloat(stop.stop_lat).toFixed(5);
            const lon = parseFloat(stop.stop_lon).toFixed(5);
            const key = `${normName}|${lat}|${lon}`;
            
            if (!stopMap.has(key)) {
                stopMap.set(key, { ...stop, koridors: new Set() });
            }
            
            if (stopToRoutes[stop.stop_id]) {
                Array.from(stopToRoutes[stop.stop_id]).forEach(rid => 
                    stopMap.get(key).koridors.add(rid)
                );
            }
        });

        return Array.from(stopMap.values());
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
        
        li.innerHTML = `<div>${stop.stop_name} (${stop.stop_id})</div>`;
        
        if (stopToRoutes[stop.stop_id]) {
            const badges = Array.from(stopToRoutes[stop.stop_id]).map(rid => {
                const route = routes.find(r => r.route_id === rid);
                if (route) {
                    const badgeColor = route.route_color ? ('#' + route.route_color) : '#6c757d';
                    return `<span class='badge badge-koridor-interaktif rounded-pill me-2' 
                                style='background:${badgeColor};color:#fff;font-weight:bold;padding-left:1.1em;padding-right:1.1em;padding-top:0.35em;padding-bottom:0.35em;'>
                                ${route.route_short_name}
                            </span>`;
                }
                return '';
            }).join('');
            li.innerHTML += `<div class='mt-1'>${badges}</div>`;
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

        // Remove previous search result marker
        if (window.searchResultMarker) {
            mapManager.removeSearchResultMarker();
        }

        // Set map view to stop location
        mapManager.setView(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon), 17);

        // Add search result marker
        window.searchResultMarker = mapManager.addSearchResultMarker(
            parseFloat(stop.stop_lat), 
            parseFloat(stop.stop_lon), 
            stop.stop_name
        );
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
} 
 