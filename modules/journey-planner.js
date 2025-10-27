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
        // Time-aware planning
        this._when = new Date();
        this._activeServiceByYmdCache = new Map(); // ymd -> Set(service_id)
        this._windowsByRouteYmdCache = new Map(); // `${routeId}|${ymd}` -> Array<{start:number,end:number}>
        this._preferredRoutes = new Set();
        this._planning = false;
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
        console.log('🚀 JourneyPlanner init starting...');
        const startTime = performance.now();
        
        // Try to load pre-built graph from cache FIRST (instant!)
        const cached = this._loadGraphFromCache();
        if (cached) {
            console.log(`⚡ Graph loaded from cache in ${(performance.now() - startTime).toFixed(2)}ms`);
            this._graphBuilt = true;
        } else {
            // Build graph in background only if not cached
        if (!this._graphBuilt && !this._graphBuilding) {
            this._graphBuilding = true;
                console.log('🔧 Building graph in background (not cached)...');
            const schedule = (cb) => { try { (window.requestIdleCallback||window.setTimeout)(cb, 0); } catch(_) { setTimeout(cb,0); } };
            schedule(() => {
                    try { 
                        this._buildGraph();
                        this._saveGraphToCache(); // Save for next time
                    } catch(e) {
                        console.error('Graph build failed:', e);
                    }
                this._graphBuilding = false;
            });
        }
        }
        
        // Load saved optimization mode
        try { const saved = localStorage.getItem('jp_mode'); if (saved) this.setOptimizationMode(saved); } catch(e) {}
        
        console.log(`✅ JourneyPlanner init completed in ${(performance.now() - startTime).toFixed(2)}ms`);
    }

    // Public: set departure/check time for time-aware planning
    setDepartureDateTime(dateObj) {
        try {
            const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
            if (isNaN(d.getTime())) return;
            this._when = d;
        } catch (_) {}
    }
    
    _loadGraphFromCache() {
        try {
            const cached = localStorage.getItem('jp_graph_cache_v2');
            if (!cached) return false;
            
            const data = JSON.parse(cached);
            
            // Restore Map structures
            this._adj = new Map(Object.entries(data.adj || {}).map(([k, v]) => [k, v]));
            this._routesAtStop = new Map(Object.entries(data.routesAtStop || {}).map(([k, v]) => [k, new Set(v)]));
            this._validStops = new Set(data.validStops || []);
            this._parentToChildren = new Map(Object.entries(data.parentToChildren || {}).map(([k, v]) => [k, v]));
            
            console.log(`📦 Graph cache restored: ${this._validStops.size} stops, ${this._adj.size} adjacencies`);
            return true;
        } catch (e) {
            console.warn('Failed to load graph cache:', e);
            return false;
        }
    }
    
    _saveGraphToCache() {
        try {
            const data = {
                adj: Object.fromEntries(this._adj),
                routesAtStop: Object.fromEntries(
                    Array.from(this._routesAtStop.entries()).map(([k, v]) => [k, Array.from(v)])
                ),
                validStops: Array.from(this._validStops),
                parentToChildren: Object.fromEntries(this._parentToChildren),
                timestamp: Date.now()
            };
            
            localStorage.setItem('jp_graph_cache_v2', JSON.stringify(data));
            console.log('💾 Graph cached for instant loading next time');
        } catch (e) {
            console.warn('Failed to save graph cache:', e);
        }
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
            if (this._planning) return;
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
        if (this._planning) return;
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
        this._planning = true;
        const gtfs = this.app.modules.gtfs;
        const stops = gtfs.getStops() || [];
		// Evaluate multiple nearby start/goal candidates to avoid far-away starts
		const startCandidates = this._nearestValidStops(this.origin.lat, this.origin.lon, stops, [200, 300, 450, 650], 5, 700);
		const goalCandidates = this._nearestValidStops(this.destination.lat, this.destination.lon, stops, [200, 300, 450, 650], 5, 700);
		if (!startCandidates.length || !goalCandidates.length) { this._setStatus('Gagal menemukan halte/platform terdekat'); return; }

		const chooseBestPlan = () => {
			let best = null;
			for (const s of startCandidates) {
				for (const g of goalCandidates) {
					let path = this._findPath(String(s.stop_id), String(g.stop_id));
					if (!path || path.length === 0) continue;
					const legs = this._groupByRoute(path);
					const d1 = this._haversine(this.origin.lat, this.origin.lon, parseFloat(s.stop_lat), parseFloat(s.stop_lon));
					const d2 = this._haversine(parseFloat(g.stop_lat), parseFloat(g.stop_lon), this.destination.lat, this.destination.lon);
					const dur = this._estimateJourneyDuration(s, g, legs, d1, d2);
					if (!best || dur.totalSec < best.dur.totalSec) {
						best = { start: s, goal: g, legs, dur };
					}
				}
			}
			return best;
		};

		// First attempt with current graph and mode
		let bestPlan = chooseBestPlan();

		// If none, try adding modest walking edges
		if (!bestPlan) { try { this._addFallbackWalkEdges(1); } catch(_) {} bestPlan = chooseBestPlan(); }

		// If still none and not in balanced mode, try balanced mode
		if (!bestPlan && this._mode !== 'balanced') {
			const originalMode = this._mode; this._mode = 'balanced';
			bestPlan = chooseBestPlan();
			this._mode = originalMode;
        }
        
        // Final attempt with more walking edges
		if (!bestPlan) { try { this._addFallbackWalkEdges(2); } catch(_) {} bestPlan = chooseBestPlan(); }
        
        if (!bestPlan) {
            const mapMod = this.app.modules.map;
            this._setStatus('Tidak ditemukan jalur layanan. Geser titik awal/tujuan untuk mencoba lagi.');
            try {
                const html = `
					<div class=\"stop-popup plus-jakarta-sans\" style=\"min-width: 220px; max-width: 330px; padding: 10px 12px;\">\n\t\t\t\t\t<div style=\"color:#b91c1c; font-weight:700;\">Rencana tidak ditemukan</div>\n\t\t\t\t\t<div class=\"small\" style=\"color:#6b7280; margin-top:6px;\">Geser marker titik awal atau tujuan agar lebih dekat ke koridor/halte.</div>\n\t\t\t\t\t<div class=\"small\" style=\"color:#6b7280; margin-top:6px;\">Tips: dekatkan ke jalan utama atau halte besar.</div>\n\t\t\t\t</div>`;
                if (this.origin && this.destination) {
                    const midLat = (this.origin.lat + this.destination.lat) / 2;
                    const midLon = (this.origin.lon + this.destination.lon) / 2;
                    mapMod.setStickyPopup(true);
                    mapMod.showHtmlPopupAt(midLon, midLat, html);
                }
            } catch (_) {}
            this._planning = false; return; 
        }

		const start = bestPlan.start;
		const goal = bestPlan.goal;
		const grouped = bestPlan.legs;
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
        finally { this._planning = false; }
    }

    _addFallbackWalkEdges(level = 1) {
        try {
            if (!this._validStops || this._validStops.size === 0) return;
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const valids = stops.filter(s => s && this._validStops.has(String(s.stop_id||'')));
			const R = level === 1 ? 200 : 300; // meters - tighter to avoid long walk bridges
			const TOPK = level === 1 ? 5 : 6; // slightly fewer to reduce zig-zag options
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

	// Get up to topK nearest VALID stops within the first radius bucket that yields results,
	// applying a hard distance cap to avoid suggesting very long initial/final walks.
	_nearestValidStops(lat, lon, stops, radii = [200, 300, 450, 650], topK = 5, hardCap = 700) {
		try {
			const results = [];
			let chosenRadius = null;
			for (const r of radii) {
				const bucket = [];
				for (const s of stops) {
					if (!s || !s.stop_lat || !s.stop_lon) continue;
					const sid = String(s.stop_id || '');
					if (!this._validStops.has(sid)) continue;
					const d = this._haversine(lat, lon, parseFloat(s.stop_lat), parseFloat(s.stop_lon));
					if (d <= r) bucket.push({ stop: s, distance: d });
				}
				if (bucket.length) {
					chosenRadius = r;
					bucket.sort((a, b) => a.distance - b.distance);
					for (const item of bucket) {
						if (item.distance <= hardCap) results.push(item);
						if (results.length >= topK) break;
					}
					break;
				}
			}
			return results.map(it => it.stop);
		} catch (_) { return []; }
    }

    _findPath(startId, goalId) {
        // A*-like: minimize weighted distance + transfer penalties with heuristic guidance
        const mode = this._mode || 'balanced';
        const BIG = mode === 'fastest' ? 50000 : (mode === 'cheapest' ? 80000 : 65000); // Reduced BIG values for all modes
        const MAX_TRANSFERS = mode === 'cheapest' ? 4 : (mode === 'fastest' ? 6 : 5); // Increased to allow complex multi-transfer routes
        const TRANSIT_WEIGHT = mode === 'fastest' ? 0.15 : (mode === 'cheapest' ? 0.30 : 0.22); // Fine-tuned weights
        const WALK_WEIGHT = mode === 'fastest' ? 2.0 : (mode === 'cheapest' ? 3.0 : 2.5); // Increased to heavily discourage long walks
        const ALIGHT_WALK_PENALTY = mode === 'fastest' ? Math.round(BIG * 0.3) : (mode === 'cheapest' ? Math.round(BIG * 0.8) : Math.round(BIG * 0.5));
        const MAX_WALK_DISTANCE = 300; // Reduced maximum walking distance for transit
        // Progressive transfer penalty: each additional transfer gets more expensive
        const getTransferPenalty = (transferCount) => {
            if (transferCount === 0) return 0;
            if (transferCount === 1) return BIG * 1.0; // First transfer
            if (transferCount === 2) return BIG * 1.3; // Second transfer - heavier
            if (transferCount === 3) return BIG * 1.7; // Third transfer - much heavier
            return BIG * 2.0; // 4+ transfers - very heavy
        };
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
        const routeShortNameById = new Map(routesList.map(r => [String(r.route_id||''), String(r.route_short_name||'')]));
        const groupPriceByKey = new Map([['BRT', 3500], ['INTEGRASI', 5000], ['OTHER', 4000]]);
        const serviceGroupForRoute = (rid) => {
            try {
                const desc = (routeDescById.get(String(rid)) || '').toLowerCase();
                if (desc.includes('brt')) return 'BRT';
                if (desc.includes('angkutan umum integrasi') || desc.includes('integrasi')) return 'INTEGRASI';
                return 'BRT';
            } catch(_) { return 'BRT'; }
        };
        // Helper to detect JAK routes (typically Mikrotrans with poor frequency)
        const isJAKRoute = (rid) => {
            try {
                const shortName = (routeShortNameById.get(String(rid)) || '').toUpperCase();
                // JAK routes typically have names like JAK01, JAK02, or just "JAK"
                return shortName.includes('JAK') || shortName.match(/^[A-Z]+\d+$/);
            } catch(_) { return false; }
        };
        // JAK penalty: discourage but don't block (applies to all modes)
        const JAK_PENALTY = Math.round(BIG * 0.4); // 40% of BIG constant
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
        const MAX_ITERATIONS = 100000; // Increased limit for complex multi-transfer routes

        const tStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const TIME_BUDGET_MS = 400; // hard cap per search to avoid UI freeze (reduced from 600ms)
        while (pq.length && iterations < MAX_ITERATIONS) {
            iterations++;
            // Check timeout every 500 iterations (not every loop to save perf)
            if (iterations % 500 === 0) {
                const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                if (nowMs - tStart > TIME_BUDGET_MS) {
                    console.warn(`Journey Planner: time budget exceeded (${TIME_BUDGET_MS}ms), aborting search early`);
                    return null; // Return null explicitly to trigger error handling
                }
            }
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
                        // More relaxed detour allowance for complex routes
                        const allowedDetour = mode === 'fastest' ? 400 : (mode === 'cheapest' ? 500 : 450);
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
                    // Time filter: skip routes not operating at selected time
                    if (!this._isRouteOperatingAt(edgeRid, this._when)) {
                        continue;
                    }
                    distComponent = stepDist * TRANSIT_WEIGHT;
                    // Soft preference for shared preferred routes (tie-breaker bias)
                    if (this._preferredRoutes && this._preferredRoutes.has(String(edgeRid))) {
                        edgePenalty -= Math.round(BIG * 0.05);
                    }
                    if (!cur.rid) {
                        nextRid = edgeRid; // boarding, no transfer penalty
                        // JAK route penalty: discourage JAK routes unless they're clearly best
                        if (isJAKRoute(edgeRid)) {
                            edgePenalty += JAK_PENALTY;
                        }
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
                        // JAK route penalty: discourage transferring to JAK routes
                        if (isJAKRoute(edgeRid)) {
                            edgePenalty += JAK_PENALTY;
                        }
                        // Progressive transfer penalty: more transfers = exponentially higher cost
                        const baseTransferPenalty = getTransferPenalty(nextTransfers);
                        // Adjust base penalty by mode and service type
                        if (mode === 'cheapest') {
                            const fromGrp = serviceGroupForRoute(cur.rid);
                            const toGrp = serviceGroupForRoute(edgeRid);
                            // Lighter penalty for BRT-to-BRT (free fare), heavier for cross-system
                            const multiplier = (fromGrp === 'BRT' && toGrp === 'BRT') ? 0.5 : 1.3;
                            edgePenalty += Math.round(baseTransferPenalty * multiplier);
                        } else if (mode === 'fastest') {
                            edgePenalty += Math.round(baseTransferPenalty * 0.9); // Slightly lighter for fastest
                        } else {
                            edgePenalty += Math.round(baseTransferPenalty); // Full progressive penalty for balanced
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
                    // Time filter for in-place transfer / initial boarding
                    if (!this._isRouteOperatingAt(String(r), this._when)) {
                        continue;
                    }
                    if (!cur.rid) {
                        // first boarding, include fare-aware penalty in 'cheapest'
                        let cost2 = cur.cost;
                        let nextFareUsed = cur.fareUsed || '';
                        // JAK route penalty for initial boarding
                        if (isJAKRoute(String(r))) {
                            cost2 += JAK_PENALTY;
                        }
                        // Preferred route bias
                        if (this._preferredRoutes && this._preferredRoutes.has(String(r))) {
                            cost2 -= Math.round(BIG * 0.05);
                        }
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
                        // Progressive transfer penalty for in-place transfers
                        const nextTransfers = cur.transfers + 1;
                        const baseTransferPenalty = getTransferPenalty(nextTransfers);
                        
                        let basePen;
                        if (mode === 'cheapest') {
                            const fromGrp = serviceGroupForRoute(cur.rid);
                            const toGrp = serviceGroupForRoute(String(r));
                            // Lighter for BRT-to-BRT, heavier for cross-system
                            const multiplier = (fromGrp === 'BRT' && toGrp === 'BRT') ? 0.5 : 1.3;
                            basePen = Math.round(baseTransferPenalty * multiplier);
                        } else if (mode === 'fastest') {
                            basePen = Math.round(baseTransferPenalty * 0.9);
                        } else {
                            basePen = Math.round(baseTransferPenalty);
                        }
                        
                        let cost2 = cur.cost + basePen;
                        let nextFareUsed = cur.fareUsed || '';
                        // JAK route penalty for transfers
                        if (isJAKRoute(String(r))) {
                            cost2 += JAK_PENALTY;
                        }
                        // Preferred route bias
                        if (this._preferredRoutes && this._preferredRoutes.has(String(r))) {
                            cost2 -= Math.round(BIG * 0.05);
                        }
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

        // No longer need to parse steps - draw walking paths based on actual distance only

        // Draw walking: origin -> startStop (based on distance only, not steps)
        const dStart = this._haversine(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon));
        if (dStart > 10) { // Draw if distance is significant (>10m to avoid clutter)
            console.log(`  🚶 Drawing initial walk to ${startStop.stop_name}: ${dStart.toFixed(0)}m`);
            this._drawWalk(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon), 
                { type: 'walk', toStopName: startStop.stop_name, preferStraight: dStart <= 100, ensureComplete: true });
        } else {
            console.log(`  ⏭️ Skipping initial walk: too short (${dStart.toFixed(0)}m)`);
        }
        
        // Draw walking: goalStop -> destination (based on distance only, not steps)
        const dEnd = this._haversine(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon);
        if (dEnd > 10) { // Draw if distance is significant (>10m to avoid clutter)
            console.log(`  🚶 Drawing final walk to destination: ${dEnd.toFixed(0)}m`);
            this._drawWalk(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon, 
                { type: 'walk', toStopName: 'Tujuan', preferStraight: dEnd <= 100, ensureComplete: true });
        } else {
            console.log(`  ⏭️ Skipping final walk: too short (${dEnd.toFixed(0)}m)`);
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
                // Fallback: stitch per-stop segments into a single polyline (avoid label spam)
                const firstStop = stopsById.get(String(leg.stops[0]));
                const lastStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
                const merged = [];

                for (let i = 0; i < leg.stops.length - 1; i++) {
                    const a = stopsById.get(String(leg.stops[i]));
                    const b = stopsById.get(String(leg.stops[i+1]));
                    if (!a || !b) continue;

                    // Try to get shape segment for this stop pair
                    const tmpLeg = { routeId: leg.routeId, stops: [String(a.stop_id), String(b.stop_id)] };
                    const seg = this._computeShapeSegmentForLeg(tmpLeg, stopsById);
                    const coords = (seg && seg.length >= 2)
                        ? seg
                        : [[parseFloat(a.stop_lat), parseFloat(a.stop_lon)], [parseFloat(b.stop_lat), parseFloat(b.stop_lon)]];

                    if (merged.length > 0 && coords.length > 0) {
                        const last = merged[merged.length - 1];
                        const first = coords[0];
                        if (Math.abs(last[0] - first[0]) < 1e-6 && Math.abs(last[1] - first[1]) < 1e-6) {
                            merged.push(...coords.slice(1));
                        } else {
                            merged.push(...coords);
                        }
                    } else {
                        merged.push(...coords);
                    }
                }

                if (merged.length >= 2) {
                    this._drawPolyline(merged, color, 4.5, 0.9, null, {
                        type: 'transit',
                        routeId: String(leg.routeId),
                        fromStopName: firstStop?.stop_name,
                        toStopName: lastStop?.stop_name
                    });

                    try {
                        legEndpoints[index] = {
                            start: merged[0],
                            end: merged[merged.length - 1],
                            fromId: String(leg.stops[0]),
                            toId: String(leg.stops[leg.stops.length - 1])
                        };
                    } catch (_) {}

                    // One label for entire leg
                    this._addLineLabel(merged, `Naik ${this._routeLabel(leg.routeId)}`, color);

                    // Start/end text once
                    try {
                        const [sLat, sLon] = merged[0];
                        const plat = (firstStop && String(firstStop.platform_code || '').trim()) || '';
                        this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${firstStop?.stop_name || ''}${plat ? ' (Platform ' + plat + ')' : ''}`, color);
                    } catch (e) {}
                    try {
                        const [eLat, eLon] = merged[merged.length - 1];
                        this._addTextAt(eLat, eLon, `Turun di ${lastStop?.stop_name || ''}`, color);
                    } catch (e) {}
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

        // Draw walking between transfer stops (based on distance only)
        console.log(`🔄 Checking ${legs.length - 1} potential transfers...`);
        for (let i = 0; i < legs.length - 1; i++) {
            const currLastId = String(legs[i].stops[legs[i].stops.length - 1]);
            const nextFirstId = String(legs[i+1].stops[0]);
            
            // Skip if same stop (no walking needed)
            if (currLastId === nextFirstId) {
                console.log(`  ⏭️ Same stop, no walking needed`);
                continue;
            }
            
            // Get stop objects
            const a = stopsById.get(currLastId);
            const b = stopsById.get(nextFirstId);
            if (!a || !b) continue;
            
            // Calculate actual distance
            const stopDistance = this._haversine(parseFloat(a.stop_lat), parseFloat(a.stop_lon), parseFloat(b.stop_lat), parseFloat(b.stop_lon));
            
            // Only draw if distance is significant (>20m to avoid clutter for same platform)
            if (stopDistance > 20) {
            console.log(`  🚶 Drawing transfer walk: ${a.stop_name} → ${b.stop_name} (${stopDistance.toFixed(0)}m)`);
                this._drawWalk(
                    parseFloat(a.stop_lat), parseFloat(a.stop_lon),
                    parseFloat(b.stop_lat), parseFloat(b.stop_lon),
                    { type: 'walk', toStopName: b.stop_name, preferStraight: stopDistance <= 150, ensureComplete: true }
                );
            } else {
                console.log(`  ⏭️ Too short (${stopDistance.toFixed(0)}m), skipping visual`);
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

    // Public: set departure date/time for planning
    setDepartureDateTime(date) {
        try {
            if (date instanceof Date && !isNaN(date.getTime())) {
                this._when = date;
            } else {
                this._when = new Date();
            }
        } catch (_) { this._when = new Date(); }
    }

    // Public: set preferred routeIds to bias path selection (used for shared plan consistency)
    setPreferredRoutes(routeIds) {
        try {
            this._preferredRoutes = new Set((routeIds || []).map(r => String(r)));
        } catch (_) { this._preferredRoutes = new Set(); }
    }

    _ymdOf(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${d}`;
    }

    _getActiveServicesForYmd(ymd) {
        try {
            const key = String(ymd);
            if (this._activeServiceByYmdCache.has(key)) return this._activeServiceByYmdCache.get(key);
            const gtfs = this.app.modules.gtfs;
            const calendar = gtfs.getCalendar ? (gtfs.getCalendar() || []) : [];
            const calendarDates = gtfs.getCalendarDates ? (gtfs.getCalendarDates() || []) : [];
            const serviceMap = new Map(); // service_id -> entries
            calendar.forEach(cal => {
                const sid = String(cal.service_id || '');
                if (!serviceMap.has(sid)) serviceMap.set(sid, []);
                serviceMap.get(sid).push(cal);
            });
            const y = parseInt(ymd.slice(0,4),10);
            const m = parseInt(ymd.slice(4,6),10);
            const d = parseInt(ymd.slice(6,8),10);
            const dateObj = new Date(y, m-1, d);
            const dayIdx = dateObj.getDay(); // 0=Sun..6=Sat
            const dayField = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][dayIdx];
            const active = new Set();
            for (const [sid, entries] of serviceMap.entries()) {
                let on = false;
                for (const cal of entries) {
                    try {
                        if (String(cal[dayField]) !== '1') continue;
                        const sd = cal.start_date; const ed = cal.end_date;
                        if (!sd || !ed) continue;
                        if (String(sd) <= ymd && ymd <= String(ed)) { on = true; break; }
                    } catch(_) {}
                }
                if (on) active.add(sid);
            }
            // Apply exceptions
            const ex = calendarDates.filter(cd => String(cd.date) === ymd);
            for (const e of ex) {
                const sid = String(e.service_id || '');
                const type = String(e.exception_type || '');
                if (type === '1') active.add(sid);
                else if (type === '2') active.delete(sid);
            }
            this._activeServiceByYmdCache.set(key, active);
            return active;
        } catch (_) { return new Set(); }
    }

    _getRouteWindowsForYmd(routeId, ymd) {
        try {
            const key = `${String(routeId)}|${String(ymd)}`;
            if (this._windowsByRouteYmdCache.has(key)) return this._windowsByRouteYmdCache.get(key);
            const gtfs = this.app.modules.gtfs;
            const tripsAll = (gtfs.getTrips() || []).filter(t => String(t.route_id||'') === String(routeId));
            const activeServices = this._getActiveServicesForYmd(ymd);
            const activeTrips = tripsAll.filter(t => activeServices.has(String(t.service_id || '')));
            const frequencies = gtfs.getFrequencies ? (gtfs.getFrequencies() || []) : [];
            const stopTimes = gtfs.getStopTimes ? (gtfs.getStopTimes() || []) : [];
            const byTripStopTimes = new Map();
            // Only build stop_times index for relevant trips
            for (const st of stopTimes) {
                const tid = String(st.trip_id || '');
                // Early skip if not in active trips
                // Build a set once
            }
            const activeTripIds = new Set(activeTrips.map(t => String(t.trip_id||'')));
            for (const st of stopTimes) {
                const tid = String(st.trip_id || '');
                if (!activeTripIds.has(tid)) continue;
                if (!byTripStopTimes.has(tid)) byTripStopTimes.set(tid, []);
                byTripStopTimes.get(tid).push(st);
            }
            const byTripFreq = new Map();
            for (const f of frequencies) {
                const tid = String(f.trip_id || '');
                if (!activeTripIds.has(tid)) continue;
                if (!byTripFreq.has(tid)) byTripFreq.set(tid, []);
                byTripFreq.get(tid).push(f);
            }
            const parse = (v) => this._parseTimeToSec(v);
            const windows = [];
            // Frequencies windows
            for (const [tid, arr] of byTripFreq.entries()) {
                for (const f of arr) {
                    const s = parse(f.start_time);
                    const e = parse(f.end_time);
                    if (isFinite(s) && isFinite(e) && e > s) windows.push({ start: s, end: e });
                }
            }
            // Stop times windows (min departure to max arrival per trip)
            for (const [tid, arr] of byTripStopTimes.entries()) {
                let minT = Infinity, maxT = -Infinity;
                for (const st of arr) {
                    const a = parse(st.arrival_time);
                    const d = parse(st.departure_time);
                    if (isFinite(a)) { if (a < minT) minT = a; if (a > maxT) maxT = a; }
                    if (isFinite(d)) { if (d < minT) minT = d; if (d > maxT) maxT = d; }
                }
                if (isFinite(minT) && isFinite(maxT) && maxT > minT) {
                    windows.push({ start: minT, end: maxT });
                }
            }
            // Merge overlapping windows for efficiency
            windows.sort((a,b) => a.start - b.start);
            const merged = [];
            for (const w of windows) {
                if (!merged.length || w.start > merged[merged.length-1].end) {
                    merged.push({ start: w.start, end: w.end });
                } else {
                    merged[merged.length-1].end = Math.max(merged[merged.length-1].end, w.end);
                }
            }
            this._windowsByRouteYmdCache.set(key, merged);
            return merged;
        } catch (_) { return []; }
    }

    _isRouteOperatingAt(routeId, when) {
        try {
            const dt = when instanceof Date ? when : new Date();
            const ymd = this._ymdOf(dt);
            const sec = dt.getHours()*3600 + dt.getMinutes()*60 + dt.getSeconds();
            // Check windows for today
            const winToday = this._getRouteWindowsForYmd(routeId, ymd);
            for (const w of winToday) { if (sec >= w.start && sec <= w.end) return true; }
            // Check spillover from previous day (times > 24h)
            const prev = new Date(dt.getTime() - 24*3600*1000);
            const ymdPrev = this._ymdOf(prev);
            const winPrev = this._getRouteWindowsForYmd(routeId, ymdPrev);
            const secPlus = sec + 24*3600;
            for (const w of winPrev) { if (secPlus >= w.start && secPlus <= w.end) return true; }
            return false;
        } catch (_) { return true; }
    }

    // Public wrapper for external modules (TypedPlanner) to query operation time accurately
    isRouteOperatingAt(routeId, when) {
        return this._isRouteOperatingAt(routeId, when);
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
        // ETA clock time based on selected departure time (this._when)
        const base = (this._when instanceof Date && !isNaN(this._when.getTime())) ? this._when : new Date();
        const eta = new Date(base.getTime() + totalSec * 1000);
        return { totalSec, parts, etaISO: eta.toISOString(), etaLabel: eta.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) };
    }

    _estimateFare(legs) {
        try {
            const gtfs = this.app.modules.gtfs;
            const routes = gtfs.getRoutes() || [];
            const stops = gtfs.getStops() || [];
            const fareRules = gtfs.getFareRules() || [];
            const fareAttributes = gtfs.getFareAttributes() || [];
            const stopsById = new Map(stops.map(s => [String(s.stop_id||''), s]));
            const routesById = new Map(routes.map(r => [String(r.route_id||''), r]));
            
            // Get payment method from UI
            const paymentMethodEl = document.getElementById('jpPaymentMethod');
            const paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'jaklingko';
            const useJakLingko = paymentMethod === 'jaklingko'; // JakLingko integration
            
            // Build fare map: route_id -> fare
            const fareMap = new Map();
            fareRules.forEach(rule => {
                const fareId = String(rule.fare_id || '');
                const routeId = String(rule.route_id || '');
                const fareAttr = fareAttributes.find(fa => String(fa.fare_id || '') === fareId);
                if (fareAttr && routeId) {
                    const price = parseFloat(fareAttr.price || 0);
                    fareMap.set(routeId, price);
                }
            });
            
            if (!legs || !legs.length) return null;
            
            // Helper to get fare for a route
            const getRouteFare = (routeId) => {
                const fare = fareMap.get(String(routeId));
                // Return fare from GTFS, or default 3500 if not found
                return fare !== undefined ? fare : 3500;
            };
            
            // Helper to check if stop is at BRT halte (NOT Pengumpan/Feeder halte)
            const isAtBRTHalte = (stopId) => {
                const sid = String(stopId || '');
                // BRT halte: stop_id does NOT start with 'B'
                // Pengumpan halte: stop_id starts with 'B'
                return !sid.startsWith('B');
            };
            
            let total = 0;
            const breakdown = [];
            let paidBRTIntegration = false; // Track if we've entered BRT system (paid once)
            
            for (let i = 0; i < legs.length; i++) {
                const leg = legs[i];
                const rid = String(leg.routeId||'');
                const firstStopId = String(leg.stops[0] || '');
                const lastStopId = String(leg.stops[leg.stops.length - 1] || '');
                
                const startAtBRT = isAtBRTHalte(firstStopId);
                const endAtBRT = isAtBRTHalte(lastStopId);
                const routeFare = getRouteFare(rid); // Get actual fare from GTFS
                
                let fare = 0;
                let reason = '';
                
                if (useJakLingko) {
                    // ========================================
                    // JAKLINGKO INTEGRATION MODE
                    // ========================================
                    // Logika:
                    // 1. Rute GRATIS (fare = 0) tetap GRATIS
                    // 2. BRT ke BRT = bayar normal (3500)
                    // 3. BRT ke Pengumpan / Pengumpan ke BRT = integrasi max 5000 total
                    // 4. Pengumpan ke Pengumpan = bayar normal per rute
                    
                    if (routeFare === 0) {
                        // Rute GRATIS (BW9, JakLingko gratis, dll) - TETAP GRATIS!
                        fare = 0;
                        reason = 'Layanan Gratis';
                    } else if (i === 0) {
                        // First leg: bayar tarif normal
                        fare = routeFare;
                        paidBRTIntegration = startAtBRT && routeFare > 0;
                        reason = 'Boarding pertama';
                    } else {
                        // Transit
                        const prevLeg = legs[i - 1];
                        const prevLastStopId = String(prevLeg.stops[prevLeg.stops.length - 1] || '');
                        const prevEndAtBRT = isAtBRTHalte(prevLastStopId);
                        
                        // Cek tipe transit
                        const isBRTtoBRT = prevEndAtBRT && startAtBRT;
                        const isPengumpanToPengumpan = !prevEndAtBRT && !startAtBRT;
                        
                        if (isBRTtoBRT && paidBRTIntegration) {
                            // BRT ke BRT dengan integrasi yang sudah dibayar = GRATIS
                            fare = 0;
                            reason = 'Transit BRT (Integrasi)';
                        } else {
                            // Semua transit lainnya (BRT↔Pengumpan, Pengumpan↔Pengumpan)
                            // Cek apakah total sudah mencapai 5000
                            if (total >= 5000) {
                                fare = 0;
                                reason = 'Integrasi JakLingko (Max 5000 tercapai)';
                            } else {
                                const remaining = 5000 - total;
                                fare = Math.min(routeFare, remaining);
                                
                                if (isPengumpanToPengumpan) {
                                    reason = 'Transit Pengumpan (Integrasi JakLingko)';
                                } else {
                                    reason = 'Transit antar tipe halte (Integrasi JakLingko)';
                                }
                            }
                            
                            // Update BRT integration status
                            if (startAtBRT) {
                                paidBRTIntegration = true;
                            } else {
                                paidBRTIntegration = false;
                            }
                        }
                    }
                    
                    if (fare > 0 || routeFare === 0) {
                        total += fare;
                        const stopName = stopsById.get(firstStopId)?.stop_name || firstStopId;
                        breakdown.push({ 
                            route_id: rid,
                            stop_name: stopName,
                            price: fare, 
                            currency: 'IDR',
                            type: routeFare === 0 ? 'Gratis' : (startAtBRT ? 'BRT' : 'Pengumpan'),
                            reason: reason
                        });
                    }
                } else {
                    // ========================================
                    // REGULAR CARD MODE (Kartu Elektronik Biasa)
                    // ========================================
                    // Bayar penuh untuk setiap rute
                    if (i === 0) {
                        // First leg: check where it starts
                        if (startAtBRT) {
                            // Starting at BRT halte: pay BRT integration (use route fare)
                            fare = routeFare;
                            paidBRTIntegration = routeFare > 0; // Only mark as paid if fare > 0
                        } else {
                            // Starting at Pengumpan halte: pay feeder fare (use route fare)
                            fare = routeFare;
                            paidBRTIntegration = false;
                        }
                    } else {
                        // Subsequent legs: check if we're still in BRT system
                        if (startAtBRT) {
                            // Transit at BRT halte
                            if (paidBRTIntegration) {
                                // Already paid BRT integration: FREE
                                fare = 0;
                            } else {
                                // Coming from Pengumpan, now at BRT halte: pay BRT (use route fare)
                                fare = routeFare;
                                paidBRTIntegration = routeFare > 0;
                            }
                        } else {
                            // Transit at Pengumpan halte (B-prefix)
                            // Always pay when going to/from Pengumpan halte (use route fare)
                            fare = routeFare;
                            paidBRTIntegration = false;
                        }
                    }
                    
                    // Cash mode fare tracking
                    if (fare > 0) {
                        total += fare;
                        const stopName = stopsById.get(firstStopId)?.stop_name || firstStopId;
                        breakdown.push({ 
                            route_id: rid,
                            stop_name: stopName,
                            price: fare, 
                            currency: 'IDR',
                            type: startAtBRT ? 'BRT/Integrated' : 'Pengumpan',
                            reason: i === 0 ? 'Initial boarding' : (startAtBRT && paidBRTIntegration ? 'BRT integration (free)' : 'New payment required')
                        });
                    }
                }
            }
            
            // Calculate original fare (without JakLingko) for comparison
            let originalTotal = 0;
            if (useJakLingko) {
                for (let i = 0; i < legs.length; i++) {
                    const leg = legs[i];
                    const rid = String(leg.routeId||'');
                    const routeFare = getRouteFare(rid);
                    
                    if (routeFare > 0) { // Skip free routes
                        const firstStopId = String(leg.stops[0] || '');
                        const startAtBRT = isAtBRTHalte(firstStopId);
                        
                        if (i === 0) {
                            originalTotal += routeFare;
                        } else {
                            // Check if would get free BRT integration in regular mode
                            const prevLeg = legs[i - 1];
                            const prevLastStopId = String(prevLeg.stops[prevLeg.stops.length - 1] || '');
                            const prevEndAtBRT = isAtBRTHalte(prevLastStopId);
                            const isBRTtoBRT = prevEndAtBRT && startAtBRT;
                            
                            // In regular card mode, BRT to BRT is free if already paid BRT
                            if (!(isBRTtoBRT && prevEndAtBRT)) {
                                originalTotal += routeFare;
                            }
                        }
                    }
                }
            }
            
            const savings = useJakLingko ? (originalTotal - total) : 0;
            
            return { 
                total, 
                breakdown,
                originalTotal: useJakLingko ? originalTotal : null,
                savings: useJakLingko ? savings : null,
                paymentMethod: paymentMethod
            };
        } catch (e) { 
            console.error('Error estimating fare:', e);
            return null; 
        }
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
        
        const drawStraight = (approx = false) => {
            const path = [[lat1, lon1], [lat2, lon2]];
            const label = approx ? `Perkiraan (garis lurus) • ${this._fmtDist(straightDist)}` : `Jalan kaki • ${this._fmtDist(straightDist)}`;
            const metaData = { ...meta, type: 'walk', approximate: approx, distance: straightDist };
            this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], metaData);
            this._addLineLabel(path, label, '#10b981');
            console.log(`  ✅ Drew straight line: ${straightDist.toFixed(0)}m`);
        };
        
        // Check if walking distance is reasonable
        if (straightDist > 1000 && !meta.ensureComplete) {
            console.warn(`  ⚠️ Walking distance ${straightDist.toFixed(0)}m is too far, not drawing`);
            return; // Don't draw anything for unreasonably long walks
        }
        
        // For very short walks, forced straight, or gap bridges - just draw simple line (no OSRM)
        if ((meta && (meta.forceStraight || meta.preferStraight)) || straightDist <= 200 || isGapBridge) {
            console.log(`  🚶 Drawing simple walk: ${straightDist.toFixed(0)}m (no OSRM needed)`);
                drawStraight(false);
                return;
            }
        
        // For longer walks, ALWAYS draw straight line first (so it's never invisible)
        console.log(`  🗺️ Drawing walk with straight line first, then trying OSRM: ${straightDist.toFixed(0)}m`);
        drawStraight(false);
        
        // Try OSRM enhancement in background (optional, best-effort)
        // If this fails, straight line is already visible so no problem
        const routeUrl = (sLon, sLat, eLon, eLat) => `https://router.project-osrm.org/route/v1/foot/${sLon},${sLat};${eLon},${eLat}?overview=full&geometries=geojson&steps=true&alternatives=false`;
        
        // OSRM enhancement (non-blocking, best-effort only)
        setTimeout(async () => {
            try {
                const timeout = (ms, promise) => {
                    return Promise.race([
                        promise,
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
                    ]);
                };
                
                // Try direct OSRM route with timeout
                const resp = await timeout(3000, fetch(routeUrl(lon1, lat1, lon2, lat2)));
                const data = await timeout(2000, resp.json());
                
                if (!data || !data.routes || !data.routes[0] || !data.routes[0].geometry) {
                    console.log(`  ℹ️ OSRM unavailable, keeping straight line`);
                    return;
                }
                
                const osrmDist = data.routes[0].distance || straightDist;
                const osrmDur = data.routes[0].duration;
                
                // Reject if OSRM route is way too long (unrealistic detour)
                if (osrmDist > straightDist * 2.5) {
                    console.log(`  ⚠️ OSRM route too long (${osrmDist.toFixed(0)}m vs ${straightDist.toFixed(0)}m), keeping straight line`);
                    return;
                }
                
                // OSRM looks good - draw enhanced route
                // Note: This will appear AFTER straight line, but that's okay - it's an enhancement
                const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                const label = `Jalan kaki • ${this._fmtDist(osrmDist)}${osrmDur ? ' • ' + Math.max(1, Math.round(osrmDur/60)) + ' mnt' : ''}`;
                
                // Extract walking steps if available
                let walkSteps = [];
                try {
                    const steps = data.routes[0].legs?.[0]?.steps || [];
                    walkSteps = steps.map(st => {
                        const name = st.name ? (' di ' + st.name) : '';
                        const dist = st.distance ? ` (${Math.round(st.distance)} m)` : '';
                        const maneuver = st.maneuver?.instruction || st.maneuver?.type || 'Jalan';
                        return `${maneuver}${name}${dist}`;
                    });
                } catch(_) {}
                
                // Draw OSRM-enhanced route with thicker line to "replace" straight line visually
                this._drawPolyline(coords, '#059669', 4, 0.95, [2, 2], { 
                    type: 'walk', 
                    approximate: false, 
                    distance: osrmDist, 
                    duration: osrmDur, 
                    walkSteps, 
                    ...meta 
                });
                this._addLineLabel(coords, label, '#059669');
                console.log(`  ✅ OSRM enhanced route drawn: ${osrmDist.toFixed(0)}m`);
                
            } catch (e) {
                // Silent fail - straight line is already visible
                console.log(`  ℹ️ OSRM enhancement failed (${e.message}), straight line remains`);
            }
        }, 100); // Small delay to let straight line render first
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
            if (!rid) {
                console.warn('⚠️ No route ID for leg');
                return null;
            }
            const gtfs = this.app.modules.gtfs;
            const routeMgr = this.app.modules.routes;
            const trips = (gtfs.getTrips() || []).filter(t => String(t.route_id || '') === rid);
            if (!trips || trips.length === 0) {
                console.warn(`⚠️ No trips found for route ${rid}`);
                return null;
            }
            if (!routeMgr || typeof routeMgr.getShapesForTrips !== 'function') {
                console.warn('⚠️ RouteManager or getShapesForTrips not available');
                return null;
            }
            const shapes = routeMgr.getShapesForTrips(trips) || [];
            if (shapes.length === 0) {
                console.warn(`⚠️ No shapes found for route ${rid}`);
                return null;
            }
            
            const firstStop = stopsById.get(String(leg.stops[0]));
            const lastStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
            if (!firstStop || !lastStop) {
                console.warn('⚠️ Cannot find first or last stop');
                return null;
            }
            const aLat = parseFloat(firstStop.stop_lat), aLon = parseFloat(firstStop.stop_lon);
            const bLat = parseFloat(lastStop.stop_lat), bLon = parseFloat(lastStop.stop_lon);
            
            console.log(`🔍 Finding shape for ${rid}: ${firstStop.stop_name} → ${lastStop.stop_name} (${leg.stops.length} stops, ${shapes.length} shapes available)`);

            // Helper: project a point onto a polyline (sequence of {lat,lng})
            const projectOnPolyline = (poly, lat, lon) => {
                let best = { segIndex: -1, t: 0, lat: poly[0]?.lat, lon: poly[0]?.lng, d2: Infinity, measure: 0 };
                for (let i = 1; i < poly.length; i++) {
                    const ax = poly[i - 1].lng, ay = poly[i - 1].lat;
                    const bx = poly[i].lng, by = poly[i].lat;
                    const px = lon, py = lat;
                    const abx = bx - ax, aby = by - ay;
                    const apx = px - ax, apy = py - ay;
                    const ab2 = abx * abx + aby * aby;
                    let t = ab2 > 0 ? (apx * abx + apy * aby) / ab2 : 0;
                    t = Math.max(0, Math.min(1, t));
                    const qx = ax + abx * t;
                    const qy = ay + aby * t;
                    const dx = px - qx, dy = py - qy;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < best.d2) {
                        // Interpolate measure if available on poly
                        let m = 0;
                        if (typeof poly[i - 1]?.dist === 'number' && typeof poly[i]?.dist === 'number') {
                            m = poly[i - 1].dist + t * (poly[i].dist - poly[i - 1].dist);
                        } else {
                            // Approximate by adding projected segment length to previous vertex
                            const segLen = this._haversine(ay, ax, qy, qx);
                            // Fallback without absolute baseline; keep 0
                            m = segLen;
                        }
                        best = { segIndex: i, t, lat: qy, lon: qx, d2, measure: m };
                    }
                }
                return best;
            };

            // Helper: slice polyline between two projections (inclusive)
            const sliceByProjections = (poly, projA, projB) => {
                if (!poly || poly.length < 2 || projA.segIndex < 1 || projB.segIndex < 1) return [];
                // Ensure order along polyline
                let aSeg = projA.segIndex, bSeg = projB.segIndex;
                let aT = projA.t, bT = projB.t;
                if (aSeg > bSeg || (aSeg === bSeg && aT > bT)) {
                    [aSeg, bSeg] = [bSeg, aSeg];
                    [aT, bT] = [bT, aT];
                    [projA, projB] = [projB, projA];
                }
                const out = [];
                // Start with projected A
                out.push([projA.lat, projA.lon]);
                // Add intermediate vertices from aSeg to bSeg-1
                for (let i = aSeg; i < bSeg; i++) {
                    out.push([poly[i].lat, poly[i].lng]);
                }
                // End with projected B
                out.push([projB.lat, projB.lon]);
                return out;
            };

            let bestSeg = null;
            let bestScore = Infinity;

            // ==========================================================
            // Trip-aware segment extraction using stop_times + shapes
            // Prefer a trip that contains BOTH first and last stops in order.
            // If shapes carry shape_dist_traveled, slice by distance; else by index.
            // ==========================================================
            try {
                const stopTimesAll = (gtfs.getStopTimes && gtfs.getStopTimes()) || [];
                const shapesRaw = (gtfs.getShapes && gtfs.getShapes()) || [];

                const stopTimesByTrip = new Map();
                for (const st of stopTimesAll) {
                    const tid = String(st.trip_id || '');
                    if (!tid) continue;
                    if (!stopTimesByTrip.has(tid)) stopTimesByTrip.set(tid, []);
                    stopTimesByTrip.get(tid).push(st);
                }

                const shapePointsById = new Map();
                const getShapePoints = (shapeId) => {
                    if (!shapeId) return [];
                    if (shapePointsById.has(shapeId)) return shapePointsById.get(shapeId);
                    const rows = shapesRaw
                        .filter(s => String(s.shape_id || '') === String(shapeId))
                        .sort((a,b) => parseInt(a.shape_pt_sequence||'0') - parseInt(b.shape_pt_sequence||'0'));
                    // Build points with cumulative distance
                    const pts = [];
                    let cum = 0;
                    for (let i = 0; i < rows.length; i++) {
                        const lat = parseFloat(rows[i].shape_pt_lat);
                        const lng = parseFloat(rows[i].shape_pt_lon);
                        let dist = rows[i].shape_dist_traveled != null ? parseFloat(rows[i].shape_dist_traveled) : NaN;
                        if (!isFinite(dist)) {
                            if (i === 0) cum = 0; else cum += this._haversine(rows[i-1].shape_pt_lat, rows[i-1].shape_pt_lon, lat, lng);
                            dist = cum;
                        }
                        pts.push({ lat, lng, dist });
                    }
                    shapePointsById.set(shapeId, pts);
                    return pts;
                };

                const firstStopId = String(leg.stops[0]);
                const lastStopId = String(leg.stops[leg.stops.length - 1]);

                for (const trip of trips) {
                    const tid = String(trip.trip_id || '');
                    const arr = (stopTimesByTrip.get(tid) || [])
                        .sort((a,b) => parseInt(a.stop_sequence||'0') - parseInt(b.stop_sequence||'0'));
                    if (arr.length === 0) continue;

                    let idxFirst = -1, idxLast = -1;
                    for (let i = 0; i < arr.length; i++) {
                        const sid = String(arr[i].stop_id || '');
                        if (sid === firstStopId && idxFirst === -1) idxFirst = i;
                        if (sid === lastStopId) idxLast = i; // last occurrence for robustness
                    }
                    if (idxFirst === -1 || idxLast === -1 || idxLast <= idxFirst) continue;

                    const shpPts = getShapePoints(trip.shape_id);
                    if (!shpPts || shpPts.length < 2) continue;

                    // Use precise projection to prevent overshoot beyond the stop
                    const projA = projectOnPolyline(shpPts, aLat, aLon);
                    const projB = projectOnPolyline(shpPts, bLat, bLon);
                    if (projA.segIndex < 1 || projB.segIndex < 1) continue;

                    // Enforce forward travel along shape in line with stop order
                    if (projB.measure <= projA.measure + 1) {
                        console.log(`  ⛔ Trip ${tid} direction opposite (measure ${projA.measure.toFixed(1)} → ${projB.measure.toFixed(1)}), skipping`);
                        continue;
                    }

                    const seg = sliceByProjections(shpPts, projA, projB);
                    if (seg.length < 2) continue;

                    const dStart = this._haversine(aLat, aLon, seg[0][0], seg[0][1]);
                    const dEnd = this._haversine(bLat, bLon, seg[seg.length - 1][0], seg[seg.length - 1][1]);
                    const score = (dStart + dEnd) * 50 + (seg.length < 6 ? (6 - seg.length) * 1e-6 : 0);

                    if (score < bestScore) {
                        bestScore = score;
                        bestSeg = seg;
                        console.log(`  🚆 Trip-aware match via trip ${tid}: cut=${seg.length} pts, score=${score.toFixed(4)}`);
                    }
                }
            } catch (e) {
                console.warn('Trip-aware selection error:', e);
            }

            if (bestSeg && bestSeg.length >= 2) {
                return bestSeg;
            }
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
                
                // Determine correct direction by checking multiple intermediate stops
                let directionScore = 0;
                let checkedStops = 0;
                
                // Check ALL intermediate stops to determine direction confidence
                for (let stopIdx = 1; stopIdx < leg.stops.length - 1; stopIdx++) {
                    const checkStopId = leg.stops[stopIdx];
                    const checkStop = stopsById.get(String(checkStopId));
                    if (!checkStop) continue;
                    
                    const checkLat = parseFloat(checkStop.stop_lat);
                    const checkLon = parseFloat(checkStop.stop_lon);
                    const idxCheck = this._nearestIdx(shp, checkLat, checkLon);
                    
                    if (idxCheck >= 0) {
                        checkedStops++;
                        // Check if this stop is between A and B in forward direction
                        if (idxA < idxCheck && idxCheck < idxB) {
                            directionScore++; // Vote for forward
                        } else if (idxB < idxCheck && idxCheck < idxA) {
                            directionScore--; // Vote for backward
                        }
                    }
                }
                
                // Decide direction based on votes
                if (checkedStops > 0) {
                    console.log(`  📊 Direction votes: ${directionScore} from ${checkedStops} stops (idxA=${idxA}, idxB=${idxB})`);
                    if (directionScore > 0) {
                        // Majority votes forward: A -> B
                                i0 = idxA;
                                i1 = idxB;
                        console.log(`  ➡️ Direction: FORWARD (${i0} → ${i1})`);
                    } else if (directionScore < 0) {
                        // Majority votes backward: B -> A
                                i0 = idxB;
                                i1 = idxA;
                        console.log(`  ⬅️ Direction: BACKWARD (${i0} → ${i1})`);
                            } else {
                        // Tie or no clear direction: use shortest path
                        if (idxA < idxB) {
                            i0 = idxA;
                            i1 = idxB;
                        } else {
                            i0 = idxB;
                            i1 = idxA;
                        }
                        console.log(`  ↔️ Direction: TIE, using shortest (${i0} → ${i1})`);
                    }
                } else {
                    // No intermediate stops checked: use shortest path
                    if (idxA < idxB) {
                        i0 = idxA;
                        i1 = idxB;
                    } else {
                        i0 = idxB;
                        i1 = idxA;
                    }
                    console.log(`  ⚠️ No intermediate stops, using shortest path (${i0} → ${i1})`);
                }
                
                // Check distance from start/end halte to nearest shape points BEFORE expansion
                const distToStart = this._haversine(aLat, aLon, shp[i0].lat, shp[i0].lng);
                const distToEnd = this._haversine(bLat, bLon, shp[i1].lat, shp[i1].lng);
                
                console.log(`  📏 Distance check: start=${distToStart.toFixed(0)}m, end=${distToEnd.toFixed(0)}m`);
                
                // VERY lenient distance check (500m) for debugging
                // We want to see shapes even if slightly misaligned
                if (distToStart > 500 || distToEnd > 500) {
                    console.warn(`  ❌ Rejecting segment: too far from halte (start: ${distToStart.toFixed(0)}m, end: ${distToEnd.toFixed(0)}m)`);
                    continue;
                }
                
                console.log(`  ✅ Distance check passed!`);
                
                // Minimal expansion - only extend if very close to halte
                let expansion = 0;
                if (distToStart < 20) expansion = 1; // Only expand 1 point if very close
                
                i0 = Math.max(0, i0 - expansion);
                i1 = Math.min(shp.length - 1, i1 + expansion);
                
                // Validate segment length - reject if unreasonably long
                const segmentLength = Math.abs(i1 - i0);
                const maxReasonableLength = Math.floor(shp.length * 0.90); // Max 90% of total shape (VERY lenient for debug)
                
                console.log(`  📐 Segment length: ${segmentLength}/${shp.length} points (${Math.round(segmentLength/shp.length*100)}%)`);
                
                // Only reject if segment is suspiciously long AND endpoints are far
                if (segmentLength > maxReasonableLength && (distToStart > 150 || distToEnd > 150)) {
                    console.warn(`  ❌ Rejecting segment: too long AND far from haltes (${segmentLength}/${shp.length} points)`);
                    continue; // Skip this shape, try next one
                }
                
                console.log(`  ✅ Segment length acceptable!`);
                
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
                    console.log(`  🎯 NEW BEST: ${segLen} points (${Math.round(segLen/shp.length*100)}% of shape), score: ${score.toFixed(6)}, distStart: ${distToStart.toFixed(0)}m, distEnd: ${distToEnd.toFixed(0)}m`);
                    if (bestScore < 0.001) {
                        console.log(`  ⚡ Perfect match found, stopping search!`);
                        break; // good enough (very close match)
                    }
                } else {
                    console.log(`  ⏭️ Score ${score.toFixed(6)} not better than best ${bestScore.toFixed(6)}, skipping`);
                }
            }
            
            if (bestSeg) {
                const segStart = bestSeg[0];
                const segEnd = bestSeg[bestSeg.length - 1];
                const finalDistStart = this._haversine(aLat, aLon, segStart[0], segStart[1]);
                const finalDistEnd = this._haversine(bLat, bLon, segEnd[0], segEnd[1]);
                console.log(`✅ SUCCESS! Using segment for ${this._routeLabel(rid)}: ${bestSeg.length} points`);
                console.log(`   From: ${firstStop.stop_name} (offset: ${finalDistStart.toFixed(0)}m)`);
                console.log(`   To: ${lastStop.stop_name} (offset: ${finalDistEnd.toFixed(0)}m)`);
                console.log(`   Best score: ${bestScore.toFixed(6)}`);
            } else {
                console.error(`❌ FAILED! No valid segment found for ${this._routeLabel(rid)} (${firstStop.stop_name} → ${lastStop.stop_name})`);
                console.error(`   Checked ${Math.min(checked, shapes.length)} shapes, all were rejected!`);
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
        // Remove raw maplibre layers/sources (but NOT destination marker layers)
        try {
            const map = mapMod.getMap();
            if (this._rawLayers && this._rawLayers.length) {
                for (const ent of this._rawLayers) {
                    // Skip if this is a destination marker layer
                    if (ent.id && (ent.id.startsWith('destination-marker') || ent.sourceId?.startsWith('destination-marker'))) {
                        continue;
                    }
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
                
                // JakLingko savings display
                if (fare.paymentMethod === 'jaklingko' && fare.originalTotal && fare.savings > 0) {
                    const rpOriginal = new Intl.NumberFormat('id-ID').format(fare.originalTotal);
                    const rpSavings = new Intl.NumberFormat('id-ID').format(fare.savings);
                    fareHtml = `
                        <div style="background:linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);border:1px solid #a7f3d0;border-radius:10px;padding:10px;margin:6px 0 8px 0;">
                            <div class="small" style="color:#065f46;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                                <iconify-icon icon="mdi:ticket-percent" style="font-size:18px;color:#10b981;"></iconify-icon>
                                <span>Hemat dengan JakLingko</span>
                            </div>
                            <div class="small" style="color:#374151;margin-bottom:4px;">
                                <span style="text-decoration:line-through;color:#9ca3af;">Tarif Asli: Rp${rpOriginal}</span>
                            </div>
                            <div class="small" style="color:#065f46;font-weight:700;font-size:0.95rem;margin-bottom:4px;">
                                Tarif JakLingko: Rp${rp}
                            </div>
                            <div class="small" style="background:#10b981;color:white;display:inline-block;padding:3px 8px;border-radius:6px;font-weight:600;">
                                💰 Hemat Rp${rpSavings}
                            </div>
                        </div>
                    `;
                } else {
                fareHtml = `<div class="small" style="color:#111827;margin:6px 0 8px 0;"><b>Perkiraan tarif:</b> Rp${rp}</div>`;
                }
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
            if (this._planning) {
                console.warn('computePlanByStopIds: already planning, rejecting new request');
                return null;
            }
            if (!startStopId || !endStopId) return null;
            if (!this._graphBuilt) {
                try { this._buildGraph(); } catch (e) {}
            }
            this._planning = true;
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const stopsById = new Map(stops.map(s => [String(s.stop_id || ''), s]));
            const startStop = stopsById.get(String(startStopId));
            const goalStop = stopsById.get(String(endStopId));
            if (!startStop || !goalStop) {
                this._planning = false;
                return null;
            }

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
            if (!path || path.length === 0) { 
                this._mode = originalMode; 
                this._planning = false;
                return null; 
            }

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
            this._planning = false;
            return plan;
        } catch (e) { this._planning = false; return null; }
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