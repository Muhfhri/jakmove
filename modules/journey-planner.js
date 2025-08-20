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
        this._validStops = new Set(); // stop_ids that appear in stop_times
        this._parentToChildren = new Map(); // parent_station -> Array(stop)
        this._ui = null; // no longer used (replaced by popups)
        this._layers = []; // ids of lines
        this._markers = []; // ids of temp markers
        this._rawLayers = []; // {id, sourceId, onClick} custom map layers for polylines
        this._lastPlan = null; // { startStop, goalStop, legs, steps }
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
    }

    enable() {
        if (this.enabled) return;
        this.enabled = true;
        if (!this._graphBuilt) this._buildGraph();
        this._bindMapClick();
        this._setStatus('Klik peta untuk memilih titik awal');
        try { this.app.modules.map.setJourneyActive(true); } catch (e) {}
    }

    disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this._unbindMapClick();
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
                    if (btn) btn.addEventListener('click', () => this.reset());
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
        // Dijkstra: minimize (transfers * BIG + distance)
        const BIG = 100000; // beratkan transfer jauh lebih tinggi dari jarak
        const MAX_TRANSFERS = 5; // izinkan lebih banyak transfer untuk jarak jauh
        const key = (sid, rid) => sid + '|' + (rid || '');
        const stopsById = new Map((this.app.modules.gtfs.getStops() || []).map(s => [String(s.stop_id||''), s]));

        const bestCost = new Map(); // key -> cost
        const bestTransfers = new Map(); // key -> transfers
        const parent = new Map(); // key -> { prevKey, viaRoute, at }

        const pq = [];
        const push = (node) => { pq.push(node); pq.sort((a,b) => a.cost - b.cost); };
        const pop = () => pq.shift();

        const tryRelax = (sid, rid, transfers, cost, prevKey) => {
            if (transfers > MAX_TRANSFERS) return false;
            const k = key(sid, rid);
            const prev = bestCost.get(k);
            if (prev !== undefined && prev <= cost) return false;
            bestCost.set(k, cost);
            bestTransfers.set(k, transfers);
            parent.set(k, { prevKey, viaRoute: rid, at: sid });
            push({ sid, rid, transfers, cost });
            return true;
        };

        tryRelax(startId, '', 0, 0, null);

        while (pq.length) {
            const cur = pop();
            if (cur.sid === goalId) {
                return this._reconstruct(parent, key(cur.sid, cur.rid), startId);
            }
            const curKey = key(cur.sid, cur.rid);
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
                if (edgeRid) {
                    if (!cur.rid) {
                        nextRid = edgeRid; // boarding, no transfer penalty
                    } else if (edgeRid !== cur.rid) {
                        nextRid = edgeRid;
                        nextTransfers = cur.transfers + 1;
                        edgePenalty += BIG; // penalize transfer heavily
                    }
                } else {
                    // walking/transfer edge: small penalty to avoid berputar
                    edgePenalty += Math.min(500, stepDist); // penalize based on distance, capped
                }

                const newCost = cur.cost + stepDist + edgePenalty;
                tryRelax(nextSid, nextRid, nextTransfers, newCost, key(cur.sid, cur.rid));
            }

            // Transfer in-place: switch to any route at this stop (no distance, but transfer penalty)
            const routeSet = this._routesAtStop.get(cur.sid);
            if (routeSet && routeSet.size) {
                for (const r of routeSet) {
                    if (!cur.rid) {
                        // first boarding, no penalty
                        tryRelax(cur.sid, r, cur.transfers, cur.cost, key(cur.sid, cur.rid));
                    } else if (r !== cur.rid) {
                        const cost2 = cur.cost + BIG; // transfer penalty
                        tryRelax(cur.sid, r, cur.transfers + 1, cost2, key(cur.sid, cur.rid));
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
        this._drawWalk(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon), { type: 'walk', toStopName: startStop.stop_name });
        // Draw walking: goalStop -> destination
        this._drawWalk(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon, { type: 'walk', toStopName: 'Tujuan' });
        // Draw transit legs (as direct lines between consecutive stops)
        for (const leg of legs) {
            const color = this._routeColorHex(String(leg.routeId));
            const segment = this._computeShapeSegmentForLeg(leg, stopsById);
            if (segment && segment.length >= 2) {
                const fromStop = stopsById.get(String(leg.stops[0]));
                const toStop = stopsById.get(String(leg.stops[leg.stops.length - 1]));
                this._drawPolyline(segment, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: fromStop?.stop_name, toStopName: toStop?.stop_name });
                this._addLineLabel(segment, `Naik ${this._routeLabel(leg.routeId)}`, color);
                // Add start/end labels for the leg
                try { const [sLat, sLon] = segment[0]; this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${fromStop?.stop_name || ''}`, color); } catch(e){}
                try { const [eLat, eLon] = segment[segment.length - 1]; this._addTextAt(eLat, eLon, `Turun di ${toStop?.stop_name || ''}`, color); } catch(e){}
            } else {
                // Fallback straight segments between stops
                for (let i = 0; i < leg.stops.length - 1; i++) {
                    const a = stopsById.get(String(leg.stops[i]));
                    const b = stopsById.get(String(leg.stops[i+1]));
                    if (!a || !b) continue;
                    const straight = [[parseFloat(a.stop_lat), parseFloat(a.stop_lon)], [parseFloat(b.stop_lat), parseFloat(b.stop_lon)]];
                    this._drawPolyline(straight, color, 4.5, 0.9, null, { type: 'transit', routeId: String(leg.routeId), fromStopName: a?.stop_name, toStopName: b?.stop_name });
                    this._addLineLabel(straight, `Naik ${this._routeLabel(leg.routeId)}`, color);
                    try { const [sLat, sLon] = straight[0]; this._addTextAt(sLat, sLon, `Naik ${this._routeLabel(leg.routeId)} di ${a?.stop_name || ''}`, color); } catch(e){}
                    try { const [eLat, eLon] = straight[straight.length - 1]; this._addTextAt(eLat, eLon, `Turun di ${b?.stop_name || ''}`, color); } catch(e){}
                }
            }
            // Mark transfer at start of each subsequent leg
            const startStop2 = stopsById.get(String(leg.stops[0]));
            if (startStop2) this._addTransitHereMarker(parseFloat(startStop2.stop_lat), parseFloat(startStop2.stop_lon), startStop2.stop_name || 'Transit di sini');
        }

        // Steps UI
        const steps = [];
        const dist1 = this._haversine(this.origin.lat, this.origin.lon, parseFloat(startStop.stop_lat), parseFloat(startStop.stop_lon));
        steps.push({ type: 'walk', text: `Jalan ke ${startStop.stop_name} (${this._fmtDist(dist1)})` });
        for (const leg of legs) {
            const first = stopsById.get(String(leg.stops[0]));
            const last = stopsById.get(String(leg.stops[leg.stops.length - 1]));
            const r = routeById.get(String(leg.routeId));
            const name = r ? (r.route_short_name || r.route_id) : leg.routeId;
            steps.push({ type: 'ride', text: `Naik ${name} dari ${first?.stop_name} ke ${last?.stop_name}` });
            if (last) steps.push({ type: 'transfer', text: `Transit di ${last.stop_name}` });
        }
        const dist2 = this._haversine(parseFloat(goalStop.stop_lat), parseFloat(goalStop.stop_lon), this.destination.lat, this.destination.lon);
        steps.push({ type: 'walk', text: `Jalan ke tujuan (${this._fmtDist(dist2)})` });
        this._lastPlan = { startStop, goalStop, legs, steps };
        this._setStatus('Rencana siap. Klik jalur untuk melihat langkah.');
    }

    _drawWalk(lat1, lon1, lat2, lon2, meta = {}) {
        // custom dashed polyline for walking
        const path = [[lat1, lon1], [lat2, lon2]];
        this._drawPolyline(path, '#10b981', 3, 0.9, [2, 2], { type: 'walk', ...meta });
        this._addLineLabel(path, 'Jalan kaki', '#10b981');
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
            const html = `
                <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                    <div style="color:#333; padding:4px 0; border-bottom:1px solid #eee; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                        <div style="font-weight:700;">${head}</div>
                        <div style="font-size:10px;color:#f59e0b;font-weight:800;border:1px solid #f59e0b;border-radius:999px;padding:1px 6px;">BETA</div>
                    </div>
                    ${sub ? `<div class="small" style="color:#374151;margin-bottom:6px;">${sub}</div>` : ''}
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
                if (btn) btn.addEventListener('click', () => this.reset());
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
            for (const shp of shapes) {
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
        return `
            <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 330px; padding: 10px 12px;">
                <div style="color:#333; padding:4px 0; border-bottom:1px solid #eee; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between;">
                    <div style="font-weight:700;">${title}</div>
                    <div style="font-size:10px;color:#f59e0b;font-weight:800;border:1px solid #f59e0b;border-radius:999px;padding:1px 6px;">BETA</div>
                </div>
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
                    if (btn) btn.addEventListener('click', () => this.reset());
                } catch (e) {}
            }
        } catch (e) {}
    }
} 