// UI Manager Module
export class UIManager {
    constructor() {
        this.isInitialized = false;
    }

    // Initialize UI
    init() {
        if (this.isInitialized) return;
        
        this.setupRouteDropdowns();
        this.setupMapControls();
        this.isInitialized = true;
    }

    // Setup route dropdowns
    setupRouteDropdowns() {
        // Main routes dropdown
        this.setupMainRouteDropdown();
        
        // Map route dropdown
        this.setupMapRouteDropdown();
    }

    // Setup main route dropdown
    setupMainRouteDropdown() {
        const select = document.getElementById('routesDropdown');
        if (!select) return;

        select.innerHTML = '';
        
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const sortedRoutes = [...routes].sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        sortedRoutes.forEach(route => {
            const opt = document.createElement('option');
            opt.value = route.route_id;
            opt.textContent = (route.route_short_name ? route.route_short_name : route.route_id) + 
                            (route.route_long_name ? ' - ' + route.route_long_name : '');
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            window.transJakartaApp.modules.routes.selectRoute(e.target.value);
        };
    }

    // Setup map route dropdown
    setupMapRouteDropdown() {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) return;

        // Create container if not exists (tengah atas)
        let container = document.getElementById('mapDropdownContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mapDropdownContainer';
            container.style.position = 'absolute';
            container.style.left = '50%';
            container.style.top = '10px';
            container.style.transform = 'translateX(-50%)';
            container.style.zIndex = 999;
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.gap = '8px';
            mapDiv.appendChild(container);
        }

        // Create basemap selector (lebih pendek)
        if (!document.getElementById('basemapSelector')) {
            const bm = document.createElement('select');
            bm.id = 'basemapSelector';
            bm.className = 'form-select form-select-sm plus-jakarta-sans';
            bm.style.minWidth = '140px';
            bm.style.maxWidth = '160px';
            bm.innerHTML = `
                <option value="positron">Positron</option>
                <option value="osm">OSM</option>
                <option value="satellite">Satelit</option>
            `;
            // Restore saved base style
            const savedStyle = localStorage.getItem('baseMapStyle') || 'positron';
            bm.value = savedStyle;
            window.transJakartaApp.modules.map.setBaseStyle(savedStyle);
            bm.onchange = () => {
                const val = bm.value;
                localStorage.setItem('baseMapStyle', val);
                window.transJakartaApp.modules.map.setBaseStyle(val);
            };
            container.appendChild(bm);
        } else {
            // Ensure existing reflects saved value
            const bm = document.getElementById('basemapSelector');
            const savedStyle = localStorage.getItem('baseMapStyle');
            if (bm && savedStyle && bm.value !== savedStyle) bm.value = savedStyle;
        }

        // Create route dropdown (lebih pendek)
        let routeDropdown = document.getElementById('mapRouteDropdown');
        if (!routeDropdown) {
            routeDropdown = document.createElement('select');
            routeDropdown.id = 'mapRouteDropdown';
            routeDropdown.className = 'form-select form-select-sm plus-jakarta-sans';
            routeDropdown.style.minWidth = '140px';
            routeDropdown.style.maxWidth = '160px';
            routeDropdown.style.fontSize = '0.9em';
            routeDropdown.style.padding = '4px 6px';
            container.appendChild(routeDropdown);
        }

        // Populate dropdown
        this.populateMapRouteDropdown(routeDropdown);

        // Setup change handler
        routeDropdown.onchange = (e) => {
            const routeId = e.target.value;
            window.transJakartaApp.modules.routes.selectRoute(routeId);
            
            // Sync with main dropdown
            const mainDropdown = document.getElementById('routesDropdown');
            if (mainDropdown && mainDropdown.value !== routeId) {
                mainDropdown.value = routeId;
            }

            // Update variant dropdown
            this.updateMapVariantDropdown(routeId);
        };

        // Sync main dropdown -> map dropdown
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) {
            mainDropdown.onchange = (e) => {
                const routeId = e.target.value;
                const currentValue = routeDropdown.value;
                if (currentValue !== routeId) routeDropdown.value = routeId;
                window.transJakartaApp.modules.routes.selectRoute(routeId);
                this.updateMapVariantDropdown(routeId);
            };
        }
    }

    // Populate map route dropdown
    populateMapRouteDropdown(dropdown) {
        dropdown.innerHTML = '';
        
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const sortedRoutes = [...routes].sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        sortedRoutes.forEach(route => {
            const opt = document.createElement('option');
            opt.value = route.route_id;
            // Truncate long names to keep dropdown compact
            let displayText = route.route_short_name || route.route_id;
            if (route.route_long_name) {
                const longName = route.route_long_name.length > 25 ? 
                    route.route_long_name.substring(0, 25) + '...' : 
                    route.route_long_name;
                displayText += ' - ' + longName;
            }
            opt.textContent = displayText;
            dropdown.appendChild(opt);
        });

        // Set selected value
        const selectedRouteId = window.transJakartaApp.modules.routes.selectedRouteId;
        if (selectedRouteId) {
            dropdown.value = selectedRouteId;
        } else if (sortedRoutes.length > 0) {
            dropdown.value = sortedRoutes[0].route_id;
        }
    }

    // Update map variant dropdown
    updateMapVariantDropdown(routeId) {
        // Remove old variant dropdown
        let old = document.getElementById('mapRouteVariantDropdown');
        if (old) old.remove();

        if (!routeId) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        // Robust extractor: ambil suffix setelah '-' terakhir
        const extractVariantFromTripId = (tripId) => {
            if (!tripId) return null;
            const idx = tripId.lastIndexOf('-');
            if (idx === -1) return null;
            const suffix = tripId.substring(idx + 1).trim();
            return suffix || null;
        };

        let variantInfo = {};
        trips.forEach(t => {
            const varKey = extractVariantFromTripId(t.trip_id);
            if (varKey && !variantInfo[varKey]) variantInfo[varKey] = t;
        });

        let variants = Object.keys(variantInfo).sort((a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b));

        // Only show if more than 1 variant
        if (variants.length > 1) {
            const container = document.getElementById('mapDropdownContainer');
            if (!container) return;

            let variantDropdown = document.createElement('select');
            variantDropdown.id = 'mapRouteVariantDropdown';
            variantDropdown.className = 'form-select form-select-sm plus-jakarta-sans';
            variantDropdown.style.minWidth = '140px';
            variantDropdown.style.maxWidth = '160px';
            variantDropdown.style.fontSize = '0.9em';
            variantDropdown.style.padding = '4px 6px';

            let localVarKey = 'selectedRouteVariant_' + routeId;
            let localVar = localStorage.getItem(localVarKey) || '';

            variantDropdown.innerHTML = `<option value="">Default</option>` +
                variants.map(v => {
                    let trip = variantInfo[v];
                    let jurusan = trip.trip_headsign || trip.trip_long_name || '';
                    if (jurusan.length > 20) jurusan = jurusan.substring(0, 20) + '...';
                    let label = v + (jurusan ? ' - ' + jurusan : '');
                    let selected = localVar === v ? 'selected' : '';
                    return `<option value="${v}" ${selected}>${label}</option>`;
                }).join('');

            variantDropdown.onchange = (e) => {
                const variant = e.target.value || null;
                window.transJakartaApp.modules.routes.selectRouteVariant(variant);
            };

            container.appendChild(variantDropdown);
        }
    }

    // Setup map controls (dipindah ke kanan)
    setupMapControls() {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) return;

        // Reset Button (kanan)
        if (!document.getElementById('resetMapBtn')) {
            const btn = document.createElement('button');
            btn.id = 'resetMapBtn';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '70px';
            btn.style.zIndex = 1000;
            btn.innerHTML = '<iconify-icon icon="mdi:refresh" inline></iconify-icon>';
            btn.onclick = () => { window.transJakartaApp.resetApp(); };
            mapDiv.appendChild(btn);
        }

        // Radius Button (kanan)
        if (!document.getElementById('radiusHalteBtnMap')) {
            const btn = document.createElement('button');
            btn.id = 'radiusHalteBtnMap';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '118px';
            btn.style.zIndex = 1000;
            btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Halte Radius</span>';
            btn.onclick = (e) => {
                e.preventDefault();
                if (!window.radiusHalteActive) {
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager && mapManager.map) {
                        const center = mapManager.map.getCenter();
                        mapManager.showHalteRadius(center.lng, center.lat, 300);
                    }
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-warning');
                    btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Sembunyikan</span>';
                    window.radiusHalteActive = true;
                } else {
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager) { mapManager.removeHalteRadiusMarkers(); }
                    btn.classList.remove('btn-warning');
                    btn.classList.add('btn-primary');
                    btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Halte Radius</span>';
                    window.radiusHalteActive = false;
                }
            };
            mapDiv.appendChild(btn);
        }

        // Nearest Stops Button (kanan)
        if (!document.getElementById('nearestStopsBtn')) {
            const btn = document.createElement('button');
            btn.id = 'nearestStopsBtn';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '166px';
            btn.style.zIndex = 1000;
            btn.style.cursor = 'pointer';
            btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius-outline" inline></iconify-icon> <span class="d-none d-md-inline">Halte Terdekat</span>';
            btn.onclick = (e) => {
                console.debug('[nearestStopsBtn] click handler fired');
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const locationManager = window.transJakartaApp.modules.location;
                if (locationManager) {
                    locationManager.requestNearestStops(6);
                } else {
                    console.warn('[nearestStopsBtn] locationManager not available');
                }
                return false;
            };
            // Deduplicate buttons if any exist accidentally
            setTimeout(() => {
                const buttons = document.querySelectorAll('#nearestStopsBtn');
                if (buttons.length > 1) {
                    console.warn('[nearestStopsBtn] Duplicate buttons detected:', buttons.length);
                    for (let i = 1; i < buttons.length; i++) buttons[i].remove();
                }
            }, 100);
            btn.style.display = 'none';
            mapDiv.appendChild(btn);
        } else {
            // Ensure existing button behaves correctly
            const btn = document.getElementById('nearestStopsBtn');
            if (btn && btn.tagName.toLowerCase() === 'button' && btn.type !== 'button') {
                btn.type = 'button';
                console.debug('[nearestStopsBtn] fixed type=button on existing element');
            }
        }
    }

    // Update route dropdowns
    updateRouteDropdowns(routeId) {
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown && mainDropdown.value !== routeId) mainDropdown.value = routeId;
        const mapDropdown = document.getElementById('mapRouteDropdown');
        if (mapDropdown && mapDropdown.value !== routeId) mapDropdown.value = routeId;
        this.updateMapVariantDropdown(routeId);
    }

    // Reset function
    reset() {
        // Reset dropdowns
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) mainDropdown.value = '';
        const mapDropdown = document.getElementById('mapRouteDropdown');
        if (mapDropdown) mapDropdown.value = '';
        this.removeVariantDropdowns();

        // Bersihkan daftar halte pada card
        const ul = document.getElementById('stopsByRoute');
        const directionTabs = document.getElementById('directionTabs');
        const title = document.getElementById('stopsTitle');
        if (ul) ul.innerHTML = '';
        if (directionTabs) directionTabs.innerHTML = '';
        if (title) title.textContent = 'Informasi layanan akan tampil di sini setelah anda memilihnya.';

        // Reset buttons
        this.resetButtons();
    }

    removeVariantDropdowns() {
        let old = document.getElementById('mapRouteVariantDropdown');
        if (old) old.remove();
        let oldStops = document.getElementById('stopsVariantDropdown');
        if (oldStops) oldStops.closest('.variant-selector-stops')?.remove();
    }

    resetButtons() {
        const liveLocationBtn = document.getElementById('liveLocationBtn');
        if (liveLocationBtn) {
            liveLocationBtn.classList.remove('btn-primary');
            liveLocationBtn.classList.add('btn-outline-primary');
            liveLocationBtn.setAttribute('data-active', 'off');
            liveLocationBtn.innerHTML = '<span id="liveLocationIcon" class="bi bi-geo-alt"></span> Live Location: OFF';
        }
        const nearestBtn = document.getElementById('nearestStopsBtn');
        if (nearestBtn) nearestBtn.style.display = 'none';
    }
} 
 