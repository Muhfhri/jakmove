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

            // Add walking transfers between nearby valid stops using spatial grid index (<=250m), keep top 3 per stop
            const validStopsList = stops.filter(s => s && this._validStops.has(String(s.stop_id || '')));
            const R = 250; // meters
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
                const capped = arr.slice(0, 3);
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
                const id = this.app.modules.map.addSearchResultMarker(lat, lon, '<b>Titik awal</b>');
                this._markers.push(id);
                this._setStatus('Klik peta untuk memilih tujuan');
            } else if (!this.destination) {
                this.destination = { lat, lon };
                const id = this.app.modules.map.addSearchResultMarker(lat, lon, '<b>Tujuan</b>');
                this._markers.push(id);
                this._setStatus('Menghitung rute...');
                if (pending) clearTimeout(pending);
                pending = setTimeout(() => this._plan(), 60);
            } else {
                // Jika sudah ada keduanya, abaikan klik jalur lain agar tidak reset ketika klik trayek
                // Untuk mulai baru: pakai tombol Reset di UI/ikon rencana
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
        const gtfs = this.app.modules.gtfs;
        const stops = gtfs.getStops() || [];
        const start = this._nearestValidStop(this.origin.lat, this.origin.lon, stops);
        const goal = this._nearestValidStop(this.destination.lat, this.destination.lon, stops);
        if (!start || !goal) { this._setStatus('Gagal menemukan halte/platform terdekat'); return; }
        const path = this._findPath(String(start.stop_id), String(goal.stop_id));
        if (!path || path.length === 0) { this._setStatus('Tidak ditemukan jalur layanan. Coba geser titik awal/tujuan lebih dekat ke halte lain.'); return; }
        const grouped = this._groupByRoute(path);
        this._renderPlan(start, goal, grouped);
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

    _nearestValidStop(lat, lon, stops) {
        let best = null, bestD = Infinity;
        for (const s of stops) {
            if (!s || !s.stop_lat || !s.stop_lon) continue;
            const sid = String(s.stop_id || '');
            if (!this._validStops.has(sid)) continue; // hanya stop yang ada di stop_times
            const d = this._haversine(lat, lon, parseFloat(s.stop_lat), parseFloat(s.stop_lon));
            if (d < bestD) { bestD = d; best = s; }
        }
        return best;
    }

    _findPath(startId, goalId) {
        // Dijkstra: minimize weighted distance + transfer penalties (depends on optimization mode)
        const mode = this._mode || 'balanced';
        const BIG = mode === 'fastest' ? 30000 : (mode === 'cheapest' ? 150000 : 100000);
        const MAX_TRANSFERS = mode === 'cheapest' ? 3 : 5;
        const TRANSIT_WEIGHT = mode === 'fastest' ? 0.18 : (mode === 'cheapest' ? 0.35 : 0.25);
        const WALK_WEIGHT = mode === 'fastest' ? 1.0 : (mode === 'cheapest' ? 1.2 : 1.0);
        const ALIGHT_WALK_PENALTY = mode === 'fastest' ? Math.round(BIG * 0.4) : BIG;
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
        const FARE_WEIGHT = 10; // 1 IDR ~ 10 cost units (tuned so 3500 IDR ~ 35k)
        const WAIT_W_MPS = 12; // convert wait seconds to distance-equivalent cost (12 m/s)
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

        const tryRelax = (sid, rid, transfers, cost, prevKey, fareUsed) => {
            if (transfers > MAX_TRANSFERS) return false;
            const k = key(sid, rid, fareUsed || '');
            const prev = bestCost.get(k);
            if (prev !== undefined && prev <= cost) return false;
            bestCost.set(k, cost);
            bestTransfers.set(k, transfers);
            parent.set(k, { prevKey, viaRoute: rid, at: sid });
            push({ sid, rid, transfers, cost, fareUsed: fareUsed || '' });
            return true;
        };

        tryRelax(startId, '', 0, 0, null, '');

        while (pq.length) {
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
                            const f = fareIdByRoute.get(edgeRid) || '';
                            nextFareUsed = f || '';
                            if (!cur.fareUsed || cur.fareUsed !== f) {
                                const p = priceByRoute.get(edgeRid) || 0;
                                edgePenalty += p * FARE_WEIGHT;
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
                        edgePenalty += BIG; // transfer penalty when switching routes
                        // fare-aware: charge only when switching to different fare product
                        if (mode === 'cheapest') {
                            const f = fareIdByRoute.get(edgeRid) || '';
                            nextFareUsed = f || '';
                            if (!cur.fareUsed || cur.fareUsed !== f) {
                                const p = priceByRoute.get(edgeRid) || 0;
                                edgePenalty += p * FARE_WEIGHT;
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
                    distComponent = stepDist * WALK_WEIGHT;
                    nextRid = '';
                    if (cur.rid) {
                        nextTransfers = cur.transfers + 1; // alight → walk counts as a transfer
                        edgePenalty += ALIGHT_WALK_PENALTY;
                    }
                    // discourage tiny zig-zags within same stop area
                    edgePenalty += Math.min(400, stepDist * (mode === 'cheapest' ? 1.4 : 1.0));
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
                            const f = fareIdByRoute.get(String(r)) || '';
                            nextFareUsed = f || '';
                            if (!cur.fareUsed || cur.fareUsed !== f) {
                                const p = priceByRoute.get(String(r)) || 0;
                                cost2 += p * FARE_WEIGHT;
                            }
                        }
                        if (mode === 'fastest') {
                            const hw = headwayByRoute.get(String(r)) || 900;
                            cost2 += (hw / 2) * WAIT_W_MPS;
                        }
                        tryRelax(cur.sid, r, cur.transfers, cost2, key(cur.sid, cur.rid, cur.fareUsed || ''), nextFareUsed);
                    } else if (r !== cur.rid) {
                        let cost2 = cur.cost + BIG; // transfer penalty per mode
                        let nextFareUsed = cur.fareUsed || '';
                        if (mode === 'cheapest') {
                            const f = fareIdByRoute.get(String(r)) || '';
                            nextFareUsed = f || '';
                            if (!cur.fareUsed || cur.fareUsed !== f) {
                                const p = priceByRoute.get(String(r)) || 0;
                                cost2 += p * FARE_WEIGHT;
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

    _renderPlan(startStop, goalStop, legs) {
        const gtfs = this.app.modules.gtfs;
        const stopsById = new Map((gtfs.getStops() || []).map(s => [String(s.stop_id||''), s]));
        const routes = gtfs.getRoutes() || [];
        const routeById = new Map(routes.map(r => [String(r.route_id||''), r]));

        this._clearMapArtifacts();

        // Draw endpoints
        this._addEndpointMarker(this.origin.lat, this.origin.lon, 'start');
        this._addEndpointMarker(this.destination.lat, this.destination.lon, 'end');

        // Draw walking: origin -> startStop
        const dStart = this._haversine(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon));
        this._drawWalk(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon), { type: 'walk', toStopName: startStop.stop_name, preferStraight: dStart <= 120 });
        // Draw walking: goalStop -> destination
        const dEnd = this._haversine(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon);
        this._drawWalk(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon, { type: 'walk', toStopName: 'Tujuan', preferStraight: dEnd <= 120 });
        // Draw transit legs (chunked to avoid blocking UI)
        const seq = ++this._drawSeq;
        const drawOneLeg = (leg, index) => {
            if (seq !== this._drawSeq) return; // canceled by reset
            const color = this._routeColorHex(String(leg.routeId));
            const segment = this._computeShapeSegmentForLeg(leg, stopsById);
            if (segment && segment.length >= 2) {
                const fromStop = stopsById.get(String(leg.stops[0]));
                const toStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
                this._drawPolyline(segment, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: fromStop?.stop_name, toStopName: toStop?.stop_name });
                this._addLineLabel(segment, `Naik ${this._routeLabel(leg.routeId)}`, color);
                // Add start/end labels for the leg
                try {
                    const [sLat, sLon] = segment[0];
                    const plat = (fromStop && String(fromStop.platform_code || '').trim()) || '';
                    this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${fromStop?.stop_name || ''}${plat ? ' (Platform ' + plat + ')' : ''}`, color);
                } catch(e){}
                try { const [eLat, eLon] = segment[segment.length - 1]; this._addTextAt(eLat, eLon, `Turun di ${toStop?.stop_name || ''}`, color); } catch(e){}
            } else {
                for (let i = 0; i < leg.stops.length - 1; i++) {
                    const a = stopsById.get(String(leg.stops[i]));
                    const b = stopsById.get(String(leg.stops[i+1]));
                    if (!a || !b) continue;
                    const straight = [[parseFloat(a.stop_lat), parseFloat(a.stop_lon)], [parseFloat(b.stop_lat), parseFloat(b.stop_lon)]];
                    this._drawPolyline(straight, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: a?.stop_name, toStopName: b?.stop_name });
                    this._addLineLabel(straight, `Naik ${this._routeLabel(leg.routeId)}`, color);
                    try {
                        const [sLat, sLon] = straight[0];
                        const plat = (a && String(a.platform_code || '').trim()) || '';
                        this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${a?.stop_name || ''}${plat ? ' (Platform ' + plat + ')' : ''}`, color);
                    } catch(e){}
                    try { const [eLat, eLon] = straight[straight.length - 1]; this._addTextAt(eLat, eLon, `Turun di ${b?.stop_name || ''}`, color); } catch(e){}
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

        // Draw walking between transfer stops when legs are not contiguous at the same stop
        for (let i = 0; i < legs.length - 1; i++) {
            const currLastId = String(legs[i].stops[legs[i].stops.length - 1]);
            const nextFirstId = String(legs[i+1].stops[0]);
            if (currLastId !== nextFirstId) {
                const a = stopsById.get(currLastId);
                const b = stopsById.get(nextFirstId);
                if (a && b) {
                    const nearD = this._haversine(parseFloat(a.stop_lat), parseFloat(a.stop_lon), parseFloat(b.stop_lat), parseFloat(b.stop_lon));
                    const sameParent = String(a.parent_station || '') && String(a.parent_station || '') === String(b.parent_station || '');
                    this._drawWalk(
                        parseFloat(a.stop_lat), parseFloat(a.stop_lon),
                        parseFloat(b.stop_lat), parseFloat(b.stop_lon),
                        { type: 'walk', toStopName: b.stop_name, preferStraight: sameParent || nearD <= 150 }
                    );
                }
            }
        }

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
        this._lastPlan = { startStop, goalStop, legs, steps, fare };
        this._setStatus('Rencana siap. Klik jalur untuk melihat langkah.');
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
        // Prefer straight within campus/terminal or very short distances
        try {
            const dist = this._haversine(lat1, lon1, lat2, lon2);
            if ((meta && (meta.forceStraight || meta.preferStraight)) || dist <= 120) {
                const path = [[lat1, lon1], [lat2, lon2]];
                this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], { type: 'walk', ...meta });
                this._addLineLabel(path, 'Jalan kaki', '#10b981');
                return;
            }
        } catch (_) {}
        // try to follow streets using OSRM; fallback to straight line
        try {
            const url = `https://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson&radiuses=50;50`;
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    let path;
                    if (data && data.routes && data.routes[0] && data.routes[0].geometry && Array.isArray(data.routes[0].geometry.coordinates)) {
                        const straight = this._haversine(lat1, lon1, lat2, lon2);
                        const osrmDist = typeof data.routes[0].distance === 'number' ? data.routes[0].distance : null;
                        // Guard against excessive detours (common inside terminals)
                        if (osrmDist !== null && osrmDist > Math.max(300, straight * 2.2)) {
                            path = [[lat1, lon1], [lat2, lon2]];
                        } else {
                            path = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                        }
                    } else {
                        path = [[lat1, lon1], [lat2, lon2]];
                    }
                    this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], { type: 'walk', ...meta });
                    this._addLineLabel(path, 'Jalan kaki', '#10b981');
                })
                .catch(() => {
                    const path = [[lat1, lon1], [lat2, lon2]];
                    this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], { type: 'walk', ...meta });
                    this._addLineLabel(path, 'Jalan kaki', '#10b981');
                });
        } catch (e) {
            try {
                const path = [[lat1, lon1], [lat2, lon2]];
                this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], { type: 'walk', ...meta });
                this._addLineLabel(path, 'Jalan kaki', '#10b981');
            } catch (_) {}
        }
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
                    this._showLegPopupAt(lngLat.lng, lngLat.lat, p);
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
            const stepsHtml = plan.steps.map(s => `<div class="small" style="margin:4px 0;">• ${s.text}</div>`).join('');
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
                const i0 = Math.min(idxA, idxB);
                const i1 = Math.max(idxA, idxB);
                const pts = shp.slice(i0, i1 + 1);
                if (pts.length < 2) continue;
                // Score = distance from endpoints to nearest vertices (smaller is better)
                const da = this._eu2(aLat, aLon, pts[0].lat, pts[0].lng);
                const db = this._eu2(bLat, bLon, pts[pts.length - 1].lat, pts[pts.length - 1].lng);
                const score = da + db;
                if (score < bestScore) {
                    bestScore = score;
                    bestSeg = pts.map(p => [p.lat, p.lng]);
                    if (bestScore < 1e-8) break; // good enough
                }
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
        const stepsHtml = steps.map(s => `<div class="small" style="margin:4px 0;">• ${s.text}</div>`).join('');
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
            // Re-render overlays
            this._renderPlan(startStop, goalStop, legs);
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
} 