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
        this.lastUserPosSmoothed = null;
        this._prevUserPosSmoothed = null;
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
        this.arrivalStop = null; // halte yang sedang dicapai (untuk pesan arrival)
        this._prevUserPos = null;
        this._uiDebounceTimer = null;
        this._uiDebounceMs = 50;
        this._smoothAlphaBase = 0.25;
        this._suspend = false;
        this._lastNextDist = null;
        this._lastNextStopId = null;
        this._lastUIUpdateTs = 0;
        this._allowAutoStart = true; // guard agar live tidak auto-nyala setelah dimatikan manual
        this._liveStartTime = null; // track when live tracking started
        this._prevDistForUi = 0; // for smooth UI updates
        this._prevEtaText = ''; // for preventing blink
        this._renderedUserPos = null; // posisi marker yang sedang dirender (untuk animasi)
        
        // Street name reverse geocoding
        this._streetNameCache = new Map();
        this._lastGeocodingRequest = null;
        this._geocodingDebounceMs = 1000; // 1 detik debounce untuk avoid spam API
        this._currentStreetName = null; // Will show "Mencari nama jalan..." initially
        this._lastGeocodedPosition = null;
        this.arrivalCountdownInterval = null;
        this._userAnimReqId = null;
        this._userAnimFrom = null;
        this._userAnimTo = null;
        this._userAnimStart = 0;
        this._userAnimDurationMs = 450;
        this._lastLiveStopForPopup = null;
        // Popup smoothing properties
        this._popupAnimReqId = null;
        this._popupAnimFrom = null;
        this._popupAnimTo = null;
        this._popupAnimStart = 0;
        this._popupAnimDurationMs = 150;
        this._renderedPopupPos = null;
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
        this._allowAutoStart = true;
        this._liveStartTime = Date.now(); // Record when live tracking started
        this.updateLiveLocationButton(true);
        this.showNearestStopsButton();
        this.updateLockButtonVisibility();
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.classList.add('live-has-custom-marker');
        // Seed marker immediately jika bisa (perpanjang timeout agar tidak cepat expired)
        try {
            navigator.geolocation.getCurrentPosition((pos)=>{
                try {
                    const lat = pos.coords.latitude, lon = pos.coords.longitude;
                    this.lastUserPos = { lat, lon };
                    this.lastUserPosSmoothed = { lat, lon };
                    this.updateUserMarker(lat, lon);
                    this._renderedUserPos = { lat, lon };
                } catch(_){}
            }, ()=>{}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 });
        } catch(_){}
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
                // Hide lock button when live layanan off
                const lockBtn = document.getElementById('cameraLockBtn');
                if (lockBtn) lockBtn.style.display = 'none';
                mapManager.setCameraLock(false);
                try { mapManager.clearNextStopLabel(); } catch (e) {}
            }
            this.userMarker = null;
        }
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.classList.remove('live-has-custom-marker');
        // Bersihkan timer arrival
        if (this.arrivalTimer) {
            clearTimeout(this.arrivalTimer);
            this.arrivalTimer = null;
        }
        if (this._uiDebounceTimer) { clearTimeout(this._uiDebounceTimer); this._uiDebounceTimer = null; }
        if (this._userAnimReqId) { try { cancelAnimationFrame(this._userAnimReqId); } catch(e){} this._userAnimReqId = null; }
        this._userAnimFrom = null; this._userAnimTo = null; this._renderedUserPos = null;
        this.lastArrivedStopId = null;
        this.arrivalStop = null;
        
        // Clear countdown interval if active
        if (this.arrivalCountdownInterval) {
            clearInterval(this.arrivalCountdownInterval);
            this.arrivalCountdownInterval = null;
        }
        this.userCentered = false;
        this.isActive = false;
        this._allowAutoStart = false;
        // Clear user position state to avoid stale behavior after OFF
        this.lastUserPos = null;
        this.lastUserPosSmoothed = null;
        this._liveStartTime = null; // Reset live tracking start time
        this._prevUserPos = null;
        this._prevUserPosSmoothed = null;
        this.lastUserTime = null;
        this.lastUserSpeed = null;
        this.updateLiveLocationButton(false);
        this.hideNearestStopsButton();
        this.updateLockButtonVisibility();

        // Remove nearest stops markers
        this.clearNearestStopsMarkers();
    }

    // Suspend/resume heavy UI updates (for fast route switch)
    suspendUpdates(on = true) { this._suspend = !!on; }

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

        // Save previous then current for bearing (raw)
        this._prevUserPos = this.lastUserPos ? { ...this.lastUserPos } : null;
        this.lastUserPos = { lat, lon };
        this.lastUserTime = now;
        this.lastUserSpeed = speed;

        // Update street name info (with debouncing and caching)
        this.updateStreetName(lat, lon);
        
        // Debug log for street name
        console.debug('[Location] Current street name:', this._currentStreetName);

        // Low-pass smoothing for display/camera
        const alpha = typeof speed === 'number' ? Math.min(0.45, Math.max(0.15, this._smoothAlphaBase + speed * 0.1)) : this._smoothAlphaBase;
        const prevSmooth = this.lastUserPosSmoothed ? { ...this.lastUserPosSmoothed } : null;
        if (!this.lastUserPosSmoothed) {
            this.lastUserPosSmoothed = { lat, lon };
        } else {
            this.lastUserPosSmoothed = {
                lat: this.lastUserPosSmoothed.lat * (1 - alpha) + lat * alpha,
                lon: this.lastUserPosSmoothed.lon * (1 - alpha) + lon * alpha,
            };
        }
        this._prevUserPosSmoothed = prevSmooth;

        if (this._suspend) {
            // During suspend, do not update marker/camera/UI to avoid lag
            return;
        }

        // Update user marker with smoothed position
        this.animateUserMarkerTo(this.lastUserPosSmoothed.lat, this.lastUserPosSmoothed.lon);
        
        // CRITICAL: Also update popup position when user moves (if popup is active)
        try {
            const mapManager = window.transJakartaApp.modules.map;
            if (mapManager && mapManager.userPopup && mapManager.userPopup.isOpen()) {
                // Update popup position for both detailed route info and simple "Posisi Anda" popup
                this.animatePopupTo(this.lastUserPosSmoothed.lat, this.lastUserPosSmoothed.lon);
            }
            
            // Update nearest stop distances in real-time if nearest popups are open
            this.updateNearestStopDistances();
            
            // Update blue marker popup distances too
            this.updateBlueMarkerPopupDistances();
            
            // Update live tracking time info without full refresh
            this.updateLiveTimeInfo();
        } catch (e) {
            console.debug('[Location] Error updating popup position:', e);
        }

        // Camera follow if locked + auto-tilt adaptif (avoid oscillation when stopped)
        let cameraLocked = false;
        try {
            const mapManager = window.transJakartaApp.modules.map;
            if (mapManager && mapManager.isCameraLock()) {
                cameraLocked = true;
                // Pitch adaptif berdasarkan kecepatan (m/s) - stabilize when stopped
                const spdVal = (typeof speed === 'number') ? speed : null;
                if (spdVal !== null && spdVal >= 0.3) {
                    let pitch = spdVal < 1.0 ? 45 : 60;
                    const currentPitch = mapManager.getMap()?.getPitch?.() || 0;
                    if (Math.abs(currentPitch - pitch) > 10) {
                        mapManager.getMap().setPitch(pitch);
                    }
                }
                // Skip follow when stopped to prevent bounce
                if (!(spdVal !== null && spdVal < 0.2)) {
                    // Heading dari smoothed previous -> current
                    let headingDeg = NaN;
                    if (this._prevUserPosSmoothed) {
                        const toRad = d => d * Math.PI / 180;
                        const toDeg = r => r * 180 / Math.PI;
                        const y = Math.sin(toRad(this.lastUserPosSmoothed.lon - this._prevUserPosSmoothed.lon)) * Math.cos(toRad(this.lastUserPosSmoothed.lat));
                        const x = Math.cos(toRad(this._prevUserPosSmoothed.lat)) * Math.sin(toRad(this.lastUserPosSmoothed.lat)) - Math.sin(toRad(this._prevUserPosSmoothed.lat)) * Math.cos(toRad(this.lastUserPosSmoothed.lat)) * Math.cos(toRad(this.lastUserPosSmoothed.lon - this._prevUserPosSmoothed.lon));
                        let brng = toDeg(Math.atan2(y, x));
                        headingDeg = (brng + 360) % 360;
                    }
                    mapManager.followUserCamera(this.lastUserPosSmoothed.lat, this.lastUserPosSmoothed.lon, headingDeg);
                }
            }
        } catch (e) {}

        // Jika camera tidak lock, hanya recenter awal sekali
        if (!cameraLocked) {
            this.updateMapView(this.lastUserPosSmoothed.lat, this.lastUserPosSmoothed.lon);
        }

        // Debounced live UI update
        this.scheduleLiveUIUpdate();

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
        if (!this.isActive) return; // do nothing if live is OFF
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
        console.debug('[Live] showUserRouteInfo called:', { stop: currentStop?.stop_id, route: routeId, userPos: { lat: userLat, lon: userLon } });
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => String(t.route_id) === String(routeId));
        console.debug('[Live] trips found for route:', trips.length);
        
        // Resolve currentStop to a cluster member that actually appears in stop_times for this route
        const gtfs = window.transJakartaApp.modules.gtfs;
        const allStops = gtfs.getStops();
        const stopTimesAll = gtfs.getStopTimes();
        const norm = (n) => String(n || '').trim().replace(/\s+/g, ' ');
        const buildKey = (s) => {
            const sid = String(s.stop_id || '');
            if (s.parent_station) return String(s.parent_station);
            if (sid.startsWith('H')) return sid;
            return `NAME:${norm(s.stop_name)}`;
        };
        const currKey = buildKey(currentStop);
        const cluster = allStops.filter(s => buildKey(s) === currKey);
        console.debug('[Live] cluster for stop:', cluster.length, 'stops');
        const routeTripIds = new Set(trips.map(t => String(t.trip_id)));
        const byTrip = new Map();
        stopTimesAll.forEach(st => { const tid = String(st.trip_id); if (routeTripIds.has(tid)) { if (!byTrip.has(tid)) byTrip.set(tid, []); byTrip.get(tid).push(st); } });
        const appearsInRoute = (sid) => {
            for (const arr of byTrip.values()) {
                if (arr.some(st => String(st.stop_id) === String(sid))) return true;
            }
            return false;
        };
        let effectiveStop = currentStop;
        // Prefer platform with same platform_code when available
        const currCode = String(currentStop.platform_code || '').trim();
        const preferred = cluster.find(s => currCode && String(s.platform_code || '').trim() === currCode && appearsInRoute(s.stop_id));
        if (preferred) effectiveStop = preferred; else {
            const anyMatch = cluster.find(s => appearsInRoute(s.stop_id));
            if (anyMatch) effectiveStop = anyMatch;
        }
        console.debug('[Live] effective stop resolved:', effectiveStop?.stop_id, 'from original:', currentStop?.stop_id);
        // Keep selection consistent for subsequent updates
        try { if (this.selectedCurrentStopForUser && String(this.selectedCurrentStopForUser.stop_id) !== String(effectiveStop.stop_id)) this.selectedCurrentStopForUser = effectiveStop; } catch(_){}
        
        let nextStop = null;
        let minSeq = Infinity;
        let tripUsed = null;
        let stopTimes = [];

        for (const trip of trips) {
            const stTimes = window.transJakartaApp.modules.gtfs.getStopTimes()
                .filter(st => String(st.trip_id) === String(trip.trip_id))
                .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            
            const idx = stTimes.findIndex(st => String(st.stop_id) === String(effectiveStop.stop_id));
            if (idx !== -1) {
                if (idx < stTimes.length - 1) {
                    const nextSt = stTimes[idx + 1];
                    if (parseInt(nextSt.stop_sequence) < minSeq) {
                        minSeq = parseInt(nextSt.stop_sequence);
                        nextStop = window.transJakartaApp.modules.gtfs.getStops()
                            .find(s => String(s.stop_id) === String(nextSt.stop_id));
                        tripUsed = trip;
                        stopTimes = stTimes;
                    }
                }
            }
        }

        console.debug('[Live] nextStop found:', nextStop?.stop_id, nextStop?.stop_name);

        // If nextStop not found directly, derive by majority across trips of this route
        if (!nextStop) {
            console.debug('[Live] No direct nextStop found, trying fallback method...');
            try {
                const tidSet = new Set(trips.map(t => String(t.trip_id)));
                const byTrip2 = new Map();
                stopTimesAll.forEach(st => { const tid = String(st.trip_id); if (tidSet.has(tid)) { if (!byTrip2.has(tid)) byTrip2.set(tid, []); byTrip2.get(tid).push(st); } });
                const currId = String(effectiveStop.stop_id);
                const counts = new Map();
                const tripByNext = new Map();
                for (const [tid, arr] of byTrip2.entries()) {
                    const sorted = arr.slice().sort((a,b)=>parseInt(a.stop_sequence)-parseInt(b.stop_sequence));
                    const idx = sorted.findIndex(x => String(x.stop_id) === currId);
                    if (idx !== -1 && idx < sorted.length - 1) {
                        const nextId = String(sorted[idx+1].stop_id);
                        counts.set(nextId, (counts.get(nextId) || 0) + 1);
                        if (!tripByNext.has(nextId)) tripByNext.set(nextId, tid);
                    }
                }
                let bestNextId = '';
                let bestCount = -1;
                counts.forEach((c, id) => { if (c > bestCount) { bestCount = c; bestNextId = id; } });
                if (bestNextId) {
                    nextStop = allStops.find(s => String(s.stop_id) === bestNextId) || null;
                    const tid = tripByNext.get(bestNextId);
                    if (tid) {
                        stopTimes = stopTimesAll.filter(st => String(st.trip_id) === tid).sort((a,b)=>parseInt(a.stop_sequence)-parseInt(b.stop_sequence));
                    }
                    console.debug('[Live] Fallback nextStop found:', nextStop?.stop_id, nextStop?.stop_name);
                }
            } catch (e) {
                console.debug('[Live] Fallback method failed:', e);
            }
        }

        console.debug('[Live] Final nextStop:', nextStop?.stop_id, nextStop?.stop_name, 'stopTimes length:', stopTimes.length);

        // Derive 2 upcoming stops after nextStop for breadcrumb
        let upcomingStops = [];
        if (nextStop && stopTimes.length > 0) {
            const idxNext = stopTimes.findIndex(st => String(st.stop_id) === String(nextStop.stop_id));
            const gtfsStops = window.transJakartaApp.modules.gtfs.getStops();
            for (let k = idxNext + 1; k <= idxNext + 2 && k < stopTimes.length; k++) {
                const sid = stopTimes[k].stop_id;
                const sObj = gtfsStops.find(s => String(s.stop_id) === String(sid));
                if (sObj) upcomingStops.push(sObj);
            }
        }

        // Linear referencing progress (advance without 30m)
        try {
            const routes = window.transJakartaApp.modules.routes;
            const linear = routes.getLinearRef && routes.getLinearRef();
            const stopMeasureMap = routes.getStopMeasureById && routes.getStopMeasureById();
            if (linear && stopMeasureMap && nextStop) {
                const poly = linear.poly, cum = linear.cum;
                const pos = this.lastUserPosSmoothed || this.lastUserPos || { lat: userLat, lon: userLon };
                let best = { dist: Infinity, idx: 1, measure: 0 };
                for (let i = 1; i < poly.length; i++) {
                    const pr = this._projectOnSegment(poly, cum, i, pos.lat, pos.lon);
                    if (Math.abs(pr.measure - (best.measure || 0)) > 0 || pr.dist < best.dist) best = pr;
                }
                const userMeasure = best.measure;
                const currMeasure = stopMeasureMap.get(effectiveStop.stop_id) || 0;
                const nextMeasure = stopMeasureMap.get(nextStop.stop_id) || currMeasure + 1;
                const gate = (currMeasure + nextMeasure) / 2;
                const corridorOk = best.minDistToSeg <= 80;
                if (corridorOk && userMeasure > gate) {
                    // Trigger arrival card when passing gate (even if not <30m)
                    if (this.lastArrivedStopId !== nextStop.stop_id) {
                        console.debug('[Location] Triggering arrival via gate logic for:', nextStop.stop_name);
                        this.arrivalStop = nextStop;
                        this.lastArrivedStopId = nextStop.stop_id;
                        if (this.arrivalTimer) { 
                            console.debug('[Location] Clearing existing arrival timer');
                            clearTimeout(this.arrivalTimer); 
                            this.arrivalTimer = null; 
                        }
                        
                        // Mark for next UI update cycle to show arrival state
                        // Don't force update immediately to avoid conflicts
                        console.debug('[Location] Arrival state set - will show in next UI cycle');
                        
                        console.debug('[Location] Setting arrival timer for 8 seconds');
                        
                        // Start countdown display
                        this.startArrivalCountdown();
                        
                        this.arrivalTimer = setTimeout(() => {
                            console.debug('[Location] Arrival timer expired, resetting arrival state');
                            this.lastArrivedStopId = null;
                            this.arrivalStop = null;
                            
                            // Clear countdown interval if active
                            if (this.arrivalCountdownInterval) {
                                clearInterval(this.arrivalCountdownInterval);
                                this.arrivalCountdownInterval = null;
                            }
                            
                            // Force UI refresh after arrival state reset
                            if (this.isActive && this.selectedRouteIdForUser) {
                                const pos = this.lastUserPos || this.lastUserPosSmoothed;
                                if (pos) {
                                    // Small delay for smooth transition
                                    setTimeout(() => {
                                        this.showUserRouteInfo(pos.lat, pos.lon, this.selectedCurrentStopForUser, this.selectedRouteIdForUser);
                                    }, 100);
                                }
                            }
                        }, 8000); // 8 seconds for 30m threshold
                    }
                    this.currentStopId = nextStop.stop_id;
                    this.selectedCurrentStopForUser = nextStop;
                    try {
                        const mapManager = window.transJakartaApp.modules.map;
                        if (mapManager && typeof mapManager.updatePassedStopsVisual === 'function') {
                            mapManager.updatePassedStopsVisual(userMeasure, stopMeasureMap);
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // ETA & distance trend calculations with improved precision
        let jarakNext = null, etaText = '', trend = '<i class="fa-solid fa-location-dot" style="color: #6b7280;" title="Mengukur jarak"></i>';
        let arrivalTrigger = false;
        if (nextStop) {
            const posSmooth = this.lastUserPosSmoothed || this.lastUserPos || { lat: userLat, lon: userLon };
            jarakNext = this.haversine(posSmooth.lat, posSmooth.lon, parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            // Always run arrival detection with RAW position before throttle
            const rawPos = this.lastUserPos || { lat: userLat, lon: userLon };
            const jarakNextRaw = this.haversine(rawPos.lat, rawPos.lon, parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            // Proper arrival threshold - 30m is reasonable distance to consider "arrived"
            arrivalTrigger = (jarakNextRaw < 30 && this.lastArrivedStopId !== nextStop.stop_id);
            this.handleArrivalDetection(rawPos.lat, rawPos.lon, currentStop, nextStop, jarakNextRaw);
            const nowTs = Date.now();
            
            // Improved distance status with Font Awesome icons
            if (this._lastNextStopId === nextStop.stop_id && this._lastNextDist !== null) {
                const delta = jarakNext - this._lastNextDist;
                if (delta < -2) {
                    trend = '<i class="fa-solid fa-location-arrow" style="color: #10b981;" title="Mendekat ke halte"></i>';
                } else if (delta > 2) {
                    trend = '<i class="fa-solid fa-location-crosshairs" style="color: #ef4444;" title="Menjauh dari halte"></i>';
                } else {
                    trend = '<i class="fa-solid fa-minus" style="color: #64748b;" title="Jarak stabil"></i>';
                }
            } else {
                trend = '<i class="fa-solid fa-location-dot" style="color: #6b7280;" title="Mengukur jarak"></i>';
            }
            this._lastNextDist = jarakNext;
            this._lastNextStopId = nextStop.stop_id;
            
            // Improved ETA calculation with smoothing
            const spd = (typeof this.lastUserSpeed === 'number') ? this.lastUserSpeed : null; // m/s
            if (spd === null || spd <= 0.15) { // slightly higher threshold for "stopped"
                etaText = 'Berhenti';
            } else {
                // Use average speed for more stable ETA
                const avgSpeed = Math.max(0.5, spd); // minimum realistic speed
                const etaSec = Math.max(5, Math.round(jarakNext / avgSpeed)); // minimum 5 seconds ETA
                
                if (etaSec < 60) {
                    etaText = `${Math.round(etaSec/5)*5}s`; // round to nearest 5 seconds
                } else if (etaSec < 3600) {
                    const minutes = Math.floor(etaSec/60);
                    const seconds = Math.round((etaSec%60)/15)*15; // round seconds to nearest 15
                    etaText = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                } else {
                    const hours = Math.floor(etaSec/3600);
                    const minutes = Math.round((etaSec%3600)/60/5)*5; // round minutes to nearest 5
                    etaText = minutes > 0 ? `${hours}j ${minutes}m` : `${hours}j`;
                }
            }
            
            // Improved visual stability: prevent unnecessary blinks
            const dt = nowTs - (this._lastUIUpdateTs || 0);
            const distChange = Math.abs((jarakNext || 0) - (this._prevDistForUi || 0));
            const etaChanged = etaText !== this._prevEtaText;
            const isArrivingActive = !!this.lastArrivedStopId && !!this.arrivalStop;
            
            // Very lenient update conditions to prevent freeze
            // Only skip if truly minimal change within very short time
            if (!arrivalTrigger && !isArrivingActive && distChange < 0.2 && !etaChanged && dt < 200) {
                return; // minimal UI throttling
            }
            
            this._lastUIUpdateTs = nowTs;
            this._prevDistForUi = jarakNext;
            this._prevEtaText = etaText;
        }

        // Update popup content (UI can use smoothed userLat/userLon passed in)
        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => String(r.route_id) === String(routeId));
        
        const popupContent = this.buildUserPopupContent(route, currentStop, nextStop, userLat, userLon, upcomingStops, { etaText, trend, jarakNext });
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager && this.userMarker) {
            // Cache stop for interactions
            this._lastLiveStopForPopup = (this.arrivalStop || nextStop) || currentStop;
            
            // Update both content AND position
            mapManager.updateUserPopup(this.userMarker, popupContent);
            this.animatePopupTo(userLat, userLon); // CRITICAL: Update popup position!
            
            // Bind live popup interactions with small delay for DOM stability
            setTimeout(() => { 
                try { this._bindLivePopupInteractions(); } catch (_) {}
            }, 10);
            
            // Render label halte berikutnya di peta
            try { mapManager.updateNextStopLabel(nextStop); } catch (e) {}
        }
    }

    // Handle arrival detection
    handleArrivalDetection(userLat, userLon, currentStop, nextStop, jarakNext) {
        if (jarakNext < 30 && this.lastArrivedStopId !== nextStop.stop_id) {
            console.debug('[Location] Triggering arrival via distance logic for:', nextStop.stop_name, 'distance:', jarakNext);
            
            // Only set arrival if not already set by gate logic
            if (!this.arrivalStop || this.arrivalStop.stop_id !== nextStop.stop_id) {
                this.arrivalStop = nextStop;
                this.lastArrivedStopId = nextStop.stop_id;
                
                // Clear existing timer
                if (this.arrivalTimer) { 
                    console.debug('[Location] Clearing existing arrival timer (distance-based)');
                    clearTimeout(this.arrivalTimer); 
                }
                
                // Mark for next UI update cycle to show arrival state
                // Don't force update immediately to avoid conflicts  
                console.debug('[Location] Arrival state set (distance-based) - will show in next UI cycle');
                
                console.debug('[Location] Setting arrival timer for 8 seconds (distance-based)');
                
                // Start countdown display
                this.startArrivalCountdown();
                
                this.arrivalTimer = setTimeout(() => {
                    console.debug('[Location] Distance-based arrival timer expired, resetting arrival state');
                    // Set current stop dan reset arrival
                    this.currentStopId = nextStop.stop_id;
                    this.selectedCurrentStopForUser = nextStop;
                    this.lastArrivedStopId = null;
                    this.arrivalStop = null;
                    
                    // Clear countdown interval if active
                    if (this.arrivalCountdownInterval) {
                        clearInterval(this.arrivalCountdownInterval);
                        this.arrivalCountdownInterval = null;
                    }
                    
                    // Refresh popup content with smooth transition
                    if (this.userMarker) {
                        const pos = this.lastUserPos;
                        if (pos) {
                            // Small delay for smooth transition
                            setTimeout(() => {
                                this.showUserRouteInfo(pos.lat, pos.lon, nextStop, this.selectedRouteIdForUser);
                            }, 100);
                        }
                    }
                }, 8000); // 8 seconds for 30m threshold
            }
        }
    }

    // Update user popup content
    updateUserPopupContent(userLat, userLon, currentStop, routeId, nextStop) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager || !this.userMarker) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => String(r.route_id) === String(routeId));
        
        // Calculate live extras for consistency
        const jarakNext = nextStop ? this.haversine(userLat, userLon, 
            parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon)) : 0;
        const liveExtras = { jarakNext };
        
        const popupContent = this.buildUserPopupContent(route, currentStop, nextStop, userLat, userLon, [], liveExtras);
        
        // Update content and position together
        if (mapManager.userPopup) {
            mapManager.userPopup.setHTML(popupContent);
            // ALWAYS update position when content is updated
            this.animatePopupTo(userLat, userLon);
        }
    }

    // Build user popup content
    buildUserPopupContent(route, currentStop, nextStop, userLat, userLon, upcomingStops = [], liveExtras = {}) {
        const badgeColor = route && route.route_color ? ('#' + route.route_color) : '#264697';
        const badgeText = route && route.route_short_name ? route.route_short_name : 'Unknown';
        
        let nextStopInfo = '';
        // Determine display stop and title per arrival state
        const displayStop = (!!this.lastArrivedStopId && !!this.arrivalStop) ? this.arrivalStop : nextStop;
        const titleLabel = (!!this.lastArrivedStopId && !!this.arrivalStop) ? 'Tiba di Halte' : 'Menuju Halte';
        
        // Pre-initialize intermodal info to avoid "before initialization" error
        const intermodalInfo = this.buildIntermodalInfo(displayStop);
        
        // Build other services at this stop (excluding current route)
        const otherServicesInfo = this.buildOtherServicesAtStop(displayStop, route?.route_id);
        if (displayStop) {
            const jarakToCurrentStop = this.haversine(userLat, userLon, 
                parseFloat(displayStop.stop_lat), parseFloat(displayStop.stop_lon));
            // Distance color indicator with better precision
            let distColor = '#64748b';
            if (jarakToCurrentStop < 80) distColor = '#10b981'; else if (jarakToCurrentStop < 200) distColor = '#f59e0b';
            
            // Format distance with better precision
            const formatDistance = (dist) => {
                if (dist < 1000) {
                    return dist < 100 ? `${Math.round(dist)} m` : `${Math.round(dist/5)*5} m`; // round to nearest 5m for >100m
                } else {
                    return `${(dist/1000).toFixed(1)} km`;
                }
            };
            
            // Helper: stop-type icon for BRT/Pengumpan/Platform
            const brtIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/JakIcon_BusBRT.svg/1200px-JakIcon_BusBRT.svg.png';
            const feederIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/JakIcon_Bus_Light.svg/2048px-JakIcon_Bus_Light.svg.png';
            const buildStopTypeIcon = (stopId) => {
                const sid = String(stopId || '');
                if (sid.startsWith('B')) {
                    return `<img src="${feederIconUrl}" alt="Feeder" title="Pengumpan" style="width:14px;height:14px;object-fit:contain;"/>`;
                }
                if (sid.startsWith('G')) {
                    // Show BRT icon for platform in breadcrumbs
                    return `<img src="${brtIconUrl}" alt="BRT" title="BRT" style="width:14px;height:14px;object-fit:contain;"/>`;
                }
                return `<img src="${brtIconUrl}" alt="BRT" title="BRT" style="width:14px;height:14px;object-fit:contain;"/>`;
            };
            // Header icon: always show BRT bus for H/G, feeder bus for B
            const buildHeaderIcon = (stopId) => {
                const sid = String(stopId || '');
                if (sid.startsWith('B')) {
                    return `<img src="${feederIconUrl}" alt="Feeder" title="Pengumpan" style="width:14px;height:14px;object-fit:contain;"/>`;
                }
                return `<img src="${brtIconUrl}" alt="BRT" title="BRT" style="width:14px;height:14px;object-fit:contain;"/>`;
            };
            
            // Layanan di halte berikutnya (badges kecil)
            let nextStopServicesHtml = '';
            try {
                const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
                const routes = window.transJakartaApp.modules.gtfs.getRoutes();
                let ids = stopToRoutes[displayStop.stop_id] ? Array.from(stopToRoutes[displayStop.stop_id]) : [];
                // Sembunyikan layanan yang sama dengan rute aktif
                const currentRouteId = route && route.route_id ? route.route_id : null;
                if (currentRouteId) {
                    ids = ids.filter(rid => String(rid) !== String(currentRouteId));
                }
                const badges = ids.map(rid => {
                    const r = routes.find(rt => String(rt.route_id) === String(rid));
                    if (!r) return '';
                    const color = r.route_color ? ('#' + r.route_color) : '#6c757d';
                    const label = r.route_short_name || r.route_id;
                    return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:default;font-weight:bold;font-size:0.7em;padding:2px 5px;">${label}</span>`;
                }).join('');
                if (badges) {
                    nextStopServicesHtml = `
                        <div style='margin-top:4px;'>
                            <div class='text-muted' style='font-size:0.9em;font-weight:600;margin-bottom:2px;'>Layanan di halte ${isArriving ? 'ini' : 'berikutnya'}</div>
                            <div style='display:flex;flex-wrap:wrap;gap:4px;'>${badges}</div>
                        </div>`;
                }
            } catch (e) {}

            // Accessibility icon for next stop if accessible
            let accessIcon = '';
            // Remove wheelchair text/icon beside title per request (keep minimal)
            accessIcon = '';

            // Breadcrumb 2 halte ke depan
            let breadcrumbHtml = '';
            if (upcomingStops && upcomingStops.length > 0) {
                const chips = upcomingStops.map(s => {
                    const ico = buildStopTypeIcon(s.stop_id);
                    return `<span style='background:#eef2ff;color:#264697;border-radius:999px;padding:4px 10px;font-size:0.85em;font-weight:600;display:inline-flex;align-items:center;gap:6px;'>${ico}<span>${s.stop_name}</span></span>`;
                }).join(' ');
                breadcrumbHtml = `<div style='margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;'>${chips}</div>`;
            }

            // Platform section (for BRT clusters) with route badges per platform
            let platformHtml = '';
            try {
                // Removed in live popup: no Per Platform list here per request
                platformHtml = '';
            } catch (e) {}

            // ETA & Trend from liveExtras with enhanced display
            const etaText = liveExtras.etaText || '';
            const trend = liveExtras.trend || '<i class="fa-solid fa-location-dot" style="color: #6b7280;" title="Mengukur jarak"></i>';
            const jarakNext = liveExtras.jarakNext !== undefined ? liveExtras.jarakNext : 
                this.haversine(userLat, userLon, parseFloat(displayStop.stop_lat), parseFloat(displayStop.stop_lon));
            
            // Simple Speed + ETA row (tanpa emoji aneh)
            const buildSpeedEtaRow = () => {
                const speedMs = (this.lastUserSpeed || 0);
                const speedKmh = speedMs * 3.6;
                const speedTextColor = '#475569';
                const etaTextLocal = liveExtras?.etaText || '';
                const etaColor = '#475569';
                const limitWarn50 = speedKmh > 50 && speedKmh <= 60;
                const limitWarn60 = speedKmh > 60;
                // Card colors (entire box) based on thresholds
                let speedCardBg = '#f8fafc';
                let speedCardBorder = '#e2e8f0';
                if (limitWarn50) {
                    speedCardBg = 'linear-gradient(135deg, #f59e0b1a 0%, #f59e0b0f 100%)';
                    speedCardBorder = '#f59e0b40';
                }
                if (limitWarn60) {
                    speedCardBg = 'linear-gradient(135deg, #dc26261a 0%, #dc26260f 100%)';
                    speedCardBorder = '#dc262640';
                }
                const warnIcon = (limitWarn50 || limitWarn60) ? `<i class=\"fa-solid fa-triangle-exclamation\" style=\"color:${limitWarn60 ? '#dc2626' : '#f59e0b'};font-size:0.9em;\" title=\"Melebihi batas kecepatan\"></i>` : '';
                const etaLabel = etaTextLocal ? `ETA ${etaTextLocal}` : '';
                if (!etaLabel && !speedMs) return '';
                return `
                    <div style='display:flex;gap:6px;margin:4px 0;'>
                        <div style='
                            background:${speedCardBg};border:1px solid ${speedCardBorder};border-radius:8px;padding:6px 8px;flex:1;display:flex;align-items:center;justify-content:center;gap:6px;'>
                            <span style='font-weight:600;color:${speedTextColor};font-size:0.85em;'>${speedKmh.toFixed(1)} km/h</span>
                            ${warnIcon}
                        </div>
                        <div style='
                            background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 8px;flex:1;display:flex;align-items:center;justify-content:center;'>
                            <span style='font-weight:600;color:${etaColor};font-size:0.85em;'>${etaLabel}</span>
                        </div>
                    </div>
                `;
            };
            const speedEtaRow = buildSpeedEtaRow();
            
            // Progress bar calculation (percentage of segment from current stop -> next stop)
            let progressBarHtml = '';
            if (currentStop && nextStop && jarakNext !== undefined) {
                // Segment length based on straight-line distance between current and next stop
                const segmentLengthMeters = this.haversine(
                    parseFloat(currentStop.stop_lat), parseFloat(currentStop.stop_lon),
                    parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon)
                );
                const denom = (Number.isFinite(segmentLengthMeters) && segmentLengthMeters > 50) ? segmentLengthMeters : 500;
                const progress = Math.max(0, Math.min(100, ((denom - jarakNext) / denom) * 100));
                const progressColor = progress > 80 ? '#10b981' : progress > 50 ? '#f59e0b' : '#3b82f6';
                
                progressBarHtml = `
                    <div style='margin: 4px 0;'>
                        <div style='display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;'>
                            <span style='font-size: 0.8em; font-weight: 600; color: #374151;'>Progress</span>
                            <span style='font-size: 0.75em; color: ${progressColor}; font-weight: 600;'>${Math.round(progress)}%</span>
                        </div>
                        <div style='
                            width: 100%;
                            height: 4px;
                            background: #e5e7eb;
                            border-radius: 8px;
                            overflow: hidden;
                            position: relative;
                        '>
                            <div style='
                                width: ${progress}%;
                                height: 100%;
                                background: linear-gradient(90deg, ${progressColor}, ${progressColor}dd);
                                border-radius: 8px;
                                transition: width 0.3s ease;
                                position: relative;
                            '>
                                ${progress > 15 ? `<div style='
                                    position: absolute;
                                    right: 0;
                                    top: 0;
                                    width: 2px;
                                    height: 100%;
                                    background: rgba(255,255,255,0.7);
                                    border-radius: 8px;
                                    animation: pulse 2s infinite;
                                '></div>` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
            
            const trendHtml = trend; // trend is already HTML with Font Awesome
             
            // Check if this is arrival state for enhanced display
            const isArrivingState = (!!this.lastArrivedStopId && !!this.arrivalStop);
            
            if (isArrivingState) {
                // Build platform info for arrival state
                const arrivalPlatformInfo = (() => {
                    if (displayStop.platform_code && displayStop.platform_code.trim()) {
                        return `
                            <div style='display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:8px;'>
                                <i class="fa-solid fa-train-subway" style="color: #059669; font-size: 0.9em;"></i>
                                <span style='font-weight:600;color:#059669;font-size:0.95em;'>Platform ${displayStop.platform_code}</span>
                            </div>
                        `;
                    }
                    return '';
                })();
                
                // Prominent arrival notification layout
                nextStopInfo = `
                    <div style='margin-bottom:6px; text-align: center;'>
                        <div style='
                            font-size:1.1em;
                            font-weight:700;
                            margin-bottom:8px;
                            color:#10b981;
                            background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
                            padding:8px 12px;
                            border-radius:12px;
                            border: 1px solid #10b981;
                            box-shadow: 0 2px 4px rgba(16,185,129,0.2);
                        '>
                            🎉 ${titleLabel}
                        </div>
                        <div style='font-size:1.4em;font-weight:bold;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;line-height:1.2;'>${buildHeaderIcon(displayStop.stop_id)} 
                            <span style='color:#047857;'>${displayStop.stop_name}</span> ${accessIcon}
                        </div>
                        ${arrivalPlatformInfo}
                        <div style='display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;'>
                            <span style='font-weight:600;color:#10b981;font-size:1.0em;background:#dcfce7;padding:4px 8px;border-radius:12px;'>${formatDistance(jarakToCurrentStop)}</span>
                        </div>
                        ${nextStopServicesHtml ? `<div style='margin-top:8px;'>${nextStopServicesHtml}</div>` : ''}
                        ${intermodalInfo ? `<div style='margin-top:8px;'>${intermodalInfo}</div>` : ''}
                        ${otherServicesInfo ? `<div style='margin-top:8px;'>${otherServicesInfo}</div>` : ''}
                        <div style='
                            margin-top:8px;
                            font-size:0.8em;
                            color:#6b7280;
                            opacity:0.8;
                        '>
                            Otomatis berlanjut dalam <span id="arrival-countdown" style="font-weight:600;color:#10b981;">8</span> detik
                        </div>
                    </div>
                `;
            } else {
                // Normal journey layout
                nextStopInfo = `
                    <div style='margin-bottom:4px;'>
                        <div class='text-muted' style='font-size:0.85em;font-weight:600;margin-bottom:2px;'>${titleLabel}</div>
                        <div style='font-size:1.0em;font-weight:bold;display:flex;align-items:center;gap:5px;margin-bottom:3px;'>${buildHeaderIcon(displayStop.stop_id)} <span>${displayStop.stop_name}</span> ${accessIcon}</div>
                        <div style='margin-bottom:3px;display:flex;align-items:center;gap:6px;'>
                            <span style='font-weight:600;color:${distColor};font-size:0.9em;'>${formatDistance(jarakToCurrentStop)}</span>
                            ${trendHtml}
                        </div>
                        ${speedEtaRow}
                        ${progressBarHtml}
                        ${nextStopServicesHtml ? `<div style='margin-top:4px;'>${nextStopServicesHtml}</div>` : ''}
                        ${otherServicesInfo ? `<div style='margin-top:4px;'>${otherServicesInfo}</div>` : ''}
                        ${breadcrumbHtml ? `<div style='margin-top:3px;'>${breadcrumbHtml}</div>` : ''}
                    </div>
                `;
            }
        }

        const statusIndicator = this.buildStatusIndicator();
        const isArriving = !!this.lastArrivedStopId && !!this.arrivalStop;
        
        // Debug log untuk arrival state
        console.debug('[Location] Building popup - Arrival state:', { 
            isArriving, 
            lastArrivedStopId: this.lastArrivedStopId, 
            arrivalStop: this.arrivalStop?.stop_name 
        });
        
        // Build time and duration info
        const timeInfo = this.buildTimeAndDurationInfo();
        
        // Build weather info (if enabled in settings)
        const weatherInfo = this.buildWeatherInfo();
        
        // Calculate remaining route distance
        const routeDistanceInfo = this.buildRouteDistanceInfo(route, currentStop, nextStop, userLat, userLon);
        
        // Build facility info from GTFS data
        const facilityInfo = this.buildFacilityInfo(currentStop);
        
        // intermodal info already defined above to avoid initialization error
        
        // Build street name info
        const streetNameInfo = this.buildStreetNameInfo();

        // Dynamic styling based on arrival status - solid backgrounds for better readability
        const popupBackground = isArriving ? 
            'background: linear-gradient(135deg, #e6fffa 0%, #ccfdf7 100%);' :
            'background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);';
        const popupBorder = isArriving ? 
            'border: 2px solid #10b981;' : // Thicker border for arrival
            'border: 1px solid #e2e8f0;';
        const popupShadow = isArriving ? 
            'box-shadow: 0 8px 25px rgba(16,185,129,0.35), 0 0 0 2px rgba(16,185,129,0.15);' : // More prominent shadow
            'box-shadow: 0 8px 25px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05);';
            
        // Extra debug to ensure arrival state is working
        if (isArriving) {
            console.debug('[Location] ARRIVAL STATE ACTIVE - Popup should be GREEN!', {
                displayStop: displayStop?.stop_name,
                titleLabel,
                arrivalStop: this.arrivalStop?.stop_name,
                lastArrivedStopId: this.lastArrivedStopId
            });
        }

        return `
            <div class='plus-jakarta-sans popup-card-friendly' style='min-width:250px;max-width:320px;line-height:1.4;${popupBackground}border-radius:16px;${popupShadow}padding:14px 16px 10px 16px;position:relative;${popupBorder}'>
                ${timeInfo}
                
                <!-- Header Section with Route Badge and Description -->
                <div style='display:flex;align-items:center;gap:10px;margin-bottom:10px;'>
                    <span class='badge badge-koridor-interaktif rounded-pill' 
                          style='background:${badgeColor};color:#fff;font-weight:bold;font-size:1.1em;padding:0.4em 0.9em;box-shadow:0 2px 6px ${badgeColor}40;flex-shrink:0;'>
                        ${badgeText}
                    </span>
                    ${route && route.route_long_name ? `<div style='font-size:0.85em;font-weight:600;color:#475569;line-height:1.3;flex:1;min-width:0;'>${route.route_long_name}</div>` : ''}
                </div>
                
                <!-- Weather & Route Distance Info (hidden during arrival) -->
                ${!isArriving && (weatherInfo || routeDistanceInfo || facilityInfo) ? `<div style='display:flex;gap:6px;margin-bottom:8px;'>${weatherInfo}${routeDistanceInfo}${facilityInfo}</div>` : ''}
                
                <!-- Intermodal Info -->
                ${!isArriving && intermodalInfo ? `<div style='margin-bottom:8px;'>${intermodalInfo}</div>` : ''}
                
                <!-- Other Services Info sudah ada di dalam nextStopInfo, jadi tidak perlu duplikasi di sini -->
                
                <!-- Street Name Info moved to bottom -->
                ${''}
                
                <!-- Status Indicator removed per request -->
                
                <div id='popup-dinamis-info'>
                    <!-- Next Stop Information -->
                    ${nextStopInfo}
                </div>
                ${!isArriving && streetNameInfo ? `<div style='margin-top:8px;border-top:1px solid #f1f5f9;padding-top:6px;'>${streetNameInfo}</div>` : ''}
                
                <!-- Background Decoration -->
                <div style='position:absolute;bottom:0;right:0;opacity:${isArriving ? '0.08' : '0.04'};font-size:4em;pointer-events:none;'>${isArriving ? '🎉' : '🚌'}</div>
            </div>
        `;
    }

    // Build time and duration info
    buildTimeAndDurationInfo() {
        const now = new Date();
        
        // Format current time without seconds to prevent blinking
        const currentTime = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: false 
        });
        
        // Calculate duration since live tracking started
        let durationText = '';
        if (this._liveStartTime) {
            const durationMs = Date.now() - this._liveStartTime;
            const durationSeconds = Math.floor(durationMs / 1000);
            
            if (durationSeconds < 60) {
                durationText = `${durationSeconds}s`;
            } else if (durationSeconds < 3600) {
                const minutes = Math.floor(durationSeconds / 60);
                const seconds = durationSeconds % 60;
                durationText = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
            } else {
                const hours = Math.floor(durationSeconds / 3600);
                const remainingMinutes = Math.floor((durationSeconds % 3600) / 60);
                durationText = remainingMinutes > 0 ? `${hours}j ${remainingMinutes}m` : `${hours}j`;
            }
        }
        
        if (durationText) {
            return `
                <div style='
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: linear-gradient(135deg, #dbeafe 0%, #dcfce7 100%);
                    border: 1px solid #bfdbfe;
                    border-radius: 10px;
                    padding: 6px 10px;
                    margin-bottom: 8px;
                    font-size: 0.8em;
                '>
                    <div style='display: flex; align-items: center; gap: 5px; color: #1f2937; font-weight: 600;'>
                        <i class="fa-solid fa-clock" style="color: #3b82f6; font-size: 10px;"></i>
                        <span class="live-current-time">${currentTime}</span>
                    </div>
                    <div style='display: flex; align-items: center; gap: 5px; color: #059669; font-weight: 600;'>
                        <i class="fa-solid fa-stopwatch" style="color: #10b981; font-size: 10px;"></i>
                        <span class="live-duration">${durationText}</span>
                    </div>
                </div>
            `;
        }
        
        return '';
    }

    // Build weather info (integrated with settings)
    buildWeatherInfo() {
        try {
            // Check if weather is enabled in settings
            const app = window.transJakartaApp;
            if (!app || !app.modules || !app.modules.settings) return '';
            if (!app.modules.settings.isEnabled('showWeatherInfo')) return '';
            
            // Get weather data from localStorage (updated by weather.js)
            const cachedWeather = localStorage.getItem('weatherData');
            if (!cachedWeather) return '';
            
            const weatherData = JSON.parse(cachedWeather);
            if (!weatherData.data || !weatherData.data.weather) return '';
            
            const weather = weatherData.data.weather[0];
            const temp = Math.round(weatherData.data.main.temp);
            const windSpeed = weatherData.data.wind.speed;
            const humidity = weatherData.data.main.humidity;
            
            // Weather icons from weather.js
            const weatherIcons = {
                '01d': '☀️', '01n': '🌙', '02d': '⛅', '02n': '☁️',
                '03d': '☁️', '03n': '☁️', '04d': '☁️', '04n': '☁️',
                '09d': '🌧️', '09n': '🌧️', '10d': '🌦️', '10n': '🌧️',
                '11d': '⛈️', '11n': '⛈️', '13d': '🌨️', '13n': '🌨️',
                '50d': '🌫️', '50n': '🌫️'
            };
            
            const icon = weatherIcons[weather.icon] || '🌤️';
            
            // Weather alert logic
            let alertClass = '';
            let alertText = '';
            if (weather.id >= 200 && weather.id < 300) { // Thunderstorm
                alertClass = 'weather-alert-danger';
                alertText = 'Badai petir! Hindari area terbuka';
            } else if (weather.id >= 500 && weather.id < 600) { // Rain
                alertClass = 'weather-alert-warning';
                alertText = 'Hujan turun, siapkan payung';
            } else if (windSpeed > 8) { // Strong wind
                alertClass = 'weather-alert-warning';
                alertText = 'Angin kencang, hati-hati';
            } else if (temp > 35) { // Very hot
                alertClass = 'weather-alert-warning';
                alertText = 'Cuaca sangat panas';
            }
            
            return `
                <div style='
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border: 1px solid #bae6fd;
                    border-radius: 8px;
                    padding: 4px 8px;
                    font-size: 0.75em;
                    font-weight: 600;
                    color: #0369a1;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex: 1;
                    min-width: 0;
                    ${alertClass ? 'position: relative;' : ''}
                ' class='weather-info-live' title='Kelembaban: ${humidity}% • Angin: ${windSpeed} m/s${alertText ? ' • ' + alertText : ''}'>
                    <span style='font-size: 1.1em;'>${icon}</span>
                    <span style='white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>${temp}°C</span>
                    ${alertClass ? `<i class="fa-solid fa-exclamation-triangle" style="color: #dc2626; font-size: 0.8em; margin-left: 2px;" title="${alertText}"></i>` : ''}
                </div>
            `;
        } catch (e) {
            console.debug('[Weather] Error building weather info:', e);
            return '';
        }
    }

    // Build remaining route distance info
    buildRouteDistanceInfo(route, currentStop, nextStop, userLat, userLon) {
        try {
            if (!route || !nextStop || !this.selectedRouteIdForUser) return '';
            
            // Get trip data for current route
            const gtfs = window.transJakartaApp.modules.gtfs;
            if (!gtfs) return '';
            
            const trips = gtfs.getTrips().filter(t => String(t.route_id) === String(this.selectedRouteIdForUser));
            if (trips.length === 0) return '';
            
            // Find current position in trip sequence
            const trip = trips[0]; // Use first trip as reference
            const stopTimes = gtfs.getStopTimes().filter(st => String(st.trip_id) === String(trip.trip_id));
            stopTimes.sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
            
            const currentStopIndex = stopTimes.findIndex(st => String(st.stop_id) === String(nextStop.stop_id));
            if (currentStopIndex === -1) return '';
            
            // Calculate remaining stops
            const remainingStops = stopTimes.length - currentStopIndex - 1;
            
            // Estimate remaining distance (rough calculation)
            let remainingDistance = 0;
            try {
                // Average distance between stops in Jakarta: ~800m
                const avgDistancePerStop = 800;
                remainingDistance = remainingStops * avgDistancePerStop;
                
                // Add distance to next stop
                const distanceToNextStop = this.haversine(
                    userLat, userLon,
                    parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon)
                );
                remainingDistance += distanceToNextStop;
            } catch (e) {
                // Fallback calculation
                remainingDistance = remainingStops * 800;
            }
            
            // Format distance
            const distanceText = remainingDistance < 1000 ? 
                `${Math.round(remainingDistance)}m` : 
                `${(remainingDistance/1000).toFixed(1)}km`;
            
            // Calculate percentage progress
            const totalStops = stopTimes.length;
            const completedStops = currentStopIndex + 1;
            const progressPercent = Math.round((completedStops / totalStops) * 100);
            
            return `
                <div style='
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 1px solid #f59e0b;
                    border-radius: 8px;
                    padding: 4px 8px;
                    font-size: 0.75em;
                    font-weight: 600;
                    color: #92400e;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex: 1;
                    min-width: 0;
                ' class='route-distance-live' title='Sisa ${remainingStops} halte • Progress ${progressPercent}%'>
                    <i class="fa-solid fa-route" style="font-size: 0.8em;"></i>
                    <span style='white-space: nowrap; overflow: hidden; text-overflow: ellipsis;'>${distanceText}</span>
                    <span style='font-size: 0.9em; opacity: 0.8;'>${progressPercent}%</span>
                </div>
            `;
        } catch (e) {
            console.debug('[Route] Error building route distance info:', e);
            return '';
        }
    }

    // Build facility info from GTFS data
    buildFacilityInfo(currentStop) {
        try {
            if (!currentStop) return '';
            
            const facilityItems = [];
            
            // Remove explicit wheelchair text (keep UI simple)
            
            // Location type info (keep minimal)
            if (currentStop.location_type === '1' || currentStop.location_type === 1) {
                facilityItems.push(`
                    <span style='color: #3b82f6; font-weight: 600; display: flex; align-items: center; gap: 3px;'>
                        <i class="fa-solid fa-building" style="font-size: 0.9em;"></i>
                        <span>Stasiun</span>
                    </span>
                `);
            } else if (currentStop.location_type === '2' || currentStop.location_type === 2) {
                facilityItems.push(`
                    <span style='color: #6b7280; font-weight: 600; display: flex; align-items: center; gap: 3px;'>
                        <i class="fa-solid fa-door-open" style="font-size: 0.9em;"></i>
                        <span>Akses</span>
                    </span>
                `);
            }
            
            // Platform code only (as requested)
            if (currentStop.platform_code && currentStop.platform_code.trim()) {
                facilityItems.push(`
                    <span style='color: #7c3aed; font-weight: 600; display: flex; align-items: center; gap: 3px;'>
                        <i class="fa-solid fa-train-subway" style="font-size: 0.9em;"></i>
                        <span>Platform ${currentStop.platform_code}</span>
                    </span>
                `);
            }
            
            if (facilityItems.length === 0) return '';
            
            return `
                <div style='
                    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                    border: 1px solid #0ea5e9;
                    border-radius: 8px;
                    padding: 4px 8px;
                    font-size: 0.75em;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    min-width: 0;
                    max-width: fit-content;
                ' class='facility-info-live' title='Informasi fasilitas halte'>
                    <i class="fa-solid fa-info-circle" style="color: #0284c7; font-size: 0.8em; flex-shrink: 0;"></i>
                    <div style='display: flex; gap: 6px; align-items: center; flex-wrap: wrap; min-width: 0;'>
                        ${facilityItems.join('')}
                    </div>
                </div>
            `;
        } catch (e) {
            console.debug('[Facility] Error building facility info:', e);
            return '';
        }
    }

    // Build intermodal info from stop data
    buildIntermodalInfo(stop) {
        try {
            if (!stop || !stop.stop_name) return '';
            
            // Get intermodal mapping from route manager
            let stationInfo = {};
            try {
                const routeManager = window.transJakartaApp?.modules?.routes;
                if (routeManager && routeManager._intermodalByStopKey) {
                    const mapping = routeManager._intermodalByStopKey;
                    stationInfo = mapping[stop.stop_id] || mapping[stop.stop_name] || {};
                }
            } catch (e) {
                console.debug('[Intermodal] Route manager not available, trying direct mapping');
            }
            
            // Fallback: direct mapping check  
            if (Object.keys(stationInfo).length === 0 && window.transJakartaApp?.intermodalMapping) {
                const mapping = window.transJakartaApp.intermodalMapping;
                stationInfo = mapping[stop.stop_id] || mapping[stop.stop_name] || {};
            }
            
            if (Object.keys(stationInfo).length === 0) return '';
            
            // Build service badges with actual intermodal images and station names
            const iconUrlMap = {
                'MRT': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-mrt-icon-w-mePn2LwZXQCglMGN-768x768.png',
                'LRT': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-lrt-icon-w-AQEpaJBkWOcwoNrr-768x768.png',
                'KRL': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-krl-icon-w-YBg4WpGk8phW4kOL-768x768.png'
            };
            
            const serviceBadges = Object.keys(stationInfo).map(service => {
                const key = String(service).toUpperCase();
                const url = iconUrlMap[key];
                const stationName = stationInfo[key] || `St. ${key}`;
                if (!url) return '';
                
                return `
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        background: rgba(255,255,255,0.8);
                        border: 1px solid rgba(0,0,0,0.1);
                        border-radius: 12px;
                        padding: 3px 6px;
                        margin: 1px;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    " title="${key} - ${stationName}">
                        <img class="intermodal-icon-img ${key.toLowerCase()}" 
                             src="${url}" 
                             alt="${key}" 
                             style="
                                width: 16px;
                                height: 16px;
                                border-radius: 50%;
                                object-fit: cover;
                                flex-shrink: 0;
                             "/>
                        <span style="
                            font-size: 0.7em;
                            font-weight: 600;
                            color: #374151;
                            white-space: nowrap;
                            max-width: 80px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        ">${stationName}</span>
                    </div>
                `;
            }).filter(badge => badge !== '').join('');
            
            return `
                <div style='
                    background: linear-gradient(135deg, #fef7ff 0%, #f3e8ff 100%);
                    border: 1px solid #c084fc;
                    border-radius: 8px;
                    padding: 6px 10px;
                    font-size: 0.8em;
                    text-align: center;
                ' class='intermodal-info-live'>
                    <div style='display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 4px;'>
                        <i class="fa-solid fa-route" style="color: #7c3aed; font-size: 0.9em;"></i>
                        <span style='font-weight: 600; color: #6b21a8;'>Terintegrasi</span>
                    </div>
                    <div style='display: flex; gap: 3px; align-items: center; justify-content: center; flex-wrap: wrap; max-width: 100%;'>
                        ${serviceBadges}
                    </div>
                </div>
            `;
        } catch (e) {
            console.debug('[Intermodal] Error building intermodal info:', e);
            return '';
        }
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


    // Build interactive status indicator
    buildStatusIndicator() {
        if (!this.lastUserSpeed && this.lastUserSpeed !== 0) return '';
        
        const speedKmh = (this.lastUserSpeed || 0) * 3.6;
        let status, statusColor, statusIcon, statusText, pulseAnimation = '';
        
        // Determine status based on speed and other factors
        if (speedKmh < 0.5) {
            status = 'stopped';
            statusColor = '#ef4444';
            statusIcon = '';
            statusText = 'Berhenti';
        } else if (speedKmh < 3) {
            status = 'slow';
            statusColor = '#f59e0b';
            statusIcon = '';
            statusText = 'Pelan';
        } else if (speedKmh < 15) {
            status = 'moving';
            statusColor = '#10b981';
            statusIcon = '';
            statusText = 'Berjalan';
            pulseAnimation = '';
        } else if (speedKmh < 40) {
            status = 'fast';
            statusColor = '#3b82f6';
            statusIcon = '';
            statusText = 'Naik Bus';
            pulseAnimation = '';
        } else {
            status = 'very-fast';
            statusColor = '#8b5cf6';
            statusIcon = '';
            statusText = 'Kendaraan Cepat';
            pulseAnimation = '';
        }
        
        // Add arrival status override
        if (this.lastArrivedStopId) {
            status = 'arrived';
            statusColor = '#10b981';
            statusIcon = '';
            statusText = 'Tiba di Halte';
            pulseAnimation = '';
        }
        
        // TransJakarta speed limit warning (50 km/h)
        let speedWarning = '';
        if (speedKmh > 50 && speedKmh <= 60) {
            // Warn (kuning) 50-60
            statusColor = '#f59e0b';
        } else if (speedKmh > 60) {
            // Danger (merah) >60
            statusColor = '#dc2626';
        }
        
        // Create solid status background based on color
        const statusBackground = statusColor === '#ef4444' ? '#fee2e2' :  // red
                                statusColor === '#dc2626' ? '#fee2e2' :  // dark red (speed warning)
                                statusColor === '#f59e0b' ? '#fef3c7' :  // orange  
                                statusColor === '#10b981' ? '#dcfce7' :  // green
                                statusColor === '#3b82f6' ? '#dbeafe' :  // blue
                                statusColor === '#8b5cf6' ? '#ede9fe' :  // purple
                                '#f1f5f9';  // default gray
        const statusBorder = statusColor === '#ef4444' ? '#fecaca' :
                           statusColor === '#dc2626' ? '#fecaca' :  // dark red (speed warning)
                           statusColor === '#f59e0b' ? '#fde68a' :
                           statusColor === '#10b981' ? '#bbf7d0' :
                           statusColor === '#3b82f6' ? '#bfdbfe' :
                           statusColor === '#8b5cf6' ? '#ddd6fe' :
                           '#e2e8f0';
        const pulseBg = statusColor === '#ef4444' ? '#fecaca' :
                       statusColor === '#dc2626' ? '#fecaca' :  // dark red (speed warning)
                       statusColor === '#f59e0b' ? '#fde68a' :
                       statusColor === '#10b981' ? '#bbf7d0' :
                       statusColor === '#3b82f6' ? '#bfdbfe' :
                       statusColor === '#8b5cf6' ? '#ddd6fe' :
                       '#e2e8f0';

        return `
            <div style='
                background: ${statusBackground};
                border: 1px solid ${statusBorder};
                border-radius: 10px;
                padding: 6px 10px;
                margin: 4px 0;
                display: flex;
                align-items: center;
                gap: 8px;
                position: relative;
                overflow: hidden;
            '>
                <div style='flex: 1;'>
                    <span style='
                        font-weight: 600;
                        font-size: 0.85em;
                        color: ${statusColor};
                    '>${statusText}</span>
                    <span style='
                        font-size: 0.75em;
                        color: #64748b;
                        font-weight: 500;
                        margin-left: 6px;
                    '>${speedKmh.toFixed(1)} km/h${speedWarning}</span>
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
        // If live active but no position yet; mark pending
        if (this.isActive) {
            console.debug('[Nearest] active but no lastUserPos yet, pending');
            this._pendingNearest = true;
            this._pendingNearestMax = maxStops;
            return;
        }
        // Live OFF: respect manual OFF; avoid auto-start unless allowed
        if (this.canAutoStartLive && this.canAutoStartLive()) {
            console.debug('[Nearest] location inactive, auto-start allowed; enabling and marking pending');
        this._pendingNearest = true;
        this._pendingNearestMax = maxStops;
            this.enableLiveLocation();
            return;
        }
        // Live OFF and auto-start not allowed: use one-shot geolocation without enabling watch
        console.debug('[Nearest] live OFF and auto-start not allowed; using one-shot geolocation');
        try {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    try {
                        const lat = pos.coords.latitude;
                        const lon = pos.coords.longitude;
                        this.showMultipleNearestStops(lat, lon, maxStops);
                    } catch (e) { console.debug('[Nearest] one-shot success but handler failed:', e); }
                },
                (err) => { console.debug('[Nearest] one-shot geolocation failed:', err); },
                { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
            );
        } catch (e) {
            console.debug('[Nearest] one-shot geolocation error:', e);
        }
    }

    // Show multiple nearest stops
    showMultipleNearestStops(userLat, userLon, maxStops = 6) {
        console.debug('[Nearest] showMultipleNearestStops lat/lon/max:', userLat, userLon, maxStops);
        const stopManager = window.transJakartaApp.modules.stops;
        if (!stopManager) return;
        // Ensure lock button is hidden until a service is explicitly chosen
        this.updateLockButtonVisibility();

        // Clear previous markers
        this.clearNearestStopsMarkers();

        const allStops = window.transJakartaApp.modules.gtfs.getStops().filter(s => s.stop_lat && s.stop_lon);
        const sortedByDistance = allStops
            .filter(s => { const id = String(s.stop_id||''); return !(id.startsWith('G') || id.startsWith('E')); })
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
            // Build enhanced service cards similar to showStopPopup
            const gtfs = window.transJakartaApp.modules.gtfs;
            const serviceCards = routeIds.map(rid => {
                const r = routes.find(rt => String(rt.route_id) === String(rid));
                if (!r) return '';
                const color = r.route_color ? `#${r.route_color}` : '#6c757d';
                const routeName = r.route_short_name || r.route_id;
                const direction = r.route_long_name || '';
                
                // Get next stop for this route from this stop
                let nextStopName = '';
                try {
                    if (gtfs && gtfs.calculateNextStopForRoute) {
                        nextStopName = gtfs.calculateNextStopForRoute(stop.stop_id, r.route_id) || '';
                    }
                } catch (e) {
                    console.log('Error getting next stop for nearest:', e);
                }
                
                return `
                    <div class="route-service-item badge-koridor-interaktif nearest-service-card" style="
                        background: linear-gradient(135deg, ${color}15 0%, ${color}08 100%);
                        border: 1px solid ${color}30;
                        border-radius: 12px;
                        padding: 12px 16px;
                        margin-bottom: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                        width: 100%;
                        box-sizing: border-box;
                        overflow: hidden;
                        position: relative;
                    " data-routeid="${r.route_id}"
                       onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'"
                       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'">
                        <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; min-width: 0;">
                            <!-- Route header -->
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span class="route-badge" style="
                                    background: ${color};
                                    color: white;
                                    padding: 4px 10px;
                                    border-radius: 20px;
                                    font-weight: bold;
                                    font-size: 0.85em;
                                    box-shadow: 0 2px 4px ${color}40;
                                    flex-shrink: 0;
                                    white-space: nowrap;
                                ">${routeName}</span>
                                ${nextStopName ? `<div style="
                                    display: flex;
                                    align-items: flex-start;
                                    gap: 6px;
                                    flex: 1;
                                    min-width: 0;
                                    margin-top: 2px;
                                ">
                                    <i class="fa-solid fa-arrow-right" style="color: #64748b; font-size: 0.7em; flex-shrink: 0; margin-top: 2px;"></i>
                                    <span class="nearest-next-stop" style="
                                        color: #059669;
                                        font-size: 0.8em;
                                        font-weight: 600;
                                        line-height: 1.5;
                                        padding: 3px 0;
                                        white-space: normal;
                                        word-wrap: break-word;
                                        overflow-wrap: break-word;
                                        display: block;
                                        max-width: 100%;
                                    ">${nextStopName}</span>
                                </div>` : ''}
                            </div>
                            
                            <!-- Route direction -->
                            ${direction ? `<div class="nearest-direction" style="
                                color: #475569;
                                font-size: 0.85em;
                                font-weight: 500;
                                line-height: 1.5;
                                word-wrap: break-word;
                                overflow-wrap: break-word;
                                hyphens: auto;
                                margin-left: 2px;
                                max-width: 100%;
                                white-space: normal;
                                display: block;
                            ">${direction}</div>` : ''}
                    </div>
                    </div>
                `;
            }).filter(card => card !== '').join('');

            // Calculate real-time distance from current user position
            let realDistance = d; // fallback to pre-calculated distance
            let distanceSource = 'perkiraan';
            
            try {
                const currentUserPos = this.lastUserPosSmoothed || this.lastUserPos;
                if (currentUserPos) {
                    realDistance = this.haversine(
                        currentUserPos.lat, 
                        currentUserPos.lon, 
                        parseFloat(stop.stop_lat), 
                        parseFloat(stop.stop_lon)
                    );
                    distanceSource = 'real-time';
                    console.debug(`[Nearest] Real distance to ${stop.stop_name}: ${Math.round(realDistance)}m`);
                }
            } catch (e) {
                console.debug('[Nearest] Error calculating real distance:', e);
            }
            
            const distText = realDistance < 1000 ? 
                `${Math.round(realDistance)} m` : 
                `${(realDistance/1000).toFixed(2)} km`;
            
            // Get weather info for this stop
            const weatherHtml = mapManager.getStopWeatherHtml ? mapManager.getStopWeatherHtml(stop) : '';
            
            const html = `
                <div class="stop-popup plus-jakarta-sans nearest-stop-popup" style="
                    min-width: 300px; 
                    max-width: 420px; 
                    padding: 16px;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08);
                    border: 1px solid rgba(0,0,0,0.06);
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    box-sizing: border-box;
                ">
                    <!-- Header -->
                    <div style="
                        padding-bottom: 12px;
                        border-bottom: 1px solid #e2e8f0;
                        margin-bottom: 16px;
                    ">
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                            margin-bottom: 8px;
                        ">
                            <i class="fa-solid fa-location-dot nearest-header-icon" style="color: #3b82f6; font-size: 16px;"></i>
                            <div style="
                                font-size: 16px;
                                font-weight: 700;
                                color: #1f2937;
                                flex: 1;
                            " class="nearest-stop-name">${stop.stop_name}</div>
                        </div>
                        
                        <!-- Distance info -->
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            font-size: 12px;
                            color: #64748b;
                        ">
                            <i class="fa-solid fa-route" style="font-size: 10px;"></i>
                            <span class="nearest-distance">Jarak: ${distText}</span>
                            ${distanceSource === 'real-time' ? `
                                <span style="
                                    background: linear-gradient(45deg, #10b981, #059669);
                                    color: white;
                                    font-size: 9px;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                    box-shadow: 0 1px 3px rgba(16,185,129,0.3);
                                " class="nearest-real-badge" title="Jarak dihitung secara real-time dari posisi Anda saat ini">
                                    REAL
                                </span>
                            ` : `
                                <span style="
                                    background: #f59e0b;
                                    color: white;
                                    font-size: 9px;
                                    padding: 2px 6px;
                                    border-radius: 8px;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    letter-spacing: 0.5px;
                                    opacity: 0.7;
                                " class="nearest-estimate-badge" title="Jarak perkiraan">
                                    EST
                                </span>
                            `}
                        </div>
                        
                        ${weatherHtml ? `<div style="margin-top: 8px;">${weatherHtml}</div>` : ''}
                    </div>
                    
                    <!-- Services Section -->
                    ${serviceCards ? `
                        <div style="margin-bottom: 16px;">
                            <div class="nearest-services-header" style="
                                font-size: 12px; 
                                color: #64748b; 
                                font-weight: 600; 
                                margin-bottom: 12px;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                            ">
                                <i class="fa-solid fa-route nearest-services-icon" style="color: #8b5cf6;"></i>
                                Layanan Tersedia
                                <span style="
                                    background: #e2e8f0;
                                    color: #475569;
                                    font-size: 10px;
                                    padding: 2px 6px;
                                    border-radius: 10px;
                                    font-weight: 500;
                                " class="nearest-count-badge">${routeIds.length}</span>
                            </div>
                            
                            <div class="services-container nearest-services-container" style="
                                display: flex;
                                flex-direction: column;
                                gap: 4px;
                                width: 100%;
                                box-sizing: border-box;
                            ">
                                ${serviceCards}
                            </div>
                        </div>
                    ` : ''}
                </div>`;

            // Popup removed - user will manually select stops via blue markers
            console.debug('[Nearest] Auto-popup removed - user will select via blue markers');
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
            btn.classList.remove('modern-action-btn', 'primary');
            btn.classList.add('modern-action-btn', 'success');
            btn.setAttribute('data-active', 'on');
            btn.innerHTML = '<iconify-icon icon="mdi:crosshairs-gps"></iconify-icon><span>Lokasi Saya</span>';
        } else {
            btn.classList.remove('modern-action-btn', 'success');
            btn.classList.add('modern-action-btn', 'primary');
            btn.setAttribute('data-active', 'off');
            btn.innerHTML = '<iconify-icon icon="mdi:crosshairs-gps"></iconify-icon><span>Lokasi Saya Nonaktif</span>';
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
        this.arrivalStop = null;
        
        // Clear countdown interval if active
        if (this.arrivalCountdownInterval) {
            clearInterval(this.arrivalCountdownInterval);
            this.arrivalCountdownInterval = null;
        }
    }

    // Jadwalkan update UI popup user dengan debounce
    scheduleLiveUIUpdate() {
        if (!this.selectedRouteIdForUser || !this.selectedCurrentStopForUser) return;
        if (this._uiDebounceTimer) clearTimeout(this._uiDebounceTimer);
        this._uiDebounceTimer = setTimeout(() => {
            const pos = this.lastUserPosSmoothed || this.lastUserPos;
            if (pos) {
                this.showUserRouteInfo(
                    pos.lat,
                    pos.lon,
                    this.selectedCurrentStopForUser,
                    this.selectedRouteIdForUser
                );
            }
        }, this._uiDebounceMs);
    }

    // Activate live service from a given stop and route
    activateLiveServiceFromStop(stop, routeId) {
        if (!stop || !routeId) return;
        console.debug('[Live] activateLiveServiceFromStop called:', stop.stop_id, routeId);
        // Resolve to the most appropriate stop in this cluster for the given route
        let resolved = this.resolveStopForRoute(stop, routeId) || stop;
        console.debug('[Live] resolved stop:', resolved.stop_id);
        this.selectedRouteIdForUser = routeId;
        this.selectedCurrentStopForUser = resolved;
        // Update lock button visibility based on selection state
        this.updateLockButtonVisibility();
        // Trigger UI update when possible
        if (this.lastUserPos && this.userMarker) {
            console.debug('[Live] triggering immediate UI update');
            this.scheduleLiveUIUpdate();
        } else {
            console.debug('[Live] no user position yet, waiting for geolocation');
        }
    }

    _bearingDeg(a, b) {
        const toRad = d => d * Math.PI / 180;
        const toDeg = r => r * 180 / Math.PI;
        const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
        const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
        let brng = toDeg(Math.atan2(y, x));
        return (brng + 360) % 360;
    }

    _projectOnSegment(poly, cum, i, lat, lon) {
        const ax = poly[i - 1].lon, ay = poly[i - 1].lat;
        const bx = poly[i].lon, by = poly[i].lat;
        const px = lon, py = lat;
        const abx = bx - ax, aby = by - ay;
        const apx = px - ax, apy = py - ay;
        const ab2 = abx * abx + aby * aby;
        let t = 0;
        if (ab2 > 0) t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
        const projLat = ay + aby * t;
        const projLon = ax + abx * t;
        const segLen = this.haversine(ay, ax, projLat, projLon);
        const measure = cum[i - 1] + segLen;
        const dToA = this.haversine(py, px, ay, ax);
        const dToB = this.haversine(py, px, by, bx);
        const minDistToSeg = Math.min(dToA, dToB);
        return { t, measure, dist: measure, minDistToSeg };
    }

    canAutoStartLive() { return !!this._allowAutoStart; }
    
    // Update nearest stop distances in real-time
    updateNearestStopDistances() {
        if (!this.lastUserPosSmoothed && !this.lastUserPos) return;
        
        const currentUserPos = this.lastUserPosSmoothed || this.lastUserPos;
        
        // Find all nearest distance elements in active popups
        const distanceElements = document.querySelectorAll('.nearest-distance');
        distanceElements.forEach(distEl => {
            try {
                const popup = distEl.closest('.nearest-stop-popup');
                if (!popup) return;
                
                // Find stop name from popup to identify which stop this is
                const stopNameEl = popup.querySelector('.nearest-stop-name');
                if (!stopNameEl) return;
                
                const stopName = stopNameEl.textContent.trim();
                
                // Find the stop in GTFS data
                const gtfs = window.transJakartaApp.modules.gtfs;
                const stops = gtfs.getStops() || [];
                const stop = stops.find(s => s.stop_name === stopName);
                
                if (!stop || !stop.stop_lat || !stop.stop_lon) return;
                
                // Calculate real-time distance
                const realDistance = this.haversine(
                    currentUserPos.lat,
                    currentUserPos.lon,
                    parseFloat(stop.stop_lat),
                    parseFloat(stop.stop_lon)
                );
                
                // Update distance text
                const newDistText = realDistance < 1000 ? 
                    `${Math.round(realDistance)} m` : 
                    `${(realDistance/1000).toFixed(2)} km`;
                
                distEl.textContent = `Jarak: ${newDistText}`;
                
                // Ensure REAL badge is shown (since this is always real-time update)
                const realBadge = popup.querySelector('.nearest-real-badge');
                const estBadge = popup.querySelector('.nearest-estimate-badge');
                
                if (!realBadge && estBadge) {
                    // Replace EST badge with REAL badge
                    estBadge.outerHTML = `
                        <span style="
                            background: linear-gradient(45deg, #10b981, #059669);
                            color: white;
                            font-size: 9px;
                            padding: 2px 6px;
                            border-radius: 8px;
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                            box-shadow: 0 1px 3px rgba(16,185,129,0.3);
                        " class="nearest-real-badge" title="Jarak dihitung secara real-time dari posisi Anda saat ini">
                            REAL
                        </span>
                    `;
                }
                
                console.debug(`[Nearest] Updated distance to ${stopName}: ${Math.round(realDistance)}m`);
            } catch (e) {
                console.debug('[Nearest] Error updating distance for element:', e);
            }
        });
    }
    
    // Update blue marker popup distances in real-time
    updateBlueMarkerPopupDistances() {
        if (!this.lastUserPosSmoothed && !this.lastUserPos) return;
        
        const currentUserPos = this.lastUserPosSmoothed || this.lastUserPos;
        
        // Find all blue marker popup distance elements
        const distanceElements = document.querySelectorAll('.nearest-popup-distance');
        distanceElements.forEach(distEl => {
            try {
                const popup = distEl.closest('.stop-popup');
                if (!popup) return;
                
                // Get the map manager to find current popup coordinates
                const mapManager = window.transJakartaApp.modules.map;
                if (!mapManager || !mapManager._currentPopup) return;
                
                const popupLngLat = mapManager._currentPopup.getLngLat();
                if (!popupLngLat) return;
                
                // Calculate real-time distance
                const realDistance = this.haversine(
                    currentUserPos.lat,
                    currentUserPos.lon,
                    popupLngLat.lat,
                    popupLngLat.lng
                );
                
                // Update distance text
                const newDistText = realDistance < 1000 ? 
                    `${Math.round(realDistance)} m` : 
                    `${(realDistance/1000).toFixed(2)} km`;
                
                distEl.textContent = `Jarak: ${newDistText}`;
                
                console.debug(`[Location] Updated blue marker popup distance: ${Math.round(realDistance)}m`);
            } catch (e) {
                console.debug('[Location] Error updating blue marker popup distance:', e);
            }
        });
    }
    
    // Update live tracking time info without full popup refresh
    updateLiveTimeInfo() {
        if (!this.isActive || !this._liveStartTime) return;
        
        try {
            // Update current time (only minutes, no seconds to prevent blinking)
            const currentTimeEl = document.querySelector('.live-current-time');
            if (currentTimeEl) {
                const now = new Date();
                const currentTime = now.toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                });
                
                // Only update if minute changed to prevent unnecessary updates
                if (currentTimeEl.textContent !== currentTime) {
                    currentTimeEl.textContent = currentTime;
                }
            }
            
            // Update duration (only update every 5 seconds to prevent too frequent changes)
            const durationEl = document.querySelector('.live-duration');
            if (durationEl) {
                const durationMs = Date.now() - this._liveStartTime;
                const durationSeconds = Math.floor(durationMs / 1000);
                
                // Only update every 5 seconds or when crossing minute/hour boundaries
                const shouldUpdate = (
                    durationSeconds % 5 === 0 || 
                    (durationSeconds > 60 && durationSeconds % 60 === 0) ||
                    (durationSeconds > 3600 && durationSeconds % 3600 === 0)
                );
                
                if (shouldUpdate) {
                    let durationText = '';
                    if (durationSeconds < 60) {
                        durationText = `${Math.floor(durationSeconds/5)*5}s`; // round to nearest 5s
                    } else if (durationSeconds < 3600) {
                        const minutes = Math.floor(durationSeconds / 60);
                        const seconds = durationSeconds % 60;
                        durationText = seconds > 30 ? `${minutes}m ${Math.round(seconds/15)*15}s` : `${minutes}m`;
                    } else {
                        const hours = Math.floor(durationSeconds / 3600);
                        const remainingMinutes = Math.floor((durationSeconds % 3600) / 60);
                        durationText = remainingMinutes > 0 ? `${hours}j ${remainingMinutes}m` : `${hours}j`;
                    }
                    
                    if (durationEl.textContent !== durationText) {
                        durationEl.textContent = durationText;
                    }
                }
            }
        } catch (e) {
            console.debug('[Location] Error updating live time info:', e);
        }
    }

    // Animate popup smoothly to target position
    animatePopupTo(targetLat, targetLon) {
        const mapManager = window.transJakartaApp.modules.map;
        if (!mapManager || !mapManager.userPopup || !this.userMarker) return;
        
        // Get current popup position
        const currentPopupPos = mapManager.userPopup.getLngLat();
        if (!currentPopupPos) {
            // No current position, set directly
            this._renderedPopupPos = { lat: targetLat, lon: targetLon };
            mapManager.userPopup.setLngLat([targetLon, targetLat]);
            return;
        }
        
        if (!this._renderedPopupPos) {
            this._renderedPopupPos = { lat: currentPopupPos.lat, lon: currentPopupPos.lng };
        }
        
        // Calculate distance to determine animation strategy
        const distance = this.haversine(this._renderedPopupPos.lat, this._renderedPopupPos.lon, targetLat, targetLon);
        
        // If jump too large, snap directly
        if (distance > 100) {
            mapManager.userPopup.setLngLat([targetLon, targetLat]);
            this._renderedPopupPos = { lat: targetLat, lon: targetLon };
            return;
        }
        
        // If distance is very small (< 5 meters), snap directly for responsiveness
        if (distance < 5) {
            mapManager.userPopup.setLngLat([targetLon, targetLat]);
            this._renderedPopupPos = { lat: targetLat, lon: targetLon };
            return;
        }
        
        // Start/replace animation
        if (this._popupAnimReqId) { 
            try { cancelAnimationFrame(this._popupAnimReqId); } catch(e){} 
            this._popupAnimReqId = null; 
        }
        
        this._popupAnimFrom = { lat: this._renderedPopupPos.lat, lon: this._renderedPopupPos.lon };
        this._popupAnimTo = { lat: targetLat, lon: targetLon };
        this._popupAnimStart = performance.now();
        
        // Adaptive animation duration based on distance
        const adaptiveDuration = Math.max(80, Math.min(this._popupAnimDurationMs, distance * 3));
        
        const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4); // Faster easing for more responsive feel
        const step = (nowTs) => {
            if (!this.isActive || !mapManager.userPopup) {
                this._popupAnimReqId = null;
                return;
            }
            
            const elapsed = nowTs - this._popupAnimStart;
            const progress = Math.min(elapsed / adaptiveDuration, 1);
            const easedProgress = easeOutQuart(progress);
            
            const lat = this._popupAnimFrom.lat + (this._popupAnimTo.lat - this._popupAnimFrom.lat) * easedProgress;
            const lon = this._popupAnimFrom.lon + (this._popupAnimTo.lon - this._popupAnimFrom.lon) * easedProgress;
            
            mapManager.userPopup.setLngLat([lon, lat]);
            this._renderedPopupPos = { lat, lon };
            
            if (progress < 1) {
                this._popupAnimReqId = requestAnimationFrame(step);
            } else {
                this._popupAnimReqId = null;
            }
        };
        
        this._popupAnimReqId = requestAnimationFrame(step);
    }

    animateUserMarkerTo(targetLat, targetLon) {
        if (!this.isActive) return;
        // Teleport on first draw or if marker not yet created
        if (!this.userMarker) {
            this.updateUserMarker(targetLat, targetLon);
            this._renderedUserPos = { lat: targetLat, lon: targetLon };
            return;
        }
        if (!this._renderedUserPos) {
            this._renderedUserPos = { lat: targetLat, lon: targetLon };
            this.updateUserMarker(targetLat, targetLon);
            return;
        }
        // If jump too large, snap directly
        try {
            const jump = this.haversine(this._renderedUserPos.lat, this._renderedUserPos.lon, targetLat, targetLon);
            if (jump > 150) {
                this.updateUserMarker(targetLat, targetLon);
                this._renderedUserPos = { lat: targetLat, lon: targetLon };
                return;
            }
        } catch (e) {}
        // Start/replace animation
        if (this._userAnimReqId) { try { cancelAnimationFrame(this._userAnimReqId); } catch(e){} this._userAnimReqId = null; }
        this._userAnimFrom = { lat: this._renderedUserPos.lat, lon: this._renderedUserPos.lon };
        this._userAnimTo = { lat: targetLat, lon: targetLon };
        this._userAnimStart = performance.now();
        const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
        const step = (nowTs) => {
            if (!this.isActive) { this._userAnimReqId = null; return; }
            const elapsed = nowTs - this._userAnimStart;
            const t = Math.max(0, Math.min(1, elapsed / this._userAnimDurationMs));
            const k = easeOutCubic(t);
            const lat = this._userAnimFrom.lat + (this._userAnimTo.lat - this._userAnimFrom.lat) * k;
            const lon = this._userAnimFrom.lon + (this._userAnimTo.lon - this._userAnimFrom.lon) * k;
            this.updateUserMarker(lat, lon);
            this._renderedUserPos = { lat, lon };
            if (t < 1) {
                this._userAnimReqId = requestAnimationFrame(step);
            } else {
                this._userAnimReqId = null;
            }
        };
        this._userAnimReqId = requestAnimationFrame(step);
    }

    _bindLivePopupInteractions() {
        try {
            const mapManager = window.transJakartaApp.modules.map;
            const el = mapManager && mapManager.userPopup && mapManager.userPopup.getElement && mapManager.userPopup.getElement();
            if (!el) return;
            const onClick = (e) => {
                try { e.preventDefault(); e.stopPropagation(); } catch(_){}
                const target = e.currentTarget;
                const rid = target && target.getAttribute('data-routeid');
                if (!rid) return;
                // Select route only; live starts via platform popup, not union services in live
                try { window.transJakartaApp.modules.routes.selectRoute(rid); } catch(_){ }
            };
            // No union badge live start; restrict to platform badges if any exist
            el.querySelectorAll('.live-platform-badge').forEach(b => b.addEventListener('click', onClick));
        } catch(_){ }
    }

    // Find the most appropriate stop in this cluster that serves the given route
    resolveStopForRoute(stop, routeId) {
        try {
            if (!stop || !routeId) return stop;
            console.debug('[Live] resolveStopForRoute called:', stop.stop_id, routeId);
            const gtfs = window.transJakartaApp.modules.gtfs;
            const allStops = gtfs.getStops() || [];
            const stopToRoutes = gtfs.getStopToRoutes() || {};
            const norm = (n) => String(n || '').trim().replace(/\s+/g, ' ');
            const buildKey = (s) => {
                const sid = String(s.stop_id || '');
                if (s.parent_station) return String(s.parent_station);
                if (sid.startsWith('H')) return sid;
                return `NAME:${norm(s.stop_name)}`;
            };
            const key = buildKey(stop);
            const cluster = allStops.filter(s => buildKey(s) === key);
            console.debug('[Live] cluster size:', cluster.length, 'for stop:', stop.stop_id);
            
            // Check if original stop serves the route
            const originalRoutes = stopToRoutes[stop.stop_id] || [];
            const originalServesRoute = Array.from(originalRoutes).some(r => String(r) === String(routeId));
            console.debug('[Live] original stop serves route:', originalServesRoute);
            if (originalServesRoute) return stop;
            
            // Prefer a platform (G) that explicitly serves routeId
            const gForRoute = cluster.find(s => String(s.stop_id||'').startsWith('G') && (stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]).map(String).includes(String(routeId)) : false));
            if (gForRoute) {
                console.debug('[Live] found platform serving route:', gForRoute.stop_id);
                return gForRoute;
            }
            // Else choose a non-access stop that serves the route
            const anyForRoute = cluster.find(s => !String(s.stop_id||'').startsWith('E') && (stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]).map(String).includes(String(routeId)) : false));
            if (anyForRoute) {
                console.debug('[Live] found any stop serving route:', anyForRoute.stop_id);
                return anyForRoute;
            }
            // Fallback: return original
            console.debug('[Live] no better stop found, using original:', stop.stop_id);
            return stop;
        } catch (e) {
            console.debug('[Live] resolveStopForRoute error:', e);
            return stop;
        }
    }

    // Centralized control for camera lock button visibility
    updateLockButtonVisibility() {
        try {
            const btn = document.getElementById('cameraLockBtn');
            if (!btn) return;
            const shouldShow = !!(this.isActive && this.selectedRouteIdForUser && this.selectedCurrentStopForUser);
            btn.style.display = shouldShow ? '' : 'none';
            if (!shouldShow) {
                const mapManager = window.transJakartaApp.modules.map;
                if (mapManager) mapManager.setCameraLock(false);
                btn.classList.remove('btn-success');
                btn.classList.add('btn-primary');
                btn.innerHTML = '<iconify-icon icon="mdi:compass" inline></iconify-icon> <span class="d-none d-md-inline">Lock</span>';
            }
        } catch (_) {}
    }

    // Street name reverse geocoding functions
    async reverseGeocode(lat, lon) {
        try {
            console.debug('[Location] Starting reverse geocoding for:', { lat, lon });
            
            // Create cache key with reduced precision to avoid too many unique requests
            const latRounded = Math.round(lat * 10000) / 10000; // 4 decimal places (~11m precision)
            const lonRounded = Math.round(lon * 10000) / 10000;
            const cacheKey = `${latRounded},${lonRounded}`;
            
            console.debug('[Location] Cache key:', cacheKey);
            
            // Check cache first
            if (this._streetNameCache.has(cacheKey)) {
                const cached = this._streetNameCache.get(cacheKey);
                // Cache valid for 1 hour
                if (Date.now() - cached.timestamp < 3600000) {
                    console.debug('[Location] Using cached result:', cached.streetName);
                    return cached.streetName;
                }
                console.debug('[Location] Cache expired, removing entry');
                this._streetNameCache.delete(cacheKey);
            }
            
            // Use OpenStreetMap Nominatim (free, no API key needed)
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latRounded}&lon=${lonRounded}&zoom=18&addressdetails=1`;
            
            console.debug('[Location] Fetching from URL:', url);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'TransJakarta-Web-App/1.0'
                },
                timeout: 5000 // 5 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            let streetName = 'Jalan tidak diketahui';
            
            if (data && data.address) {
                // Priority order: road > pedestrian > path > neighbourhood
                streetName = data.address.road || 
                           data.address.pedestrian || 
                           data.address.path || 
                           data.address.neighbourhood || 
                           data.address.suburb ||
                           data.display_name?.split(',')[0] || 
                           'Jalan tidak diketahui';
                
                // Clean up street name
                streetName = streetName.trim();
                if (streetName.length > 50) {
                    streetName = streetName.substring(0, 47) + '...';
                }
            }
            
            // Cache the result
            this._streetNameCache.set(cacheKey, {
                streetName: streetName,
                timestamp: Date.now()
            });
            
            // Limit cache size (keep last 100 entries)
            if (this._streetNameCache.size > 100) {
                const firstKey = this._streetNameCache.keys().next().value;
                this._streetNameCache.delete(firstKey);
            }
            
            return streetName;
            
        } catch (error) {
            console.debug('[Location] Reverse geocoding failed:', error);
            return 'Jalan tidak diketahui';
        }
    }

    // Update street name with debouncing
    updateStreetName(lat, lon) {
        console.debug('[Location] updateStreetName called:', { lat, lon, currentStreetName: this._currentStreetName });
        
        // Check if position changed significantly (>20m)
        if (this._lastGeocodedPosition) {
            const distance = this.haversine(lat, lon, 
                this._lastGeocodedPosition.lat, this._lastGeocodedPosition.lon);
            console.debug('[Location] Distance from last geocoded position:', distance);
            if (distance < 20) {
                console.debug('[Location] Position unchanged, skipping geocoding');
                return; // Position hasn't changed much, skip geocoding
            }
        }
        
        // Cancel previous request if exists
        if (this._lastGeocodingRequest) {
            console.debug('[Location] Cancelling previous geocoding request');
            clearTimeout(this._lastGeocodingRequest);
        }
        
        console.debug('[Location] Starting geocoding debounce timer...');
        
        // Debounce the geocoding request
        this._lastGeocodingRequest = setTimeout(async () => {
            console.debug('[Location] Executing geocoding request for:', { lat, lon });
            const streetName = await this.reverseGeocode(lat, lon);
            console.debug('[Location] Geocoding result:', streetName);
            this._currentStreetName = streetName;
            this._lastGeocodedPosition = { lat, lon };
            
            // Update popup if currently shown
            if (this.isActive && this.selectedRouteIdForUser) {
                try {
                    console.debug('[Location] Updating popup with new street name');
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager && mapManager.userPopup && mapManager.userPopup.isOpen()) {
                        // Trigger a popup content refresh
                        this.updateUserPopupContent(lat, lon, 
                            this.selectedCurrentStopForUser, 
                            this.selectedRouteIdForUser, 
                            this.getNextStopForRoute(this.selectedRouteIdForUser, this.selectedCurrentStopForUser)
                        );
                    }
                } catch (e) {
                    console.debug('[Location] Street name popup update failed:', e);
                }
            }
        }, this._geocodingDebounceMs);
    }

    // Optional: clear in-memory volatile caches for cache reset
    clearVolatileCaches() {
        try { if (this._streetNameCache && this._streetNameCache.clear) this._streetNameCache.clear(); } catch (e) {}
        try { this._currentStreetName = ''; this._lastGeocodedPosition = null; } catch (e) {}
        try { this.lastUserPos = null; this.lastUserSpeed = null; } catch (e) {}
    }

    // Start arrival countdown display
    startArrivalCountdown() {
        let countdown = 8;
        
        // Clear any existing countdown
        if (this.arrivalCountdownInterval) {
            clearInterval(this.arrivalCountdownInterval);
        }
        
        this.arrivalCountdownInterval = setInterval(() => {
            countdown--;
            const countdownElement = document.getElementById('arrival-countdown');
            if (countdownElement) {
                countdownElement.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(this.arrivalCountdownInterval);
                    this.arrivalCountdownInterval = null;
                }
            } else {
                // Element not found, stop countdown
                clearInterval(this.arrivalCountdownInterval);
                this.arrivalCountdownInterval = null;
            }
        }, 1000);
    }

    // Build other services available at stop
    buildOtherServicesAtStop(stop, currentRouteId) {
        if (!stop) return '';
        
        try {
            const gtfs = window.transJakartaApp.modules.gtfs;
            const stopToRoutes = gtfs.getStopToRoutes();
            const allStops = gtfs.getStops() || [];
            const routesAll = gtfs.getRoutes() || [];
            
            // Build cluster key similar to popup logic
            const normalizeName = (n) => String(n || '').trim().replace(/\s+/g, ' ');
            const buildKey = (s) => {
                const sid = String(s.stop_id || '');
                if (s.parent_station) return String(s.parent_station);
                if (sid.startsWith('H')) return sid;
                return `NAME:${normalizeName(s.stop_name)}`;
            };
            
            const sid = String(stop.stop_id || '');
            let unionRouteIds = [];
            
            if (sid.startsWith('B')) {
                // Feeder: keep this stop's services only
                unionRouteIds = stopToRoutes[sid] ? Array.from(stopToRoutes[sid]) : [];
            } else {
                // BRT/others: union services across cluster (merge platforms)
                try {
                    const key = buildKey(stop);
                    const cluster = allStops.filter(s => buildKey(s) === key);
                    const set = new Set();
                    cluster.forEach(cs => {
                        const cid = String(cs.stop_id || '');
                        // skip access E*
                        if (cid.startsWith('E')) return;
                        const rids = stopToRoutes[cid] ? Array.from(stopToRoutes[cid]) : [];
                        rids.forEach(r => set.add(String(r)));
                    });
                    unionRouteIds = Array.from(set);
                } catch (e) {
                    unionRouteIds = stopToRoutes[sid] ? Array.from(stopToRoutes[sid]) : [];
                }
            }
            
            // Filter out currently selected route
            const others = unionRouteIds.filter(rid => String(rid) !== String(currentRouteId));
            
            if (others.length === 0) return '';
            
            // Build badges HTML
            const badges = others.map(rid => {
                const route = routesAll.find(r => String(r.route_id) === String(rid));
                if (!route) return '';
                const color = route.route_color ? ('#' + route.route_color) : '#6c757d';
                const label = route.route_short_name || route.route_id;
                return `<span class="badge badge-koridor-interaktif rounded-pill" 
                              style="background:${color};color:#fff;font-weight:bold;font-size:0.75em;padding:3px 6px;margin:1px;" 
                              title="${route.route_long_name || ''}">${label}</span>`;
            }).filter(b => b !== '').join('');
            
            if (!badges) return '';
            
            return `
                <div style='
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    border: 1px solid #f59e0b;
                    border-radius: 8px;
                    padding: 6px 10px;
                    margin-top: 6px;
                    font-size: 0.8em;
                ' class='other-services-live'>
                    <div style='display: flex; align-items: center; gap: 6px; margin-bottom: 4px;'>
                        <i class="fa-solid fa-bus" style="color: #d97706; font-size: 0.9em;"></i>
                        <span style='font-weight: 600; color: #92400e; font-size: 0.9em;'>Layanan Lain</span>
                    </div>
                    <div style='display: flex; gap: 3px; align-items: center; flex-wrap: wrap; line-height: 1.4;'>
                        ${badges}
                    </div>
                </div>
            `;
            
        } catch (e) {
            console.debug('[Location] Error building other services:', e);
            return '';
        }
    }

    // Build street name info HTML
    buildStreetNameInfo() {
        // Always show street info section, with different states
        let streetText = '';
        let iconColor = '#64748b';
        let textColor = '#475569';
        
        if (!this._currentStreetName) {
            streetText = 'Mencari nama jalan...';
            iconColor = '#f59e0b';
            textColor = '#92400e';
        } else if (this._currentStreetName === 'Jalan tidak diketahui') {
            streetText = 'Lokasi tidak diketahui';
            iconColor = '#64748b';
            textColor = '#6b7280';
        } else {
            streetText = this._currentStreetName;
            iconColor = '#10b981';
            textColor = '#065f46';
        }
        
        console.debug('[Location] Building street name info:', { streetText, currentStreetName: this._currentStreetName });
        
        return `
            <div style='
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                padding: 6px 10px;
                margin-top: 6px;
                font-size: 0.8em;
                text-align: center;
            ' class='street-name-info'>
                <div style='display: flex; align-items: center; justify-content: center; gap: 6px;'>
                    <i class="fa-solid fa-road" style="color: ${iconColor}; font-size: 0.9em;"></i>
                    <span style='font-weight: 600; color: ${textColor};'>${streetText}</span>
                </div>
            </div>
        `;
    }
    
    // Test function untuk manual testing - arrival state
    testArrivalState() {
        console.log('[Location] Testing arrival state...');
        
        if (!this.selectedCurrentStopForUser || !this.selectedRouteIdForUser) {
            console.log('[Location] No current stop/route selected, cannot test arrival');
            console.log('[Location] Please select a route and start live tracking first!');
            return;
        }
        
        const nextStop = this.getNextStopForRoute(this.selectedRouteIdForUser, this.selectedCurrentStopForUser);
        if (!nextStop) {
            console.log('[Location] No next stop found');
            return;
        }
        
        // Force trigger arrival state
        this.arrivalStop = nextStop;
        this.lastArrivedStopId = nextStop.stop_id;
        
        console.log('[Location] ✅ Forced arrival state for:', nextStop.stop_name);
        console.log('[Location] Arrival state:', { 
            arrivalStop: this.arrivalStop?.stop_name, 
            lastArrivedStopId: this.lastArrivedStopId 
        });
        
        // Force UI update to show green arrival state
        if (this.isActive && this.selectedRouteIdForUser) {
            try {
                const mapManager = window.transJakartaApp.modules.map;
                if (mapManager && mapManager.userPopup && mapManager.userPopup.isOpen()) {
                    const pos = this.lastUserPos || this.lastUserPosSmoothed || { lat: -6.2088, lon: 106.8456 };
                    console.log('[Location] Updating popup content with arrival state...');
                    this.updateUserPopupContent(pos.lat, pos.lon, 
                        this.selectedCurrentStopForUser, 
                        this.selectedRouteIdForUser, 
                        nextStop
                    );
                    console.log('[Location] ✅ Popup should now be GREEN with arrival notification!');
                } else {
                    console.log('[Location] ⚠️ Popup is not open, cannot update UI');
                }
            } catch (e) {
                console.error('[Location] Test arrival popup update failed:', e);
            }
        }
        
        // Start countdown
        this.startArrivalCountdown();
        console.log('[Location] ⏱️ Countdown started (8 seconds)');
        
        // Auto-reset after 8 seconds (matching real timer)
        setTimeout(() => {
            console.log('[Location] ⏰ Auto-resetting arrival state after 8 seconds');
            this.lastArrivedStopId = null;
            this.arrivalStop = null;
            
            // Clear countdown interval if active
            if (this.arrivalCountdownInterval) {
                clearInterval(this.arrivalCountdownInterval);
                this.arrivalCountdownInterval = null;
            }
            
            // Move to next stop
            this.currentStopId = nextStop.stop_id;
            this.selectedCurrentStopForUser = nextStop;
            
            // Refresh popup back to normal state
            if (this.isActive && this.selectedRouteIdForUser) {
                try {
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager && mapManager.userPopup && mapManager.userPopup.isOpen()) {
                        const pos = this.lastUserPos || this.lastUserPosSmoothed || { lat: -6.2088, lon: 106.8456 };
                        console.log('[Location] Resetting popup to normal state...');
                        this.showUserRouteInfo(pos.lat, pos.lon, nextStop, this.selectedRouteIdForUser);
                        console.log('[Location] ✅ Popup reset to normal state');
                    }
                } catch (e) {
                    console.error('[Location] Reset popup update failed:', e);
                }
            }
        }, 8000);
    }

    // Test function to check other services
    testOtherServices() {
        console.log('[Location] Testing other services display...');
        
        if (!this.selectedCurrentStopForUser) {
            console.log('[Location] No current stop selected');
            return;
        }
        
        const otherServices = this.buildOtherServicesAtStop(this.selectedCurrentStopForUser, this.selectedRouteIdForUser);
        console.log('[Location] Other services HTML:', otherServices);
        
        if (otherServices) {
            console.log('[Location] ✅ Other services found and generated');
        } else {
            console.log('[Location] ⚠️ No other services found at this stop');
        }
    }
} 
 