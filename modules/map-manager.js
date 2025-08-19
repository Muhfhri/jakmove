// Map Manager using MapLibre GL JS
export class MapManager {
    constructor() {
        this.map = null;
        this.markers = new Map();
        this.layers = new Map();
        this.isInitialized = false;
        this._styleName = 'positron';
        this._radiusLayerId = 'radius-stops';
        this._radiusSourceId = 'radius-source';
        this._currentPopup = null; // feature popup only
        this.featurePopup = null;
        this.userPopup = null;
        this._activeRouteData = null; // Simpan data rute aktif
        this._cameraLock = false; // camera follow user
    }

    init() {
        if (this.isInitialized) return;
        
        try {
            this.map = new maplibregl.Map({
                container: 'map',
                style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
                center: [106.8, -6.2],
                zoom: 11,
                attributionControl: true
            });

            this.map.addControl(new maplibregl.NavigationControl(), 'top-left');
            this.map.addControl(new maplibregl.FullscreenControl(), 'top-left');

            const geoCtrl = new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                trackUserLocation: true,
                showUserHeading: true
            });
            this.map.addControl(geoCtrl, 'top-left');
            geoCtrl.on('geolocate', () => {
                const app = window.transJakartaApp;
                if (app && app.modules && app.modules.location && !app.modules.location.isActive) {
                    app.modules.location.enableLiveLocation();
                }
            });

            this.setupMapEvents();
            this.featurePopup = new maplibregl.Popup({ 
                closeButton: true, 
                closeOnClick: false, 
                maxWidth: '350px',
                className: 'custom-popup-transparent'
            });
            this.userPopup = new maplibregl.Popup({ 
                closeButton: false, 
                closeOnClick: false, 
                maxWidth: '350px',
                className: 'custom-popup-transparent',
                anchor: 'top',
                offset: [0, 20]
            });

