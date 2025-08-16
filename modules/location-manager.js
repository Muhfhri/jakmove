// Location Manager Module
export class LocationManager {
    constructor() {
        this.isActive = false;
        this.geoWatchId = null;
        this.userMarker = null;
        this.nearestStopMarker = null;
        this.userToStopLine = null;
        this.nearestStopsMarkers = [];
        this.lastUserPos = null;
        this.lastUserTime = null;
        this.lastUserSpeed = null;
        this.userCentered = false;
        this.selectedRouteIdForUser = null;
        this.selectedCurrentStopForUser = null;
        this.currentStopId = null;
        this.lastArrivedStopId = null;
        this.arrivalTimer = null;
        this._pendingNearest = false;
        this._pendingNearestMax = 6;
    }

    // Toggle live location
    toggleLiveLocation() {
        if (this.isActive) {
            this.disableLiveLocation();
        } else {
            this.enableLiveLocation();
        }
    }

    // Enable live location
    enableLiveLocation() {
        if (!navigator.geolocation) {
            alert('Geolocation tidak didukung di browser ini.');
            return;
        }

        if (this.geoWatchId) {
            navigator.geolocation.clearWatch(this.geoWatchId);
        }

        this.geoWatchId = navigator.geolocation.watchPosition(
            (pos) => this.handlePositionUpdate(pos),
            (err) => this.handlePositionError(err),
            {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 20000
            }
        );

        this.isActive = true;
        this.updateLiveLocationButton(true);
        this.showNearestStopsButton();
    }

    // Disable live location
    disableLiveLocation() {
        if (this.geoWatchId) {
            navigator.geolocation.clearWatch(this.geoWatchId);
            this.geoWatchId = null;
        }

        if (this.userMarker) {
            const mapManager = window.transJakartaApp.modules.map;
            if (mapManager) {
                mapManager.removeUserMarker();
            }
            this.userMarker = null;
        }

        // Clear arrival timer
        if (this.arrivalTimer) {
            clearTimeout(this.arrivalTimer);
            this.arrivalTimer = null;
        }

        this.lastArrivedStopId = null;
        this.userCentered = false;
        this.isActive = false;
        this.updateLiveLocationButton(false);
        this.hideNearestStopsButton();

        // Remove nearest stops markers
        this.clearNearestStopsMarkers();
    }

    // Handle position update
    handlePositionUpdate(pos) {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const now = Date.now();
        console.debug('[Location] position update:', { lat, lon });

        // Calculate speed
        let speed = null;
        if (this.lastUserPos && this.lastUserTime) {
            const dist = this.haversine(this.lastUserPos.lat, this.lastUserPos.lon, lat, lon);
            const dt = (now - this.lastUserTime) / 1000; // seconds
            if (dt > 0 && dist < 1000) { // ignore large jumps
                speed = dist / dt;
            }
        }

        this.lastUserPos = { lat, lon };
        this.lastUserTime = now;
        this.lastUserSpeed = speed;

        // Update map
        this.updateUserMarker(lat, lon);
        this.updateMapView(lat, lon);
        this.updateUserRouteInfo(lat, lon);

        // If pending nearest requested earlier, show now
        if (this._pendingNearest && this.lastUserPos) {
            console.debug('[Location] pending nearest requested, rendering now');
            this._pendingNearest = false;
            this.showMultipleNearestStops(this.lastUserPos.lat, this.lastUserPos.lon, this._pendingNearestMax);
        }
    }

    // Handle position error
    handlePositionError(err) {
        alert('Gagal mendapatkan lokasi: ' + err.message);
        this.disableLiveLocation();
    }

    // Update user marker
    updateUserMarker(lat, lon) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;

