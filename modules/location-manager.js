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
        this._uiDebounceMs = 200;
        this._smoothAlphaBase = 0.25;
        this._suspend = false;
        this._lastNextDist = null;
        this._lastNextStopId = null;
        this._lastUIUpdateTs = 0;
        this._allowAutoStart = true; // guard agar live tidak auto-nyala setelah dimatikan manual
        this._renderedUserPos = null; // posisi marker yang sedang dirender (untuk animasi)
        this._userAnimReqId = null;
        this._userAnimFrom = null;
        this._userAnimTo = null;
        this._userAnimStart = 0;
        this._userAnimDurationMs = 450;
        this._lastLiveStopForPopup = null;
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
        this.updateLiveLocationButton(true);
        this.showNearestStopsButton();
        const mapEl = document.getElementById('map');
        if (mapEl) mapEl.classList.add('live-has-custom-marker');
        // Seed marker immediately if possible
        try {
            navigator.geolocation.getCurrentPosition((pos)=>{
                try {
                    const lat = pos.coords.latitude, lon = pos.coords.longitude;
                    this.lastUserPos = { lat, lon };
                    this.lastUserPosSmoothed = { lat, lon };
                    this.updateUserMarker(lat, lon);
                    this._renderedUserPos = { lat, lon };
                } catch(_){}
            }, ()=>{}, { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 });
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
        this.userCentered = false;
        this.isActive = false;
        this._allowAutoStart = false;
        this.updateLiveLocationButton(false);
        this.hideNearestStopsButton();

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

        // Derive 2 upcoming stops after nextStop for breadcrumb
        let upcomingStops = [];
        if (nextStop && stopTimes.length > 0) {
            const idxNext = stopTimes.findIndex(st => st.stop_id === nextStop.stop_id);
            const gtfsStops = window.transJakartaApp.modules.gtfs.getStops();
            for (let k = idxNext + 1; k <= idxNext + 2 && k < stopTimes.length; k++) {
                const sid = stopTimes[k].stop_id;
                const sObj = gtfsStops.find(s => s.stop_id === sid);
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
                const currMeasure = stopMeasureMap.get(currentStop.stop_id) || 0;
                const nextMeasure = stopMeasureMap.get(nextStop.stop_id) || currMeasure + 1;
                const gate = (currMeasure + nextMeasure) / 2;
                const corridorOk = best.minDistToSeg <= 80;
                if (corridorOk && userMeasure > gate) {
                    // Trigger arrival card when passing gate (even if not <30m)
                    if (this.lastArrivedStopId !== nextStop.stop_id) {
                        this.arrivalStop = nextStop;
                        this.lastArrivedStopId = nextStop.stop_id;
                        if (this.arrivalTimer) { clearTimeout(this.arrivalTimer); this.arrivalTimer = null; }
                        this.arrivalTimer = setTimeout(() => {
                            this.lastArrivedStopId = null;
                            this.arrivalStop = null;
                        }, 10000);
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

        // ETA & distance trend calculations
        let jarakNext = null, etaText = '', trend = '→';
        let arrivalTrigger = false;
        if (nextStop) {
            const posSmooth = this.lastUserPosSmoothed || this.lastUserPos || { lat: userLat, lon: userLon };
            jarakNext = this.haversine(posSmooth.lat, posSmooth.lon, parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            // Always run arrival detection with RAW position before throttle
            const rawPos = this.lastUserPos || { lat: userLat, lon: userLon };
            const jarakNextRaw = this.haversine(rawPos.lat, rawPos.lon, parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
            arrivalTrigger = (jarakNextRaw < 30 && this.lastArrivedStopId !== nextStop.stop_id);
            this.handleArrivalDetection(rawPos.lat, rawPos.lon, currentStop, nextStop, jarakNextRaw);
            const nowTs = Date.now();
            if (this._lastNextStopId === nextStop.stop_id && this._lastNextDist !== null) {
                const delta = jarakNext - this._lastNextDist;
                if (delta < -2) trend = '⬇️'; else if (delta > 2) trend = '⬆️'; else trend = '→';
            }
            this._lastNextDist = jarakNext;
            this._lastNextStopId = nextStop.stop_id;
            // ETA based on speed; if stopped, show 'Berhenti'
            const spd = (typeof this.lastUserSpeed === 'number') ? this.lastUserSpeed : null; // m/s
            if (spd === null || spd <= 0.1) {
                etaText = 'Berhenti';
            } else {
                const etaSec = Math.max(1, Math.round(jarakNext / spd));
                etaText = etaSec < 60 ? `${etaSec}s` : `${Math.floor(etaSec/60)}m ${etaSec%60}s`;
            }
            // Visual stability: skip UI update if distance change small and <1s
            const dt = nowTs - (this._lastUIUpdateTs || 0);
            if (!arrivalTrigger && Math.abs((jarakNext || 0) - (this._prevDistForUi || 0)) < 3 && dt < 1000) {
                return; // keep last UI
            }
            this._lastUIUpdateTs = nowTs;
            this._prevDistForUi = jarakNext;
        }

        // Update popup content (UI can use smoothed userLat/userLon passed in)
        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeId);
        
        const popupContent = this.buildUserPopupContent(route, currentStop, nextStop, userLat, userLon, upcomingStops, { etaText, trend, jarakNext });
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager && this.userMarker) {
            // Cache stop for interactions
            this._lastLiveStopForPopup = (this.arrivalStop || nextStop) || currentStop;
            mapManager.updateUserPopup(this.userMarker, popupContent);
            // Bind live popup interactions (route badges + platform badges)
            setTimeout(() => { this._bindLivePopupInteractions(); }, 30);
            // Render label halte berikutnya di peta
            try { mapManager.updateNextStopLabel(nextStop); } catch (e) {}
        }
    }

    // Handle arrival detection
    handleArrivalDetection(userLat, userLon, currentStop, nextStop, jarakNext) {
        if (jarakNext < 30 && this.lastArrivedStopId !== nextStop.stop_id) {
            // Mulai kartu arrival untuk nextStop (bukan currentStop)
            this.arrivalStop = nextStop;
            this.arrivalTimer = setTimeout(() => {
                // Setelah 10 detik, set halte saat ini menjadi nextStop dan reset status arrival
                this.currentStopId = nextStop.stop_id;
                this.selectedCurrentStopForUser = nextStop;
                this.lastArrivedStopId = null;
                this.arrivalStop = null;
                if (this.userMarker) {
                    const pos = this.lastUserPos;
                    if (pos) {
                        this.showUserRouteInfo(pos.lat, pos.lon, nextStop, this.selectedRouteIdForUser);
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
    buildUserPopupContent(route, currentStop, nextStop, userLat, userLon, upcomingStops = [], liveExtras = {}) {
        const badgeColor = route && route.route_color ? ('#' + route.route_color) : '#264697';
        const badgeText = route && route.route_short_name ? route.route_short_name : 'Unknown';
        
        let nextStopInfo = '';
        // Determine display stop and title per arrival state
        const isArriving = !!this.lastArrivedStopId && !!this.arrivalStop;
        const displayStop = isArriving ? this.arrivalStop : nextStop;
        const titleLabel = isArriving ? 'Halte Saat Ini' : 'Menuju Halte';
        if (displayStop) {
            const jarakNext = this.haversine(userLat, userLon, 
                parseFloat(displayStop.stop_lat), parseFloat(displayStop.stop_lon));
            // Distance color indicator
            let distColor = '#64748b';
            if (jarakNext < 80) distColor = '#10b981'; else if (jarakNext < 200) distColor = '#f59e0b';
            // Bearing indicator (deg)
            let bearingDeg = '';
            try {
                const pos = this.lastUserPosSmoothed || this.lastUserPos || { lat: userLat, lon: userLon };
                bearingDeg = Math.round(this._bearingDeg({ lat: pos.lat, lon: pos.lon }, { lat: parseFloat(displayStop.stop_lat), lon: parseFloat(displayStop.stop_lon) })) + '°';
            } catch (e) {}
            
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
            
            // Layanan di halte berikutnya
            let nextStopServicesHtml = '';
            try {
                const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
                const routes = window.transJakartaApp.modules.gtfs.getRoutes();
                let ids = stopToRoutes[displayStop.stop_id] ? Array.from(stopToRoutes[displayStop.stop_id]) : [];
                // Sembunyikan layanan yang sama dengan rute aktif
                const currentRouteId = route && route.route_id ? route.route_id : null;
                if (currentRouteId) {
                    ids = ids.filter(rid => rid !== currentRouteId);
                }
                const badges = ids.map(rid => {
                    const r = routes.find(rt => rt.route_id === rid);
                    if (!r) return '';
                    const color = r.route_color ? ('#' + r.route_color) : '#6c757d';
                    const label = r.route_short_name || r.route_id;
                    return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:default;font-weight:bold;font-size:0.85em;padding:4px 8px;">${label}</span>`;
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
            if (displayStop && displayStop.wheelchair_boarding === '1') {
                accessIcon = `<span title='Ramah kursi roda' style='margin-left:6px;'>♿</span>`;
            }

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

            // ETA & Trend from liveExtras
            const etaText = liveExtras.etaText || '';
            const trend = liveExtras.trend || '→';
            const etaHtml = etaText ? `<span style='font-size:0.9em;color:#64748b;'>ETA ${etaText}</span>` : '';
            const trendHtml = `<span style='font-size:0.9em;'>${trend}</span>`;
             
            nextStopInfo = `
                <div style='margin-bottom:6px;'>
                    <div class='text-muted' style='font-size:0.95em;font-weight:600;margin-bottom:2px;'>${titleLabel}</div>
                    <div style='font-size:1.1em;font-weight:bold;display:flex;align-items:center;gap:6px;'>${buildHeaderIcon(displayStop.stop_id)} <span>${displayStop.stop_name}</span> ${accessIcon}</div>
                    <div style='margin-bottom:2px;display:flex;align-items:center;gap:8px;'>
                        <span style='font-weight:600;color:${distColor};'>${jarakNext < 1000 ? Math.round(jarakNext) + ' m' : (jarakNext/1000).toFixed(2) + ' km'}</span>
                        <span style='font-size:0.9em;color:#64748b;'>arah ${bearingDeg}</span>
                        ${trendHtml}
                        ${etaHtml}
                    </div>
                    ${nextStopServicesHtml}
                    ${breadcrumbHtml}
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
        const arrivedStop = this.arrivalStop || this.selectedCurrentStopForUser;
        if (!arrivedStop) return '';
        return `
            <div style='background:linear-gradient(135deg, #10b981, #059669);color:white;padding:12px;border-radius:8px;margin-top:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);border-left:4px solid #047857;'>
                <div style='display:flex;align-items:center;gap:8px;'>
                    <div style='font-size:1.2em;'>🎉</div>
                    <div style='flex:1;'>
                        <div style='font-weight:bold;font-size:1.1em;margin-bottom:2px;'>Tiba di Halte!</div>
                        <div style='font-size:0.95em;opacity:0.9;'>${arrivedStop.stop_name}</div>
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
                        // Select route only; do not start live from nearest popup
                        try { window.transJakartaApp.modules.routes.selectRoute(rid); } catch (err) {}
                        // Close popup
                        try { const mm = window.transJakartaApp.modules.map; if (mm) mm.closePopup(); } catch(_){}
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
        this.arrivalStop = null;
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
        this.selectedRouteIdForUser = routeId;
        this.selectedCurrentStopForUser = stop;
        // Show lock button when live layanan active
        const lockBtn = document.getElementById('cameraLockBtn');
        if (lockBtn) lockBtn.style.display = '';
        if (this.lastUserPos && this.userMarker) {
            this.scheduleLiveUIUpdate();
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
            // Prefer a platform (G) that explicitly serves routeId
            const firstG = cluster.find(s => String(s.stop_id||'').startsWith('G') && (stopToRoutes[s.stop_id] || stopToRoutes[s.stop_id] === undefined));
            const gForRoute = cluster.find(s => String(s.stop_id||'').startsWith('G') && (stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]).map(String).includes(String(routeId)) : false));
            if (gForRoute) return gForRoute;
            // Else choose a non-access stop that serves the route
            const anyForRoute = cluster.find(s => !String(s.stop_id||'').startsWith('E') && (stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]).map(String).includes(String(routeId)) : false));
            if (anyForRoute) return anyForRoute;
            // Fallback: return original
            return stop;
        } catch (e) {
            return stop;
        }
    }
} 
 