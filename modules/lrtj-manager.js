/**
 * LRTJakartaManager - Manages LRT Jakarta (city) display on map
 * Data source: modules/geojson/lrtjakarta.geojson
 */

export class LRTJakartaManager {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.geojsonData = null;
        this.railLines = [];
        this.stations = [];
        this.layerIds = [];
        this.sourceIds = [];
        this._loaded = false;
        this.brandColor = '#e31e24'; // LRT Jakarta red
    }

    async init() {
        try {
            const response = await fetch('./modules/geojson/lrtjakarta.geojson');
            if (!response.ok) throw new Error(`Failed to load LRT Jakarta GeoJSON: ${response.statusText}`);
            this.geojsonData = await response.json();
            this._parseFeatures();
            this._loaded = true;
            return true;
        } catch (e) {
            console.error('LRTJakartaManager init error:', e);
            return false;
        }
    }

    _parseFeatures() {
        this.railLines = [];
        this.stations = [];
        if (!this.geojsonData || !this.geojsonData.features) return;
        for (const feature of this.geojsonData.features) {
            const props = feature.properties || {};
            const geom = feature.geometry;
            if (!geom) continue;
            if (geom.type === 'LineString' && (props.route === 'light_rail' || props.railway === 'light_rail')) {
                this.railLines.push({
                    id: feature.id || `lrtsg-${this.railLines.length}`,
                    name: props.name || props.ref || 'LRT Jakarta',
                    ref: props.ref || '',
                    colour: props.colour || props.color || this.brandColor,
                    geometry: geom,
                    properties: props
                });
            } else if (geom.type === 'Point' && (props.railway === 'station' || props.station === 'light_rail' || props.public_transport === 'station')) {
                this.stations.push({
                    id: feature.id || `station-${this.stations.length}`,
                    name: props.name || 'Stasiun LRT Jakarta',
                    nameEn: props['name:en'] || '',
                    coordinates: geom.coordinates,
                    properties: props
                });
            }
        }
    }

    _getLineColor(rail) {
        if (rail.colour && rail.colour.startsWith('#')) return rail.colour;
        return this.brandColor;
    }

    async enable() {
        if (!this._loaded) {
            const ok = await this.init();
            if (!ok) return false;
        }
        if (this.enabled) return true;
        await new Promise(resolve => {
            requestAnimationFrame(() => {
                this._renderRailLines();
                if (this.stations.length > 0) {
                    requestAnimationFrame(() => { this._renderStations(); resolve(); });
                } else { resolve(); }
            });
        });
        this.enabled = true;
        return true;
    }

    disable() {
        if (!this.enabled) return;
        const map = this.app.modules.map.getMap();
        for (const layerId of this.layerIds) {
            try { if (map.getLayer(layerId)) map.removeLayer(layerId); } catch (_) {}
        }
        for (const sourceId of this.sourceIds) {
            try { if (map.getSource(sourceId)) map.removeSource(sourceId); } catch (_) {}
        }
        this.layerIds = [];
        this.sourceIds = [];
        this.enabled = false;
    }

    async toggle() {
        if (this.enabled) this.disable(); else await this.enable();
        return this.enabled;
    }

    _renderRailLines() {
        const map = this.app.modules.map.getMap();
        const sourceId = 'lrtj-all-rails-source';
        const layerId = 'lrtj-all-rails-layer';
        const features = this.railLines.map(rail => ({
            type: 'Feature',
            properties: { name: rail.name, ref: rail.ref, color: this._getLineColor(rail), ...rail.properties },
            geometry: rail.geometry
        }));
        const geojsonSource = { type: 'FeatureCollection', features };
        try {
            map.addSource(sourceId, { type: 'geojson', data: geojsonSource, tolerance: 0.375, buffer: 128, lineMetrics: false });
            map.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': ['get', 'color'],
                    'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.8, 14, 3.2, 18, 5.2],
                    'line-opacity': 0.85
                }
            });
            map.on('click', layerId, (e) => { e.preventDefault(); if (e.originalEvent) e.originalEvent.stopPropagation(); });
            this.sourceIds.push(sourceId);
            this.layerIds.push(layerId);
        } catch (e) { console.warn('LRTJ render lines error:', e); }
    }

    _renderStations() {
        const map = this.app.modules.map.getMap();
        const sourceId = 'lrtj-stations-source';
        const clusterLayerId = 'lrtj-stations-clusters';
        const clusterCountLayerId = 'lrtj-stations-cluster-count';
        const layerId = 'lrtj-stations-layer';
        const labelLayerId = 'lrtj-stations-labels';

        const features = this.stations.map(st => ({
            type: 'Feature',
            properties: { id: st.id, name: st.name, nameEn: st.nameEn, ...st.properties },
            geometry: { type: 'Point', coordinates: st.coordinates }
        }));
        const geojsonSource = { type: 'FeatureCollection', features };

        try {
            map.addSource(sourceId, { type: 'geojson', data: geojsonSource, cluster: true, clusterMaxZoom: 12, clusterRadius: 48, tolerance: 0.375 });
            map.addLayer({ id: clusterLayerId, type: 'circle', source: sourceId, filter: ['has', 'point_count'], paint: {
                'circle-color': this.brandColor, 'circle-radius': ['step', ['get', 'point_count'], 14, 3, 18, 5, 22], 'circle-opacity': 0.85, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff'
            }});
            map.addLayer({ id: clusterCountLayerId, type: 'symbol', source: sourceId, filter: ['has', 'point_count'], layout: {
                'text-field': '{point_count_abbreviated}', 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 12
            }, paint: { 'text-color': '#ffffff' }});
            map.addLayer({ id: layerId, type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']], paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 14, 8, 18, 10],
                'circle-color': '#ffffff', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 3, 18, 4], 'circle-stroke-color': this.brandColor, 'circle-opacity': 1
            }});
            map.addLayer({ id: labelLayerId, type: 'symbol', source: sourceId, filter: ['!', ['has', 'point_count']], minzoom: 12, layout: {
                'text-field': ['get', 'name'], 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 14, 11, 18, 13], 'text-offset': [0, 1.5], 'text-anchor': 'top', 'text-optional': true
            }, paint: { 'text-color': '#1f2937', 'text-halo-color': '#ffffff', 'text-halo-width': 2 }});

            map.on('click', layerId, async (e) => { if (!e.features || !e.features[0]) return; const props = e.features[0].properties; await this._showStationPopup(props, e.lngLat); });
            map.on('mouseenter', clusterLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', clusterLayerId, () => { map.getCanvas().style.cursor = ''; });
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });

            this.sourceIds.push(sourceId);
            this.layerIds.push(clusterLayerId, clusterCountLayerId, layerId, labelLayerId);
        } catch (e) { console.error('LRTJ render stations error:', e); }
    }

    async _showStationPopup(props, lngLat) {
        try {
            const stationName = props.name || 'Stasiun LRT Jakarta';
            
            // Import getConnectedTransJakartaStops
            const { getConnectedTransJakartaStops } = await import('./distance-helper.js');
            
            // Get connected TransJakarta stops
            let connectedStopsHtml = '';
            const stationCoords = [props.longitude || lngLat.lng, props.latitude || lngLat.lat];
            const connectedStops = await getConnectedTransJakartaStops(
                stationName,
                'LRTJ',
                stationCoords[1],
                stationCoords[0]
            );
            
            if (connectedStops && connectedStops.length > 0) {
                const stopsListHtml = connectedStops.map((stop) => {
                    const extractKey = (s) => {
                        if (!s) return { n: Number.POSITIVE_INFINITY, base: '', raw: '' };
                        const raw = String(s).toUpperCase().trim();
                        const m = raw.match(/(\d+)/);
                        const n = m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
                        const base = m ? m[0] : '';
                        return { n, base, raw };
                    };
                    const sortedRoutes = (stop.routes || []).slice().sort((a, b) => {
                        const ka = extractKey(a.route_short_name);
                        const kb = extractKey(b.route_short_name);
                        if (ka.n !== kb.n) return ka.n - kb.n;
                        if (ka.base.length !== kb.base.length) return kb.base.length - ka.base.length;
                        return ka.raw.localeCompare(kb.raw);
                    });
                    const routesHtml = sortedRoutes.length > 0
                        ? `<div style="margin-top:8px;">
                            <div class="im-muted" style="font-size:0.75em;margin-bottom:4px;font-weight:600;">Layanan TransJakarta:</div>
                            <div class="im-route-badges">
                                ${sortedRoutes.map(route => `
                                    <div class="im-route-badge" style="background:#${route.route_color};">${route.route_short_name}</div>
                                `).join('')}
                            </div>
                           </div>`
                        : '';
                    return `
                        <div class="im-card" style="padding:14px;">
                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                                <div style="width:32px;height:32px;background:${this.brandColor};border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fa-solid fa-bus" style="color:white;font-size:0.9em;"></i></div>
                                <div style="flex:1;">
                                    <div class="im-card-title" style="font-size:0.95em;">${stop.stop_name}</div>
                                    <div class="im-muted" style="font-size:0.7em;margin-top:2px;">Halte TransJakarta</div>
                                </div>
                            </div>
                            ${routesHtml}
                        </div>
                    `;
                }).join('');

                connectedStopsHtml = `
                    <div style="margin-top:12px;margin-bottom:10px;">
                        <div class="small im-header">
                            <i class="fa-solid fa-arrow-right-arrow-left"></i>
                            <strong>Integrasi TransJakarta</strong>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:10px;">
                            ${stopsListHtml}
                        </div>
                    </div>
                `;
            }
            
            const html = `
                <div class="stop-popup plus-jakarta-sans" style="min-width:280px;max-width:350px;padding:12px;">
                    <div style="display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:2px solid #fee2e2;margin-bottom:10px;">
                        <div style="width:42px;height:42px;background:linear-gradient(135deg, ${this.brandColor} 0%, #b91c1c 100%);border-radius:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(227,30,36,0.3);">
                            <i class="fa-solid fa-train-tram" style="color:white;font-size:1.3em;"></i>
                        </div>
                        <div style="flex:1;">
                            <div class="im-card-title" style="font-weight:800;font-size:1.1em;">${stationName}</div>
                            <div class="im-muted" style="font-size:0.8em;margin-top:2px;">LRT Jakarta</div>
                        </div>
                    </div>
                    ${connectedStopsHtml}
                </div>
            `;
            this.app.modules.map.showHtmlPopupAt(lngLat.lng, lngLat.lat, html);
        } catch (e) { console.error('LRTJ popup error:', e); }
    }

    isEnabled() { return this.enabled; }
    isLoaded() { return this._loaded; }
}