        if (this.userMarker) {
            mapManager.updateUserMarkerPosition(lat, lon);
        } else {
            this.userMarker = mapManager.addUserMarker(lat, lon);
        }
    }

    // Update map view
    updateMapView(lat, lon) {
        if (!this.userCentered) {
            const mapManager = window.transJakartaApp.modules.map;
            if (mapManager) {
                mapManager.setView(lat, lon, 16);
            }
            this.userCentered = true;
        }
    }

    // Update user route info
    updateUserRouteInfo(lat, lon) {
        if (!this.selectedRouteIdForUser || !this.selectedCurrentStopForUser) {
            // Show simple "Posisi Anda" popup
            if (this.userMarker) {
                const mapManager = window.transJakartaApp.modules.map;
                if (mapManager) {
                    mapManager.showUserPositionPopup(this.userMarker);
                }
            }
            return;
        }

        // Show detailed route info
        this.showUserRouteInfo(lat, lon, this.selectedCurrentStopForUser, this.selectedRouteIdForUser);
    }

    // Show user route info
    showUserRouteInfo(userLat, userLon, currentStop, routeId) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        let nextStop = null;
        let minSeq = Infinity;
        let tripUsed = null;
        let stopTimes = [];

        for (const trip of trips) {
            const stTimes = window.transJakartaApp.modules.gtfs.getStopTimes()
                .filter(st => st.trip_id === trip.trip_id)
                .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            
            const idx = stTimes.findIndex(st => st.stop_id === currentStop.stop_id);
            if (idx !== -1) {
                if (idx < stTimes.length - 1) {
                    const nextSt = stTimes[idx + 1];
                    if (parseInt(nextSt.stop_sequence) < minSeq) {
                        minSeq = parseInt(nextSt.stop_sequence);
                        nextStop = window.transJakartaApp.modules.gtfs.getStops()
                            .find(s => s.stop_id === nextSt.stop_id);
                        tripUsed = trip;
                        stopTimes = stTimes;
                    }
                }
            }
        }

        if (nextStop) {
            const jarakNext = this.haversine(userLat, userLon, 
                parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            
            // Handle arrival detection
            this.handleArrivalDetection(userLat, userLon, currentStop, nextStop, jarakNext);
        }

        // Update popup content
        this.updateUserPopupContent(userLat, userLon, currentStop, routeId, nextStop);
    }

    // Handle arrival detection
    handleArrivalDetection(userLat, userLon, currentStop, nextStop, jarakNext) {
        if (jarakNext < 30 && this.lastArrivedStopId !== nextStop.stop_id) {
            // Start arrival timer
            console.log(`Timer dimulai untuk halte: ${nextStop.stop_name}`);
            this.arrivalTimer = setTimeout(() => {
                console.log(`Timer selesai, pindah dari ${currentStop.stop_name} ke ${nextStop.stop_name}`);
                this.currentStopId = nextStop.stop_id;
                this.selectedCurrentStopForUser = nextStop;
                this.lastArrivedStopId = null;
                
                if (this.userMarker) {
                    const pos = this.lastUserPos;
                    if (pos) {
                        this.showUserRouteInfo(pos.lat, pos.lng, nextStop, this.selectedRouteIdForUser);
                    }
                }
            }, 10000);

            this.lastArrivedStopId = nextStop.stop_id;
        }
    }

    // Update user popup content
    updateUserPopupContent(userLat, userLon, currentStop, routeId, nextStop) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager || !this.userMarker) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeId);
        
        const popupContent = this.buildUserPopupContent(route, currentStop, nextStop, userLat, userLon);
        mapManager.updateUserPopup(this.userMarker, popupContent);
    }

    // Build user popup content
    buildUserPopupContent(route, currentStop, nextStop, userLat, userLon) {
        const badgeColor = route && route.route_color ? ('#' + route.route_color) : '#264697';
        const badgeText = route && route.route_short_name ? route.route_short_name : 'Unknown';
        
        let nextStopInfo = '';
        if (nextStop) {
            const jarakNext = this.haversine(userLat, userLon, 
                parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            
            nextStopInfo = `
                <div style='margin-bottom:6px;'>
                    <div class='text-muted' style='font-size:0.95em;font-weight:600;margin-bottom:2px;'>Halte Selanjutnya</div>
                    <div style='font-size:1.1em;font-weight:bold;'>${nextStop.stop_name}</div>
                    <div style='margin-bottom:2px;'><b>Jarak:</b> ${jarakNext < 1000 ? Math.round(jarakNext) + ' m' : (jarakNext/1000).toFixed(2) + ' km'}</div>
                </div>
            `;
        }

        const speedInfo = this.buildSpeedInfo();
        const arrivalMsg = this.buildArrivalMessage();

        return `
            <div class='plus-jakarta-sans popup-card-friendly' style='min-width:220px;max-width:340px;line-height:1.45;background:rgba(248,250,252,0.95);border-radius:18px;box-shadow:none;padding:18px 18px 12px 18px;position:relative;'>
                <div style='display:flex;align-items:center;gap:12px;margin-bottom:8px;'>
                    <div style='flex:1;'>
                        <span class='badge badge-koridor-interaktif rounded-pill' 
                              style='background:${badgeColor};color:#fff;font-weight:bold;font-size:1.2em;padding:0.5em 1.1em;'>
                            ${badgeText}
                        </span>
                    </div>
                </div>
                <div id='popup-dinamis-info'>
                    ${route && route.route_long_name ? `<div style='margin-bottom:4px;font-size:0.95em;font-weight:600;color:#374151;'>${route.route_long_name}</div>` : ''}
                    ${nextStopInfo}
                    ${speedInfo}
                    <hr style='margin:6px 0 4px 0;border-top:1.5px solid #e5e7eb;'>
                    ${arrivalMsg}
                </div>
                <div style='position:absolute;bottom:0;right:0;opacity:0.09;font-size:6em;pointer-events:none;'>🚌</div>
            </div>
        `;
    }

    // Build speed info
    buildSpeedInfo() {
        let speedKmh = 0;
        if (this.lastUserSpeed !== null && this.lastUserSpeed >= 0) {
            speedKmh = this.lastUserSpeed * 3.6;
        }

        if (this.lastUserSpeed === null || speedKmh < 0.2) {
            return `<div style='margin-bottom:2px;'><b>Kecepatan:</b> 0 km/jam</div>`;
        } else if (speedKmh < 1) {
            return `<div style='margin-bottom:2px;'><b>Kecepatan:</b> ${(speedKmh*1000).toFixed(0)} m/jam</div>`;
        } else {
            return `<div style='margin-bottom:2px;'><b>Kecepatan:</b> ${speedKmh.toFixed(1)} km/jam</div>`;
        }
    }

    // Build arrival message
    buildArrivalMessage() {
        if (!this.lastArrivedStopId) return '';

        const nextStop = this.selectedCurrentStopForUser;
        if (!nextStop) return '';

        return `
            <div style='background:linear-gradient(135deg, #10b981, #059669);color:white;padding:12px;border-radius:8px;margin-top:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);border-left:4px solid #047857;'>
                <div style='display:flex;align-items:center;gap:8px;'>
                    <div style='font-size:1.2em;'>🎉</div>
                    <div style='flex:1;'>
                        <div style='font-weight:bold;font-size:1.1em;margin-bottom:2px;'>Tiba di Halte!</div>
                        <div style='font-size:0.95em;opacity:0.9;'>${nextStop.stop_name}</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Show nearest stop from user
    showNearestStopFromUser(userLat, userLon) {
        const stopManager = window.transJakartaApp.modules.stops;
        if (!stopManager) return;

        const { stop, distance } = stopManager.findNearestStop(userLat, userLon);
        if (!stop) return;

        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;

        // Add nearest stop marker
        this.nearestStopMarker = mapManager.addNearestStopMarker(
            parseFloat(stop.stop_lat), 
            parseFloat(stop.stop_lon), 
            stop, 
            distance
        );

        // Set map view
        mapManager.setView(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon), 17);

        // Add walking route line
        this.addWalkingRouteLine(userLat, userLon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
    }

    // Add walking route line
    addWalkingRouteLine(userLat, userLon, stopLat, stopLon) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;

        // Try to fetch walking route from OSRM
        fetch(`https://router.project-osrm.org/route/v1/foot/${userLon},${userLat};${stopLon},${stopLat}?overview=full&geometries=geojson`)
            .then(res => res.json())
            .then(data => {
                if (data.routes && data.routes[0] && data.routes[0].geometry) {
                    const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                    this.userToStopLine = mapManager.addWalkingRouteLine(coords);
                } else {
                    this.userToStopLine = mapManager.addDirectLine(userLat, userLon, stopLat, stopLon);
                }
            })
            .catch(() => {
                this.userToStopLine = mapManager.addDirectLine(userLat, userLon, stopLat, stopLon);
            });
    }

    // Request nearest stops (safe even if location not ready)
    requestNearestStops(maxStops = 6) {
        console.debug('[Nearest] requestNearestStops called');
        if (this.lastUserPos) {
            console.debug('[Nearest] using existing lastUserPos', this.lastUserPos);
            this.showMultipleNearestStops(this.lastUserPos.lat, this.lastUserPos.lon, maxStops);
            return;
        }
        // If not active, enable and mark pending
        if (!this.isActive) {
            console.debug('[Nearest] location inactive, enabling and marking pending');
            this._pendingNearest = true;
            this._pendingNearestMax = maxStops;
            this.enableLiveLocation();
            return;
        }
        // Active but no position yet; mark pending
        console.debug('[Nearest] active but no lastUserPos yet, pending');
        this._pendingNearest = true;
        this._pendingNearestMax = maxStops;
    }

    // Show multiple nearest stops
    showMultipleNearestStops(userLat, userLon, maxStops = 6) {
        console.debug('[Nearest] showMultipleNearestStops lat/lon/max:', userLat, userLon, maxStops);
        const stopManager = window.transJakartaApp.modules.stops;
        if (!stopManager) return;

        // Clear previous markers
        this.clearNearestStopsMarkers();

        const allStops = window.transJakartaApp.modules.gtfs.getStops().filter(s => s.stop_lat && s.stop_lon);
        const sortedByDistance = allStops
            .map(s => ({ stop: s, d: this.haversine(userLat, userLon, parseFloat(s.stop_lat), parseFloat(s.stop_lon)) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, maxStops);
        console.debug('[Nearest] found stops:', sortedByDistance.map(x => ({ id: x.stop.stop_id, d: Math.round(x.d) })));

        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager) return;

        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();

        sortedByDistance.forEach(({ stop, d }) => {
            const markerId = mapManager.addNearestStopMarker(
                parseFloat(stop.stop_lat),
                parseFloat(stop.stop_lon),
                stop,
                d
            );
            console.debug('[Nearest] marker added:', markerId, stop.stop_id);
            this.nearestStopsMarkers.push(markerId);

            const routeIds = stopToRoutes[stop.stop_id] ? Array.from(stopToRoutes[stop.stop_id]) : [];
            const badges = routeIds.map(rid => {
                const r = routes.find(rt => rt.route_id === rid);
                if (!r) return '';
                const color = r.route_color ? ('#' + r.route_color) : '#6c757d';
                return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:pointer;font-weight:bold;font-size:0.8em;padding:4px 8px;" data-routeid="${r.route_id}">${r.route_short_name}</span>`;
            }).join('');

            const distText = d < 1000 ? Math.round(d) + ' m' : (d/1000).toFixed(2) + ' km';
            const html = `
                <div class='stop-popup plus-jakarta-sans' style='min-width: 220px; max-width: 280px; padding: 10px 12px;'>
                    <div style='color:#333;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:6px;'>
                        <div style='font-size:14px;font-weight:600;'>${stop.stop_name}</div>
                    </div>
                    <div style='font-size:11px;color:#666;margin-bottom:6px;'>Jarak: ${distText}</div>
                    ${badges ? `<div><div style='font-size:11px;color:#666;margin-bottom:6px;'>Layanan:</div><div class='nearest-services' style='display:flex;flex-wrap:wrap;gap:4px;'>${badges}</div></div>` : ''}
                </div>`;

            const pop = mapManager.showHtmlPopupAt(parseFloat(stop.stop_lon), parseFloat(stop.stop_lat), html);

            setTimeout(() => {
                const el = pop && pop.getElement && pop.getElement();
                if (!el) return;
                el.querySelectorAll('.badge-koridor-interaktif').forEach(badge => {
                    const handler = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const rid = badge.getAttribute('data-routeid');
                        console.debug('[Nearest] service badge clicked:', rid, 'at stop', stop.stop_id);
                        this.selectedRouteIdForUser = rid;
                        this.selectedCurrentStopForUser = stop;
                        if (this.userMarker && this.lastUserPos) {
                            this.showUserRouteInfo(this.lastUserPos.lat, this.lastUserPos.lon, stop, rid);
                        }
                        window.transJakartaApp.modules.routes.selectRoute(rid);
                    };
                    badge.addEventListener('click', handler);
                    badge.addEventListener('touchstart', handler, { passive: false });
                });
            }, 50);
        });
    }

    // Clear nearest stops markers
    clearNearestStopsMarkers() {
        this.nearestStopsMarkers.forEach(marker => {
            const mapManager = window.transJakartaApp.modules.map;
            if (mapManager) {
                mapManager.removeMarker(marker);
            }
        });
        this.nearestStopsMarkers = [];
    }

    // Update live location button
    updateLiveLocationButton(active) {
        const btn = document.getElementById('liveLocationBtn');
        if (!btn) return;

        if (active) {
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-primary');
            btn.setAttribute('data-active', 'on');
            btn.innerHTML = '<span id="liveLocationIcon" class="bi bi-geo-alt-fill"></span> Live Location: ON';
        } else {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-outline-primary');
            btn.setAttribute('data-active', 'off');
            btn.innerHTML = '<span id="liveLocationIcon" class="bi bi-geo-alt"></span> Live Location: OFF';
        }
    }

    // Show nearest stops button
    showNearestStopsButton() {
        const nearestBtn = document.getElementById('nearestStopsBtn');
        if (nearestBtn) nearestBtn.style.display = '';
    }

    // Hide nearest stops button
    hideNearestStopsButton() {
        const nearestBtn = document.getElementById('nearestStopsBtn');
        if (nearestBtn) nearestBtn.style.display = 'none';
    }

    // Haversine distance calculation
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
        this.disableLiveLocation();
        this.selectedRouteIdForUser = null;
        this.selectedCurrentStopForUser = null;
        this.currentStopId = null;
        this.lastArrivedStopId = null;
    }

    // Activate live service from a given stop and route
    activateLiveServiceFromStop(stop, routeId) {
        if (!stop || !routeId) return;
        this.selectedRouteIdForUser = routeId;
        this.selectedCurrentStopForUser = stop;
        if (this.lastUserPos && this.userMarker) {
            this.showUserRouteInfo(this.lastUserPos.lat, this.lastUserPos.lon, stop, routeId);
        }
    }
} 
 