            this.isInitialized = true;
            console.log('MapLibre map initialized successfully');

        } catch (error) {
            console.error('Failed to initialize map:', error);
            throw error;
        }
    }

    setupMapEvents() {
        this.map.on('load', () => { console.log('Map loaded'); });
        
        // Close feature popup when clicking outside
        this.map.on('click', (e) => {
            if (this._currentPopup && !e.originalEvent.target.closest('.maplibregl-popup')) {
                this._currentPopup.remove();
                this._currentPopup = null;
            }
        });

        this.map.on('zoomend', () => {
            if (window.radiusHalteActive && this.map.getZoom() >= 14) {
                const c = this.map.getCenter();
                this.showHalteRadius(c.lng, c.lat, 300);
            } else {
                this.removeHalteRadiusMarkers();
            }
        });
        
        this.map.on('moveend', () => {
            if (window.radiusHalteActive && this.map.getZoom() >= 14) {
                const c = this.map.getCenter();
                this.showHalteRadius(c.lng, c.lat, 300);
            } else {
                this.removeHalteRadiusMarkers();
            }
        });
    }

    setBaseStyle(name) {
        this._styleName = name;
        let style;
        if (name === 'positron') style = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
        else if (name === 'voyager') style = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
        else if (name === 'dark') style = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
        else if (name === 'osm') style = 'https://demotiles.maplibre.org/style.json';
        else if (name === 'maplibre3d') style = 'https://demotiles.maplibre.org/style.json';
        else if (name.startsWith('openmaptiles-')) {
            const key = localStorage.getItem('openmaptilesKey') || '';
            const base = 'https://api.maptiler.com/maps';
            if (name === 'openmaptiles-streets') style = `${base}/streets/style.json?key=${key}`;
            else if (name === 'openmaptiles-bright') style = `${base}/bright/style.json?key=${key}`;
            else if (name === 'openmaptiles-dark') style = `${base}/darkmatter/style.json?key=${key}`;
            else if (name === 'openmaptiles-positron') style = `${base}/positron/style.json?key=${key}`;
            else style = `${base}/streets/style.json?key=${key}`;
        }
        else if (name === 'satellite') style = this._buildSatelliteStyle();
        else if (name === 'streets') style = this._buildRasterStyle(['https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'], 'Tiles © Esri');
        else if (name === 'topo') style = this._buildRasterStyle(['https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'], 'Tiles © Esri');
        else if (name === 'gray') style = this._buildRasterStyle(['https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], 'Tiles © Esri');
        else if (name === 'opentopo') style = this._buildRasterStyle([
            'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
            'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
        ], 'Map data: © OpenStreetMap contributors, SRTM | Style: © OpenTopoMap');
        else style = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

        this.map.setStyle(style);
        
        // Reset layer-bound handler flags so they rebind after style reload
        this._stopsHandlersBound = false;
        // Reset icon load promise for new style
        this._stopIconsPromise = null;
        
        // Re-add layers after style change
        const readd = () => {
            // Re-add route polyline if exists
            if (this._activeRouteData) {
                this.addRoutePolyline(
                    this._activeRouteData.routeId, 
                    this._activeRouteData.shapes, 
                    this._activeRouteData.color
                );
            }
            
            // Re-add stops markers if exists (snapshot stored)
            if (this._activeRouteData && this._activeRouteData.stopsSnapshot) {
                this.addStopsMarkers(
                    this._activeRouteData.stopsSnapshot.stops,
                    this._activeRouteData.stopsSnapshot.stopToRoutes,
                    this._activeRouteData.stopsSnapshot.routes
                );
            }
            // Move overlay layers above
            this._ensureOverlaysOnTop();
            
            // If for some reason stops layer still missing, force re-render via RouteManager
            try {
                const hasStopsLayer = this.map.getLayer('stops-markers');
                const routesMod = window.transJakartaApp?.modules?.routes;
                const activeId = routesMod && routesMod.selectedRouteId;
                if (!hasStopsLayer && activeId) {
                    // Trigger a light reselect to rebuild layers
                    routesMod.selectRoute(activeId);
                }
            } catch (e) {}
            
            // Re-add user marker if active
            const app = window.transJakartaApp;
            try {
                const loc = app?.modules?.location;
                if (loc && loc.isActive && loc.lastUserPos) {
                    const p = loc.lastUserPos;
                    this.addUserMarker(p.lat, p.lon);
                }
            } catch (e) {}
            
            // Re-add radius markers if active
            try {
            if (window.radiusHalteActive && this.map.getZoom() >= 14) {
                const center = this.map.getCenter();
                this.showHalteRadius(center.lng, center.lat, 300);
            }
            } catch (e) {}
            
            this.map.off('idle', readd);
        };
        this.map.on('idle', readd);
    }

    _ensureOverlaysOnTop() {
        try {
            if (this.map.getLayer('stops-markers')) this.map.moveLayer('stops-markers');
            if (this.map.getLayer('stops-hitbox')) this.map.moveLayer('stops-hitbox');
            if (this.map.getLayer('platform-dots')) this.map.moveLayer('platform-dots');
            if (this.map.getLayer('platform-hitbox')) this.map.moveLayer('platform-hitbox');
            if (this.map.getLayer(this._radiusLayerId)) this.map.moveLayer(this._radiusLayerId);
            if (this.map.getLayer('radius-platform-dots')) this.map.moveLayer('radius-platform-dots');
        } catch (e) {}
    }

    _buildSatelliteStyle() {
        return {
            version: 8,
            sources: {
                esri: { type: 'raster', tiles: ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, attribution: 'Tiles © Esri' }
            },
            layers: [ { id: 'esri', type: 'raster', source: 'esri' } ]
        };
    }

    _buildRasterStyle(tiles, attribution) {
        return {
            version: 8,
            sources: {
                base: { type: 'raster', tiles, tileSize: 256, attribution }
            },
            layers: [ { id: 'base', type: 'raster', source: 'base' } ]
        };
    }

    _removeRouteLayers() {
        Array.from(this.layers.keys()).filter(id => id.startsWith('route-')).forEach(id => {
            const ent = this.layers.get(id);
            if (ent) {
                if (this.map.getLayer(ent.layerId)) this.map.removeLayer(ent.layerId);
                if (this.map.getSource(ent.sourceId)) this.map.removeSource(ent.sourceId);
                this.layers.delete(id);
            }
        });
    }

    _ensureStyleReady(callback) {
        if (!this.map) return;
        if (this.map.isStyleLoaded()) {
            callback();
        } else {
            const onceCb = () => {
                this.map.off('idle', onceCb);
                callback();
            };
            this.map.on('idle', onceCb);
        }
    }

    // Build grouped stop features:
    // - Hide access stops (E/H)
    // - Merge platform (G*) stops with the same stop_name into one feature
    // - Union routeIds and collect platform codes for popup
    _buildGroupedStopFeatures(stops, stopToRoutes) {
		const normalizeName = (n) => String(n || '').trim().replace(/\s+/g, ' ');
		// Load all GTFS stops for full clustering
		let allStops = [];
		try { allStops = window.transJakartaApp.modules.gtfs.getStops() || []; } catch (e) {}
		const idToStop = new Map(allStops.map(s => [String(s.stop_id || ''), s]));
		// Build parent-based clusters from all stops
		const parentToChildren = new Map();
		for (const s of allStops) {
			if (!s) continue;
			const sid = String(s.stop_id || '');
			if (sid.startsWith('E')) continue; // exclude access from cluster children
			let key = '';
			if (s.parent_station) {
				key = String(s.parent_station);
			} else if (sid.startsWith('H')) {
				key = sid; // parent itself
			} else {
				// fallback by normalized name (for feeder/non-parented)
				key = `NAME:${normalizeName(s.stop_name)}`;
			}
			if (!parentToChildren.has(key)) parentToChildren.set(key, []);
			parentToChildren.get(key).push(s);
		}
		// Build features for clusters referenced by provided subset
		const seenKeys = new Set();
		const features = [];
		for (const s of stops) {
			if (!s) continue;
			const sid = String(s.stop_id || '');
			let key = '';
			if (s.parent_station) key = String(s.parent_station);
			else if (sid.startsWith('H')) key = sid;
			else key = `NAME:${normalizeName(s.stop_name)}`;
			if (seenKeys.has(key)) continue;
			seenKeys.add(key);
			const cluster = parentToChildren.get(key) || [];
			if (cluster.length === 0) continue;
			const ids = [];
			const nonAccess = [];
			let parentStop = null;
			for (const cs of cluster) {
				const cid = String(cs.stop_id || '');
				if (cid.startsWith('E')) continue;
				ids.push(cid);
				if (cid.startsWith('H')) parentStop = cs;
				if (cs.stop_lat && cs.stop_lon) nonAccess.push(cs);
			}
			if (ids.length === 0) continue;
			// Geometry: prefer parent H position; else average
			let lat = 0, lon = 0;
			if (parentStop && parentStop.stop_lat && parentStop.stop_lon) {
				lat = parseFloat(parentStop.stop_lat); lon = parseFloat(parentStop.stop_lon);
			} else if (nonAccess.length) {
				const lats = nonAccess.map(x => parseFloat(x.stop_lat));
				const lons = nonAccess.map(x => parseFloat(x.stop_lon));
				lat = lats.reduce((a,b)=>a+b,0) / lats.length;
				lon = lons.reduce((a,b)=>a+b,0) / lons.length;
			}
			// Aggregate routes and platform mapping
			const routeIdSet = new Set();
			const platformCodes = new Set();
			const platformCodeToRouteIds = new Map();
			let anyWheelchair = false;
			let hasFeeder = false;
			let hasNonFeeder = false;
			let firstCode = '';
			let firstDesc = '';
			for (const cs of cluster) {
				const cid = String(cs.stop_id || '');
				if (cid.startsWith('E')) continue;
				const rids = stopToRoutes[cid] ? Array.from(stopToRoutes[cid]) : [];
				rids.forEach(r => routeIdSet.add(String(r)));
				if (!firstCode && cs.stop_code) firstCode = String(cs.stop_code);
				if (!firstDesc && cs.stop_desc) firstDesc = String(cs.stop_desc);
				if (String(cs.wheelchair_boarding || '0') === '1') anyWheelchair = true;
				if (cid.startsWith('B')) hasFeeder = true; else hasNonFeeder = true;
				if (cid.startsWith('G')) {
					const code = String(cs.platform_code || '').trim();
					if (code) {
						platformCodes.add(code);
						let set = platformCodeToRouteIds.get(code);
						if (!set) { set = new Set(); platformCodeToRouteIds.set(code, set); }
						rids.forEach(r => set.add(String(r)));
					}
				}
			}
			const platformMap = Array.from(platformCodeToRouteIds.entries()).map(([code, set]) => ({ code, routeIds: Array.from(set) })).sort((a,b)=>a.code.localeCompare(b.code));
			features.push({
				type: 'Feature',
				properties: {
					stopId: ids[0],
					stopName: normalizeName(s.stop_name || (parentStop && parentStop.stop_name)),
					stopType: (hasFeeder && !hasNonFeeder) ? 'Pengumpan' : 'Koridor',
					routeIds: Array.from(routeIdSet),
					platformCodes: Array.from(platformCodes).sort(),
					platformMap,
					wheelchairBoarding: anyWheelchair ? '1' : '0',
					stopCode: firstCode,
					stopDesc: firstDesc
				},
				geometry: { type: 'Point', coordinates: [lon, lat] }
			});
		}
		return features;
    }

    addRoutePolyline(routeId, shapes, color = '#264697') {
        if (!this.map || !shapes || shapes.length === 0) return;
        this._ensureStyleReady(() => {
            // Remove previous route layers to avoid stacking
            this._removeRouteLayers();

            const layerId = `route-${routeId}`;
            const sourceId = `source-${routeId}`;

            const routeFeatures = shapes.map(shape => ({
                type: 'Feature', properties: { routeId, color }, geometry: { type: 'LineString', coordinates: shape.map(p => [p.lng, p.lat]) }
            }));
            const routeSource = { type: 'geojson', data: { type: 'FeatureCollection', features: routeFeatures } };

            if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
            this.map.addSource(sourceId, routeSource);
            if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
            this.map.addLayer({ id: layerId, type: 'line', source: sourceId, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': color, 'line-width': 4, 'line-opacity': 0.8 } });
            this.layers.set(layerId, { sourceId, layerId });
            
            // Simpan data rute aktif untuk re-add setelah ganti style
            this._activeRouteData = { routeId, shapes, color, ...(this._activeRouteData || {}) };
            
            // Ensure overlays appear above the new polyline
            this._ensureOverlaysOnTop();
            
            this.fitBoundsToRoute(shapes);
        });
    }

    // Ensure custom stop icons are loaded into the style once per style load
    _ensureStopIconsLoaded() {
        if (!this.map) return Promise.resolve();
        if (this._stopIconsPromise) return this._stopIconsPromise;
        const entries = [
            { name: 'tj-stop-brt', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/JakIcon_BusBRT.svg/1200px-JakIcon_BusBRT.svg.png' },
            { name: 'tj-stop-feeder', url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/JakIcon_Bus_Light.svg/2048px-JakIcon_Bus_Light.svg.png' }
        ];
        const loadOne = (name, url) => {
            return new Promise((resolve) => {
                try {
                    if (this.map.hasImage && this.map.hasImage(name)) { resolve(true); return; }
                    this.map.loadImage(url, (err, img) => {
                        if (err || !img) { resolve(false); return; }
                        try {
                            // Double-check before add to avoid races
                            if (this.map.hasImage && this.map.hasImage(name)) { resolve(true); return; }
                            this.map.addImage(name, img);
                        } catch (e) {
                            // Ignore duplicate image errors
                        }
                        resolve(true);
                    });
                } catch (e) { resolve(false); }
            });
        };
        this._stopIconsPromise = Promise.all(entries.map(e => loadOne(e.name, e.url))).then(() => {});
        return this._stopIconsPromise;
    }

    addStopsMarkers(stops, stopToRoutes, routes) {
        if (!this.map || !stops || stops.length === 0) return;
        this._ensureStyleReady(() => {
            const layerId = 'stops-markers';
            const hitLayerId = 'stops-hitbox';
            const sourceId = 'stops-source';

            const stopFeatures = this._buildGroupedStopFeatures(stops, stopToRoutes);
            const data = { type: 'FeatureCollection', features: stopFeatures };
            if (this.map.getSource(sourceId)) {
                try { this.map.getSource(sourceId).setData(data); } catch (e) {}
            } else {
                this.map.addSource(sourceId, { type: 'geojson', data });
            }

            // Ensure layers exist once
            const addOrUpdateLayers = () => {
                if (!this.map.getLayer(layerId)) {
                    this.map.addLayer({
                        id: layerId,
                        type: 'symbol',
                        source: sourceId,
                        layout: {
                            'icon-image': [
                                'case',
                                ['==', ['get', 'stopType'], 'Pengumpan'], 'tj-stop-feeder',
                                'tj-stop-brt'
                            ],
                            'icon-size': [
                                'case',
                                ['==', ['get', 'stopType'], 'Pengumpan'], 0.008,
                                0.012
                            ],
                            'icon-rotate': [
                                'case',
                                ['==', ['get', 'stopType'], 'Pengumpan'], 180,
                                0
                            ],
                            'icon-allow-overlap': true,
                            'icon-ignore-placement': true
                        }
                    });
                }
                if (!this.map.getLayer(hitLayerId)) {
                    this.map.addLayer({ id: hitLayerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)' } });
                }
                this.layers.set(layerId, { sourceId, layerId });
                this.layers.set(hitLayerId, { sourceId, layerId: hitLayerId });

                // Add/Update platform dots and hitbox layers (G*)
                try {
                    const platformFeatures = (stops || []).filter(s => String(s.stop_id || '').startsWith('G')).map(s => ({
                type: 'Feature',
                properties: {
                            stopId: s.stop_id,
                            stopName: s.stop_name,
                            platformCode: String(s.platform_code || '').trim(),
                            routeIds: stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]) : []
                        },
                        geometry: { type: 'Point', coordinates: [parseFloat(s.stop_lon), parseFloat(s.stop_lat)] }
                    }));
                    const pfSourceId = 'platform-source';
                    const pfDotsId = 'platform-dots';
                    const pfHitId = 'platform-hitbox';
                    const pfData = { type: 'FeatureCollection', features: platformFeatures };
                    if (this.map.getSource(pfSourceId)) {
                        try { this.map.getSource(pfSourceId).setData(pfData); } catch (e) {}
                    } else {
                        this.map.addSource(pfSourceId, { type: 'geojson', data: pfData });
                    }
                    if (!this.map.getLayer(pfDotsId)) {
                        this.map.addLayer({ id: pfDotsId, type: 'circle', source: pfSourceId, paint: { 'circle-radius': 2.6, 'circle-color': '#64748b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.8 } });
                    }
                    if (!this.map.getLayer(pfHitId)) {
                        this.map.addLayer({ id: pfHitId, type: 'circle', source: pfSourceId, paint: { 'circle-radius': 10, 'circle-color': 'rgba(0,0,0,0)' } });
                    }
                    this.layers.set(pfDotsId, { sourceId: pfSourceId, layerId: pfDotsId });
                    this.layers.set(pfHitId, { sourceId: pfSourceId, layerId: pfHitId });

                    // Bind platform click once
                    if (!this._platformHandlersBound) {
                        this._onPlatformClick = (e) => {
                            const f = e.features && e.features[0];
                            if (!f) return;
                            const props = f.properties || {};
                            const code = props.platformCode || '';
                            let routeIds = [];
                            try { routeIds = Array.isArray(props.routeIds) ? props.routeIds : (typeof props.routeIds === 'string' ? JSON.parse(props.routeIds) : []); } catch (e) { routeIds = []; }
                            if (!Array.isArray(routeIds) || routeIds.length === 0) {
                                const sid = props.stopId;
                                if (sid && stopToRoutes[sid]) routeIds = Array.from(stopToRoutes[sid]);
                            }
                            const routesAll = window.transJakartaApp.modules.gtfs.getRoutes();
                            const badges = (routeIds || []).map(rid => {
                                const r = routesAll.find(rt => rt.route_id === rid);
                                if (!r) return '';
                                const color = r.route_color ? `#${r.route_color}` : '#6c757d';
                                return `<span class=\"badge badge-koridor-interaktif\" style=\"background:${color};color:#fff;font-weight:600;font-size:0.72em;padding:3px 7px;margin-right:6px;margin-bottom:6px;border-radius:9999px;\" data-routeid=\"${r.route_id}\">${r.route_short_name}</span>`;
                            }).join('');
                            const title = code ? `Platform ${code}` : 'Platform';
                            const html = `
                                <div class=\"stop-popup plus-jakarta-sans\" style=\"min-width:220px;max-width:300px;padding:10px 12px;\">
                                    <div style=\"color:#333;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:6px;display:flex;align-items:center;gap:6px;\">
                                        <div style=\"font-size:13px;font-weight:700;\">${title}</div>
                                    </div>
                                    <div style=\"font-size:11px;color:#666;margin-bottom:6px;\">Layanan pada platform ini</div>
                                    <div style=\"display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;\">${badges}</div>
                                </div>`;
                            this.showHtmlPopupAt(e.lngLat.lng, e.lngLat.lat, html);
                        };
                        this.map.on('click', pfHitId, this._onPlatformClick);
                        this.map.on('mouseenter', pfHitId, () => { this.map.getCanvas().style.cursor = 'pointer'; });
                        this.map.on('mouseleave', pfHitId, () => { this.map.getCanvas().style.cursor = ''; });
                        this._platformHandlersBound = true;
                    }
                } catch (e) {}

                // Bind handlers once
                if (!this._stopsHandlersBound) {
            this._onStopsClick = (e) => { const f = e.features && e.features[0]; if (f) this.showStopPopup(f, e.lngLat); };
            this._onStopsEnter = () => { this.map.getCanvas().style.cursor = 'pointer'; };
            this._onStopsLeave = () => { this.map.getCanvas().style.cursor = ''; };
            this.map.on('click', hitLayerId, this._onStopsClick);
            this.map.on('mouseenter', hitLayerId, this._onStopsEnter);
            this.map.on('mouseleave', hitLayerId, this._onStopsLeave);
                    this._stopsHandlersBound = true;
                }
                // Snapshot for re-add
            if (!this._activeRouteData) this._activeRouteData = {};
            this._activeRouteData.stopsSnapshot = { stops, stopToRoutes, routes };
                // Cache for radius updates
                this._radiusBaseFeatures = stopFeatures;
            };

            this._ensureStopIconsLoaded().then(addOrUpdateLayers);
        });
    }

    // Close current popup and remove temporary layers (nearest/search/walk/direct)
    closePopupAndTemp() {
        if (this._currentPopup) {
            this._currentPopup.remove();
            this._currentPopup = null;
        }
        const tempPrefixes = ['search-', 'walk-', 'direct-', 'near-'];
        const keys = Array.from(this.layers.keys());
        const tempEntries = keys
            .filter(k => tempPrefixes.some(p => k.startsWith(p)))
            .map(k => ({ key: k, entry: this.layers.get(k) }))
            .filter(x => !!x.entry);
        // Phase 1: remove layers
        tempEntries.forEach(({ entry }) => {
            if (entry && entry.layerId && this.map.getLayer(entry.layerId)) {
                this.map.removeLayer(entry.layerId);
            }
        });
        // Phase 2: remove sources (unique)
        const srcIds = new Set(tempEntries.map(({ entry }) => entry.sourceId).filter(Boolean));
        srcIds.forEach(srcId => {
            if (this.map.getSource(srcId)) this.map.removeSource(srcId);
        });
        // Cleanup registry
        tempEntries.forEach(({ key }) => this.layers.delete(key));
    }

    showStopPopup(stop, lngLat) {
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const currentRouteId = window.transJakartaApp.modules.routes.selectedRouteId;

        // Recompute union of route IDs and platform mapping from GTFS to be robust
        const gtfs = window.transJakartaApp.modules.gtfs;
        const allStops = gtfs.getStops();
        const stopToRoutes = gtfs.getStopToRoutes();
        const byId = new Map(allStops.map(s => [String(s.stop_id || ''), s]));
        const normalizeName = (n) => String(n || '').trim().replace(/\s+/g, ' ');
        const buildClusterKey = (s) => {
            const sid = String(s.stop_id || '');
            if (s.parent_station) return String(s.parent_station);
            if (sid.startsWith('H')) return sid;
            return `NAME:${normalizeName(s.stop_name)}`;
        };
        const stopId = String(stop.properties.stopId || '');
        const thisStop = byId.get(stopId);
        let unionRouteIds = [];
        let platformCodes = [];
        let platformMap = [];
        if (thisStop) {
            const sid = String(thisStop.stop_id || '');
            if (sid.startsWith('B')) {
                // Feeder: do not merge across name; use only this stop's routes
                unionRouteIds = stopToRoutes[sid] ? Array.from(stopToRoutes[sid]) : [];
            } else {
                // BRT: cluster by parent/name and union
                const key = buildClusterKey(thisStop);
                const cluster = allStops.filter(s => buildClusterKey(s) === key);
                const routeSet = new Set();
                const codeToSet = new Map();
                const codeSet = new Set();
                cluster.forEach(cs => {
                    const cid = String(cs.stop_id || '');
                    if (cid.startsWith('E')) return; // skip access
                    const rids = stopToRoutes[cid] ? Array.from(stopToRoutes[cid]) : [];
                    rids.forEach(r => routeSet.add(String(r)));
                    if (cid.startsWith('G')) {
                        const code = String(cs.platform_code || '').trim();
                        if (code) {
                            codeSet.add(code);
                            let set = codeToSet.get(code);
                            if (!set) { set = new Set(); codeToSet.set(code, set); }
                            rids.forEach(r => set.add(String(r)));
                        }
                    }
                });
                unionRouteIds = Array.from(routeSet);
                platformCodes = Array.from(codeSet).sort();
                platformMap = Array.from(codeToSet.entries()).map(([code, set]) => ({ code, routeIds: Array.from(set) })).sort((a,b)=>a.code.localeCompare(b.code));
                // Derive headsign per platform code using stop_times/trips
                try {
                    const trips = gtfs.getTrips();
                    const stopTimes = gtfs.getStopTimes ? gtfs.getStopTimes() : [];
                    const allStopsById = new Map(allStops.map(s => [String(s.stop_id || ''), s]));
                    const tripById = new Map((trips || []).map(t => [String(t.trip_id || ''), t]));
                    const unionSet = new Set(unionRouteIds.map(r => String(r)));
                    const codeToHeadsign = new Map();
                    const codeToBearing = new Map();
                    const codeToNextName = new Map();
                    platformMap.forEach(pm => { codeToHeadsign.set(pm.code, ''); });
                    for (const pm of platformMap) {
                        const code = pm.code;
                        const gStops = cluster.filter(cs => String(cs.stop_id || '').startsWith('G') && String(cs.platform_code || '').trim() === code);
                        const headCounts = new Map();
                        const nextNameCounts = new Map();
                        let sumX = 0, sumY = 0, seenBear = 0;
                        for (const gs of gStops) {
                            const stArr = (stopTimes || []).filter(st => String(st.stop_id || '') === String(gs.stop_id || ''));
                            let seen = 0;
                            for (const st of stArr) {
                                const tid = String(st.trip_id || '');
                                const trip = tripById.get(tid);
                                if (!trip) continue;
                                const rid = String(trip.route_id || '');
                                if (!unionSet.has(rid)) continue;
                                const head = String(trip.trip_headsign || '').trim();
                                if (head) headCounts.set(head, (headCounts.get(head) || 0) + 1);
                                // Compute bearing to next stop if available and collect next stop name
                                const seq = parseInt(st.stop_sequence || '0');
                                const next = (stopTimes || []).find(x => String(x.trip_id || '') === tid && parseInt(x.stop_sequence || '0') === seq + 1);
                                if (next) {
                                    const nextStop = allStopsById.get(String(next.stop_id || ''));
                                    if (nextStop && nextStop.stop_lat && nextStop.stop_lon && gs.stop_lat && gs.stop_lon) {
                                        const b = this._followBearingFrom(parseFloat(gs.stop_lat), parseFloat(gs.stop_lon), parseFloat(nextStop.stop_lat), parseFloat(nextStop.stop_lon));
                                        const rad = (b * Math.PI) / 180;
                                        sumX += Math.cos(rad); sumY += Math.sin(rad); seenBear++;
                                        const nm = String(nextStop.stop_name || '').trim();
                                        if (nm) nextNameCounts.set(nm, (nextNameCounts.get(nm) || 0) + 1);
                                    }
                                }
                                if (++seen >= 80) break; // limit work per stop
                            }
                        }
                        let best = '';
                        let bestCount = -1;
                        headCounts.forEach((c, h) => { if (c > bestCount) { bestCount = c; best = h; } });
                        if (best) codeToHeadsign.set(code, best);
                        let bestNext = '';
                        let bestNextCount = -1;
                        nextNameCounts.forEach((c, n) => { if (c > bestNextCount) { bestNextCount = c; bestNext = n; } });
                        if (bestNext) codeToNextName.set(code, bestNext);
                        if (seenBear > 0) {
                            const meanRad = Math.atan2(sumY, sumX);
                            let deg = (meanRad * 180 / Math.PI + 360) % 360;
                            codeToBearing.set(code, deg);
                        }
                    }
                    // Attach headsign and direction to platformMap entries
                    const arrows = ['↑','↗','→','↘','↓','↙','←','↖'];
                    platformMap = platformMap.map(pm => {
                        // compute representative lng/lat (average of G stops for this code)
                        const gStops = cluster.filter(cs => String(cs.stop_id || '').startsWith('G') && String(cs.platform_code || '').trim() === pm.code);
                        let lat = 0, lng = 0;
                        if (gStops.length) {
                            const lats = gStops.map(x => parseFloat(x.stop_lat));
                            const lngs = gStops.map(x => parseFloat(x.stop_lon));
                            lat = lats.reduce((a,b)=>a+b,0)/lats.length;
                            lng = lngs.reduce((a,b)=>a+b,0)/lngs.length;
                        }
                        const deg = codeToBearing.has(pm.code) ? codeToBearing.get(pm.code) : null;
                        let arrow = '';
                        if (deg !== null) {
                            const idx = Math.round(deg / 45) % 8;
                            arrow = arrows[idx];
                        }
                        // compute next stop per route for this platform code
                        const nextByRoute = (pm.routeIds || []).map(rid => {
                            const counts = new Map();
                            for (const gs of gStops) {
                                const stArr = (stopTimes || []).filter(st => String(st.stop_id || '') === String(gs.stop_id || ''));
                                let seen = 0;
                                for (const st of stArr) {
                                    const tid = String(st.trip_id || '');
                                    const trip = tripById.get(tid);
                                    if (!trip) continue;
                                    if (String(trip.route_id || '') !== String(rid)) continue;
                                    const seq = parseInt(st.stop_sequence || '0');
                                    const next = (stopTimes || []).find(x => String(x.trip_id || '') === tid && parseInt(x.stop_sequence || '0') === seq + 1);
                                    if (next) {
                                        const ns = allStopsById.get(String(next.stop_id || ''));
                                        const nm = ns && ns.stop_name ? String(ns.stop_name).trim() : '';
                                        if (nm) counts.set(nm, (counts.get(nm) || 0) + 1);
                                    }
                                    if (++seen >= 80) break;
                                }
                            }
                            let bestNm = '';
                            let bc = -1;
                            counts.forEach((c, n) => { if (c > bc) { bc = c; bestNm = n; } });
                            return { rid: String(rid), nextName: bestNm };
                        });
                        return { ...pm, headsign: codeToHeadsign.get(pm.code) || '', nextName: (codeToNextName.get(pm.code) || codeToHeadsign.get(pm.code) || ''), nextByRoute, bearingDeg: deg, directionArrow: arrow, lat, lng };
                    });
                } catch (e) {}
            }
        }
        // Fallback to feature properties if cluster lookup failed
        if (!unionRouteIds.length) unionRouteIds = Array.isArray(stop.properties.routeIds) ? stop.properties.routeIds : [];
        if (!platformCodes.length) platformCodes = Array.isArray(stop.properties.platformCodes) ? stop.properties.platformCodes : [];
        if (!platformMap.length) platformMap = Array.isArray(stop.properties.platformMap) ? stop.properties.platformMap : [];
        // Intersect with feature-specific routeIds when present to avoid showing routes not at this exact stop
        try {
            let given = [];
            if (Array.isArray(stop.properties.routeIds)) {
                given = stop.properties.routeIds.map(x => String(x));
            } else if (typeof stop.properties.routeIds === 'string') {
                given = JSON.parse(stop.properties.routeIds);
                given = Array.isArray(given) ? given.map(x => String(x)) : [];
            }
            if (given && given.length) {
                unionRouteIds = unionRouteIds.filter(r => given.includes(String(r)));
            }
        } catch (e) {}

        const wheelchair = stop.properties.wheelchairBoarding === '1';
        const isFeeder = stop.properties.stopType === 'Pengumpan' || (thisStop && String(thisStop.stop_id || '').startsWith('B'));

        // Header jenis/platform
        let jenisHtml = '';
        if (isFeeder) {
            jenisHtml = `<div style="font-size: 12px; color: #facc15; font-weight: 600; margin-bottom: 6px;">Pengumpan</div>`;
        } else if (platformCodes.length) {
            jenisHtml = `<div style=\"font-size: 12px; color: #64748b; margin-bottom: 6px;\">Platform: ${platformCodes.join('-')}</div>`;
        }

        // Semua layanan di halte
        const semuaBadges = unionRouteIds
            .filter(rid => !currentRouteId || String(rid) !== String(currentRouteId))
            .map(rid => {
                const r = routes.find(rt => rt.route_id === rid);
                if (!r) return '';
                const color = r.route_color ? `#${r.route_color}` : '#6c757d';
            return `<span class=\"badge badge-koridor-interaktif\" style=\"background:${color};color:#fff;cursor:pointer;font-weight:600;font-size:0.74em;padding:3px 7px;margin-right:6px;margin-bottom:6px;border-radius:9999px;\" data-routeid=\"${r.route_id}\">${r.route_short_name}</span>`;
            }).join('');

        // Active route prefix before stop name as a badge
        const activePrefix = (() => {
            const idStr = currentRouteId ? String(currentRouteId) : '';
            if (!idStr) return '';
            // Only show if active route actually serves this stop
            try {
                const hasActiveHere = (unionRouteIds || []).some(r => String(r) === idStr);
                if (!hasActiveHere) return '';
            } catch (e) {}
            const r = routes.find(rt => String(rt.route_id) === idStr);
            if (!r) return '';
            const color = r.route_color ? `#${r.route_color}` : '#6c757d';
            const shortName = r.route_short_name || '';
            if (!shortName) return '';
            return `<span class=\"badge badge-koridor-interaktif rounded-pill me-1\" style=\"background:${color};color:#fff;font-weight:bold;padding:4px 8px;\">${shortName}</span>`;
        })();

        // Layanan per platform (jika ada detail kode platform)
        let platformDetailHtml = '';
        if (!isFeeder && platformMap.length) {
			const pfId = 'pf-' + Date.now();
			const rows = platformMap.map((p, idx) => {
				const perRoute = (p.nextByRoute || []).map(({ rid, nextName }) => {
					const r = routes.find(rt => String(rt.route_id) === String(rid));
					if (!r) return '';
					const color = r.route_color ? `#${r.route_color}` : '#6c757d';
					const shortName = r.route_short_name || rid;
					return `<div class=\"pf-next-item\" data-routeid=\"${r.route_id}\" style=\"display:flex;align-items:center;gap:8px;margin:2px 0;cursor:pointer;\"><span class=\"badge\" data-routeid=\"${r.route_id}\" style=\"background:${color};color:#fff;font-weight:700;font-size:0.72em;padding:3px 7px;border-radius:9999px;\">${shortName}</span><span class=\"next-name\" style=\"color:#111827;\">${nextName || '-'}</span></div>`;
				}).join('');
				return `
				<div class=\"pf-block\" data-pf=\"${idx}\" data-code=\"${p.code}\" data-lat=\"${p.lat}\" data-lng=\"${p.lng}\" style=\"margin:8px 0;\">\n\t\t\t\t\t\t<div class=\"pf-row\" style=\"font-weight:600;color:#475569;\">Platform ${p.code}<\/div>\n\t\t\t\t\t\t<div class=\"pf-next\">${perRoute}<\/div>\n\t\t\t\t\t\t<div class=\"pf-actions\" style=\"margin-top:6px;\"><button class=\"pf-open btn btn-sm btn-outline-secondary\" data-code=\"${p.code}\" data-lat=\"${p.lat}\" data-lng=\"${p.lng}\" data-rids=\"${encodeURIComponent(JSON.stringify(p.routeIds||[]))}\" style=\"padding:3px 8px;font-size:11px;\">Lihat<\/button><\/div>\n\t\t\t\t\t<\/div>`;
			}).join('');
			// Collapse logic: show first 2 rows, toggle to show all
			const total = platformMap.length;
			const visible = Math.min(2, total);
			const htmlRows = `
				<div id=\"${pfId}-rows\">${rows}</div>
			`;
			const toggleBtn = total > visible ? `<button id=\"${pfId}-toggle\" class=\"btn btn-sm btn-link p-0\" type=\"button\">Tampilkan semua (${total})</button>` : '';
			platformDetailHtml = `
				<div style=\"margin-top:8px;\">\n\t\t\t\t\t\t<div style=\"font-size:11px;color:#666;margin-bottom:4px;\">Per Platform</div>\n\t\t\t\t\t\t<div id=\"${pfId}\">${htmlRows}${toggleBtn}</div>\n\t\t\t\t\t</div>`;
			// After popup render we will collapse extra rows and bind toggle
			setTimeout(() => {
				try {
					const root = this._currentPopup && this._currentPopup.getElement && this._currentPopup.getElement();
					if (!root) return;
					const container = root.querySelector('#' + CSS.escape(pfId));
					if (!container) return;
					const blocks = container.querySelectorAll('.pf-block');
					if (blocks.length > 2) {
						for (let i = 2; i < blocks.length; i++) {
							blocks[i].style.display = 'none';
						}
						const btn = container.querySelector('#' + CSS.escape(pfId) + '-toggle');
						let expanded = false;
						if (btn) btn.addEventListener('click', () => {
							expanded = !expanded;
							for (let i = 2; i < blocks.length; i++) blocks[i].style.display = expanded ? '' : 'none';
							btn.textContent = expanded ? 'Sembunyikan' : `Tampilkan semua (${blocks.length})`;
						});
					}
					// Bind per-route click to select route and start Live from this platform
					const onRouteClick = (ev) => {
						try { ev.preventDefault(); ev.stopPropagation(); } catch (e) {}
						const target = ev.currentTarget;
						if (!target) return;
						const rid = target.getAttribute('data-routeid');
						if (!rid) return;
						// Determine platform context
						const host = target.closest('.pf-block');
						const code = host ? host.getAttribute('data-code') : '';
						const platLat = host ? parseFloat(host.getAttribute('data-lat')) : NaN;
						const platLng = host ? parseFloat(host.getAttribute('data-lng')) : NaN;
						try { window.transJakartaApp.modules.location.suspendUpdates(true); } catch (e) {}
						// Select route first
						try { window.transJakartaApp.modules.routes.selectRoute(rid); } catch (e) {}
						// After brief delay, enable live and start from this platform
						setTimeout(() => {
							try {
								const loc = window.transJakartaApp.modules.location;
								if (loc && !loc.isActive && loc.canAutoStartLive && loc.canAutoStartLive()) loc.enableLiveLocation();
								const gtStop = this._findPlatformStopBy(code, platLat, platLng);
								if (loc && gtStop) {
									loc.activateLiveServiceFromStop(gtStop, rid);
									const tryImmediate = () => {
										if (loc.lastUserPos && loc.userMarker) {
											loc.showUserRouteInfo(loc.lastUserPos.lat, loc.lastUserPos.lon, gtStop, rid);
											return true;
										}
										return false;
									};
									if (!tryImmediate()) {
										try {
											navigator.geolocation.getCurrentPosition(
												(pos) => {
													try {
														const lat = pos.coords.latitude, lon = pos.coords.longitude;
														loc.lastUserPos = { lat, lon };
														loc.lastUserPosSmoothed = { lat, lon };
														loc.updateUserMarker(lat, lon);
														loc.showUserRouteInfo(lat, lon, gtStop, rid);
													} catch (_) { loc.scheduleLiveUIUpdate(); }
												},
												() => { try { loc.scheduleLiveUIUpdate(); } catch(_){} },
												{ enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 }
											);
										} catch (_) { try { loc.scheduleLiveUIUpdate(); } catch(_){} }
									}
								}
							} catch (e) {}
							this._resumeAfterIdle();
						}, 160);
						if (this._currentPopup) { this._currentPopup.remove(); this._currentPopup = null; }
					};
					container.querySelectorAll('.pf-next-item').forEach(el => {
						el.addEventListener('click', onRouteClick);
					});
					container.querySelectorAll('.pf-next-item .badge').forEach(el => {
						el.addEventListener('click', onRouteClick);
					});
					// Bind open platform buttons
					container.querySelectorAll('.pf-open').forEach(btn => {
						btn.addEventListener('click', (ev) => {
							try { ev.stopPropagation(); ev.preventDefault(); } catch (e) {}
							const code = btn.getAttribute('data-code');
							const lat = parseFloat(btn.getAttribute('data-lat'));
							const lng = parseFloat(btn.getAttribute('data-lng'));
							let rids = [];
							try { rids = JSON.parse(decodeURIComponent(btn.getAttribute('data-rids') || '[]')); } catch (e) { rids = []; }
							this.navigateToPlatformAndShow(code, lat, lng, rids);
						});
					});
				} catch (e) {}
			}, 60);
		}

        const wheelchairIconHtml = wheelchair ? `<iconify-icon icon=\"fontisto:paralysis-disability\" inline></iconify-icon>` : '';

        const popupContent = `
            <div class=\"stop-popup plus-jakarta-sans\" style=\"min-width: 220px; max-width: 330px; padding: 10px 12px;\">
                <div style=\"color: #333; padding: 6px 0; border-bottom: 1px solid #eee; margin-bottom: 6px; display:flex; align-items:center; gap:6px;\">
                    <div style=\"display:flex;align-items:center;gap:6px;\">${activePrefix}<span style=\"font-size: 14px; font-weight: 600;\">${stop.properties.stopName}</span>
                        ${(() => { try { const rm = window.transJakartaApp.modules.routes; const stopObj = window.transJakartaApp.modules.gtfs.getStops().find(s => String(s.stop_id) === String(stop.properties.stopId)); if (!rm || !stopObj) return ''; const html = rm.buildIntermodalIconsForStop ? rm.buildIntermodalIconsForStop(stopObj) : ''; return html || ''; } catch(e){ return ''; } })()}
                        ${(() => { try { const rm = window.transJakartaApp.modules.routes; const stopObj = window.transJakartaApp.modules.gtfs.getStops().find(s => String(s.stop_id) === String(stop.properties.stopId)); if (!rm || !stopObj) return ''; if (rm.shouldShowJaklingkoBadge && rm.shouldShowJaklingkoBadge(stopObj)) { return '<img class="jaklingko-badge" src="https://transportforjakarta.or.id/wp-content/uploads/2024/10/jaklingko-w-AR0bObLen0c7yK8n-768x768.png" alt="JakLingko" title="Terintegrasi JakLingko" />'; } return ''; } catch(e){ return ''; } })()}
                    </div>
                    ${wheelchairIconHtml}
                </div>
                <div class=\"popup-scroll\" style=\"max-height:56vh;overflow:auto;\">
                ${jenisHtml}
                    ${semuaBadges ? `
                <div>
                        <div style=\"font-size: 11px; color: #666; margin-bottom: 6px;\">Layanan</div>
                        <div style=\"display:flex;flex-wrap:wrap;gap:4px;\">
                            ${semuaBadges}
                    </div>
                </div>` : ''}
                    ${platformDetailHtml}
                </div>
            </div>
        `;

        if (this._currentPopup) this._currentPopup.remove();
        this._currentPopup = this.featurePopup.setLngLat(lngLat).setHTML(popupContent).addTo(this.map);

        setTimeout(() => {
            const el = this._currentPopup && this._currentPopup.getElement();
            if (!el) return;
            el.querySelectorAll('.badge-koridor-interaktif').forEach(badge => {
                const handler = (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const routeId = badge.getAttribute('data-routeid');
                    // Select route only from union services
                    try { window.transJakartaApp.modules.routes.selectRoute(routeId); } catch (e) {}
                    this._resumeAfterIdle();
                    if (this._currentPopup) { this._currentPopup.remove(); this._currentPopup = null; }
                };
                badge.addEventListener('click', handler);
                badge.addEventListener('touchstart', handler, { passive: false });
            });
        }, 50);
    }

    _handleRouteBadgeClick(routeId) {
        if (routeId) {
            window.transJakartaApp.modules.routes.selectRoute(routeId);
            if (this._currentPopup) {
                this._currentPopup.remove();
                this._currentPopup = null;
            }
        }
    }

    getStopType(stopId) {
        if (stopId.startsWith('B')) return 'Pengumpan';
        if (stopId.startsWith('G')) return 'Platform';
        if (stopId.startsWith('E') || stopId.startsWith('H')) return 'Akses Masuk';
        return 'Koridor';
    }

    fitBoundsToRoute(shapes) {
        if (!shapes || shapes.length === 0) return;
        const bounds = new maplibregl.LngLatBounds();
        shapes.forEach(shape => shape.forEach(p => bounds.extend([p.lng, p.lat])));
        this.map.fitBounds(bounds, { padding: 50, duration: 1000 });
    }

    // Implement radius markers
    showHalteRadius(centerLng, centerLat, radius = 300) {
        // Throttle updates to avoid jank
        this._radiusRequest = { centerLng, centerLat, radius };
        if (this._radiusUpdateTimer) clearTimeout(this._radiusUpdateTimer);
        this._radiusUpdateTimer = setTimeout(() => this._updateHalteRadius(), 120);
    }

    _updateHalteRadius() {
        this._ensureStyleReady(() => {
            const req = this._radiusRequest || {};
            const centerLng = req.centerLng, centerLat = req.centerLat, radius = req.radius || 300;
            if (typeof centerLng !== 'number' || typeof centerLat !== 'number') return;
            // Build raw features so feeder (B) and platform (G) are preserved
            let selected = [];
            let platformSelected = [];
            try {
                const gtfs = window.transJakartaApp.modules.gtfs;
                const stops = gtfs.getStops() || [];
                const stopToRoutes = gtfs.getStopToRoutes() || {};
                const candidates = stops.filter(s => s && s.stop_lat && s.stop_lon && !(String(s.stop_id||'').startsWith('E')));
                const computed = candidates.map(s => {
                    const lat = parseFloat(s.stop_lat), lon = parseFloat(s.stop_lon);
                    const d = this._haversine(centerLat, centerLng, lat, lon);
                    const routeIds = stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]) : [];
                    const stopType = this.getStopType(String(s.stop_id));
                    return {
                        f: {
                    type: 'Feature',
                    properties: {
                                stopId: s.stop_id,
                                stopName: s.stop_name,
                                stopType,
                                routeIds,
                                wheelchairBoarding: s.wheelchair_boarding || '0',
                                stopCode: s.stop_code || '',
                                stopDesc: s.stop_desc || ''
                            },
                            geometry: { type: 'Point', coordinates: [lon, lat] }
                        },
                        d,
                        isPlatform: String(s.stop_id||'').startsWith('G')
                    };
                }).filter(o => o.d <= radius).sort((a,b) => a.d - b.d);
                const limited = computed.slice(0, 30);
                // Exclude platform (G) from base radius markers to avoid duplication with platform dots
                selected = limited.filter(o => !o.isPlatform).map(o => ({ type: 'Feature', properties: { ...o.f.properties, dist: o.d }, geometry: o.f.geometry }));
                platformSelected = limited.filter(o => o.isPlatform).map(o => ({
                    type: 'Feature',
                    properties: {
                        stopId: o.f.properties.stopId,
                        platform: true,
                        platformCode: (window.transJakartaApp.modules.gtfs.getStops().find(s => s.stop_id === o.f.properties.stopId)?.platform_code || '').toString(),
                        routeIds: o.f.properties.routeIds || []
                    },
                    geometry: o.f.geometry
                }));
            } catch (e) { selected = []; platformSelected = []; }

            const data = { type: 'FeatureCollection', features: selected };
            if (this.map.getSource(this._radiusSourceId)) {
                try { this.map.getSource(this._radiusSourceId).setData(data); } catch (e) {}
            } else {
                this.map.addSource(this._radiusSourceId, { type: 'geojson', data });
            }

            // Add a lightweight circle layer for performance
            if (!this.map.getLayer(this._radiusLayerId)) {
                this.map.addLayer({
                    id: this._radiusLayerId,
                    type: 'circle',
                    source: this._radiusSourceId,
                    paint: {
                        'circle-radius': [
                            'case',
                            ['==', ['get', 'stopType'], 'Pengumpan'], 4.5,
                            5.5
                        ],
                        'circle-color': [
                            'case',
                            ['==', ['get', 'stopType'], 'Pengumpan'], '#f59e0b',
                            '#2563eb'
                        ],
                        'circle-stroke-color': '#ffffff',
                        'circle-stroke-width': 1.2
                    }
                });
            } else {
                // Update paint to ensure styling persists
                try {
                    this.map.setPaintProperty(this._radiusLayerId, 'circle-radius', [
                        'case', ['==', ['get', 'stopType'], 'Pengumpan'], 4.5, 5.5
                    ]);
                    this.map.setPaintProperty(this._radiusLayerId, 'circle-color', [
                        'case', ['==', ['get', 'stopType'], 'Pengumpan'], '#f59e0b', '#2563eb'
                    ]);
                    this.map.setPaintProperty(this._radiusLayerId, 'circle-stroke-color', '#ffffff');
                    this.map.setPaintProperty(this._radiusLayerId, 'circle-stroke-width', 1.2);
                } catch (e) {}
            }

            // Platform dots overlay for radius
            const pfSrcId = 'radius-platform-source';
            const pfLyId = 'radius-platform-dots';
            const pfData = { type: 'FeatureCollection', features: platformSelected };
            if (this.map.getSource(pfSrcId)) {
                try { this.map.getSource(pfSrcId).setData(pfData); } catch (e) {}
            } else {
                this.map.addSource(pfSrcId, { type: 'geojson', data: pfData });
            }
            if (!this.map.getLayer(pfLyId)) {
                this.map.addLayer({ id: pfLyId, type: 'circle', source: pfSrcId, paint: { 'circle-radius': 2.2, 'circle-color': '#64748b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 0.8 } });
            }

            // Click handler for platform dots
            if (this._onRadiusPlatformClick) { try { this.map.off('click', pfLyId, this._onRadiusPlatformClick); } catch (e) {} }
            this._onRadiusPlatformClick = (e) => {
                const f = e.features && e.features[0];
                if (!f) return;
                const props = f.properties || {};
                const code = props.platformCode || '';
                let rids = [];
                try { rids = Array.isArray(props.routeIds) ? props.routeIds : (typeof props.routeIds === 'string' ? JSON.parse(props.routeIds) : []); } catch (err) { rids = []; }
                const lng = f.geometry && f.geometry.coordinates ? f.geometry.coordinates[0] : e.lngLat.lng;
                const lat = f.geometry && f.geometry.coordinates ? f.geometry.coordinates[1] : e.lngLat.lat;
                this.navigateToPlatformAndShow(code, lat, lng, rids);
            };
            this.map.on('click', pfLyId, this._onRadiusPlatformClick);
            this.map.on('mouseenter', pfLyId, () => { this.map.getCanvas().style.cursor = 'pointer'; });
            this.map.on('mouseleave', pfLyId, () => { this.map.getCanvas().style.cursor = ''; });

            // Bind click once
            if (this._onRadiusClick) { try { this.map.off('click', this._radiusLayerId, this._onRadiusClick); } catch (e) {} }
            this._onRadiusClick = (e) => { 
                const f = e.features && e.features[0]; 
                if (!f) return;
                const routeIdsAtStop = Array.isArray(f.properties.routeIds) ? f.properties.routeIds : [];
                const app = window.transJakartaApp;
                if (routeIdsAtStop.length === 1) {
                    try { app.modules.location.suspendUpdates(true); } catch (e) {}
                    app.modules.routes.selectRoute(routeIdsAtStop[0]);
                    this._resumeAfterIdle();
                } else {
                    this.showStopPopup(f, e.lngLat);
                }
            };
            this.map.on('click', this._radiusLayerId, this._onRadiusClick);
            this.map.getCanvas().style.cursor = 'pointer';
            // Keep overlays on top
            this._ensureOverlaysOnTop();
        });
    }

    removeHalteRadiusMarkers() {
        if (this.map.getLayer(this._radiusLayerId)) this.map.removeLayer(this._radiusLayerId);
        if (this.map.getSource(this._radiusSourceId)) this.map.removeSource(this._radiusSourceId);
        if (this.map.getLayer('radius-platform-dots')) this.map.removeLayer('radius-platform-dots');
        if (this.map.getSource('radius-platform-source')) this.map.removeSource('radius-platform-source');
    }

    addUserMarker(lat, lng) {
        this._ensureStyleReady(() => {
            const layerId = 'user-marker';
            const sourceId = 'user-source';
            if (this.map.getSource(sourceId)) {
                // If exists, just update
                const src = this.map.getSource(sourceId);
                if (src && src.setData) src.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } });
                return 'user-marker';
            }
            if (this.layers.has(layerId)) {
                const entry = this.layers.get(layerId);
                if (entry && this.map.getLayer(entry.layerId)) return layerId;
            }
            this.map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } } });
            this.map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 8, 'circle-color': '#007cbf', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
            this.layers.set(layerId, { sourceId, layerId });
        });
        return 'user-marker';
    }

    updateUserMarkerPosition(lat, lng) {
        const source = this.map.getSource('user-source');
        if (source) source.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } });
    }

    removeUserMarker() {
        if (this.map.getLayer('user-marker')) this.map.removeLayer('user-marker');
        if (this.map.getSource('user-source')) this.map.removeSource('user-source');
        this.layers.delete('user-marker');
    }

    showUserPositionPopup() {
        const src = this.map.getSource('user-source');
        if (!src || !src._data) return;
        const coords = src._data.geometry && src._data.geometry.coordinates;
        if (!coords) return;
        if (!this.userPopup) return;
        this.userPopup.setLngLat(coords).setHTML('Posisi Anda').addTo(this.map);
    }

    updateUserPopup(_markerId, html) {
        const src = this.map.getSource('user-source');
        if (!src || !src._data) return;
        const coords = src._data.geometry && src._data.geometry.coordinates;
        if (!coords) return;
        if (!this.userPopup) return;
        this.userPopup.setLngLat(coords).setOffset([0, 20]).setHTML(html).addTo(this.map);
    }

    addSearchResultMarker(lat, lng, title) {
        const id = `search-${Date.now()}`;
        const sourceId = `${id}-source`;
        this.map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: { title }, geometry: { type: 'Point', coordinates: [lng, lat] } } });
        this.map.addLayer({ id, type: 'circle', source: sourceId, paint: { 'circle-radius': 6, 'circle-color': '#d9534f', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
        this.layers.set(id, { sourceId, layerId: id });
        this.showHtmlPopupAt(lng, lat, title);
        return id;
    }

    removeSearchResultMarker() {
        const keys = Array.from(this.layers.keys()).filter(k => k.startsWith('search-'));
        const last = keys.pop();
        if (!last) return;
        const entry = this.layers.get(last);
        if (entry) {
            if (this.map.getLayer(entry.layerId)) this.map.removeLayer(entry.layerId);
            if (this.map.getSource(entry.sourceId)) this.map.removeSource(entry.sourceId);
            this.layers.delete(last);
        }
    }

    addNearestStopMarker(lat, lng, stop, distance) {
        const id = `near-${stop.stop_id}-${Date.now()}`;
        const sourceId = `${id}-source`;
        const layerId = id;
        const hitLayerId = `${id}-hitbox`;
        const distText = typeof distance === 'number' ? (distance < 1000 ? Math.round(distance) + ' m' : (distance/1000).toFixed(2) + ' km') : '';

        this._ensureStyleReady(() => {
            // Defensive remove if exists
            if (this.map.getLayer(hitLayerId)) this.map.removeLayer(hitLayerId);
            if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
            if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);

            this.map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', properties: { stop_id: stop.stop_id }, geometry: { type: 'Point', coordinates: [lng, lat] } } });
            this.map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 7, 'circle-color': '#0074D9', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
            // Hitbox for easier click
            this.map.addLayer({ id: hitLayerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)' } });
            this.layers.set(layerId, { sourceId, layerId });
            this.layers.set(hitLayerId, { sourceId, layerId: hitLayerId });

            // Click handler: open popup with badges
            this.map.on('click', hitLayerId, (e) => {
                const p = e.lngLat;
                const s = stop; // closure
                const pseudoFeature = { properties: { stopId: s.stop_id, stopName: s.stop_name, wheelchairBoarding: (s.wheelchair_boarding || '0') } };
                this.showStopPopup(pseudoFeature, p);
            });
            this.map.on('mouseenter', hitLayerId, () => { this.map.getCanvas().style.cursor = 'pointer'; });
            this.map.on('mouseleave', hitLayerId, () => { this.map.getCanvas().style.cursor = ''; });
        });
        return id;
    }

    removeMarker(id) {
        const entry = this.layers.get(id);
        if (!entry) return;
        const sourceId = entry.sourceId;
        const layerId = entry.layerId;
        // Remove the target layer first
        try { if (layerId && this.map.getLayer(layerId)) this.map.removeLayer(layerId); } catch (e) {}
        // Only remove the source if no other registered layers still reference it
        if (sourceId) {
            const stillUsing = Array.from(this.layers.entries()).some(([key, e]) => {
                if (!e || key === id) return false;
                const same = e.sourceId === sourceId;
                if (!same) return false;
                try { return !!(e.layerId && this.map.getLayer(e.layerId)); } catch (_) { return false; }
            });
            if (!stillUsing) {
                try { if (this.map.getSource(sourceId)) this.map.removeSource(sourceId); } catch (e) {}
            }
        }
        // Cleanup registry
        this.layers.delete(id);
    }

    addWalkingRouteLine(coordsLatLng) {
        const id = `walk-${Date.now()}`;
        const sourceId = `${id}-source`;
        const lineCoords = coordsLatLng.map(([lat, lng]) => [lng, lat]);
        this.map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: lineCoords } } });
        this.map.addLayer({ id, type: 'line', source: sourceId, paint: { 'line-color': '#0074D9', 'line-width': 4, 'line-dasharray': [2, 2] } });
        this.layers.set(id, { sourceId, layerId: id });
        return id;
    }

    addDirectLine(lat1, lon1, lat2, lon2) {
        const id = `direct-${Date.now()}`;
        const sourceId = `${id}-source`;
        const coords = [[lon1, lat1], [lon2, lat2]];
        this.map.addSource(sourceId, { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
        this.map.addLayer({ id, type: 'line', source: sourceId, paint: { 'line-color': '#0074D9', 'line-width': 4, 'line-dasharray': [6, 8] } });
        this.layers.set(id, { sourceId, layerId: id });
        return id;
    }

    setView(lat, lng, zoom = 16) {
        if (this.map) this.map.flyTo({ center: [lng, lat], zoom, duration: 1000 });
    }

    clearLayers() {
        // Remove all layers first, then remove sources to avoid dependency errors
        const entries = Array.from(this.layers.values());
        const removedLayers = new Set();
        const sourceIds = new Set();
        entries.forEach(({ sourceId, layerId }) => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
                removedLayers.add(layerId);
            }
            if (sourceId) sourceIds.add(sourceId);
        });
        sourceIds.forEach((srcId) => {
            if (this.map.getSource(srcId)) this.map.removeSource(srcId);
        });
        this.layers.clear();
        this.removeHalteRadiusMarkers();
        
        // Clear active route data
        this._activeRouteData = null;
        
        // Close any open feature popup
        if (this._currentPopup) {
            this._currentPopup.remove();
            this._currentPopup = null;
        }
        // Do not close user popup here to keep live info; reset() will handle it
    }

    reset() {
        this.clearLayers();
        this.setView(-6.2, 106.8, 11);
        if (this.featurePopup) this.featurePopup.remove();
        if (this.userPopup) this.userPopup.remove();
        this._currentPopup = null;
        this._activeRouteData = null;
    }

    _haversine(lat1, lon1, lat2, lon2) {
        const toRad = x => x * Math.PI / 180;
        const R = 6371e3;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) ** 2;
        return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    getMap() { return this.map; }

    closePopup() {
        if (this._currentPopup) {
            this._currentPopup.remove();
            this._currentPopup = null;
        }
    }

    showHtmlPopupAt(lng, lat, html) {
        if (!this.featurePopup) return;
        if (this._currentPopup) this._currentPopup.remove();
        this._currentPopup = this.featurePopup.setLngLat([lng, lat]).setHTML(html).addTo(this.map);
        return this._currentPopup;
    }
    
    // Render/update label text untuk halte berikutnya di peta
    updateNextStopLabel(nextStop) {
        this._ensureStyleReady(() => {
            const srcId = 'nextstop-label-source';
            const layerId = 'nextstop-label';
            if (!nextStop) {
                if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
                if (this.map.getSource(srcId)) this.map.removeSource(srcId);
                this.layers.delete(layerId);
                return;
            }
            const lng = parseFloat(nextStop.stop_lon);
            const lat = parseFloat(nextStop.stop_lat);
            const data = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { name: nextStop.stop_name }, geometry: { type: 'Point', coordinates: [lng, lat] } }] };
            if (this.map.getSource(srcId)) {
                const src = this.map.getSource(srcId);
                if (src && src.setData) src.setData(data);
            } else {
                this.map.addSource(srcId, { type: 'geojson', data });
            }
            if (!this.map.getLayer(layerId)) {
                this.map.addLayer({
                    id: layerId,
                    type: 'symbol',
                    source: srcId,
                    layout: {
                        'text-field': ['get', 'name'],
                        'text-size': 12,
                        'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
                        'text-anchor': 'bottom',
                        'text-offset': [0, -1.2]
                    },
                    paint: {
                        'text-color': '#111111',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1.2
                    }
                });
                this.layers.set(layerId, { sourceId: srcId, layerId });
            }
        });
    }
    
    clearNextStopLabel() { this.updateNextStopLabel(null); }

    setCameraLock(enabled) {
        this._cameraLock = !!enabled;
        if (!this.map) return;
        if (this._cameraLock) {
            // Set initial 3D pitch for better perspective
            this.map.setPitch(60);
        } else {
            // Optionally relax pitch when unlocked
            this.map.setPitch(0);
        }
    }

    toggleCameraLock() { this.setCameraLock(!this._cameraLock); }
    isCameraLock() { return !!this._cameraLock; }

    _followBearingFrom(lat1, lon1, lat2, lon2) {
        const toRad = d => d * Math.PI / 180;
        const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
        let brng = Math.atan2(y, x) * 180 / Math.PI;
        return (brng + 360) % 360;
    }

    followUserCamera(lat, lon, headingDeg, zoom = 17) {
        if (!this.map || !this._cameraLock) return;
        let bearing = typeof headingDeg === 'number' && !isNaN(headingDeg) ? headingDeg : this.map.getBearing();
        // Smooth bearing changes to avoid jitter
        const currentBearing = this.map.getBearing();
        const delta = Math.abs(((bearing - currentBearing + 540) % 360) - 180);
        if (delta < 2) bearing = currentBearing;
        // Smooth center update
        const currentCenter = this.map.getCenter();
        const dx = Math.abs(currentCenter.lng - lon);
        const dy = Math.abs(currentCenter.lat - lat);
        const smallMove = dx < 1e-5 && dy < 1e-5;
        this.map.easeTo({ center: smallMove ? currentCenter : [lon, lat], zoom, bearing, pitch: Math.max(this.map.getPitch(), 60), duration: 600, easing: t => t });
    }

    _resumeAfterIdle() {
        const resume = () => {
            try { window.transJakartaApp.modules.location.suspendUpdates(false); } catch (e) {}
            this.map.off('idle', resume);
        };
        this.map.on('idle', resume);
    }

    navigateToPlatformAndShow(code, lat, lng, routeIds) {
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        // Focus map to platform location
        try { this.setView(lat, lng, Math.max(this.map.getZoom() || 16, 18)); } catch (e) {}
        // Build badges
        const badges = (routeIds || []).map(rid => {
            const r = routes.find(rt => String(rt.route_id) === String(rid));
            if (!r) return '';
            const color = r.route_color ? `#${r.route_color}` : '#6c757d';
            return `<span class=\"badge badge-koridor-interaktif\" style=\"background:${color};color:#fff;font-weight:600;font-size:0.72em;padding:3px 7px;margin-right:6px;margin-bottom:6px;\" data-routeid=\"${r.route_id}\">${r.route_short_name}</span>`;
        }).join('');
        const title = code ? `Platform ${code}` : 'Platform';
        const html = `
            <div class=\"stop-popup plus-jakarta-sans\" style=\"min-width:220px;max-width:300px;padding:10px 12px;\">
                <div style=\"color:#333;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:6px;display:flex;align-items:center;gap:6px;\">
                    <div style=\"font-size:13px;font-weight:700;\">${title}</div>
                </div>
                <div style=\"font-size:11px;color:#666;margin-bottom:6px;\">Layanan pada platform ini</div>
                <div style=\"display:flex;flex-wrap:wrap;gap:4px;\">${badges}</div>
            </div>`;
        this.showHtmlPopupAt(lng, lat, html);
        // Bind route badge clicks
        setTimeout(() => {
            const el = this._currentPopup && this._currentPopup.getElement();
            if (!el) return;
            el.querySelectorAll('.badge-koridor-interaktif').forEach(badge => {
                const handler = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    const routeId = badge.getAttribute('data-routeid');
                    try { window.transJakartaApp.modules.location.suspendUpdates(true); } catch (e) {}
                    window.transJakartaApp.modules.routes.selectRoute(routeId);
                    this._resumeAfterIdle();
                    if (this._currentPopup) { this._currentPopup.remove(); this._currentPopup = null; }
                };
                badge.addEventListener('click', handler);
                badge.addEventListener('touchstart', handler, { passive: false });
            });
        }, 50);
    }

    // Control user marker visibility (avoid duplicate visuals during live popup)
    setUserMarkerVisible(visible) {
        try {
            if (this.map.getLayer('user-marker')) {
                this.map.setPaintProperty('user-marker', 'circle-opacity', visible ? 1 : 0);
            }
        } catch (e) {}
    }

    _findPlatformStopBy(code, lat, lng) {
        try {
            const gt = window.transJakartaApp.modules.gtfs;
            const all = gt.getStops() || [];
            const cand = all.filter(s => String(s.stop_id||'').startsWith('G') && String(s.platform_code||'').trim() === String(code||'').trim());
            if (cand.length === 0) return null;
            let best = cand[0];
            let bestD = Infinity;
            for (const s of cand) {
                const d = Math.hypot((parseFloat(s.stop_lat)-lat), (parseFloat(s.stop_lon)-lng));
                if (d < bestD) { bestD = d; best = s; }
            }
            return best;
        } catch (e) { return null; }
    }

    navigateToPlatformAndShow(code, lat, lng, routeIds) {
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        // Focus map to platform location
        try { this.setView(lat, lng, Math.max(this.map.getZoom() || 16, 18)); } catch (e) {}
        // Build badges
        const badges = (routeIds || []).map(rid => {
            const r = routes.find(rt => String(rt.route_id) === String(rid));
            if (!r) return '';
            const color = r.route_color ? `#${r.route_color}` : '#6c757d';
            return `<span class="badge badge-koridor-interaktif" style="background:${color};color:#fff;font-weight:600;font-size:0.72em;padding:3px 7px;margin-right:6px;margin-bottom:6px;" data-routeid="${r.route_id}">${r.route_short_name}</span>`;
        }).join('');
        const title = code ? `Platform ${code}` : 'Platform';
        const html = `
            <div class="stop-popup plus-jakarta-sans" style="min-width:220px;max-width:300px;padding:10px 12px;">
                <div style="color:#333;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                    <div style="font-size:13px;font-weight:700;">${title}</div>
                </div>
                <div style="font-size:11px;color:#666;margin-bottom:6px;">Layanan pada platform ini</div>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">${badges}</div>
            </div>`;
        this.showHtmlPopupAt(lng, lat, html);
        // Bind route badge clicks to start live tracking from this platform
        setTimeout(() => {
            const el = this._currentPopup && this._currentPopup.getElement();
            if (!el) return;
            el.querySelectorAll('.badge-koridor-interaktif').forEach(badge => {
                const handler = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    const routeId = badge.getAttribute('data-routeid');
                    // Select route first
                    try { window.transJakartaApp.modules.routes.selectRoute(routeId); } catch (e) {}
                    setTimeout(() => {
                        try {
                            const loc = window.transJakartaApp.modules.location;
                            if (loc && !loc.isActive && loc.canAutoStartLive && loc.canAutoStartLive()) loc.enableLiveLocation();
                            const gtStop = this._findPlatformStopBy(code, lat, lng);
                            if (gtStop) {
                                loc.activateLiveServiceFromStop(gtStop, routeId);
                                if (loc.lastUserPos && loc.userMarker) {
                                    loc.showUserRouteInfo(loc.lastUserPos.lat, loc.lastUserPos.lon, gtStop, routeId);
                                } else {
                                    try {
                                        navigator.geolocation.getCurrentPosition((pos)=>{
                                            try {
                                                const plat = pos.coords.latitude, plon = pos.coords.longitude;
                                                loc.lastUserPos = { lat: plat, lon: plon };
                                                loc.lastUserPosSmoothed = { lat: plat, lon: plon };
                                                loc.updateUserMarker(plat, plon);
                                                loc.showUserRouteInfo(plat, plon, gtStop, routeId);
                                            } catch(_) { loc.scheduleLiveUIUpdate(); }
                                        }, ()=>{ try { loc.scheduleLiveUIUpdate(); } catch(_){} }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 5000 });
                                    } catch(_) { try { loc.scheduleLiveUIUpdate(); } catch(_){} }
                                }
                            }
                        } catch (e) {}
                        this._resumeAfterIdle();
                    }, 160);
                    if (this._currentPopup) { this._currentPopup.remove(); this._currentPopup = null; }
                };
                badge.addEventListener('click', handler);
                badge.addEventListener('touchstart', handler, { passive: false });
            });
        }, 50);
    }
} 
 