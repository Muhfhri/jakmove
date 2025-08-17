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
            if (app?.modules?.location?.lastUserPos) {
                const p = app.modules.location.lastUserPos;
                this.addUserMarker(p.lat, p.lon);
            }
            
            // Re-add radius markers if active
            if (window.radiusHalteActive && this.map.getZoom() >= 14) {
                const center = this.map.getCenter();
                this.showHalteRadius(center.lng, center.lat, 300);
            }
            
            this.map.off('idle', readd);
        };
        this.map.on('idle', readd);
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
            
            this.fitBoundsToRoute(shapes);
        });
    }

    addStopsMarkers(stops, stopToRoutes, routes) {
        if (!this.map || !stops || stops.length === 0) return;
        this._ensureStyleReady(() => {
            const layerId = 'stops-markers';
            const hitLayerId = 'stops-hitbox';
            const sourceId = 'stops-source';

            // Unbind previous handlers to avoid duplicates
            if (this._onStopsClick) {
                try { this.map.off('click', hitLayerId, this._onStopsClick); } catch (e) {}
                try { this.map.off('mouseenter', hitLayerId, this._onStopsEnter); } catch (e) {}
                try { this.map.off('mouseleave', hitLayerId, this._onStopsLeave); } catch (e) {}
            }

            // Remove existing hitbox and marker layers before removing source
            if (this.map.getLayer(hitLayerId)) this.map.removeLayer(hitLayerId);
            if (this.map.getLayer(layerId)) this.map.removeLayer(layerId);
            if (this.map.getSource(sourceId)) this.map.removeSource(sourceId);
            this.layers.delete(layerId);
            this.layers.delete(hitLayerId);

            const stopFeatures = stops.map(stop => ({
                type: 'Feature',
                properties: {
                    stopId: stop.stop_id,
                    stopName: stop.stop_name,
                    stopType: this.getStopType(stop.stop_id),
                    routeIds: stopToRoutes[stop.stop_id] ? Array.from(stopToRoutes[stop.stop_id]) : [],
                    wheelchairBoarding: stop.wheelchair_boarding || '0',
                    stopCode: stop.stop_code || '',
                    stopDesc: stop.stop_desc || ''
                },
                geometry: { type: 'Point', coordinates: [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)] }
            }));
            const stopsSource = { type: 'geojson', data: { type: 'FeatureCollection', features: stopFeatures } };
            this.map.addSource(sourceId, stopsSource);
            this.map.addLayer({ id: layerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 6, 'circle-color': '#264697', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });
            // Extra hitbox transparent layer on top for easier tapping
            this.map.addLayer({ id: hitLayerId, type: 'circle', source: sourceId, paint: { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)' } });
            this.layers.set(layerId, { sourceId, layerId });
            this.layers.set(hitLayerId, { sourceId, layerId: hitLayerId });

            // Bind handlers once, store refs for off()
            this._onStopsClick = (e) => { const f = e.features && e.features[0]; if (f) this.showStopPopup(f, e.lngLat); };
            this._onStopsEnter = () => { this.map.getCanvas().style.cursor = 'pointer'; };
            this._onStopsLeave = () => { this.map.getCanvas().style.cursor = ''; };
            this.map.on('click', hitLayerId, this._onStopsClick);
            this.map.on('mouseenter', hitLayerId, this._onStopsEnter);
            this.map.on('mouseleave', hitLayerId, this._onStopsLeave);
            
            // Simpan data stops untuk re-add setelah ganti style
            if (!this._activeRouteData) this._activeRouteData = {};
            this._activeRouteData.stopsSnapshot = { stops, stopToRoutes, routes };
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
        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
        const currentRouteId = window.transJakartaApp.modules.routes.selectedRouteId;

        const routeIds = Array.isArray(stop.properties.routeIds) ? stop.properties.routeIds : [];

        // Jenis halte (tanpa label "Jenis:")
        let jenisHtml = '';
        const stopId = stop.properties.stopId || '';
        // Ambil data stop lengkap untuk platform_code dan wheelchair
        const gtfsStop = window.transJakartaApp.modules.gtfs.getStops().find(x => x.stop_id === stopId);
        const platformCode = gtfsStop && gtfsStop.platform_code ? gtfsStop.platform_code : '';
        const wheelchair = (gtfsStop && gtfsStop.wheelchair_boarding === '1') || stop.properties.wheelchairBoarding === '1';
        if (stopId.startsWith('B')) {
            jenisHtml = `<div style="font-size: 12px; color: #facc15; font-weight: 600; margin-bottom: 6px;">Pengumpan</div>`;
        } else if (stopId.startsWith('G')) {
            const label = platformCode ? `Platform ${platformCode}` : 'Platform';
            jenisHtml = `<div style="font-size: 12px; color: #64748b; margin-bottom: 6px;">${label}</div>`;
        } else {
            jenisHtml = '';
        }

        // Layanan Lain (exclude current selected route)
        let layananLainHtml = '';
        const allRouteIdsAtStop = stopToRoutes[stopId] ? Array.from(stopToRoutes[stopId]) : routeIds;
        const otherRouteIds = (allRouteIdsAtStop || []).filter(rid => rid !== currentRouteId);
        if (otherRouteIds.length > 0) {
            const badges = otherRouteIds.map(rid => {
                const r = routes.find(rt => rt.route_id === rid);
                if (!r) return '';
                const color = r.route_color ? `#${r.route_color}` : '#6c757d';
                return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:pointer;font-weight:bold;font-size:0.8em;padding:4px 8px;" data-routeid="${r.route_id}">${r.route_short_name}</span>`;
            }).join('');
            if (badges) {
                layananLainHtml = `
                    <div style="margin-top:6px;">
                        <div style="font-size:11px;color:#666;margin-bottom:6px;">Layanan Lain:</div>
                        <div style="display:flex;flex-wrap:wrap;gap:4px;">${badges}</div>
                    </div>`;
            }
        }

        // Layanan tersedia (semua route di halte)
        const layananTersediaBadges = routeIds.map(rid => {
            const r = routes.find(rt => rt.route_id === rid);
            if (!r) return '';
            const color = r.route_color ? `#${r.route_color}` : '#6c757d';
            return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:pointer;font-weight:bold;font-size:0.8em;padding:4px 8px;" data-routeid="${r.route_id}">${r.route_short_name}</span>`;
        }).join('');

        let wheelchairIcon = '';
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (wheelchair && (!settings || settings.isEnabled('showAccessibilityIcon'))) {
                wheelchairIcon = `<span title="Ramah kursi roda" style="margin-left:6px;">♿</span>`;
            }
        } catch (e) { wheelchairIcon = wheelchair ? `<span title="Ramah kursi roda" style="margin-left:6px;">♿</span>` : ''; }

        // Intermodal icons and JakLingko badge
        let interIconsHtml = '';
        let jaklingkoHtml = '';
        try {
            const routesMod = window.transJakartaApp?.modules?.routes;
            if (routesMod && typeof routesMod.buildIntermodalIconsForStop === 'function') {
                interIconsHtml = routesMod.buildIntermodalIconsForStop({ stop_id: stopId, stop_name: stop.properties.stopName }) || '';
            }
            if (routesMod && typeof routesMod.shouldShowJaklingkoBadge === 'function' && routesMod.shouldShowJaklingkoBadge({ stop_id: stopId, stop_name: stop.properties.stopName })) {
                jaklingkoHtml = `<img class='jaklingko-badge' src='https://transportforjakarta.or.id/wp-content/uploads/2024/10/jaklingko-w-AR0bObLen0c7yK8n-768x768.png' alt='JakLingko' title='Terintegrasi JakLingko'/>`;
            }
        } catch (e) {}

        const popupContent = `
            <div class="stop-popup plus-jakarta-sans" style="min-width: 220px; max-width: 280px; padding: 10px 12px;">
                <div style="color: #333; padding: 6px 0; border-bottom: 1px solid #eee; margin-bottom: 6px; display:flex; align-items:center; gap:6px;">
                    <div style="font-size: 14px; font-weight: 600;">${stop.properties.stopName}</div>
                    ${interIconsHtml}
                    ${jaklingkoHtml}
                    ${wheelchairIcon}
                </div>
                ${jenisHtml}
                ${layananTersediaBadges ? `
                <div>
                    <div style="font-size: 11px; color: #666; margin-bottom: 6px;">Layanan:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${layananTersediaBadges}
                    </div>
                </div>` : ''}
                ${layananLainHtml}
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
                    // Suspend updates to avoid lag while switching
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
        let duration = 1000;
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (settings && settings.isEnabled('batterySaver')) duration = 0;
        } catch (e) {}
        this.map.fitBounds(bounds, { padding: 50, duration });
    }

    // Implement radius markers
    showHalteRadius(centerLng, centerLat, radius = 300) {
        this._ensureStyleReady(() => {
            const stops = window.transJakartaApp.modules.gtfs.getStops();
            const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
            const features = stops.filter(s => s.stop_lat && s.stop_lon)
                .filter(s => !(String(s.stop_id || '').startsWith('E') || String(s.stop_id || '').startsWith('H')))
                .map(s => ({ s, d: this._haversine(centerLat, centerLng, parseFloat(s.stop_lat), parseFloat(s.stop_lon)) }))
                .filter(o => o.d <= radius)
                .map(o => ({
                    type: 'Feature',
                    properties: {
                        stopId: o.s.stop_id,
                        stopName: o.s.stop_name,
                        stopType: this.getStopType(o.s.stop_id),
                        routeIds: stopToRoutes[o.s.stop_id] ? Array.from(stopToRoutes[o.s.stop_id]) : [],
                        dist: o.d,
                        wheelchairBoarding: o.s.wheelchair_boarding || '0',
                        stopCode: o.s.stop_code || '',
                        stopDesc: o.s.stop_desc || ''
                    },
                    geometry: { type: 'Point', coordinates: [parseFloat(o.s.stop_lon), parseFloat(o.s.stop_lat)] }
                }));

            // Remove previous
            if (this.map.getLayer(this._radiusLayerId)) this.map.removeLayer(this._radiusLayerId);
            if (this.map.getSource(this._radiusSourceId)) this.map.removeSource(this._radiusSourceId);

            this.map.addSource(this._radiusSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } });
            this.map.addLayer({ id: this._radiusLayerId, type: 'circle', source: this._radiusSourceId, paint: { 'circle-radius': 5, 'circle-color': '#FF9800', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } });

            // Unbind previous click to avoid duplicates
            if (this._onRadiusClick) { try { this.map.off('click', this._radiusLayerId, this._onRadiusClick); } catch (e) {} }
            this._onRadiusClick = (e) => { 
                const f = e.features && e.features[0]; 
                if (!f) return;
                // Auto-select service if only one service passes
                const routeIds = Array.isArray(f.properties.routeIds) ? f.properties.routeIds : [];
                const app = window.transJakartaApp;
                if (routeIds.length === 1) {
                    const rid = routeIds[0];
                    // Suspend updates to avoid lag while switching
                    try { app.modules.location.suspendUpdates(true); } catch (e) {}
                    app.modules.routes.selectRoute(rid);
                    // Resume after map idle
                    this._resumeAfterIdle();
                } else {
                    // Let user choose via popup badges
                    this.showStopPopup(f, e.lngLat);
                }
            };
            this.map.on('click', this._radiusLayerId, this._onRadiusClick);
            this.map.getCanvas().style.cursor = 'pointer';
        });
    }

    removeHalteRadiusMarkers() {
        if (this.map.getLayer(this._radiusLayerId)) this.map.removeLayer(this._radiusLayerId);
        if (this.map.getSource(this._radiusSourceId)) this.map.removeSource(this._radiusSourceId);
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
                const gtfs = window.transJakartaApp.modules.gtfs;
                const stopToRoutes = gtfs.getStopToRoutes();
                const routes = gtfs.getRoutes();
                const s = stop; // from closure
                const routeIds = stopToRoutes[s.stop_id] ? Array.from(stopToRoutes[s.stop_id]) : [];
                const badges = routeIds.map(rid => {
                    const r = routes.find(rt => rt.route_id === rid);
                    if (!r) return '';
                    const color = r.route_color ? ('#' + r.route_color) : '#6c757d';
                    return `<span class="badge badge-koridor-interaktif rounded-pill me-1 mb-1" style="background:${color};color:#fff;cursor:pointer;font-weight:bold;font-size:0.8em;padding:4px 8px;" data-routeid="${r.route_id}">${r.route_short_name}</span>`;
                }).join('');
                // Jenis + wheelchair
                const fullStop = gtfs.getStops().find(x => x.stop_id === s.stop_id);
                const platformCode = fullStop && fullStop.platform_code ? fullStop.platform_code : '';
                const isFeeder = s.stop_id && s.stop_id.startsWith('B');
                const jenisLine = isFeeder
                    ? `<div style='font-size:12px;color:#facc15;font-weight:600;margin-bottom:6px;'>Pengumpan</div>`
                    : (s.stop_id && s.stop_id.startsWith('G') ? `<div style='font-size:12px;color:#64748b;margin-bottom:6px;'>Platform ${platformCode || ''}</div>` : '');
                const wheelchair = (fullStop && fullStop.wheelchair_boarding === '1');
                let wcIcon = '';
                try {
                    const settings = window.transJakartaApp.modules.settings;
                    if (wheelchair && (!settings || settings.isEnabled('showAccessibilityIcon'))) {
                        wcIcon = `<span title='Ramah kursi roda' style='margin-left:6px;'>♿</span>`;
                    }
                } catch (e) { wcIcon = wheelchair ? `<span title='Ramah kursi roda' style='margin-left:6px;'>♿</span>` : ''; }

                // Intermodal icons and JakLingko badge
                let interHtml = '';
                let jlHtml = '';
                try {
                    const routesMod = window.transJakartaApp?.modules?.routes;
                    if (routesMod && typeof routesMod.buildIntermodalIconsForStop === 'function') {
                        interHtml = routesMod.buildIntermodalIconsForStop({ stop_id: s.stop_id, stop_name: s.stop_name }) || '';
                    }
                    if (routesMod && typeof routesMod.shouldShowJaklingkoBadge === 'function' && routesMod.shouldShowJaklingkoBadge({ stop_id: s.stop_id, stop_name: s.stop_name })) {
                        jlHtml = `<img class='jaklingko-badge' src='https://transportforjakarta.or.id/wp-content/uploads/2024/10/jaklingko-w-AR0bObLen0c7yK8n-768x768.png' alt='JakLingko' title='Terintegrasi JakLingko'/>`;
                    }
                } catch (e) {}

                const html = `
                    <div class='stop-popup plus-jakarta-sans' style='min-width: 220px; max-width: 280px; padding: 10px 12px;'>
                        <div style='color:#333;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:6px;display:flex;align-items:center;gap:6px;'>
                            <div style='font-size:14px;font-weight:600;'>${s.stop_name}</div>
                            ${interHtml}
                            ${jlHtml}
                            ${wcIcon}
                        </div>
                        ${jenisLine}
                        ${distText ? `<div style='font-size:11px;color:#666;margin-bottom:6px;'>Jarak: ${distText}</div>` : ''}
                        ${badges ? `<div><div style='font-size:11px;color:#666;margin-bottom:6px;'>Layanan:</div><div class='nearest-services' style='display:flex;flex-wrap:wrap;gap:4px;'>${badges}</div></div>` : ''}
                    </div>`;
                this.showHtmlPopupAt(p.lng, p.lat, html);

                setTimeout(() => {
                    const el = this._currentPopup && this._currentPopup.getElement && this._currentPopup.getElement();
                    if (!el) return;
                    el.querySelectorAll('.badge-koridor-interaktif').forEach(badge => {
                        const handler = (ev) => {
                            ev.preventDefault(); ev.stopPropagation();
                            const rid = badge.getAttribute('data-routeid');
                            const loc = window.transJakartaApp.modules.location;
                            window.lastStopId = s.stop_id;
                            if (loc) loc.activateLiveServiceFromStop(s, rid);
                            window.transJakartaApp.modules.routes.selectRoute(rid);
                            this.closePopup();
                        };
                        badge.addEventListener('click', handler);
                        badge.addEventListener('touchstart', handler, { passive: false });
                    });
                }, 40);
            });
            this.map.on('mouseenter', hitLayerId, () => { this.map.getCanvas().style.cursor = 'pointer'; });
            this.map.on('mouseleave', hitLayerId, () => { this.map.getCanvas().style.cursor = ''; });
        });
        return id;
    }

    removeMarker(id) {
        const entry = this.layers.get(id);
        if (!entry) return;
        if (this.map.getLayer(entry.layerId)) this.map.removeLayer(entry.layerId);
        if (this.map.getSource(entry.sourceId)) this.map.removeSource(entry.sourceId);
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
        if (this.map) {
            let duration = 1000;
            try {
                const settings = window.transJakartaApp.modules.settings;
                if (settings && settings.isEnabled('batterySaver')) duration = 0;
            } catch (e) {}
            this.map.flyTo({ center: [lng, lat], zoom, duration });
        }
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
        let duration = 600;
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (settings && settings.isEnabled('batterySaver')) duration = 0;
        } catch (e) {}
        this.map.easeTo({ center: smallMove ? currentCenter : [lon, lat], zoom, bearing, pitch: Math.max(this.map.getPitch(), 60), duration, easing: t => t });
    }

    _resumeAfterIdle() {
        const resume = () => {
            try { window.transJakartaApp.modules.location.suspendUpdates(false); } catch (e) {}
            this.map.off('idle', resume);
        };
        this.map.on('idle', resume);
    }
} 
 