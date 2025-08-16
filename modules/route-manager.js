// Route Manager Module
export class RouteManager {
    constructor() {
        this.selectedRouteId = null;
        this.selectedRouteVariant = null;
        this.lastRouteId = null;
    }

    // Select a route
    selectRoute(routeId) {
        if (!routeId) {
            this.resetRoute();
            return;
        }

        this.selectedRouteId = routeId;
        this.saveActiveRouteId(routeId);
        localStorage.setItem('activeRouteId', routeId);
        
        // Reset variant when changing routes
        if (this.lastRouteId !== routeId) {
            this.selectedRouteVariant = null;
            this.lastRouteId = routeId;
        }

        // Before updating, close any popup and temp layers
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            if (typeof mapManager.closePopupAndTemp === 'function') {
                mapManager.closePopupAndTemp();
            } else if (typeof mapManager.closePopup === 'function') {
                mapManager.closePopup();
            }
        }

        // Update UI
        this.updateRouteDropdowns();
        this.renderRouteInfo();
        this.showStopsByRoute(routeId);
        
        // Update map
        this.updateMapRoute();

        // If location is active and user has a last stop context, activate live service from that stop
        try {
            const loc = window.transJakartaApp.modules.location;
            const gtfs = window.transJakartaApp.modules.gtfs;
            if (loc && loc.isActive && window.lastStopId) {
                const stop = gtfs.getStops().find(s => s.stop_id === window.lastStopId);
                if (stop) loc.activateLiveServiceFromStop(stop, routeId);
            }
        } catch (e) {
            console.warn('[RouteManager] live service activation skipped:', e);
        }
    }

    // Reset route selection
    resetRoute() {
        this.selectedRouteId = null;
        this.selectedRouteVariant = null;
        this.lastRouteId = null;
        this.saveActiveRouteId(null);
        
        // Clear UI
        this.clearRouteInfo();
        this.clearMapRoute();
    }

    // Select route variant
    selectRouteVariant(variant) {
        this.selectedRouteVariant = variant;
        
        // Save to localStorage
        if (this.selectedRouteId) {
            const localVarKey = 'selectedRouteVariant_' + this.selectedRouteId;
            localStorage.setItem(localVarKey, variant || '');
        }
        
        // Update UI
        this.updateVariantDropdowns();
        this.showStopsByRoute(this.selectedRouteId);
    }

    // Update route dropdowns
    updateRouteDropdowns() {
        // Main dropdown
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) {
            mainDropdown.value = this.selectedRouteId;
        }

        // Map dropdown
        if (window.updateMapRouteDropdown) {
            window.updateMapRouteDropdown(this.selectedRouteId);
        }
    }

    // Update variant dropdowns
    updateVariantDropdowns() {
        // Map variant dropdown
        const mapVariantDropdown = document.getElementById('mapRouteVariantDropdown');
        if (mapVariantDropdown) {
            mapVariantDropdown.value = this.selectedRouteVariant || '';
        }

        // Stops variant dropdown
        const stopsVariantDropdown = document.getElementById('stopsVariantDropdown');
        if (stopsVariantDropdown) {
            stopsVariantDropdown.value = this.selectedRouteVariant || '';
        }
    }

    // Render route information
    renderRouteInfo() {
        if (!this.selectedRouteId) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === this.selectedRouteId);
        
        if (!route) return;

        const title = document.getElementById('stopsTitle');
        if (!title) return;

        const routeInfo = this.buildRouteInfoHTML(route);
        title.innerHTML = routeInfo;
        title.className = 'mb-3 fs-3 fw-bold plus-jakarta-sans';

        // Setup variant dropdown if needed
        this.setupVariantDropdown(route);
    }

    // Build route info HTML
    buildRouteInfoHTML(route) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const variantInfo = this.getRouteVariants(trips);
        const variants = Object.keys(variantInfo).sort(
            (a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        let variantDropdownHTML = '';
        if (variants.length > 1) {
            variantDropdownHTML = this.buildVariantDropdownHTML(variants, variantInfo);
        }

        const serviceInfo = this.buildServiceInfoHTML(route, trips);
        
        return `
            <div class='service-info-container'>
                ${this.buildRouteBadgeHTML(route)}
                ${this.buildRouteJurusanHTML(route)}
                ${this.buildServiceTypeHTML(route)}
                <div class='service-details'>
                    ${serviceInfo}
                </div>
            </div>
            ${variantDropdownHTML}
        `;
    }

    // NEW: Build combined service info HTML (days, hours, frequency, fare, length)
    buildServiceInfoHTML(route, trips) {
        const parts = [];
        parts.push(this.buildOperatingDaysHTML(trips));
        parts.push(this.buildOperatingHoursHTML(trips));
        parts.push(this.buildFrequencyHTML(trips));
        parts.push(this.buildFareHTML(route));
        parts.push(this.buildRouteLengthHTML(trips));
        return parts.filter(Boolean).join('');
    }

    // Build route badge HTML
    buildRouteBadgeHTML(route) {
        const badgeText = route.route_short_name || route.route_id || '';
        const badgeColor = route.route_color ? ('#' + route.route_color) : '#264697';
        
        return `
            <div class='mb-3 text-center'>
                <div class='route-badge-container'>
                    <span class='badge badge-koridor-interaktif rounded-pill me-2' 
                          style='background:${badgeColor};color:#fff;font-weight:bold;font-size:2rem !important;padding:0.8em 1.6em;box-shadow:0 4px 15px rgba(38,70,151,0.2);border-radius:2em;letter-spacing:2px;'>
                        ${badgeText}
                    </span>
                    <div class='route-badge-subtitle'>Koridor TransJakarta</div>
                </div>
            </div>
        `;
    }

    // Build route jurusan HTML
    buildRouteJurusanHTML(route) {
        if (!route.route_long_name) return '';
        
        return `
            <div class='mb-3 text-center'>
                <h4 class='route-jurusan plus-jakarta-sans fw-bold'>${route.route_long_name}</h4>
            </div>
        `;
    }

    // Build service type HTML
    buildServiceTypeHTML(route) {
        if (!route.route_desc) return '';

        let serviceType = route.route_desc;
        if (route.route_id && route.route_id.startsWith('JAK.') && 
            serviceType.trim() === 'Angkutan Umum Integrasi') {
            serviceType = 'MikroTrans';
        }

        const serviceTypeMap = {
            'BRT': 'Bus Rapid Transit',
            'TransJakarta': 'Bus Rapid Transit',
            'Angkutan Umum Integrasi': 'Angkutan Umum Integrasi',
            'MikroTrans': 'MikroTrans',
            'Royal Trans': 'Royal Trans',
            'Bus Wisata': 'Bus Wisata'
        };

        const displayServiceType = serviceTypeMap[serviceType] || serviceType;
        
        let serviceBadgeClass = 'bg-primary';
        if (serviceType.includes('BRT') || serviceType.includes('TransJakarta')) {
            serviceBadgeClass = 'bg-primary';
        } else if (serviceType.includes('Angkutan Umum Integrasi')) {
            serviceBadgeClass = 'bg-warning';
        } else if (serviceType.includes('Royal')) {
            serviceBadgeClass = 'bg-success text-dark';
        } else if (serviceType.includes('Wisata')) {
            serviceBadgeClass = 'bg-danger';
        } else if (serviceType.includes('Rusun')) {
            serviceBadgeClass = 'bg-secondary';
        } else if (serviceType.includes('Mikro')) {
            serviceBadgeClass = 'bg-info';
        }

        return `
            <div class='mb-3 text-center'>
                <span class='badge ${serviceBadgeClass} fs-6 px-3 py-2 rounded-pill'>
                    <iconify-icon icon="mdi:bus" inline></iconify-icon>
                    ${displayServiceType}
                </span>
            </div>
        `;
    }

    infoIconLink(url, title) {
        if (!url) return '';
        return `<a href="${url}" target="_blank" title="${title}" class="info-link" style="margin-left:6px; text-decoration:none; display:inline-flex; align-items:center;"><iconify-icon icon="mdi:information-outline" inline></iconify-icon></a>`;
    }

    // Build operating days HTML
    buildOperatingDaysHTML(trips) {
        const serviceIds = Array.from(new Set(trips.map(t => t.service_id)));
        if (serviceIds.length === 0) return '';

        const serviceIdMap = {
            'SH': 'Setiap Hari',
            'HK': 'Hari Kerja',
            'HL': 'Hari Libur',
            'HM': 'Hanya Minggu',
            'X': 'Khusus',
        };

        const hariText = serviceIds.map(sid => serviceIdMap[sid] || sid).join(' / ');
        const rawUrl = `gtfs-raw-viewer.html?file=calendar&service_id=${encodeURIComponent(serviceIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data calendar');
        
        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:calendar-week" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Hari Operasi</div>
                    <div class='info-value'>${hariText}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build operating hours HTML
    buildOperatingHoursHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        
        const tripIds = filteredTrips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        let startTimes = [], endTimes = [];
        if (freqsForRoute.length > 0) {
            freqsForRoute.forEach(f => {
                if (f.start_time && f.end_time) {
                    startTimes.push(f.start_time);
                    endTimes.push(f.end_time);
                }
            });
        }

        if (startTimes.length === 0 || endTimes.length === 0) {
            let stopTimesForRoute = stopTimes.filter(st => tripIds.includes(st.trip_id));
            if (stopTimesForRoute.length > 0) {
                startTimes = stopTimesForRoute.map(st => st.arrival_time).filter(Boolean);
                endTimes = stopTimesForRoute.map(st => st.departure_time).filter(Boolean);
            }
        }

        if (startTimes.length === 0 || endTimes.length === 0) return '';

        const minStart = startTimes.reduce((a, b) => this.timeToSeconds(a) < this.timeToSeconds(b) ? a : b);
        const maxEnd = endTimes.reduce((a, b) => this.timeToSeconds(a) > this.timeToSeconds(b) ? a : b);

        const rawUrl = `gtfs-raw-viewer.html?file=stop_times&trip_id=${encodeURIComponent(tripIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data stop_times');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:clock-outline" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Jam Operasi</div>
                    <div class='info-value'>${this.formatOperatingHours(minStart, maxEnd)}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build frequency HTML
    buildFrequencyHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        
        const tripIds = filteredTrips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        if (freqsForRoute.length === 0) return '';

        let headwaySeconds = [];
        freqsForRoute.forEach(f => {
            if (f.min_headway_secs) headwaySeconds.push(parseInt(f.min_headway_secs));
            if (f.max_headway_secs) headwaySeconds.push(parseInt(f.max_headway_secs));
            if (f.headway_secs) headwaySeconds.push(parseInt(f.headway_secs));
        });

        let headwayMinutes = headwaySeconds
            .filter(v => !isNaN(v))
            .map(v => Math.round(v/60))
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => a - b);

        const headwayText = headwayMinutes.length > 0 ? headwayMinutes.map(v => `${v} menit`).join(', ') : '-';
        const rawUrl = `gtfs-raw-viewer.html?file=frequencies&trip_id=${encodeURIComponent(tripIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data frequencies');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:repeat" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Frekuensi</div>
                    <div class='info-value'>${headwayText}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build fare HTML
    buildFareHTML(route) {
        const fareRules = window.transJakartaApp.modules.gtfs.getFareRules();
        const fareAttributes = window.transJakartaApp.modules.gtfs.getFareAttributes();
        
        const fareRule = fareRules.find(fr => fr.route_id === route.route_id);
        if (!fareRule) return '';

        const fareAttr = fareAttributes.find(fa => fa.fare_id === fareRule.fare_id);
        if (!fareAttr) return '';

        const price = parseInt(fareAttr.price).toLocaleString('id-ID');
        const currency = fareAttr.currency_type === 'IDR' ? 'Rp' : (fareAttr.currency_type + ' ');
        const rawUrl = `gtfs-raw-viewer.html?file=fare_attributes&fare_id=${encodeURIComponent(fareRule.fare_id)}&route_id=${encodeURIComponent(route.route_id)}&show_rules=1`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data fare');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:ticket-percent" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Tarif</div>
                    <div class='info-value'>${currency}${price}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build route length HTML
    buildRouteLengthHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const shapes = window.transJakartaApp.modules.gtfs.getShapes();
        
        if (filteredTrips.length === 0) return '';

        const mainShapeId = filteredTrips[0].shape_id;
        if (!mainShapeId) return '';

        const shapePoints = shapes.filter(s => s.shape_id === mainShapeId)
            .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));

        let totalLength = 0;
        for (let i = 1; i < shapePoints.length; i++) {
            const lat1 = parseFloat(shapePoints[i-1].shape_pt_lat);
            const lon1 = parseFloat(shapePoints[i-1].shape_pt_lon);
            const lat2 = parseFloat(shapePoints[i].shape_pt_lat);
            const lon2 = parseFloat(shapePoints[i].shape_pt_lon);
            totalLength += this.haversine(lat1, lon1, lat2, lon2);
        }

        if (totalLength === 0) return '';
        const rawUrl = `gtfs-raw-viewer.html?file=shapes&shape_id=${encodeURIComponent(mainShapeId)}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data shapes');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:ruler" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Panjang Trayek</div>
                    <div class='info-value'>${(totalLength/1000).toFixed(2)} km${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build variant dropdown HTML
    buildVariantDropdownHTML(variants, variantInfo) {
        return `
            <div class="variant-selector-stops">
                <label class="form-label">
                    <iconify-icon icon="mdi:routes"></iconify-icon>
                    Pilih Varian Trayek
                </label>
                <select id="stopsVariantDropdown" class="form-select plus-jakarta-sans">
                    <option value="">Default (Semua Varian)</option>
                    ${variants.map(v => {
                        const trip = variantInfo[v];
                        const jurusan = trip.trip_headsign || trip.trip_long_name || '';
                        const label = v + (jurusan ? ' - ' + jurusan : '');
                        const selected = this.selectedRouteVariant === v ? 'selected' : '';
                        return `<option value="${v}" ${selected}>${label}</option>`;
                    }).join('')}
                </select>
                <div class="help-text lancip">
                    <iconify-icon icon="mdi:information-outline"></iconify-icon>
                    Pilih varian untuk melihat arah spesifik
                </div>
            </div>
        `;
    }

    // Setup variant dropdown
    setupVariantDropdown(route) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const variantInfo = this.getRouteVariants(trips);
        const variants = Object.keys(variantInfo).sort(
            (a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        if (variants.length > 1) {
            // Load saved variant
            const localVarKey = 'selectedRouteVariant_' + route.route_id;
            const localVar = localStorage.getItem(localVarKey);
            if (localVar && !this.selectedRouteVariant) {
                this.selectedRouteVariant = localVar;
            }

            // Setup event listener
            setTimeout(() => {
                const stopsVariantDropdown = document.getElementById('stopsVariantDropdown');
                if (stopsVariantDropdown) {
                    stopsVariantDropdown.onchange = (e) => {
                        this.selectRouteVariant(e.target.value || null);
                    };
                }
            }, 10);
        }
    }

    // Extract variant suffix from trip_id (more robust than regex \w)
    extractVariantFromTripId(tripId) {
        if (!tripId) return null;
        const idx = tripId.lastIndexOf('-');
        if (idx === -1) return null;
        const suffix = tripId.substring(idx + 1).trim();
        return suffix || null;
    }

    // Get route variants
    getRouteVariants(trips) {
        const variantInfo = {};
        trips.forEach(t => {
            const varKey = this.extractVariantFromTripId(t.trip_id);
            if (varKey) {
                if (!variantInfo[varKey]) variantInfo[varKey] = t;
            }
        });
        return variantInfo;
    }

    // Get filtered trips based on variant
    getFilteredTrips(trips) {
        if (!this.selectedRouteVariant) return trips;
        return trips.filter(t => this.extractVariantFromTripId(t.trip_id) === this.selectedRouteVariant);
    }

    // Show stops by route
    showStopsByRoute(routeId) {
        if (!routeId) {
            this.clearStopsList();
            return;
        }

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeId);
        
        if (!route) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        const filteredTrips = this.getFilteredTrips(trips);
        const allStops = this.getStopsForRoute(filteredTrips);
        
        this.renderStopsList(allStops);
        this.updateMapRoute();
    }

    // Get stops for route
    getStopsForRoute(trips) {
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        const stops = window.transJakartaApp.modules.gtfs.getStops();
        
        if (!this.selectedRouteVariant) {
            // Combine all stops from all trips (no duplicates)
            const halteMap = new Map();
            trips.forEach(trip => {
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop) {
                        const key = stop.stop_id;
                        if (!halteMap.has(key)) halteMap.set(key, stop);
                    }
                });
            });
            return Array.from(halteMap.values());
        } else {
            // Only selected variant
            const allStops = [];
            trips.forEach(trip => {
                if (this.extractVariantFromTripId(trip.trip_id) !== this.selectedRouteVariant) return;
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop) allStops.push(stop);
                });
            });
            return allStops;
        }
    }

    // Render stops list
    renderStopsList(stops) {
        const ul = document.getElementById('stopsByRoute');
        if (!ul) return;

        if (stops.length === 0) {
            ul.innerHTML = '<li class="list-group-item">Tidak ada halte ditemukan</li>';
            return;
        }

        ul.innerHTML = '';
        stops.forEach((stop, idx) => {
            const li = this.createStopListItem(stop, idx);
            ul.appendChild(li);
        });
    }

    // Create stop list item
    createStopListItem(stop, idx) {
        const li = document.createElement('li');
        li.className = 'stop-item';
        
        const stopContainer = document.createElement('div');
        stopContainer.className = 'stop-container';
        
        const stopHeader = document.createElement('div');
        stopHeader.className = 'stop-header';
        
        const stopNumber = document.createElement('div');
        stopNumber.className = 'stop-number';
        stopNumber.textContent = (idx + 1).toString().padStart(2, '0');
        
        const stopName = document.createElement('div');
        stopName.className = 'stop-name';
        stopName.textContent = stop.stop_name;
        
        // Coordinate link
        if (stop.stop_lat && stop.stop_lon) {
            const coordLink = document.createElement('a');
            coordLink.href = `https://www.google.com/maps/search/?api=1&query=${stop.stop_lat},${stop.stop_lon}`;
            coordLink.target = '_blank';
            coordLink.rel = 'noopener';
            coordLink.className = 'coord-link';
            coordLink.title = 'Lihat di Google Maps';
            coordLink.innerHTML = `<iconify-icon icon="mdi:map-marker" style="color: #d9534f;"></iconify-icon>`;
            stopHeader.appendChild(coordLink);
        }
        
        stopHeader.appendChild(stopNumber);
        stopHeader.appendChild(stopName);
        
        // Stop type badge
        const stopTypeBadge = this.createStopTypeBadge(stop);
        
        // Other routes badges
        const otherRoutesBadges = this.createOtherRoutesBadges(stop);
        
        stopContainer.innerHTML = `
            ${stopHeader.outerHTML}
            ${stopTypeBadge}
            ${otherRoutesBadges}
        `;
        
        li.appendChild(stopContainer);
        
        // Event handlers
        li.onclick = (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            window.lastStopId = stop.stop_id;
        };
        
        return li;
    }

    // Create stop type badge
    createStopTypeBadge(stop) {
        let stopTypeBadge = '';
        if (stop.stop_id && stop.stop_id.startsWith('B')) {
            stopTypeBadge = `<div class='stop-type-badge feeder'>Pengumpan</div>`;
        } else if (stop.stop_id && stop.stop_id.startsWith('G') && stop.platform_code) {
            stopTypeBadge = `<div class='stop-type-badge platform'>Platform ${stop.platform_code}</div>`;
        } else if (stop.stop_id && (stop.stop_id.startsWith('E') || stop.stop_id.startsWith('H'))) {
            stopTypeBadge = `<div class='stop-type-badge access'>Akses Masuk</div>`;
        } else {
            stopTypeBadge = `<div class='stop-type-badge corridor'>Koridor</div>`;
        }
        return stopTypeBadge;
    }

    // Create other routes badges
    createOtherRoutesBadges(stop) {
        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
        if (!stopToRoutes[stop.stop_id]) return '';

        const otherRoutes = Array.from(stopToRoutes[stop.stop_id])
            .filter(rid => rid !== this.selectedRouteId);
        
        if (otherRoutes.length === 0) return '';

        let otherRoutesBadges = `<div class='other-routes'>
            <div class='other-routes-label'>Layanan lain:</div>
            <div class='other-routes-badges'>`;
        
        otherRoutes.forEach(rid => {
            const route = window.transJakartaApp.modules.gtfs.getRoutes().find(r => r.route_id === rid);
            if (route) {
                let badgeColor = (route.route_color) ? ('#' + route.route_color) : '#6c757d';
                otherRoutesBadges += `<span class='route-badge' style='background: ${badgeColor};' title='${route.route_long_name}'>${route.route_short_name}</span>`;
            }
        });
        
        otherRoutesBadges += `</div></div>`;
        return otherRoutesBadges;
    }

    // Clear stops list
    clearStopsList() {
        const ul = document.getElementById('stopsByRoute');
        const title = document.getElementById('stopsTitle');
        const directionTabs = document.getElementById('directionTabs');
        
        if (ul) ul.innerHTML = '';
        if (title) title.textContent = '';
        if (directionTabs) directionTabs.innerHTML = '';
        
        // Remove variant dropdowns
        this.removeVariantDropdowns();
    }

    // Remove variant dropdowns
    removeVariantDropdowns() {
        let old = document.getElementById('routeVariantDropdown');
        if (old) {
            old.previousSibling && old.previousSibling.remove();
            old.remove();
        }
        
        let oldStops = document.getElementById('stopsVariantDropdown');
        if (oldStops) {
            oldStops.closest('.variant-selector-stops')?.remove();
        }
    }

    // Update map route
    updateMapRoute() {
        if (!this.selectedRouteId) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === this.selectedRouteId);
        
        if (!route) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === this.selectedRouteId);
        
        let filteredTrips = this.getFilteredTrips(trips);
        let shapes = this.getShapesForTrips(filteredTrips);

        // Fallback: jika varian menghasilkan shapes kosong (mis. di mobile), gunakan semua trips
        const shapesEmpty = !shapes || shapes.length === 0 || shapes.every(arr => !arr || arr.length === 0);
        if (shapesEmpty) {
            filteredTrips = trips;
            shapes = this.getShapesForTrips(filteredTrips);
        }
        
        // Update map
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            // Close popup and temporary layers before rendering new route
            if (typeof mapManager.closePopupAndTemp === 'function') mapManager.closePopupAndTemp();

            mapManager.addRoutePolyline(this.selectedRouteId, shapes, route.route_color ? '#' + route.route_color : '#264697');
            
            const stops = this.getStopsForRoute(filteredTrips);
            const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
            mapManager.addStopsMarkers(stops, stopToRoutes, window.transJakartaApp.modules.gtfs.getRoutes());

            // Prepare linear referencing for live layanan
            this.prepareLinearRef(shapes, stops);
        }
    }

    // Flatten shapes into single polyline and compute cumulative distances; project stops
    prepareLinearRef(shapes, stops) {
        // Flatten shapes (array of arrays of {lat,lng}) into one continuous polyline
        const poly = [];
        shapes.forEach(seg => { if (seg && seg.length) seg.forEach(p => poly.push({ lat: p.lat, lon: p.lng })); });
        if (poly.length < 2) { this.linearRef = null; this.stopMeasureById = null; this.orderedStops = stops || []; return; }
        const cum = [0];
        for (let i = 1; i < poly.length; i++) {
            cum[i] = cum[i - 1] + this.haversine(poly[i - 1].lat, poly[i - 1].lon, poly[i].lat, poly[i].lon);
        }
        // Helper project lat/lon onto segment i-1 -> i
        const projectOnSegment = (i, lat, lon) => {
            const ax = poly[i - 1].lon, ay = poly[i - 1].lat;
            const bx = poly[i].lon, by = poly[i].lat;
            const px = lon, py = lat;
            const abx = bx - ax, aby = by - ay;
            const apx = px - ax, apy = py - ay;
            const ab2 = abx * abx + aby * aby;
            if (ab2 === 0) return { t: 0, dist: cum[i - 1] };
            let t = (apx * abx + apy * aby) / ab2;
            t = Math.max(0, Math.min(1, t));
            const projLat = ay + aby * t;
            const projLon = ax + abx * t;
            const segLen = this.haversine(ay, ax, projLat, projLon);
            return { t, dist: cum[i - 1] + segLen };
        };
        // Project stop to nearest segment
        const stopMeasureById = new Map();
        const orderedStops = Array.isArray(stops) ? [...stops] : [];
        orderedStops.forEach(stop => {
            let best = { dist: Infinity };
            for (let i = 1; i < poly.length; i++) {
                const pr = projectOnSegment(i, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
                if (pr.dist < best.dist) best = pr;
            }
            stopMeasureById.set(stop.stop_id, best.dist);
        });
        this.linearRef = { poly, cum };
        this.stopMeasureById = stopMeasureById;
        this.orderedStops = orderedStops;
    }

    getLinearRef() { return this.linearRef || null; }
    getStopMeasureById() { return this.stopMeasureById || new Map(); }
    getOrderedStops() { return this.orderedStops || []; }

    // Get shapes for trips
    getShapesForTrips(trips) {
        const shapes = window.transJakartaApp.modules.gtfs.getShapes();
        const shapeIds = trips.map(t => t.shape_id).filter(Boolean);
        
        return shapeIds.map(shapeId => {
            const shapePoints = shapes.filter(s => s.shape_id === shapeId)
                .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));
            
            return shapePoints.map(s => ({
                lat: parseFloat(s.shape_pt_lat),
                lng: parseFloat(s.shape_pt_lon)
            }));
        });
    }

    // Clear map route
    clearMapRoute() {
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            mapManager.clearLayers();
        }
    }

    // Clear route info
    clearRouteInfo() {
        const title = document.getElementById('stopsTitle');
        if (title) {
            title.textContent = 'Informasi layanan akan tampil di sini setelah anda memilihnya.';
            title.className = 'mb-3 fs-3 fw-bold plus-jakarta-sans';
        }
    }

    // Save active route ID
    saveActiveRouteId(routeId) {
        if (routeId) {
            localStorage.setItem('activeRouteId', routeId);
        } else {
            localStorage.removeItem('activeRouteId');
        }
    }

    // Utility functions
    timeToSeconds(time) {
        if (!time) return null;
        const [h, m, s] = time.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    }

    formatOperatingHours(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        if (eh >= 24) {
            if (sh === 5 && sm === 0 && eh === 29 && em === 0) {
                return '24 jam (05:00)';
            }
            if (sh === 0 && sm === 0 && (eh === 24 || (eh === 23 && em === 59))) {
                return '24 jam';
            }
            let endH = eh - 24;
            let endStr = `${String(endH).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
            return `${this.formatTime(start)} - ${endStr} (+1)`;
        }
        return `${this.formatTime(start)} - ${this.formatTime(end)}`;
    }

    formatTime(time) {
        if (!time) return '';
        const [h, m] = time.split(':');
        return `${h}:${m}`;
    }

    haversine(lat1, lon1, lat2, lon2) {
        function toRad(x) { return x * Math.PI / 180; }
        const R = 6371e3; // meter
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Reset function
    reset() {
        this.resetRoute();
    }
} 
 