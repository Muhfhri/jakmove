export class JourneyPlanner {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.origin = null; // {lat, lon}
        this.destination = null; // {lat, lon}
        this._onMapClick = null;
        this._graphBuilt = false;
        this._adj = new Map(); // stopId -> Array<{to, routeId}>
        this._routesAtStop = new Map(); // stopId -> Set(routeId)
        this._validStops = new Set(); // stop_ids yang appear in stop_times
        this._parentToChildren = new Map(); // parent_station -> Array(stop)
        this._ui = null; // no longer used (replaced by popups)
        this._layers = []; // ids of lines
        this._markers = []; // ids of temp markers
        this._rawLayers = []; // {id, sourceId, onClick} custom map layers for polylines
        this._lastPlan = null; // { startStop, goalStop, legs, steps }
        this._mode = 'balanced'; // 'fastest' | 'cheapest' | 'balanced'
        this._replanTimer = null; // debounce timer for replan
        this._drawSeq = 0; // token to cancel stale scheduled draws
    }

    _isMapPanning() {
        try { return !!this.app.modules.map._isPanning; } catch (_) { return false; }
    }

    setOptimizationMode(mode) {
        try {
            const allowed = new Set(['fastest', 'cheapest', 'balanced']);
            if (!allowed.has(String(mode))) mode = 'balanced';
            this._mode = String(mode);
            const label = this._mode === 'fastest' ? 'Paling cepat' : (this._mode === 'cheapest' ? 'Paling hemat' : 'Seimbang');
            this._setStatus(`Mode rute: ${label}`);
            // Trigger immediate replan when mode changes (ensure visible update)
            if (this.origin && this.destination) {
                try { if (this._replanTimer) clearTimeout(this._replanTimer); } catch(_){}
                try { this._plan(); } catch(_){}
            }
        } catch (e) {}
    }

    init() {
        // Prewarm graph asynchronously to avoid first-click lag
        if (!this._graphBuilt && !this._graphBuilding) {
            this._graphBuilding = true;
            const schedule = (cb) => { try { (window.requestIdleCallback||window.setTimeout)(cb, 0); } catch(_) { setTimeout(cb,0); } };
            schedule(() => {
                try { this._buildGraph(); } catch(e) {}
                this._graphBuilding = false;
            });
        }
        // Load saved optimization mode
        try { const saved = localStorage.getItem('jp_mode'); if (saved) this.setOptimizationMode(saved); } catch(e) {}
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        // Start fresh every activation
        try { this._clearMapArtifacts(); } catch (e) {}
        this.origin = null;
        this.destination = null;
        this._lastPlan = null;
        if (!this._graphBuilt) this._buildGraph();
        this._bindMapClick();
        this._setStatus('Klik peta untuk memilih titik awal');
        try { this.app.modules.map.setJourneyActive(true); } catch (e) {}
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this._unbindMapClick();
        // Clear overlays and reset state when deactivated
        try { this._clearMapArtifacts(); } catch (e) {}
        try { this.app.modules.map.closePopup(); } catch (e) {}
        try { this.app.modules.map.clearJourneyMarkers(); } catch (e) {}
        this.origin = null;
        this.destination = null;
        this._lastPlan = null;
        this._setSteps([]);
        this._setStatus('Nonaktif');
        try { this.app.modules.map.setJourneyActive(false); } catch (e) {}
    }

    reset() {
        this.disable();
        this.origin = null;
        this.destination = null;
        this._clearMapArtifacts();
        this._setStatus('');
        this._setSteps([]);
        this._lastPlan = null;
    }

    replan() {
        try {
            if (!this.origin || !this.destination) return;
            if (this._replanTimer) clearTimeout(this._replanTimer);
            this._replanTimer = setTimeout(() => { try { this._plan(); } catch(_){} }, 80);
        } catch(e) {}
    }

    _buildGraph() {
        try {
            const gtfs = this.app.modules.gtfs;
            const stopTimes = gtfs.getStopTimes() || [];
            const trips = gtfs.getTrips() || [];
            const stops = gtfs.getStops() || [];
            const tripById = new Map(trips.map(t => [String(t.trip_id || ''), t]));

            // Prepare structures
            this._adj.clear();
            this._routesAtStop.clear();
            this._validStops.clear();
            this._parentToChildren.clear();

            // Build valid stop set and routes-at-stop
            for (const st of stopTimes) {
                const sid = String(st.stop_id || '');
                if (!sid) continue;
                this._validStops.add(sid);
                const trip = tripById.get(String(st.trip_id || ''));
                if (trip) {
                    const rid = String(trip.route_id || '');
                    if (!this._routesAtStop.has(sid)) this._routesAtStop.set(sid, new Set());
                    if (rid) this._routesAtStop.get(sid).add(rid);
                }
            }

            // Build edges for each sequential pair in trips (directed)
            const byTrip = new Map();
            for (const st of stopTimes) {
                const tid = String(st.trip_id || '');
                if (!byTrip.has(tid)) byTrip.set(tid, []);
                byTrip.get(tid).push(st);
            }
            const addEdge = (a, b, rid) => {
                if (!this._adj.has(a)) this._adj.set(a, []);
                this._adj.get(a).push({ to: b, routeId: rid });
            };
            for (const [tid, arr] of byTrip.entries()) {
                arr.sort((a,b) => parseInt(a.stop_sequence||'0') - parseInt(b.stop_sequence||'0'));
                const trip = tripById.get(tid);
                const rid = trip ? String(trip.route_id || '') : '';
                for (let i = 0; i < arr.length - 1; i++) {
                    const a = String(arr[i].stop_id || '');
                    const b = String(arr[i+1].stop_id || '');
                    if (a && b && rid) addEdge(a, b, rid);
                }
            }

            // Build parent->children for transfer across platform siblings
            for (const s of stops) {
                if (!s) continue;
                const sid = String(s.stop_id || '');
                const parent = String(s.parent_station || '');
                if (!parent) continue;
                if (!this._parentToChildren.has(parent)) this._parentToChildren.set(parent, []);
                this._parentToChildren.get(parent).push(s);
            }

            // Add zero-cost transfer edges between siblings (both directions)
            for (const [parent, children] of this._parentToChildren.entries()) {
                const valids = children.filter(cs => this._validStops.has(String(cs.stop_id || '')));
                for (let i = 0; i < valids.length; i++) {
                    for (let j = i + 1; j < valids.length; j++) {
                        const a = String(valids[i].stop_id);
                        const b = String(valids[j].stop_id);
                        if (!this._adj.has(a)) this._adj.set(a, []);
                        if (!this._adj.has(b)) this._adj.set(b, []);
                        this._adj.get(a).push({ to: b, routeId: '' });
                        this._adj.get(b).push({ to: a, routeId: '' });
                    }
                }
            }

            // Add walking transfers between nearby valid stops using spatial grid index (<=120m), keep top 4 per stop
            const validStopsList = stops.filter(s => s && this._validStops.has(String(s.stop_id || '')));
            const R = 120; // meters - further reduced for shorter walks
            const cell = 0.004; // ~400m grid
            const keyOf = (lat, lon) => `${Math.floor(lat/cell)}|${Math.floor(lon/cell)}`;
            const grid = new Map(); // cellKey -> array of stops
            for (const s of validStopsList) {
                const lat = parseFloat(s.stop_lat), lon = parseFloat(s.stop_lon);
                const k = keyOf(lat, lon);
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(s);
            }
            const neighborMap = new Map(); // sid -> Array<{sid,d}>
            const neighCells = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            for (const s of validStopsList) {
                const sid = String(s.stop_id);
                const sLat = parseFloat(s.stop_lat), sLon = parseFloat(s.stop_lon);
                const baseK = keyOf(sLat, sLon);
                const [gy, gx] = baseK.split('|').map(n=>parseInt(n,10));
                let cand = [];
                for (const [dy,dx] of neighCells) {
                    const kk = `${gy+dy}|${gx+dx}`;
                    const arr = grid.get(kk);
                    if (arr && arr.length) cand = cand.concat(arr);
                }
                for (const t of cand) {
                    const tj = String(t.stop_id);
                    if (tj === sid) continue;
                    const d = this._haversine(sLat, sLon, parseFloat(t.stop_lat), parseFloat(t.stop_lon));
                    if (d <= R) {
                        if (!neighborMap.has(sid)) neighborMap.set(sid, []);
                        neighborMap.get(sid).push({ sid: tj, d });
                    }
                }
            }
            for (const [sid, arr] of neighborMap.entries()) {
                arr.sort((a,b) => a.d - b.d);
                const capped = arr.slice(0, 4); // increased to 4 for better connectivity but shorter walks
                if (!this._adj.has(sid)) this._adj.set(sid, []);
                for (const nb of capped) this._adj.get(sid).push({ to: nb.sid, routeId: '' });
            }

            this._graphBuilt = true;
        } catch (e) {
            console.error('JourneyPlanner: gagal membangun graf', e);
            this._graphBuilt = false;
        }
    }

    _bindMapClick() {
        const map = this.app.modules.map.getMap();
        let pending = null;
        this._onMapClick = (e) => {
            if (!this.enabled) return;
            const lat = e.lngLat.lat;
            const lon = e.lngLat.lng;
            if (!this.origin) {
                this.origin = { lat, lon };
                try {
                    this._isDragging = false;
                    this.app.modules.map.addJourneyMarker(
                        'start', lat, lon,
                        (newLat, newLon) => { // onDragEnd
                            this._isDragging = false;
                            this.origin = { lat: newLat, lon: newLon };
                            this._setStatus('Menghitung ulang...');
                            this.replan();
                        },
                        () => { this._isDragging = true; }, // onDragStart
                        (curLat, curLon) => { this.origin = { lat: curLat, lon: curLon }; } // onDrag (no UI/popup)
                    );
                } catch(_) {}
                this._setStatus('Klik peta untuk memilih tujuan');
            } else if (!this.destination) {
                this.destination = { lat, lon };
                try {
                    this._isDragging = false;
                    this.app.modules.map.addJourneyMarker(
                        'end', lat, lon,
                        (newLat, newLon) => { // onDragEnd
                            this._isDragging = false;
                            this.destination = { lat: newLat, lon: newLon };
                            this._setStatus('Menghitung ulang...');
                            this.replan();
                        },
                        () => { this._isDragging = true; }, // onDragStart
                        (curLat, curLon) => { this.destination = { lat: curLat, lon: curLon }; } // onDrag (no UI/popup)
                    );
                } catch(_) {}
                this._setStatus('Menghitung rute...');
                if (pending) clearTimeout(pending);
                pending = setTimeout(() => this._plan(), 80);
            } else {
                // Setelah kedua titik dipilih, klik peta tidak memindahkan marker.
                // Geser (drag) marker untuk mengubah posisi.
                this._setStatus('Geser marker untuk mengubah titik awal/tujuan');
            }
        };
        map.on('click', this._onMapClick);
    }

    _unbindMapClick() {
        const map = this.app.modules.map.getMap();
        if (this._onMapClick) {
            try { map.off('click', this._onMapClick); } catch(e) {}
        }
        this._onMapClick = null;
    }

    async _plan() {
        if (!this.origin || !this.destination) return;
        // Hard guard: never plan while map is panning to avoid debounce side-effects
        if (this._isMapPanning()) {
            try { if (this._replanTimer) clearTimeout(this._replanTimer); } catch(_){}
            this._replanTimer = setTimeout(() => { if (!this._isMapPanning()) { try { this._plan(); } catch(_){} } }, 120);
            return;
        }
        // Ensure graph is built before planning to avoid empty results
        if (!this._graphBuilt) {
            try {
                if (!this._graphBuilding) this._buildGraph();
            } catch (_) {}
            this._setStatus('Menyiapkan data rute...');
            try { if (this._replanTimer) clearTimeout(this._replanTimer); } catch(_){ }
            if (!this._isDragging && !this._isMapPanning()) {
                this._replanTimer = setTimeout(() => { if (!this._isMapPanning()) { try { this._plan(); } catch(_){ } } }, 150);
            }
            return;
        }
        const gtfs = this.app.modules.gtfs;
        const stops = gtfs.getStops() || [];
        // Robust nearest-stop fallback distances
        const radii = [300, 450, 650, 900];
        let start = null, goal = null;
        for (const r of radii) { if (!start) start = this._nearestValidStop(this.origin.lat, this.origin.lon, stops, r); else break; }
        for (const r of radii) { if (!goal) goal = this._nearestValidStop(this.destination.lat, this.destination.lon, stops, r); else break; }
        if (!start || !goal) { this._setStatus('Gagal menemukan halte/platform terdekat'); return; }
        let path = this._findPath(String(start.stop_id), String(goal.stop_id));
        
        // If no path found, try with expanded walking connections
        if (!path || path.length === 0) {
            try { this._addFallbackWalkEdges(1); } catch(_) {}
            path = this._findPath(String(start.stop_id), String(goal.stop_id));
        }
        
        // If still no path and not in balanced mode, fallback to balanced
        if ((!path || path.length === 0) && this._mode !== 'balanced') {
            console.warn(`Journey Planner: ${this._mode} mode failed, falling back to balanced mode`);
            const originalMode = this._mode;
            this._mode = 'balanced';
            path = this._findPath(String(start.stop_id), String(goal.stop_id));
            this._mode = originalMode; // Restore for UI consistency
        }
        
        // Final attempt with more walking edges
        if (!path || path.length === 0) {
            try { this._addFallbackWalkEdges(2); } catch(_) {}
            path = this._findPath(String(start.stop_id), String(goal.stop_id));
        }
        
        if (!path || path.length === 0) { 
            const mapMod = this.app.modules.map;
            this._setStatus('Tidak ditemukan jalur layanan. Geser titik awal/tujuan untuk mencoba lagi.');
            try {
                const html = `
                    <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                        <div style="color:#b91c1c; font-weight:700;">Rencana tidak ditemukan</div>
                        <div class="small" style="color:#6b7280; margin-top:6px;">Geser marker titik awal atau tujuan agar lebih dekat ke koridor/halte.</div>
                        <div class="small" style="color:#6b7280; margin-top:6px;">Tips: dekatkan ke jalan utama atau halte besar.</div>
                    </div>`;
                // Tampilkan di tengah antara origin/destination kalau keduanya ada
                if (this.origin && this.destination) {
                    const midLat = (this.origin.lat + this.destination.lat) / 2;
                    const midLon = (this.origin.lon + this.destination.lon) / 2;
                    mapMod.setStickyPopup(true);
                    mapMod.showHtmlPopupAt(midLon, midLat, html);
                }
            } catch (_) {}
            return; 
        }
        const grouped = this._groupByRoute(path);
        // Hindari efek kedip saat drag: render hanya ketika tidak sedang drag
        if (!this._isDragging) {
            // Pass steps from _lastPlan if available
            const stepsToUse = (this._lastPlan && this._lastPlan.steps) ? this._lastPlan.steps : [];
            this._renderPlan(start, goal, grouped, stepsToUse);
        }
        // Show popup immediately at origin with full steps and make it sticky
        try {
            const mapMod = this.app.modules.map;
            const plan = this._lastPlan;
            if (plan && plan.steps && plan.steps.length) {
                const html = this._buildFullStepsPopupHTML('Rencana Perjalanan', plan.steps);
                const lng = parseFloat(start.stop_lon), lat = parseFloat(start.stop_lat);
                mapMod.setStickyPopup(true);
                mapMod.showHtmlPopupAt(lng, lat, html);
                try { mapMod.getMap().easeTo({ center: [lng, lat], duration: 350 }); } catch(e){}
                // Bind reset in the immediate popup
                try {
                    const el = this.app.modules.map._currentPopup && this.app.modules.map._currentPopup.getElement && this.app.modules.map._currentPopup.getElement();
                    const btn = el && el.querySelector('#jp-reset-inline');
                    if (btn) btn.addEventListener('click', () => { try { this.reset(); } catch(_) {} try { this.app.modules.map.closePopup(); } catch(_) {} });
                    // Bind mode buttons in full-steps popup
                    const group = el && el.querySelector('#jp-mode-inline');
                    if (group) {
                        const setActive = (activeId) => {
                            group.querySelectorAll('button[data-mode]').forEach(b => {
                                if (b.getAttribute('data-mode') === activeId) { b.classList.remove('btn-outline-primary'); b.classList.add('btn-primary'); }
                                else { b.classList.add('btn-outline-primary'); b.classList.remove('btn-primary'); }
                            });
                        };
                        setActive(this._mode || 'balanced');
                        group.querySelectorAll('button[data-mode]').forEach(b => {
                            b.addEventListener('click', (ev) => {
                                try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}
                                const m = b.getAttribute('data-mode');
                                try { localStorage.setItem('jp_mode', m); } catch(_){ }
                                this.setOptimizationMode(m);
                                setActive(m);
                                this.replan();
                            });
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    _addFallbackWalkEdges(level = 1) {
        try {
            if (!this._validStops || this._validStops.size === 0) return;
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const valids = stops.filter(s => s && this._validStops.has(String(s.stop_id||'')));
            const R = level === 1 ? 250 : 400; // meters - further reduced for shorter walks
            const TOPK = level === 1 ? 5 : 8; // increased connectivity to compensate for shorter radius
            const cell = 0.006; // slightly larger grid for fallback
            const keyOf = (lat, lon) => `${Math.floor(lat/cell)}|${Math.floor(lon/cell)}`;
            const grid = new Map();
            for (const s of valids) {
                const lat = parseFloat(s.stop_lat), lon = parseFloat(s.stop_lon);
                const k = keyOf(lat, lon);
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k).push(s);
            }
            const neighCells = [[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1],[2,0],[-2,0],[0,2],[0,-2]];
            for (const s of valids) {
                const sid = String(s.stop_id);
                const sLat = parseFloat(s.stop_lat), sLon = parseFloat(s.stop_lon);
                const baseK = keyOf(sLat, sLon);
                const [gy, gx] = baseK.split('|').map(n=>parseInt(n,10));
                let cand = [];
                for (const [dy,dx] of neighCells) {
                    const kk = `${gy+dy}|${gx+dx}`;
                    const arr = grid.get(kk);
                    if (arr && arr.length) cand = cand.concat(arr);
                }
                const scored = [];
                for (const t of cand) {
                    const tj = String(t.stop_id);
                    if (tj === sid) continue;
                    const d = this._haversine(sLat, sLon, parseFloat(t.stop_lat), parseFloat(t.stop_lon));
                    if (d <= R) scored.push({ sid: tj, d });
                }
                scored.sort((a,b)=>a.d-b.d);
                const capped = scored.slice(0, TOPK);
                if (!this._adj.has(sid)) this._adj.set(sid, []);
                const arrAdj = this._adj.get(sid);
                for (const nb of capped) {
                    // avoid duplicate same-edge entries
                    if (!arrAdj.some(e => e.to === nb.sid && !e.routeId)) {
                        arrAdj.push({ to: nb.sid, routeId: '' });
                    }
                }
            }
        } catch (_) {}
    }

    _nearestValidStop(lat, lon, stops, maxDistance = 300) {
        let best = null, bestD = Infinity;
        const candidates = [];
        for (const s of stops) {
            if (!s || !s.stop_lat || !s.stop_lon) continue;
            const sid = String(s.stop_id || '');
            if (!this._validStops.has(sid)) continue; // hanya stop yang ada di stop_times
            const d = this._haversine(lat, lon, parseFloat(s.stop_lat), parseFloat(s.stop_lon));
            if (d <= maxDistance) {
                candidates.push({ stop: s, distance: d });
            }
        }
        // Sort by distance and prefer stops with more connections
        candidates.sort((a, b) => {
            const adjA = this._adj.get(String(a.stop.stop_id)) || [];
            const adjB = this._adj.get(String(b.stop.stop_id)) || [];
            // Prefer closer stops, but also consider connectivity
            const scoreA = a.distance + (adjA.length > 5 ? -20 : 0);
            const scoreB = b.distance + (adjB.length > 5 ? -20 : 0);
            return scoreA - scoreB;
        });
        return candidates.length > 0 ? candidates[0].stop : null;
    }

    _findPath(startId, goalId) {
        // A*-like: minimize weighted distance + transfer penalties with heuristic guidance
        const mode = this._mode || 'balanced';
        const BIG = mode === 'fastest' ? 50000 : (mode === 'cheapest' ? 80000 : 65000); // Reduced BIG values for all modes
        const MAX_TRANSFERS = mode === 'cheapest' ? 2 : (mode === 'fastest' ? 4 : 3); // Adjusted for each mode
        const TRANSIT_WEIGHT = mode === 'fastest' ? 0.15 : (mode === 'cheapest' ? 0.30 : 0.22); // Fine-tuned weights
        const WALK_WEIGHT = mode === 'fastest' ? 2.0 : (mode === 'cheapest' ? 3.0 : 2.5); // Increased to heavily discourage long walks
        const ALIGHT_WALK_PENALTY = mode === 'fastest' ? Math.round(BIG * 0.3) : (mode === 'cheapest' ? Math.round(BIG * 0.8) : Math.round(BIG * 0.5));
        const MAX_WALK_DISTANCE = 300; // Reduced maximum walking distance for transit
        // Fare-aware preferences (only used in 'cheapest')
        let priceByRoute = new Map();
        let fareIdByRoute = new Map();
        // Frequency-aware preferences (only used in 'fastest')
        let headwayByRoute = new Map(); // seconds
        if (mode === 'cheapest') {
            try {
                const gtfs = this.app.modules.gtfs;
                const fareRules = gtfs.getFareRules ? (gtfs.getFareRules() || []) : [];
                const fareAttrs = gtfs.getFareAttributes ? (gtfs.getFareAttributes() || []) : [];
                const priceByFare = new Map(fareAttrs.map(a => [String(a.fare_id||''), parseInt(a.price||'0',10) || 0]));
                fareIdByRoute = new Map();
                for (const fr of fareRules) {
                    const rid = String(fr.route_id||'');
                    const fid = String(fr.fare_id||'');
                    if (rid && fid && !fareIdByRoute.has(rid)) fareIdByRoute.set(rid, fid);
                }
                priceByRoute = new Map(Array.from(fareIdByRoute.entries()).map(([rid,fid]) => [rid, priceByFare.get(fid) || 0]));
            } catch (e) { priceByRoute = new Map(); fareIdByRoute = new Map(); }
        }
        // Service-type-aware grouping (BRT vs Integrasi) to bias CHEAPEST mode
        const routesList = (this.app.modules.gtfs.getRoutes() || []);
        const routeDescById = new Map(routesList.map(r => [String(r.route_id||''), String(r.route_desc||'')]));
        const groupPriceByKey = new Map([['BRT', 3500], ['INTEGRASI', 5000], ['OTHER', 4000]]);
        const serviceGroupForRoute = (rid) => {
            try {
                const desc = (routeDescById.get(String(rid)) || '').toLowerCase();
                if (desc.includes('brt')) return 'BRT';
                if (desc.includes('angkutan umum integrasi') || desc.includes('integrasi')) return 'INTEGRASI';
                return 'BRT';
            } catch(_) { return 'BRT'; }
        };
        if (mode === 'fastest') {
            try {
                const gtfs = this.app.modules.gtfs;
                const freqs = gtfs.getFrequencies ? (gtfs.getFrequencies() || []) : [];
                const trips = gtfs.getTrips ? (gtfs.getTrips() || []) : [];
                const byRoute = new Map(); // routeId -> array of trip_ids
                for (const t of trips) {
                    const rid = String(t.route_id || '');
                    if (!byRoute.has(rid)) byRoute.set(rid, []);
                    byRoute.get(rid).push(String(t.trip_id || ''));
                }
                // Build headway (use min headway across freqs for the route; fallback to 900s)
                for (const [rid, trIds] of byRoute.entries()) {
                    let best = Infinity;
                    for (const f of freqs) {
                        const tid = String(f.trip_id || '');
                        if (trIds.includes(tid)) {
                            const vals = [f.min_headway_secs, f.max_headway_secs, f.headway_secs]
                                .map(x => (x !== undefined && x !== null) ? parseInt(x, 10) : NaN)
                                .filter(v => isFinite(v) && v > 0);
                            for (const v of vals) if (v < best) best = v;
                        }
                    }
                    headwayByRoute.set(rid, isFinite(best) ? best : 900);
                }
            } catch (e) { headwayByRoute = new Map(); }
        }
        const FARE_WEIGHT = mode === 'cheapest' ? 15 : 5; // Adjusted fare weight based on mode
        const WAIT_W_MPS = mode === 'fastest' ? 8 : 10; // convert wait seconds to distance-equivalent cost
        const key = (sid, rid, fare) => sid + '|' + (rid || '') + '|' + (fare || '');
        const stopsById = new Map((this.app.modules.gtfs.getStops() || []).map(s => [String(s.stop_id||''), s]));

        const bestCost = new Map(); // key -> cost
        const bestTransfers = new Map(); // key -> transfers
        const parent = new Map(); // key -> { prevKey, viaRoute, at }

        // Fast min-heap priority queue to avoid O(n log n) sort per push
        const pq = [];
        const swap = (i,j)=>{ const t=pq[i]; pq[i]=pq[j]; pq[j]=t; };
        const siftUp = (i)=>{ while(i>0){ const p=((i-1)>>1); if (pq[p].cost <= pq[i].cost) break; swap(i,p); i=p; } };
        const siftDown = (i)=>{ const n=pq.length; while(true){ let l=i*2+1,r=l+1,m=i; if(l<n && pq[l].cost<pq[m].cost) m=l; if(r<n && pq[r].cost<pq[m].cost) m=r; if(m===i) break; swap(i,m); i=m; } };
        const push = (node)=>{ pq.push(node); siftUp(pq.length-1); };
        const pop = ()=>{ if(!pq.length) return undefined; const root=pq[0]; const last=pq.pop(); if(pq.length){ pq[0]=last; siftDown(0);} return root; };

        const heuristic = (sid) => {
            try {
                const s = stopsById.get(String(sid));
                const g = stopsById.get(String(goalId));
                if (!s || !g) return 0;
                const h = this._haversine(parseFloat(s.stop_lat), parseFloat(s.stop_lon), parseFloat(g.stop_lat), parseFloat(g.stop_lon));
            // scale heuristic similar to transit weight to remain admissible
            // Adjust heuristic based on mode to avoid overly aggressive pruning
            const hScale = mode === 'fastest' ? 0.12 : (mode === 'cheapest' ? 0.25 : 0.18);
            return h * hScale;
            } catch (_) { return 0; }
        };

        const tryRelax = (sid, rid, transfers, cost, prevKey, fareUsed) => {
            if (transfers > MAX_TRANSFERS) return false;
            const k = key(sid, rid, fareUsed || '');
            const prev = bestCost.get(k);
            if (prev !== undefined && prev <= cost) return false;
            bestCost.set(k, cost);
            bestTransfers.set(k, transfers);
            parent.set(k, { prevKey, viaRoute: rid, at: sid });
            const f = cost + heuristic(sid);
            push({ sid, rid, transfers, cost, fareUsed: fareUsed || '', f });
            return true;
        };

        tryRelax(startId, '', 0, 0, null, '');

        let iterations = 0;
        const MAX_ITERATIONS = 50000; // Safety limit to prevent infinite loops

        while (pq.length && iterations < MAX_ITERATIONS) {
            iterations++;
            const cur = pop();
            if (cur.sid === goalId) {
                return this._reconstruct(parent, key(cur.sid, cur.rid, cur.fareUsed || ''), startId);
            }
            const curKey = key(cur.sid, cur.rid, cur.fareUsed || '');
            if (bestCost.get(curKey) !== cur.cost) continue; // stale

            const s = stopsById.get(String(cur.sid));
            const sLat = s ? parseFloat(s.stop_lat) : null;
            const sLon = s ? parseFloat(s.stop_lon) : null;

            const nexts = this._adj.get(cur.sid) || [];
            for (const edge of nexts) {
                const nextSid = edge.to;
                const toStop = stopsById.get(String(nextSid));
                if (!toStop) continue;
                const tLat = parseFloat(toStop.stop_lat), tLon = parseFloat(toStop.stop_lon);
                const stepDist = (sLat !== null && sLon !== null) ? this._haversine(sLat, sLon, tLat, tLon) : 0;
                // discourage reverse progress relative to goal bearing
                try {
                    const g = stopsById.get(String(goalId));
                    if (g && isFinite(sLat) && isFinite(sLon)) {
                        const gLat = parseFloat(g.stop_lat), gLon = parseFloat(g.stop_lon);
                        const distToGoal = this._haversine(sLat, sLon, gLat, gLon);
                        const distToGoalNext = this._haversine(tLat, tLon, gLat, gLon);
                        // Relax this constraint for different modes
                        const allowedDetour = mode === 'fastest' ? 200 : (mode === 'cheapest' ? 300 : 250);
                        if (distToGoalNext > distToGoal + allowedDetour) {
                            // Penalize moving away from goal significantly
                            continue;
                        }
                    }
                } catch (_) {}

                const edgeRid = edge.routeId || '';
                let nextRid = cur.rid;
                let nextTransfers = cur.transfers;
                let edgePenalty = 0;
                let distComponent = 0;
                let nextFareUsed = cur.fareUsed || '';
                if (edgeRid) {
                    // riding transit
                    distComponent = stepDist * TRANSIT_WEIGHT;
                    if (!cur.rid) {
                        nextRid = edgeRid; // boarding, no transfer penalty
                        // fare-aware: pay fare only if not already on same fare product
                        if (mode === 'cheapest') {
                            const grp = serviceGroupForRoute(edgeRid);
                            nextFareUsed = grp;
                            if (!cur.fareUsed || cur.fareUsed !== grp) {
                                const price = priceByRoute.get(edgeRid) || groupPriceByKey.get(grp) || 3500;
                                edgePenalty += price * FARE_WEIGHT;
                            }
                        }
                        // frequency-aware: expected wait ~ headway/2
                        if (mode === 'fastest') {
                            const hw = headwayByRoute.get(edgeRid) || 900;
                            edgePenalty += (hw / 2) * WAIT_W_MPS;
                        }
                    } else if (edgeRid !== cur.rid) {
                        nextRid = edgeRid;
                        nextTransfers = cur.transfers + 1;
                        // transfer penalty when switching routes; heavily discourage unnecessary transfers
                        if (mode === 'cheapest') {
                            const fromGrp = serviceGroupForRoute(cur.rid);
                            const toGrp = serviceGroupForRoute(edgeRid);
                            // Strong penalty for integrasi transfers, lighter for BRT platform changes
                            edgePenalty += Math.round(BIG * ((fromGrp === 'BRT' && toGrp === 'BRT') ? 0.3 : 1.2));
                        } else if (mode === 'fastest') {
                            edgePenalty += Math.round(BIG * 0.8); // Increased penalty to reduce transfers
                        } else {
                            edgePenalty += Math.round(BIG * 1.0); // Full penalty for balanced mode
                        }
                        // fare-aware: charge only when switching to different fare product
                        if (mode === 'cheapest') {
                            const grp = serviceGroupForRoute(edgeRid);
                            nextFareUsed = grp;
                            if (!cur.fareUsed || cur.fareUsed !== grp) {
                                const price = priceByRoute.get(edgeRid) || groupPriceByKey.get(grp) || 3500;
                                edgePenalty += price * FARE_WEIGHT;
                            }
                        }
                        // frequency-aware: expected wait on route change
                        if (mode === 'fastest') {
                            const hw = headwayByRoute.get(edgeRid) || 900;
                            edgePenalty += (hw / 2) * WAIT_W_MPS;
                        }
                    }
                } else {
                    // walking/transfer edge
                    // Skip if walking distance is too long for transit (except start/end)
                    // Adjust max walk distance based on mode - more restrictive
                    const modeMaxWalk = mode === 'fastest' ? 250 : (mode === 'cheapest' ? 200 : MAX_WALK_DISTANCE);
                    if (stepDist > modeMaxWalk && cur.sid !== startId && edge.to !== goalId) {
                        continue; // Skip this edge - too far to walk for transit
                    }
                    distComponent = stepDist * WALK_WEIGHT;
                    nextRid = '';
                    if (cur.rid) {
                        nextTransfers = cur.transfers + 1; // alight → walk counts as a transfer
                        edgePenalty += ALIGHT_WALK_PENALTY;
                    }
                    // Heavily discourage long walks and zig-zags
                    const walkPenaltyFactor = mode === 'fastest' ? 1.2 : (mode === 'cheapest' ? 2.5 : 1.8);
                    edgePenalty += Math.min(800, stepDist * walkPenaltyFactor);
                    // Progressive penalty for longer walks
                    if (stepDist > 100) {
                        edgePenalty += (stepDist - 100) * 1.5; // Light penalty for walks >100m
                    }
                    if (stepDist > 200) {
                        edgePenalty += (stepDist - 200) * 3; // Heavy penalty for walks >200m
                    }
                    if (stepDist > 300) {
                        edgePenalty += (stepDist - 300) * 5; // Very heavy penalty for walks >300m
                    }
                    // keep current fare product validity across walking (integration window approximation)
                    nextFareUsed = cur.fareUsed || '';
                }

                const newCost = cur.cost + distComponent + edgePenalty;
                tryRelax(nextSid, nextRid, nextTransfers, newCost, key(cur.sid, cur.rid, cur.fareUsed || ''), nextFareUsed);
            }

            // Transfer in-place: switch to any route at this stop (no distance, but transfer penalty)
            const routeSet = this._routesAtStop.get(cur.sid);
            if (routeSet && routeSet.size) {
                for (const r of routeSet) {
                    if (!cur.rid) {
                        // first boarding, include fare-aware penalty in 'cheapest'
                        let cost2 = cur.cost;
                        let nextFareUsed = cur.fareUsed || '';
                        if (mode === 'cheapest') {
                            const grp = serviceGroupForRoute(String(r));
                            nextFareUsed = grp;
                            if (!cur.fareUsed || cur.fareUsed !== grp) {
                                const price = priceByRoute.get(String(r)) || groupPriceByKey.get(grp) || 3500;
                                cost2 += price * FARE_WEIGHT;
                            }
                        }
                        if (mode === 'fastest') {
                            const hw = headwayByRoute.get(String(r)) || 900;
                            cost2 += (hw / 2) * WAIT_W_MPS;
                        }
                        tryRelax(cur.sid, r, cur.transfers, cost2, key(cur.sid, cur.rid, cur.fareUsed || ''), nextFareUsed);
                    } else if (r !== cur.rid) {
                        // transfer penalty per mode with service-type awareness
                        let basePen;
                        if (mode === 'cheapest') {
                            const fromGrp = serviceGroupForRoute(cur.rid);
                            const toGrp = serviceGroupForRoute(String(r));
                            // Strong penalty for integrasi transfers, lighter for BRT platform changes
                            basePen = Math.round(BIG * ((fromGrp === 'BRT' && toGrp === 'BRT') ? 0.3 : 1.2));
                        } else if (mode === 'fastest') {
                            basePen = Math.round(BIG * 0.8); // Increased penalty to reduce transfers
                        } else {
                            basePen = Math.round(BIG * 1.0); // Full penalty for balanced mode
                        }
                        let cost2 = cur.cost + basePen;
                        let nextFareUsed = cur.fareUsed || '';
                        if (mode === 'cheapest') {
                            const grp = serviceGroupForRoute(String(r));
                            nextFareUsed = grp;
                            if (!cur.fareUsed || cur.fareUsed !== grp) {
                                const price = priceByRoute.get(String(r)) || groupPriceByKey.get(grp) || 3500;
                                cost2 += price * FARE_WEIGHT;
                            }
                        }
                        if (mode === 'fastest') {
                            const hw = headwayByRoute.get(String(r)) || 900;
                            cost2 += (hw / 2) * WAIT_W_MPS;
                        }
                        tryRelax(cur.sid, r, cur.transfers + 1, cost2, key(cur.sid, cur.rid, cur.fareUsed || ''), nextFareUsed);
                    }
                }
            }
        }
        
        // If we hit max iterations, log warning
        if (iterations >= MAX_ITERATIONS) {
            console.warn(`Journey Planner: Hit max iterations (${MAX_ITERATIONS}) in ${mode} mode`);
        }
        
        return null;
    }

    _reconstruct(parent, endKey, startId) {
        const seq = [];
        let curK = endKey;
        while (curK) {
            const info = parent.get(curK);
            if (!info) break;
            seq.push({ stopId: info.at, routeId: info.viaRoute });
            curK = info.prevKey;
        }
        // Ensure start node present
        if (!seq.length || seq[seq.length - 1].stopId !== startId) {
            seq.push({ stopId: startId, routeId: '' });
        }
        seq.reverse();
        return seq;
    }

    _groupByRoute(seq) {
        // seq: [{stopId, routeId}] starting with start stop (routeId may be '')
        const legs = [];
        let cur = null;
        for (let i = 1; i < seq.length; i++) {
            const prev = seq[i-1];
            const now = seq[i];
            if (!cur) {
                cur = { routeId: now.routeId, stops: [prev.stopId, now.stopId] };
                continue;
            }
            if (now.routeId === cur.routeId) {
                cur.stops.push(now.stopId);
            } else {
                if (cur.routeId) legs.push(cur);
                cur = { routeId: now.routeId, stops: [prev.stopId, now.stopId] };
            }
        }
        if (cur && cur.routeId) legs.push(cur);
        return legs;
    }

    _renderPlan(startStop, goalStop, legs, planSteps = []) {
        const gtfs = this.app.modules.gtfs;
        const stopsById = new Map((gtfs.getStops() || []).map(s => [String(s.stop_id||''), s]));
        const routes = gtfs.getRoutes() || [];
        const routeById = new Map(routes.map(r => [String(r.route_id||''), r]));

        this._clearMapArtifacts();

        // Draw endpoints
        this._addEndpointMarker(this.origin.lat, this.origin.lon, 'start');
        this._addEndpointMarker(this.destination.lat, this.destination.lon, 'end');

        // Parse steps to determine actual walks needed
        const walksFromSteps = new Set();
        for (const step of planSteps) {
            if (step.type === 'walk') {
                // Extract walk info from step text
                walksFromSteps.add(step.text);
            }
        }
        
        console.log(`📋 Steps contain ${walksFromSteps.size} walk segments:`, Array.from(walksFromSteps));

        // Draw walking: origin -> startStop ONLY if steps include it
        const dStart = this._haversine(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon));
        const hasInitialWalk = Array.from(walksFromSteps).some(w => w.includes(startStop.stop_name));
        if (dStart > 5 && hasInitialWalk) { // Only draw if not already at stop AND step exists
            console.log(`  🚶 Drawing initial walk to ${startStop.stop_name}`);
            this._drawWalk(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon), 
                { type: 'walk', toStopName: startStop.stop_name, preferStraight: dStart <= 100, ensureComplete: true });
        } else {
            console.log(`  ⏭️ Skipping initial walk (${dStart.toFixed(0)}m, hasStep=${hasInitialWalk})`);
        }
        
        // Draw walking: goalStop -> destination ONLY if steps include it
        const dEnd = this._haversine(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon);
        const hasFinalWalk = Array.from(walksFromSteps).some(w => w.includes('tujuan'));
        if (dEnd > 5 && hasFinalWalk) { // Only draw if not already at destination AND step exists
            console.log(`  🚶 Drawing final walk to destination`);
            this._drawWalk(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon, 
                { type: 'walk', toStopName: 'Tujuan', preferStraight: dEnd <= 100, ensureComplete: true });
        } else {
            console.log(`  ⏭️ Skipping final walk (${dEnd.toFixed(0)}m, hasStep=${hasFinalWalk})`);
        }
        // Draw transit legs (chunked to avoid blocking UI)
        const seq = ++this._drawSeq;
        const legEndpoints = [];
        const drawOneLeg = (leg, index) => {
            if (seq !== this._drawSeq) return; // canceled by reset
            const color = this._routeColorHex(String(leg.routeId));
            const segment = this._computeShapeSegmentForLeg(leg, stopsById);
            if (segment && segment.length >= 2) {
                const fromStop = stopsById.get(String(leg.stops[0]));
                const toStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
                this._drawPolyline(segment, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: fromStop?.stop_name, toStopName: toStop?.stop_name });
                try { legEndpoints[index] = { start: segment[0], end: segment[segment.length-1], fromId: String(leg.stops[0]), toId: String(leg.stops[leg.stops.length-1]) }; } catch(_) {}
                this._addLineLabel(segment, `Naik ${this._routeLabel(leg.routeId)}`, color);
                // Add start/end labels for the leg
                try {
                    const [sLat, sLon] = segment[0];
                    const plat = (fromStop && String(fromStop.platform_code || '').trim()) || '';
                    this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${fromStop?.stop_name || ''}${plat ? ' (Platform ' + plat + ')' : ''}`, color);
                } catch(e){}
                try { const [eLat, eLon] = segment[segment.length - 1]; this._addTextAt(eLat, eLon, `Turun di ${toStop?.stop_name || ''}`, color); } catch(e){}
                // NO GAP BRIDGING - shapes should be accurate enough, and we don't want to add walks not in steps
            } else {
                // Fallback: render stop-by-stop using shapes when possible
                for (let i = 0; i < leg.stops.length - 1; i++) {
                    const a = stopsById.get(String(leg.stops[i]));
                    const b = stopsById.get(String(leg.stops[i+1]));
                    if (!a || !b) continue;
                    // Try to get shape segment for this stop pair
                    const tmpLeg = { routeId: leg.routeId, stops: [String(a.stop_id), String(b.stop_id)] };
                    const seg = this._computeShapeSegmentForLeg(tmpLeg, stopsById);
                    const coords = (seg && seg.length >= 2) ? seg : [[parseFloat(a.stop_lat), parseFloat(a.stop_lon)], [parseFloat(b.stop_lat), parseFloat(b.stop_lon)]];
                    this._drawPolyline(coords, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: a?.stop_name, toStopName: b?.stop_name });
                    try { if (!legEndpoints[index]) legEndpoints[index] = { start: coords[0], end: coords[coords.length-1], fromId: String(leg.stops[0]), toId: String(leg.stops[leg.stops.length-1]) }; else legEndpoints[index].end = coords[coords.length-1]; } catch(_) {}
                    this._addLineLabel(coords, `Naik ${this._routeLabel(leg.routeId)}`, color);
                    try {
                        const [sLat, sLon] = coords[0];
                        const plat = (a && String(a.platform_code || '').trim()) || '';
                        if (i === 0) this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${a?.stop_name || ''}${plat ? ' (Platform ' + plat + ')' : ''}`, color);
                    } catch(e){}
                    try { 
                        const [eLat, eLon] = coords[coords.length - 1]; 
                        if (i === leg.stops.length - 2) this._addTextAt(eLat, eLon, `Turun di ${b?.stop_name || ''}`, color); 
                    } catch(e){}
                    // NO GAP BRIDGING in fallback mode either
                }
            }
            // Mark transfer at start of each subsequent leg
            const startStop2 = stopsById.get(String(leg.stops[0]));
            if (startStop2) {
                const plat2 = String(startStop2.platform_code || '').trim();
                const name2 = (startStop2.stop_name || 'Transit di sini') + (plat2 ? ` (Platform ${plat2})` : '');
                this._addTransitHereMarker(parseFloat(startStop2.stop_lat), parseFloat(startStop2.stop_lon), name2);
            }
        };
        legs.forEach((leg, idx) => { setTimeout(() => drawOneLeg(leg, idx), idx * 0); });

        // Draw walking between transfer stops ONLY if mentioned in steps
        console.log(`🔄 Checking ${legs.length - 1} potential transfers...`);
        for (let i = 0; i < legs.length - 1; i++) {
            const currLastId = String(legs[i].stops[legs[i].stops.length - 1]);
            const nextFirstId = String(legs[i+1].stops[0]);
            
            // Get stop objects
            const a = stopsById.get(currLastId);
            const b = stopsById.get(nextFirstId);
            if (!a || !b) continue;
            
            // Check if steps explicitly mention walking between these stops
            const transferWalk = Array.from(walksFromSteps).find(w => 
                w.includes(a.stop_name) && w.includes(b.stop_name)
            );
            
            if (!transferWalk) {
                console.log(`  ⏭️ No walk step for transfer ${a.stop_name} → ${b.stop_name}, skipping`);
                continue;
            }
            
            // Calculate actual distance
            const stopDistance = this._haversine(parseFloat(a.stop_lat), parseFloat(a.stop_lon), parseFloat(b.stop_lat), parseFloat(b.stop_lon));
            
            console.log(`  🚶 Drawing transfer walk: ${a.stop_name} → ${b.stop_name} (${stopDistance.toFixed(0)}m)`);
            
            // Only draw if distance is significant and not same location
            if (stopDistance > 20 && currLastId !== nextFirstId) {
                this._drawWalk(
                    parseFloat(a.stop_lat), parseFloat(a.stop_lon),
                    parseFloat(b.stop_lat), parseFloat(b.stop_lon),
                    { type: 'walk', toStopName: b.stop_name, preferStraight: stopDistance <= 150, ensureComplete: true }
                );
            } else {
                console.log(`    ⏭️ Too short or same stop, skipping visual`);
            }
        }
        
        // NO MORE automatic gap bridging - only draw what's in steps

        // Steps UI
        const steps = [];
        const dist1 = this._haversine(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon));
        steps.push({ type: 'walk', text: `Jalan ke ${startStop.stop_name} (${this._fmtDist(dist1)})` });
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const first = stopsById.get(String(leg.stops[0]));
            const last = stopsById.get(String(leg.stops[leg.stops.length - 1]));
            const r = routeById.get(String(leg.routeId));
            const name = r ? (r.route_short_name || r.route_id) : leg.routeId;
            steps.push({ type: 'ride', text: `Naik ${name} dari ${first?.stop_name} ke ${last?.stop_name}` });
            if (i < legs.length - 1) {
                const nextFirst = stopsById.get(String(legs[i+1].stops[0]));
                if (last && nextFirst) {
                    const d = this._haversine(parseFloat(last.stop_lat), parseFloat(last.stop_lon), parseFloat(nextFirst.stop_lat), parseFloat(nextFirst.stop_lon));
                    steps.push({ type: 'transfer', text: `Transit di ${last.stop_name}` });
                    if (d > 1) steps.push({ type: 'walk', text: `Jalan ke ${nextFirst.stop_name} (${this._fmtDist(d)})` });
                }
            }
        }
        const dist2 = this._haversine(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon);
        steps.push({ type: 'walk', text: `Jalan ke tujuan (${this._fmtDist(dist2)})` });
        // Fare estimate
        const fare = this._estimateFare(legs);
        // Duration + ETA estimate
        const duration = this._estimateJourneyDuration(startStop, goalStop, legs, dist1, dist2);
        this._lastPlan = { startStop, goalStop, legs, steps, fare, duration };
        this._setStatus('Rencana siap. Klik jalur untuk melihat langkah.');
    }

    _parseTimeToSec(t) {
        try {
            if (!t) return NaN;
            const parts = String(t).split(':').map(x => parseInt(x, 10));
            if (parts.length < 2) return NaN;
            const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;
            return h * 3600 + m * 60 + s;
        } catch (_) { return NaN; }
    }

    _headwayByRoute() {
        try {
            const gtfs = this.app.modules.gtfs;
            const freqs = gtfs.getFrequencies ? (gtfs.getFrequencies() || []) : [];
            const trips = gtfs.getTrips ? (gtfs.getTrips() || []) : [];
            const byRoute = new Map(); // routeId -> trip_ids
            for (const t of trips) {
                const rid = String(t.route_id || '');
                if (!byRoute.has(rid)) byRoute.set(rid, []);
                byRoute.get(rid).push(String(t.trip_id || ''));
            }
            const headway = new Map();
            for (const [rid, trIds] of byRoute.entries()) {
                let best = Infinity;
                for (const f of freqs) {
                    const tid = String(f.trip_id || '');
                    if (trIds.includes(tid)) {
                        const vals = [f.min_headway_secs, f.max_headway_secs, f.headway_secs]
                            .map(x => (x !== undefined && x !== null) ? parseInt(x, 10) : NaN)
                            .filter(v => isFinite(v) && v > 0);
                        for (const v of vals) if (v < best) best = v;
                    }
                }
                headway.set(rid, isFinite(best) ? best : 900);
            }
            return headway;
        } catch (e) { return new Map(); }
    }

    _estimateInVehicleSeconds(routeId, fromStopId, toStopId) {
        try {
            const gtfs = this.app.modules.gtfs;
            const trips = (gtfs.getTrips() || []).filter(t => String(t.route_id||'') === String(routeId));
            const stopTimes = gtfs.getStopTimes ? (gtfs.getStopTimes() || []) : [];
            // Group stop_times by trip for target route
            const byTrip = new Map();
            for (const st of stopTimes) {
                const tid = String(st.trip_id||'');
                if (!trips.find(t => String(t.trip_id||'') === tid)) continue;
                if (!byTrip.has(tid)) byTrip.set(tid, []);
                byTrip.get(tid).push(st);
            }
            const parse = (v) => this._parseTimeToSec(v);
            // Try first 30 trips for performance
            let best = Infinity;
            let checked = 0;
            for (const [tid, arr] of byTrip.entries()) {
                if (++checked > 30) break;
                arr.sort((a,b) => parseInt(a.stop_sequence||'0') - parseInt(b.stop_sequence||'0'));
                let aIdx = -1, bIdx = -1;
                for (let i = 0; i < arr.length; i++) {
                    const sid = String(arr[i].stop_id||'');
                    if (sid === String(fromStopId) && aIdx === -1) aIdx = i;
                    if (sid === String(toStopId)) { bIdx = i; break; }
                }
                if (aIdx >= 0 && bIdx > aIdx) {
                    const aDep = parse(arr[aIdx].departure_time || arr[aIdx].arrival_time);
                    const bArr = parse(arr[bIdx].arrival_time || arr[bIdx].departure_time);
                    if (isFinite(aDep) && isFinite(bArr)) {
                        // handle times beyond 24h
                        let dt = bArr - aDep; if (dt < 0) dt += 24*3600;
                        if (dt > 60 && dt < best) best = dt;
                    }
                }
            }
            if (isFinite(best) && best < Infinity) return best;
            // Fallback: estimate by number of stops * 90s
            // Count stops in leg from grouping caller context is not available here; approximate 8 stops → 12 min per 10 stops
            return 12 * 60; // reasonable default if unknown
        } catch (e) { return 12 * 60; }
    }

    _estimateJourneyDuration(startStop, goalStop, legs, distStart, distEnd) {
        const WALK_MPS = 1.2; // ~4.3 km/h
        const headway = this._headwayByRoute();
        let totalSec = 0;
        const parts = [];
        // Start walk
        const startWalk = Math.round((distStart || 0) / WALK_MPS);
        totalSec += startWalk; parts.push({ type: 'walk', sec: startWalk, label: `Jalan ke ${startStop.stop_name}` });
        // Each leg
        const stopsById = new Map((this.app.modules.gtfs.getStops() || []).map(s => [String(s.stop_id||''), s]));
        for (let i = 0; i < legs.length; i++) {
            const leg = legs[i];
            const rid = String(leg.routeId||'');
            const firstId = String(leg.stops[0]);
            const lastId = String(leg.stops[leg.stops.length - 1]);
            // Wait time (avg half headway)
            const hw = headway.get(rid) || 900; // default 15 min
            const wait = Math.round((hw / 2));
            totalSec += wait; parts.push({ type: 'wait', sec: wait, label: `Menunggu ${this._routeLabel(rid)}` });
            // Ride time from stop_times
            const ride = this._estimateInVehicleSeconds(rid, firstId, lastId);
            totalSec += ride; parts.push({ type: 'ride', sec: ride, label: `Naik ${this._routeLabel(rid)}` });
            // Transfer walk between legs if needed
            if (i < legs.length - 1) {
                const nextFirstId = String(legs[i+1].stops[0]);
                const a = stopsById.get(lastId), b = stopsById.get(nextFirstId);
                if (a && b) {
                    const d = this._haversine(parseFloat(a.stop_lat), parseFloat(a.stop_lon), parseFloat(b.stop_lat), parseFloat(b.stop_lon));
                    const w = Math.round(d / WALK_MPS);
                    if (w > 0) { totalSec += w; parts.push({ type: 'walk', sec: w, label: `Transit jalan ke ${b.stop_name}` }); }
                }
            }
        }
        // End walk
        const endWalk = Math.round((distEnd || 0) / WALK_MPS);
        totalSec += endWalk; parts.push({ type: 'walk', sec: endWalk, label: `Jalan ke tujuan` });
        // ETA clock time
        const now = new Date();
        const eta = new Date(now.getTime() + totalSec * 1000);
        return { totalSec, parts, etaISO: eta.toISOString(), etaLabel: eta.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
    }

    _estimateFare(legs) {
        try {
            const gtfs = this.app.modules.gtfs;
            const fareRules = gtfs.getFareRules ? (gtfs.getFareRules() || []) : [];
            const fareAttrs = gtfs.getFareAttributes ? (gtfs.getFareAttributes() || []) : [];
            if (!fareRules.length || !fareAttrs.length || !legs || !legs.length) return null;
            const attrsById = new Map(fareAttrs.map(a => [String(a.fare_id||''), a]));
            // Map route_id -> first fare_id found
            const fareIdByRoute = new Map();
            for (const fr of fareRules) {
                const rid = String(fr.route_id||'');
                const fid = String(fr.fare_id||'');
                if (rid && fid && !fareIdByRoute.has(rid)) fareIdByRoute.set(rid, fid);
            }
            const usedFareIds = new Set();
            let total = 0;
            const breakdown = [];
            for (const leg of legs) {
                const rid = String(leg.routeId||'');
                const fid = fareIdByRoute.get(rid);
                if (!fid || usedFareIds.has(fid)) continue; // de-dup same fare product (integrasi)
                const attr = attrsById.get(fid);
                if (!attr) continue;
                const price = parseInt(attr.price, 10);
                if (isFinite(price)) {
                    total += price;
                    usedFareIds.add(fid);
                    breakdown.push({ fare_id: fid, price, currency: attr.currency_type || '' });
                }
            }
            return { total, breakdown };
        } catch (e) { return null; }
    }

    _drawWalk(lat1, lon1, lat2, lon2, meta = {}) {
        const straightDist = this._haversine(lat1, lon1, lat2, lon2);
        
        // SKIP walking lines for very short distances or internal gaps (noise reduction)
        if (straightDist < 10) {
            console.log(`  ⏭️ Skipping walk: too short (${straightDist.toFixed(0)}m)`);
            return; // Don't draw anything for sub-10m distances
        }
        
        // For gap bridging (not actual user walking), use invisible/minimal lines
        const isGapBridge = meta && (meta.type === 'walk') && (meta.toStopName === 'Platform' || meta.toStopName === 'Pindah platform');
        if (isGapBridge && straightDist < 100) {
            console.log(`  ⏭️ Skipping gap bridge: too short (${straightDist.toFixed(0)}m)`);
            return; // Don't draw gap bridges less than 100m
        }
        
        // Create unique ID for this walk segment to replace placeholder later
        const walkId = `walk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        
        const drawStraight = (approx = true, isPlaceholder = false) => {
            const path = [[lat1, lon1], [lat2, lon2]];
            const label = approx ? `Perkiraan (garis lurus) • ${this._fmtDist(straightDist)}` : `Jalan kaki • ${this._fmtDist(straightDist)}`;
            const metaData = { ...meta, type: 'walk', approximate: approx, distance: straightDist, walkId: isPlaceholder ? walkId : undefined };
            this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], metaData);
            this._addLineLabel(path, label, '#10b981');
        };
        
        // Check if walking distance is reasonable
        if (straightDist > 1000 && !meta.ensureComplete) {
            console.warn(`  ⚠️ Walking distance ${straightDist.toFixed(0)}m is too far, not drawing`);
            return; // Don't draw anything for unreasonably long walks
        }
        
        // For very short walks or forced straight, just draw simple line without OSRM
        try {
            if ((meta && (meta.forceStraight || meta.preferStraight)) || straightDist <= 100) {
                drawStraight(false);
                return;
            }
        } catch (_) {}
        
        // For gap bridges or very short walks, skip OSRM entirely (just draw straight line)
        if (isGapBridge || straightDist <= 150) {
            console.log(`  🚶 Drawing simple walk: ${straightDist.toFixed(0)}m (skipping OSRM)`);
            drawStraight(false); // Draw without "Perkiraan" label
            return;
        }
        
        // Only use OSRM for actual user walking (origin/destination or significant transfers)
        console.log(`  🗺️ Fetching OSRM route for ${straightDist.toFixed(0)}m walk`);
        
        // Tampilkan placeholder garis lurus terlebih dahulu agar tidak "hilang" saat OSRM fetch
        drawStraight(false, true); // Use false to avoid "Perkiraan" label on placeholder
        
        // Snap ke jalan terdekat lalu rute OSRM dengan steps; fallback garis lurus bila tidak konsisten
        const nearestUrl = (lat, lon) => `https://router.project-osrm.org/nearest/v1/foot/${lon},${lat}?number=1`;
        const routeUrl = (sLon, sLat, eLon, eLat) => `https://router.project-osrm.org/route/v1/foot/${sLon},${sLat};${eLon},${eLat}?overview=full&geometries=geojson&steps=true&alternatives=false&radiuses=30;30`;
        (async () => {
            try {
                const [sn1, sn2] = await Promise.all([
                    fetch(nearestUrl(lat1, lon1)).then(r=>r.json()).catch(()=>null),
                    fetch(nearestUrl(lat2, lon2)).then(r=>r.json()).catch(()=>null)
                ]);
                let sLat = lat1, sLon = lon1, eLat = lat2, eLon = lon2;
                let snapOk = false;
                try {
                    const w1 = (sn1 && sn1.waypoints && sn1.waypoints[0]) ? sn1.waypoints[0] : null;
                    const w2 = (sn2 && sn2.waypoints && sn2.waypoints[0]) ? sn2.waypoints[0] : null;
                    if (w1 && w2) {
                        const p1 = w1.location; // [lon, lat]
                        const p2 = w2.location;
                        const d1 = this._haversine(lat1, lon1, p1[1], p1[0]);
                        const d2 = this._haversine(lat2, lon2, p2[1], p2[0]);
                        if (d1 <= 120 && d2 <= 120) { // jangan snap terlalu jauh
                            sLat = p1[1]; sLon = p1[0]; eLat = p2[1]; eLon = p2[0];
                            snapOk = true;
                        }
                    }
                } catch(_) {}
                const resp = await fetch(routeUrl(sLon, sLat, eLon, eLat));
                const data = await resp.json();
                if (!data || !data.routes || !data.routes[0] || !data.routes[0].geometry) {
                    console.log(`  ⚠️ OSRM failed, keeping simple straight line`);
                    // Don't redraw - placeholder is already there
                    return;
                }
                const osrmDist = typeof data.routes[0].distance === 'number' ? data.routes[0].distance : null;
                const osrmDur = typeof data.routes[0].duration === 'number' ? data.routes[0].duration : null;
                // Hindari detour berlebihan (mis. di dalam terminal)
                if (osrmDist !== null && osrmDist > Math.max(350, straightDist * 2.2)) {
                    console.log(`  ⚠️ OSRM route too long (${osrmDist}m vs ${straightDist}m straight), keeping placeholder`);
                    // Don't redraw - placeholder is already there
                    return;
                }
                const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                const label = `Jalan kaki • ${this._fmtDist(osrmDist || straightDist)}${osrmDur ? ' • ' + Math.max(1, Math.round(osrmDur/60)) + ' mnt' : ''}`;
                // Extract simple step texts if available
                let walkSteps = [];
                try {
                    const steps = (data.routes[0].legs && data.routes[0].legs[0] && data.routes[0].legs[0].steps) ? data.routes[0].legs[0].steps : [];
                    walkSteps = steps.map(st => {
                        const name = st.name ? (' di ' + st.name) : '';
                        const dist = st.distance ? ` (${Math.round(st.distance)} m)` : '';
                        const maneuver = (st.maneuver && st.maneuver.instruction) ? st.maneuver.instruction : (st.maneuver && st.maneuver.type ? st.maneuver.type : 'Jalan');
                        return `${maneuver}${name}${dist}`;
                    });
                } catch(_) {}
                this._drawPolyline(coords, '#10b981', 3, 0.9, [2, 2], { type: 'walk', approximate: false, distance: osrmDist || straightDist, duration: osrmDur || null, walkSteps, ...meta });
                this._addLineLabel(coords, label, '#10b981');
        } catch (e) {
                // Try advanced segmented approach for problematic cases
                const attemptSegmented = async () => {
                    try {
                        // If OSRM fails, try breaking into segments
                        const midLat = lat1 + (lat2 - lat1) * 0.5;
                        const midLon = lon1 + (lon2 - lon1) * 0.5;
                        
                        // Get nearest road points
                        const [p1, pm, p2] = await Promise.all([
                            fetch(nearestUrl(lat1, lon1)).then(r=>r.json()).catch(()=>null),
                            fetch(nearestUrl(midLat, midLon)).then(r=>r.json()).catch(()=>null),
                            fetch(nearestUrl(lat2, lon2)).then(r=>r.json()).catch(()=>null)
                        ]);
                        
                        if (!p1?.waypoints?.[0] || !p2?.waypoints?.[0]) return false;
                        
                        const coords = [];
                        let totalDist = 0;
                        
                        // Try first segment
                        if (pm?.waypoints?.[0]) {
                            const r1 = await fetch(routeUrl(p1.waypoints[0].location[0], p1.waypoints[0].location[1], 
                                                          pm.waypoints[0].location[0], pm.waypoints[0].location[1]))
                                             .then(r=>r.json()).catch(()=>null);
                            if (r1?.routes?.[0]?.geometry) {
                                coords.push(...r1.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]));
                                totalDist += r1.routes[0].distance || 0;
                            }
                            
                            // Try second segment
                            const r2 = await fetch(routeUrl(pm.waypoints[0].location[0], pm.waypoints[0].location[1], 
                                                          p2.waypoints[0].location[0], p2.waypoints[0].location[1]))
                                             .then(r=>r.json()).catch(()=>null);
                            if (r2?.routes?.[0]?.geometry) {
                                coords.push(...r2.routes[0].geometry.coordinates.slice(1).map(([lng, lat]) => [lat, lng]));
                                totalDist += r2.routes[0].distance || 0;
                            }
                        }
                        
                        if (coords.length > 1) {
                            this._drawPolyline(coords, '#10b981', 3, 0.9, [2, 2], { type: 'walk', approximate: false, distance: totalDist, ...meta });
                            this._addLineLabel(coords, `Jalan kaki • ${this._fmtDist(totalDist)}`, '#10b981');
                            return true;
                        }
                        return false;
                    } catch(_) { return false; }
                };
                
                const segmented = await attemptSegmented();
                if (!segmented) drawStraight(true);
            }
        })();
    }

    _drawPolyline(latlngs, color = '#2563eb', width = 4, opacity = 0.88, dash = null, meta = null) {
        try {
            const map = this.app.modules.map.getMap();
            const id = 'jp-line-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const sourceId = id + '-src';
            const coords = latlngs.map(([lat, lon]) => [lon, lat]);
            const props = meta ? { ...meta } : {};
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } }] };
            map.addSource(sourceId, { type: 'geojson', data });
            map.addLayer({ id, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': width, 'line-opacity': opacity, ...(dash ? { 'line-dasharray': dash } : {}) } });
            // Add wide invisible hit layer on top for reliable clicks
            const hitId = id + '-hit';
            map.addLayer({ id: hitId, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': Math.max(width + 14, 18), 'line-opacity': 0.01 } });
            // Move hit layer to very top to capture clicks above other overlays
            try { map.moveLayer(hitId); } catch (e) {}
            const onClick = (e) => {
                try {
                    const f = e.features && e.features[0];
                    const p = f && f.properties ? f.properties : (meta || {});
                    const lngLat = e.lngLat;
            if (p && p.type === 'walk' && Array.isArray(p.walkSteps) && p.walkSteps.length) {
                        const stepsHtml = `<ol style="padding-left:18px;margin:0;">${p.walkSteps.map(s => `<li class=\"small\" style=\"margin:3px 0;\">${s}</li>`).join('')}</ol>`;
                        const html = `
                            <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                                <div style="color:#333; padding:4px 0; border-bottom:1px solid #eee; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                                    <div style="font-weight:700;">Langkah Jalan Kaki</div>
                                </div>
                                <div class="small" style="color:#6b7280;margin-bottom:6px;">Ikuti trotoar/jalur pejalan kaki</div>
                                <div style="max-height:36vh;overflow:auto;">${stepsHtml}</div>
                            </div>`;
                        this.app.modules.map.setStickyPopup(true);
                        this.app.modules.map.showHtmlPopupAt(lngLat.lng, lngLat.lat, html);
                    } else {
                    this._showLegPopupAt(lngLat.lng, lngLat.lat, p);
                    }
                } catch (err) {}
            };
            const onEnter = () => { try { map.getCanvas().style.cursor = 'pointer'; } catch(e){} };
            const onLeave = () => { try { map.getCanvas().style.cursor = ''; } catch(e){} };
            map.on('click', hitId, onClick);
            map.on('mouseenter', hitId, onEnter);
            map.on('mouseleave', hitId, onLeave);
            this._rawLayers.push({ id, sourceId, onClick, hitId, onEnter, onLeave });
        } catch (e) { /* ignore */ }
    }

    _addLineLabel(latlngs, text, color = '#111827') {
        try {
            if (!latlngs || latlngs.length === 0) return;
            const map = this.app.modules.map.getMap();
            const midIndex = Math.floor(latlngs.length / 2);
            const [midLat, midLon] = latlngs[midIndex];
            const id = 'jp-lbl-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const srcId = id + '-src';
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { label: text }, geometry: { type: 'Point', coordinates: [midLon, midLat] } }] };
            map.addSource(srcId, { type: 'geojson', data });
            map.addLayer({ id, type: 'symbol', source: srcId, layout: { 'text-field': ['get','label'], 'text-size': 10, 'text-anchor': 'center' }, paint: { 'text-color': color, 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
            this._rawLayers.push({ id, sourceId: srcId });
        } catch (e) {}
    }

    _addEndpointMarker(lat, lon, type) {
        try {
            const map = this.app.modules.map.getMap();
            const id = 'jp-endp-' + type + '-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const srcId = id + '-src';
            const label = type === 'start' ? 'Awal' : 'Tujuan';
            const fill = type === 'start' ? '#22c55e' : '#ef4444';
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { label }, geometry: { type: 'Point', coordinates: [lon, lat] } }] };
            map.addSource(srcId, { type: 'geojson', data });
            map.addLayer({ id: id+'-circle', type: 'circle', source: srcId, paint: { 'circle-radius': 5, 'circle-color': fill, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
            map.addLayer({ id: id+'-label', type: 'symbol', source: srcId, layout: { 'text-field': ['get','label'], 'text-size': 10, 'text-offset': [0, -1.2], 'text-anchor': 'bottom' }, paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } });
            this._rawLayers.push({ id: id+'-circle', sourceId: srcId });
            this._rawLayers.push({ id: id+'-label', sourceId: srcId });
        } catch (e) {}
    }

    _addTransitHereMarker(lat, lon, name = 'Transit di sini') {
        try {
            const map = this.app.modules.map.getMap();
            const id = 'jp-transit-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const srcId = id + '-src';
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { title: `Transit: ${name}` }, geometry: { type: 'Point', coordinates: [lon, lat] } }] };
            map.addSource(srcId, { type: 'geojson', data });
            map.addLayer({ id, type: 'symbol', source: srcId, layout: { 'text-field': ['get','title'], 'text-size': 11, 'text-offset': [0, -1.2], 'text-anchor': 'bottom' }, paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } });
            this._rawLayers.push({ id, sourceId: srcId });
        } catch (e) {}
    }

    _showLegPopupAt(lng, lat, props) {
        try {
            const mapMod = this.app.modules.map;
            const plan = this._lastPlan;
            if (!plan) return;
            const isWalk = props && props.type === 'walk';
            const head = isWalk ? 'Jalan Kaki' : `Naik ${this._routeLabel(props && props.routeId)}`;
            const sub = isWalk ? (props && props.toStopName ? `Menuju ${props.toStopName}` : '') : `${props && props.fromStopName ? props.fromStopName : ''} → ${props && props.toStopName ? props.toStopName : ''}`;
            const stepsHtml = `<ol style="padding-left:18px;margin:0;">${plan.steps.map(s => `<li class=\"small\" style=\"margin:4px 0;\">${s.text}</li>`).join('')}</ol>`;
            const mode = this._mode || 'balanced';
            const modeLabel = (mode === 'fastest') ? 'Paling cepat' : (mode === 'cheapest' ? 'Paling hemat' : 'Seimbang');
            const modeHtml = `
                <div id="jp-mode-inline" class="btn-group btn-group-sm" role="group" aria-label="Mode">
                    <button type="button" class="btn ${mode==='balanced'?'btn-primary':'btn-outline-primary'}" data-mode="balanced" title="Seimbang"><i class="fa-solid fa-scale-balanced"></i></button>
                    <button type="button" class="btn ${mode==='fastest'?'btn-primary':'btn-outline-primary'}" data-mode="fastest" title="Paling cepat"><i class="fa-solid fa-gauge-high"></i></button>
                    <button type="button" class="btn ${mode==='cheapest'?'btn-primary':'btn-outline-primary'}" data-mode="cheapest" title="Paling hemat"><i class="fa-solid fa-money-bill-wave"></i></button>
                </div>`;
            const html = `
                <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                    <div style="color:#333; padding:4px 0; border-bottom:1px solid #eee; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                        <div style="font-weight:700;">${head}</div>
                        <div style="font-size:10px;color:#f59e0b;font-weight:800;border:1px solid #f59e0b;border-radius:999px;padding:1px 6px;">BETA</div>
                    </div>
                    ${sub ? `<div class="small" style="color:#374151;margin-bottom:6px;">${sub}</div>` : ''}
                    ${(() => { try { const d = this._lastPlan && this._lastPlan.duration; return d ? `<div class=\"small\" style=\"background:#f8fafc;border:1px solid #e5e7f0;border-radius:8px;padding:6px 8px;margin-bottom:6px;\"><span class=\"fw-semibold\">Estimasi tiba:</span> ${d.etaLabel} <span class=\"text-muted\" style=\"font-size:0.85em\">(berdasarkan headway & jalan kaki)</span></div>` : ''; } catch(_) { return ''; } })()}
                    <div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                        <div style="display:flex;gap:6px;align-items:center;"><span class="small" style="color:#6b7280;">Mode:</span> ${modeHtml}</div>
                        <div id="jp-mode-label" class="small" style="color:#6b7280;"><i class="fa-solid ${mode==='balanced'?'fa-scale-balanced':(mode==='fastest'?'fa-gauge-high':'fa-money-bill-wave')}"></i> ${modeLabel}</div>
                    </div>
                    <div style="margin-top:4px;">
                        <div class="small" style="color:#6b7280;margin-bottom:4px;">Langkah lengkap:</div>
                        <div style="max-height:36vh;overflow:auto;">${stepsHtml}</div>
                    </div>
                    <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                        <button id="jp-reset-inline" class="btn btn-sm btn-outline-secondary" style="padding:3px 8px;font-size:11px;">Reset</button>
                    </div>
                </div>
            `;
            this.app.modules.map.setStickyPopup(true);
            mapMod.showHtmlPopupAt(lng, lat, html);
            try { this.app.modules.map.getMap().easeTo({ center: [lng, lat], duration: 250 }); } catch(e){}
            // Bind reset button inside popup
            try {
                const el = this.app.modules.map._currentPopup && this.app.modules.map._currentPopup.getElement && this.app.modules.map._currentPopup.getElement();
                const btn = el && el.querySelector('#jp-reset-inline');
                if (btn) btn.addEventListener('click', () => { try { this.reset(); } catch(_) {} try { this.app.modules.map.closePopup(); } catch(_) {} });
                // Bind mode buttons
                const group = el && el.querySelector('#jp-mode-inline');
                if (group) {
                    const setActive = (activeId) => {
                        group.querySelectorAll('button[data-mode]').forEach(bb => {
                            if (bb.getAttribute('data-mode') === activeId) { bb.classList.remove('btn-outline-primary'); bb.classList.add('btn-primary'); }
                            else { bb.classList.add('btn-outline-primary'); bb.classList.remove('btn-primary'); }
                        });
                        const lbl = el.querySelector('#jp-mode-label');
                        if (lbl) {
                            const text = (activeId === 'fastest') ? 'Paling cepat' : (activeId === 'cheapest' ? 'Paling hemat' : 'Seimbang');
                            const icon = (activeId === 'fastest') ? 'fa-gauge-high' : (activeId === 'cheapest' ? 'fa-money-bill-wave' : 'fa-scale-balanced');
                            lbl.innerHTML = `<i class="fa-solid ${icon}"></i> ${text}`;
                        }
                    };
                    setActive(this._mode || 'balanced');
                    group.querySelectorAll('button[data-mode]').forEach(b => {
                        b.addEventListener('click', (ev) => {
                            try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}
                            const m = b.getAttribute('data-mode');
                            try { localStorage.setItem('jp_mode', m); } catch(_){ }
                            this.setOptimizationMode(m);
                            setActive(m);
                            this.replan();
                        });
                    });
                }
            } catch (e) {}
        } catch (e) {}
    }

    _routeLabel(routeId) {
        try {
            const r = (this.app.modules.gtfs.getRoutes() || []).find(rr => String(rr.route_id||'') === String(routeId));
            return r ? (r.route_short_name || r.route_id) : String(routeId || '');
        } catch (e) { return String(routeId || ''); }
    }

    _computeShapeSegmentForLeg(leg, stopsById) {
        try {
            const rid = String(leg.routeId || '');
            if (!rid) return null;
            const gtfs = this.app.modules.gtfs;
            const routeMgr = this.app.modules.routes;
            const trips = (gtfs.getTrips() || []).filter(t => String(t.route_id || '') === rid);
            if (!trips || trips.length === 0 || !routeMgr || typeof routeMgr.getShapesForTrips !== 'function') return null;
            const shapes = routeMgr.getShapesForTrips(trips) || [];
            const firstStop = stopsById.get(String(leg.stops[0]));
            const lastStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
            if (!firstStop || !lastStop) return null;
            const aLat = parseFloat(firstStop.stop_lat), aLon = parseFloat(firstStop.stop_lon);
            const bLat = parseFloat(lastStop.stop_lat), bLon = parseFloat(lastStop.stop_lon);

            let bestSeg = null;
            let bestScore = Infinity;
            // Limit work to avoid freezes
            const MAX_SHAPES = 60;
            let checked = 0;
            for (const shp of shapes) {
                if (++checked > MAX_SHAPES) break;
                if (!Array.isArray(shp) || shp.length < 2) continue;
                const idxA = this._nearestIdx(shp, aLat, aLon);
                const idxB = this._nearestIdx(shp, bLat, bLon);
                if (idxA < 0 || idxB < 0) continue;
                // Ensure proper direction based on stop sequence
                let i0 = idxA, i1 = idxB;
                
                // Check if we need to reverse based on actual route direction
                // by looking at a few intermediate stops if available
                if (leg.stops.length > 2) {
                    const midStopId = leg.stops[Math.floor(leg.stops.length / 2)];
                    const midStop = stopsById.get(String(midStopId));
                    if (midStop) {
                        const midLat = parseFloat(midStop.stop_lat);
                        const midLon = parseFloat(midStop.stop_lon);
                        const idxMid = this._nearestIdx(shp, midLat, midLon);
                        
                        // If middle stop suggests order, use it to determine direction
                        if (idxMid >= 0) {
                            // Check if midpoint is between start and end in shape
                            const isForward = (idxA < idxMid && idxMid < idxB);
                            const isBackward = (idxB < idxMid && idxMid < idxA);
                            
                            if (isForward) {
                                // Normal forward order (A -> Mid -> B)
                                i0 = idxA;
                                i1 = idxB;
                            } else if (isBackward) {
                                // Reversed order (B -> Mid -> A), swap them
                                i0 = idxB;
                                i1 = idxA;
                            } else {
                                // Ambiguous case: use shortest path between A and B
                                // ALWAYS prefer shorter segment over full shape
                                if (i0 > i1) { const tmp = i0; i0 = i1; i1 = tmp; }
                            }
                        } else {
                            // No midpoint found, ensure forward direction
                            if (i0 > i1) { const tmp = i0; i0 = i1; i1 = tmp; }
                        }
                    } else {
                        // No midpoint available, ensure forward direction
                        if (i0 > i1) { const tmp = i0; i0 = i1; i1 = tmp; }
                    }
                } else {
                    // For 2-stop segments, ensure forward direction
                    if (i0 > i1) { const tmp = i0; i0 = i1; i1 = tmp; }
                }
                
                // Check distance from start/end halte to nearest shape points BEFORE expansion
                const distToStart = this._haversine(aLat, aLon, shp[i0].lat, shp[i0].lng);
                const distToEnd = this._haversine(bLat, bLon, shp[i1].lat, shp[i1].lng);
                
                // CRITICAL: Reject if shape points are too far from actual halte
                // This prevents using wrong segments (e.g., starting from Lapangan Banteng instead of Jembatan Merah)
                if (distToStart > 100 || distToEnd > 100) {
                    console.warn(`⚠️ Rejecting segment: too far from halte (start: ${distToStart.toFixed(0)}m, end: ${distToEnd.toFixed(0)}m)`);
                    continue;
                }
                
                // Minimal expansion - only extend if very close to halte
                let expansion = 0;
                if (distToStart < 20) expansion = 1; // Only expand 1 point if very close
                
                i0 = Math.max(0, i0 - expansion);
                i1 = Math.min(shp.length - 1, i1 + expansion);
                
                // Validate segment length - reject if too long (likely wrong segment)
                const segmentLength = Math.abs(i1 - i0);
                const maxReasonableLength = Math.floor(shp.length * 0.7); // Max 70% of total shape
                
                if (segmentLength > maxReasonableLength) {
                    console.warn(`⚠️ Rejecting segment: too long (${segmentLength}/${shp.length} points, ${Math.round(segmentLength/shp.length*100)}%)`);
                    continue; // Skip this shape, try next one
                }
                
                const pts = shp.slice(i0, i1 + 1);
                if (pts.length < 2) continue;
                
                // Score = distance from endpoints to nearest vertices (smaller is better)
                // HEAVILY penalize distance from halte to segment start/end
                const da = this._eu2(aLat, aLon, pts[0].lat, pts[0].lng);
                const db = this._eu2(bLat, bLon, pts[pts.length - 1].lat, pts[pts.length - 1].lng);
                
                // CRITICAL: Very heavy penalty for endpoint mismatch (100x multiplier)
                const endpointPenalty = (da + db) * 100;
                
                const segLen = pts.length;
                // prefer segments that are not too short (avoid half-drawn)
                const lengthPenalty = segLen < 6 ? (6 - segLen) * 1e-6 : 0;
                const score = endpointPenalty + lengthPenalty;
                
                if (score < bestScore) {
                    bestScore = score;
                    bestSeg = pts.map(p => [p.lat, p.lng]);
                    console.log(`✅ Found segment: ${segLen} points (${Math.round(segLen/shp.length*100)}% of shape), score: ${score.toFixed(6)}, distStart: ${distToStart.toFixed(0)}m, distEnd: ${distToEnd.toFixed(0)}m`);
                    if (bestScore < 0.001) break; // good enough (very close match)
                }
            }
            
            if (bestSeg) {
                const segStart = bestSeg[0];
                const segEnd = bestSeg[bestSeg.length - 1];
                const finalDistStart = this._haversine(aLat, aLon, segStart[0], segStart[1]);
                const finalDistEnd = this._haversine(bLat, bLon, segEnd[0], segEnd[1]);
                console.log(`🎯 Using best segment for ${this._routeLabel(rid)}: ${bestSeg.length} points`);
                console.log(`   From: ${firstStop.stop_name} (offset: ${finalDistStart.toFixed(0)}m)`);
                console.log(`   To: ${lastStop.stop_name} (offset: ${finalDistEnd.toFixed(0)}m)`);
                console.log(`   Best score: ${bestScore.toFixed(6)}`);
            } else {
                console.warn(`⚠️ No valid segment found for ${this._routeLabel(rid)} (${firstStop.stop_name} → ${lastStop.stop_name})`);
            }
            
            return bestSeg;
        } catch (e) { return null; }
    }

    _routeColorHex(routeId) {
        try {
            const r = (this.app.modules.gtfs.getRoutes() || []).find(rr => String(rr.route_id||'') === String(routeId));
            if (!r) return '#2563eb';
            const hex = r.route_color ? ('#' + r.route_color) : '#2563eb';
            return hex;
        } catch (e) { return '#2563eb'; }
    }

    _nearestIdx(points, lat, lon) {
        let best = -1, bestD = Infinity;
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const d = this._eu2(lat, lon, p.lat, p.lng);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    _eu2(lat1, lon1, lat2, lon2) {
        const dx = lat1 - lat2; const dy = lon1 - lon2; return dx*dx + dy*dy;
    }

    _clearMapArtifacts() {
        const mapMod = this.app.modules.map;
        // Cancel any scheduled draws
        this._drawSeq++;
        if (this._layers && this._layers.length) {
            for (const id of this._layers) {
                try { mapMod.removeMarker(id); } catch(e) {}
            }
        }
        this._layers = [];
        if (this._markers && this._markers.length) {
            for (const id of this._markers) {
                try { mapMod.removeMarker(id); } catch(e) {}
            }
        }
        this._markers = [];
        // Remove raw maplibre layers/sources
        try {
            const map = mapMod.getMap();
            if (this._rawLayers && this._rawLayers.length) {
                for (const ent of this._rawLayers) {
                    try { if (ent.onClick && ent.hitId) map.off('click', ent.hitId, ent.onClick); } catch(e) {}
                    try { if (ent.onEnter && ent.hitId) map.off('mouseenter', ent.hitId, ent.onEnter); } catch(e) {}
                    try { if (ent.onLeave && ent.hitId) map.off('mouseleave', ent.hitId, ent.onLeave); } catch(e) {}
                    try { if (map.getLayer(ent.hitId)) map.removeLayer(ent.hitId); } catch(e) {}
                    try { if (map.getLayer(ent.id)) map.removeLayer(ent.id); } catch(e) {}
                    try { if (map.getSource(ent.sourceId)) map.removeSource(ent.sourceId); } catch(e) {}
                }
            }
        } catch (e) {}
        this._rawLayers = [];
        try { this.app.modules.map.setStickyPopup(false); } catch (e) {}
    }

    _ensureUI() {
        // Panel fullscreen logic removed; we use popups only now
    }

    _setStatus(text) {
        // Panel fullscreen logic removed; we use popups only now
    }

    _setSteps(steps) {
        // Panel fullscreen logic removed; we use popups only now
    }

    _fmtDist(m) {
        if (!m || !isFinite(m)) return '-';
        return m < 1000 ? `${Math.round(m)} m` : `${(m/1000).toFixed(2)} km`;
    }

    _haversine(lat1, lon1, lat2, lon2) {
        const toRad = x => x * Math.PI / 180;
        const R = 6371e3;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    _buildFullStepsPopupHTML(title, steps) {
        const stepsHtml = `<ol style="padding-left:18px;margin:0;">${steps.map(s => `<li class=\"small\" style=\"margin:4px 0;\">${s.text}</li>`).join('')}</ol>`;
        let fareHtml = '';
        try {
            const fare = this._lastPlan && this._lastPlan.fare;
            if (fare && isFinite(fare.total)) {
                const rp = new Intl.NumberFormat('id-ID').format(fare.total);
                fareHtml = `<div class="small" style="color:#111827;margin:6px 0 8px 0;"><b>Perkiraan tarif:</b> Rp${rp}</div>`;
            }
        } catch (_) {}
        const mode = this._mode || 'balanced';
        const modeLabel = (mode === 'fastest') ? 'Paling cepat' : (mode === 'cheapest' ? 'Paling hemat' : 'Seimbang');
        const durHtml = (() => { try { const d = this._lastPlan && this._lastPlan.duration; if (!d) return ''; const mins = Math.max(1, Math.round((d.totalSec||0)/60)); return `<div class=\"small\" style=\"background:#f8fafc;border:1px solid #e5e7f0;border-radius:8px;padding:6px 8px;margin:6px 0;\"><span class=\"fw-semibold\">Estimasi durasi:</span> ${mins} menit • Tiba sekitar ${d.etaLabel}</div>`; } catch(_) { return ''; } })();
        const modeHtml = `
            <div id="jp-mode-inline" class="btn-group btn-group-sm" role="group" aria-label="Mode">
                <button type="button" class="btn ${mode==='balanced'?'btn-primary':'btn-outline-primary'}" data-mode="balanced" title="Seimbang"><i class="fa-solid fa-scale-balanced"></i></button>
                <button type="button" class="btn ${mode==='fastest'?'btn-primary':'btn-outline-primary'}" data-mode="fastest" title="Paling cepat"><i class="fa-solid fa-gauge-high"></i></button>
                <button type="button" class="btn ${mode==='cheapest'?'btn-primary':'btn-outline-primary'}" data-mode="cheapest" title="Paling hemat"><i class="fa-solid fa-money-bill-wave"></i></button>
            </div>`;
        return `
            <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                <div style="color:#333; padding:4px 0; border-bottom:1px solid #eee; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-weight:700;">${title}</div>
                    <div style="font-size:10px;color:#f59e0b;font-weight:800;border:1px solid #f59e0b;border-radius:999px;padding:1px 6px;">BETA</div>
                </div>
                ${durHtml}
                <div style="margin-bottom:8px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
                    <div style="display:flex;gap:6px;align-items:center;"><span class="small" style="color:#6b7280;">Mode:</span> ${modeHtml}</div>
                    <div id="jp-mode-label" class="small" style="color:#6b7280;"><i class="fa-solid ${mode==='balanced'?'fa-scale-balanced':(mode==='fastest'?'fa-gauge-high':'fa-money-bill-wave')}"></i> ${modeLabel}</div>
                </div>
                ${fareHtml}
                <div style="max-height:36vh;overflow:auto;">${stepsHtml}</div>
                <div style="margin-top:8px;display:flex;justify-content:flex-end;">
                    <button id="jp-reset-inline" class="btn btn-sm btn-outline-secondary" style="padding:3px 8px;font-size:11px;">Reset</button>
                </div>
            </div>
        `;
    }

    _addTextAt(lat, lon, text, color = '#111827') {
        try {
            const map = this.app.modules.map.getMap();
            const id = 'jp-txt-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            const srcId = id + '-src';
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { label: text }, geometry: { type: 'Point', coordinates: [lon, lat] } }] };
            map.addSource(srcId, { type: 'geojson', data });
            map.addLayer({ id, type: 'symbol', source: srcId, layout: { 'text-field': ['get','label'], 'text-size': 10, 'text-anchor': 'center' }, paint: { 'text-color': color, 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 } });
            this._rawLayers.push({ id, sourceId: srcId });
        } catch (e) {}
    }

    rebuildOverlaysAfterStyleChange() {
        try {
            if (!this.enabled || !this._lastPlan || !this.origin || !this.destination) return;
            const { startStop, goalStop, legs, steps } = this._lastPlan;
            // Re-render overlays with steps
            this._renderPlan(startStop, goalStop, legs, steps || []);
            // Restore sticky popup
            if (steps && steps.length) {
                const html = this._buildFullStepsPopupHTML('Rencana Perjalanan', steps);
                const lng = parseFloat(startStop.stop_lon), lat = parseFloat(startStop.stop_lat);
                this.app.modules.map.setStickyPopup(true);
                this.app.modules.map.showHtmlPopupAt(lng, lat, html);
                try {
                    const el = this.app.modules.map._currentPopup && this.app.modules.map._currentPopup.getElement && this.app.modules.map._currentPopup.getElement();
                    const btn = el && el.querySelector('#jp-reset-inline');
                    if (btn) btn.addEventListener('click', () => { try { this.reset(); } catch(_) {} try { this.app.modules.map.closePopup(); } catch(_) {} });
                    // Bind mode buttons in restored popup
                    const group = el && el.querySelector('#jp-mode-inline');
                    if (group) {
                        const setActive = (activeId) => {
                            group.querySelectorAll('button[data-mode]').forEach(b => {
                                if (b.getAttribute('data-mode') === activeId) { b.classList.remove('btn-outline-primary'); b.classList.add('btn-primary'); }
                                else { b.classList.add('btn-outline-primary'); b.classList.remove('btn-primary'); }
                            });
                        };
                        setActive(this._mode || 'balanced');
                        group.querySelectorAll('button[data-mode]').forEach(b => {
                            b.addEventListener('click', (ev) => {
                                try { ev.preventDefault(); ev.stopPropagation(); } catch(_){}
                                const m = b.getAttribute('data-mode');
                                try { localStorage.setItem('jp_mode', m); } catch(_){ }
                                this.setOptimizationMode(m);
                                setActive(m);
                                this.replan();
                            });
                        });
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    // Public: compute a plan between two stop_ids without rendering on the map
    computePlanByStopIds(startStopId, endStopId, mode = 'balanced') {
        try {
            if (!startStopId || !endStopId) return null;
            if (!this._graphBuilt) {
                try { this._buildGraph(); } catch (e) {}
            }
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const stopsById = new Map(stops.map(s => [String(s.stop_id || ''), s]));
            const startStop = stopsById.get(String(startStopId));
            const goalStop = stopsById.get(String(endStopId));
            if (!startStop || !goalStop) return null;

            const originalMode = this._mode;
            this._mode = String(mode || originalMode || 'balanced');

            // Find path with fallbacks similar to _plan()
            let path = this._findPath(String(startStopId), String(endStopId));
            if (!path || path.length === 0) { try { this._addFallbackWalkEdges(1); } catch (_) {} path = this._findPath(String(startStopId), String(endStopId)); }
            if ((!path || path.length === 0) && this._mode !== 'balanced') {
                const save = this._mode; this._mode = 'balanced';
                path = this._findPath(String(startStopId), String(endStopId));
                this._mode = save;
            }
            if (!path || path.length === 0) { try { this._addFallbackWalkEdges(2); } catch (_) {} path = this._findPath(String(startStopId), String(endStopId)); }
            if (!path || path.length === 0) { this._mode = originalMode; return null; }

            const legs = this._groupByRoute(path);
            // Build steps (no initial/final walking from free coords)
            const steps = [];
            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                const first = stopsById.get(String(leg.stops[0]));
                const last = stopsById.get(String(leg.stops[leg.stops.length - 1]));
                const name = (() => { try { const routes = gtfs.getRoutes() || []; const r = routes.find(rr => String(rr.route_id || '') === String(leg.routeId)); return r ? (r.route_short_name || r.route_id) : leg.routeId; } catch (_) { return leg.routeId; } })();
                steps.push({ type: 'ride', text: `Naik ${name} dari ${first?.stop_name} ke ${last?.stop_name}` });
                if (i < legs.length - 1) {
                    const nextFirst = stopsById.get(String(legs[i + 1].stops[0]));
                    if (last && nextFirst) {
                        const d = this._haversine(parseFloat(last.stop_lat), parseFloat(last.stop_lon), parseFloat(nextFirst.stop_lat), parseFloat(nextFirst.stop_lon));
                        steps.push({ type: 'transfer', text: `Transit di ${last.stop_name}` });
                        if (d > 1) steps.push({ type: 'walk', text: `Jalan ke ${nextFirst.stop_name} (${this._fmtDist(d)})` });
                    }
                }
            }
            const fare = this._estimateFare(legs);
            const duration = this._estimateJourneyDuration(startStop, goalStop, legs, 0, 0);
            const plan = { startStop, goalStop, legs, steps, fare, duration, mode: this._mode };
            this._mode = originalMode;
            return plan;
        } catch (e) { return null; }
    }

    // Public: render computed plan on map and show steps popup
    showPlanOnMap(plan) {
        try {
            if (!plan || !plan.startStop || !plan.goalStop || !Array.isArray(plan.legs)) return;
            // Set internal state for proper rendering
            this.origin = { lat: parseFloat(plan.startStop.stop_lat), lon: parseFloat(plan.startStop.stop_lon) };
            this.destination = { lat: parseFloat(plan.goalStop.stop_lat), lon: parseFloat(plan.goalStop.stop_lon) };
            this._lastPlan = { ...plan };
            this._clearMapArtifacts();
            this._renderPlan(plan.startStop, plan.goalStop, plan.legs, plan.steps || []);
            // Show sticky popup with full steps at origin
            try {
                const mapMod = this.app.modules.map;
                const html = this._buildFullStepsPopupHTML('Rencana Perjalanan', plan.steps || []);
                const lng = parseFloat(plan.startStop.stop_lon), lat = parseFloat(plan.startStop.stop_lat);
                mapMod.setStickyPopup(true);
                mapMod.showHtmlPopupAt(lng, lat, html);
                try {
                    const el = mapMod._currentPopup && mapMod._currentPopup.getElement && mapMod._currentPopup.getElement();
                    const btn = el && el.querySelector('#jp-reset-inline');
                    if (btn) btn.addEventListener('click', () => { try { this.reset(); } catch (_) {} try { this.app.modules.map.closePopup(); } catch (_) {} });
                    const group = el && el.querySelector('#jp-mode-inline');
                    if (group) {
                        const setActive = (activeId) => {
                            group.querySelectorAll('button[data-mode]').forEach(b => {
                                if (b.getAttribute('data-mode') === activeId) { b.classList.remove('btn-outline-primary'); b.classList.add('btn-primary'); }
                                else { b.classList.add('btn-outline-primary'); b.classList.remove('btn-primary'); }
                            });
                        };
                        setActive(this._mode || 'balanced');
                        group.querySelectorAll('button[data-mode]').forEach(b => {
                            b.addEventListener('click', (ev) => {
                                try { ev.preventDefault(); ev.stopPropagation(); } catch (_e) {}
                                const m = b.getAttribute('data-mode');
                                try { localStorage.setItem('jp_mode', m); } catch (_e2) {}
                                this.setOptimizationMode(m);
                                // Try to get cached plan from TypedPlanner first, if not available, re-compute
                                try {
                                    const typedPlanner = this.app.modules.typedPlanner;
                                    const cacheKey = `${String(plan.startStop.stop_id)}|${String(plan.goalStop.stop_id)}|${m}`;
                                    let recomputed = null;
                                    
                                    if (typedPlanner && typedPlanner._cachedPlans && typedPlanner._cachedPlans.has(cacheKey)) {
                                        recomputed = typedPlanner._cachedPlans.get(cacheKey);
                                        console.log(`🗺️ Using cached plan from popup mode switcher: ${cacheKey}`);
                                    } else {
                                        console.log(`⚠️ Plan not in cache, recomputing from popup: ${cacheKey}`);
                                        recomputed = this.computePlanByStopIds(String(plan.startStop.stop_id), String(plan.goalStop.stop_id), m);
                                    }
                                    
                                    if (recomputed) this.showPlanOnMap(recomputed);
                                } catch (_) {}
                            });
                        });
                    }
                } catch (e) {}
            } catch (e) {}
        } catch (e) {}
    }
}