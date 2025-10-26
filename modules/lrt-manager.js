/**
 * LRTManager - Manages LRT Jabodebek display on map
 * Features:
 * - Load and parse LRT GeoJSON data (rail lines + stations)
 * - Render rail lines with LRT colors
 * - Display stations as markers
 * - Toggle visibility of LRT layer
 */

import { getUserLocation, calculateDistance, formatDistance, findNearestStops, getConnectedTransJakartaStops } from './distance-helper.js';

export class LRTManager {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.geojsonData = null;
        this.railLines = [];
        this.stations = [];
        this.layerIds = []; // Track all map layers for cleanup
        this.sourceIds = []; // Track all map sources for cleanup
        this._loaded = false;
        
        // LRT Line colors
        this.lineColors = {
            'default': '#8b5cf6'  // Purple
        };
    }

    /**
     * Initialize and load LRT data
     */
    async init() {
        try {
            console.log('🚊 LRTManager: Initializing...');
            const startTime = performance.now();
            
            // Load LRT GeoJSON
            const response = await fetch('./modules/geojson/lrtjabodebek.geojson');
            
            if (!response.ok) {
                throw new Error(`Failed to load LRT GeoJSON: ${response.statusText}`);
            }
            
            this.geojsonData = await response.json();
            console.log(`📦 LRT GeoJSON loaded: ${this.geojsonData.features.length} features`);
            
            // Parse features into rail lines and stations
            this._parseFeatures();
            
            const elapsed = (performance.now() - startTime).toFixed(2);
            console.log(`✅ LRTManager initialized in ${elapsed}ms`);
            console.log(`   📍 ${this.stations.length} stations`);
            console.log(`   🛤️  ${this.railLines.length} rail segments`);
            
            this._loaded = true;
            return true;
        } catch (error) {
            console.error('❌ LRTManager init failed:', error);
            return false;
        }
    }

    /**
     * Parse GeoJSON features into rail lines and stations
     */
    _parseFeatures() {
        if (!this.geojsonData || !this.geojsonData.features) return;
        
        this.railLines = [];
        this.stations = [];
        
        for (const feature of this.geojsonData.features) {
            const props = feature.properties || {};
            const geom = feature.geometry;
            
            // Check if it's a rail line (LineString with route=light_rail or railway=light_rail)
            if (geom.type === 'LineString' && (props.route === 'light_rail' || props.railway === 'light_rail')) {
                this.railLines.push({
                    id: feature.id || `rail-${this.railLines.length}`,
                    name: props.name || props.ref || 'LRT Line',
                    ref: props.ref || '',
                    colour: props.colour || props.color || '',
                    geometry: geom,
                    properties: props
                });
            }
            
            // Check if it's a station (Point with railway=station or station=light_rail)
            else if (geom.type === 'Point' && (props.railway === 'station' || props.station === 'light_rail')) {
                this.stations.push({
                    id: feature.id || `station-${this.stations.length}`,
                    name: props.name || 'LRT Station',
                    nameEn: props['name:en'] || '',
                    coordinates: geom.coordinates, // [lon, lat]
                    properties: props
                });
            }
        }
        
        console.log(`📊 Parsed: ${this.railLines.length} rail lines, ${this.stations.length} stations`);
    }

    /**
     * Get color for LRT line
     */
    _getLineColor(rail) {
        // LRT Jabodebek uses purple color
        if (rail.colour && rail.colour.startsWith('#')) {
            return rail.colour;
        }
        return this.lineColors.default;
    }

    /**
     * Enable LRT display on map
     */
    async enable() {
        if (!this._loaded) {
            console.log('🚊 Loading LRT data...');
            const success = await this.init();
            if (!success) {
                console.error('Cannot enable LRT: initialization failed');
                return false;
            }
        }
        
        if (this.enabled) {
            console.log('LRT already enabled');
            return true;
        }
        
        console.log('🚊 Enabling LRT display...');
        
        try {
            // Use requestAnimationFrame for smoother rendering
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    this._renderRailLines();
                    if (this.stations.length > 0) {
                        requestAnimationFrame(() => {
                            this._renderStations();
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
            
            this.enabled = true;
            console.log('✅ LRT display enabled');
            return true;
        } catch (error) {
            console.error('❌ Failed to enable LRT:', error);
            return false;
        }
    }

    /**
     * Disable LRT display on map
     */
    disable() {
        if (!this.enabled) return;
        
        console.log('🚊 Disabling LRT display...');
        
        try {
            const map = this.app.modules.map.getMap();
            
            // Remove all layers
            for (const layerId of this.layerIds) {
                try {
                    if (map.getLayer(layerId)) {
                        map.removeLayer(layerId);
                    }
                } catch (e) {
                    console.warn(`Failed to remove layer ${layerId}:`, e);
                }
            }
            
            // Remove all sources
            for (const sourceId of this.sourceIds) {
                try {
                    if (map.getSource(sourceId)) {
                        map.removeSource(sourceId);
                    }
                } catch (e) {
                    console.warn(`Failed to remove source ${sourceId}:`, e);
                }
            }
            
            this.layerIds = [];
            this.sourceIds = [];
            this.enabled = false;
            
            console.log('✅ LRT display disabled');
        } catch (error) {
            console.error('❌ Failed to disable LRT:', error);
        }
    }

    /**
     * Toggle LRT display
     */
    async toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            await this.enable();
        }
        return this.enabled;
    }

    /**
     * Render rail lines on map (OPTIMIZED - single source for all lines)
     */
    _renderRailLines() {
        const map = this.app.modules.map.getMap();
        
        console.log(`🛤️  Rendering ${this.railLines.length} LRT rail lines (optimized)...`);
        
        // OPTIMIZATION: Combine all rail lines into a single GeoJSON source
        const sourceId = 'lrt-all-rails-source';
        const layerId = 'lrt-all-rails-layer';
        
        // Create features array with line colors stored in properties
        const features = this.railLines.map(rail => ({
            type: 'Feature',
            properties: {
                name: rail.name,
                ref: rail.ref,
                color: this._getLineColor(rail),
                ...rail.properties
            },
            geometry: rail.geometry
        }));
        
        const geojsonSource = {
            type: 'FeatureCollection',
            features: features
        };
        
        try {
            // Add single source for all rails
            map.addSource(sourceId, {
                type: 'geojson',
                data: geojsonSource,
                // Performance optimization
                tolerance: 0.375,
                buffer: 128,
                lineMetrics: false
            });
            
            // Add single layer that uses data-driven styling for colors
            map.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    // Use the color from feature properties
                    'line-color': ['get', 'color'],
                    'line-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 1.8,  // Thinner than MRT at far zoom
                        14, 3.5,  // Normal at medium zoom
                        18, 5.5   // Thicker when zoomed in
                    ],
                    'line-opacity': 0.8
                }
            });
            
            // Prevent click on rail lines from showing popup
            map.on('click', layerId, (e) => {
                e.preventDefault();
                if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                }
            });
            
            // Track IDs for cleanup
            this.sourceIds.push(sourceId);
            this.layerIds.push(layerId);
            
            console.log(`✅ Rendered ${this.railLines.length} LRT rail lines in single layer`);
            
        } catch (error) {
            console.error(`Failed to render LRT rail lines:`, error);
        }
    }

    /**
     * Render stations on map with clustering
     */
    _renderStations() {
        const map = this.app.modules.map.getMap();
        
        console.log(`📍 Rendering ${this.stations.length} LRT stations...`);
        
        const sourceId = 'lrt-stations-source';
        const clusterLayerId = 'lrt-stations-clusters';
        const clusterCountLayerId = 'lrt-stations-cluster-count';
        const layerId = 'lrt-stations-layer';
        const labelLayerId = 'lrt-stations-labels';
        
        const features = this.stations.map(station => ({
            type: 'Feature',
            properties: {
                id: station.id,
                name: station.name,
                nameEn: station.nameEn,
                ...station.properties
            },
            geometry: {
                type: 'Point',
                coordinates: station.coordinates
            }
        }));
        
        const geojsonSource = {
            type: 'FeatureCollection',
            features: features
        };
        
        try {
            // Add source with clustering
            map.addSource(sourceId, {
                type: 'geojson',
                data: geojsonSource,
                cluster: true,
                clusterMaxZoom: 12,
                clusterRadius: 50,
                tolerance: 0.375
            });
            
            // Cluster layer
            map.addLayer({
                id: clusterLayerId,
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#8b5cf6',
                    'circle-radius': [
                        'step',
                        ['get', 'point_count'],
                        15, 3,
                        20, 5,
                        25
                    ],
                    'circle-opacity': 0.8,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#ffffff'
                }
            });
            
            // Cluster count labels
            map.addLayer({
                id: clusterCountLayerId,
                type: 'symbol',
                source: sourceId,
                filter: ['has', 'point_count'],
                layout: {
                    'text-field': '{point_count_abbreviated}',
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': 12
                },
                paint: {
                    'text-color': '#ffffff'
                }
            });
            
            // Individual stations
            map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 5,
                        14, 8,
                        18, 10
                    ],
                    'circle-color': '#ffffff',
                    'circle-stroke-width': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 2,
                        14, 3,
                        18, 4
                    ],
                    'circle-stroke-color': '#8b5cf6',
                    'circle-opacity': 1
                }
            });
            
            // Station labels
            map.addLayer({
                id: labelLayerId,
                type: 'symbol',
                source: sourceId,
                filter: ['!', ['has', 'point_count']],
                minzoom: 12,
                layout: {
                    'text-field': ['get', 'name'],
                    'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                    'text-size': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        12, 9,
                        14, 11,
                        18, 13
                    ],
                    'text-offset': [0, 1.5],
                    'text-anchor': 'top',
                    'text-optional': true
                },
                paint: {
                    'text-color': '#1f2937',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            });
            
            // Click handlers for clusters
            map.on('click', clusterLayerId, (e) => {
                const features = map.queryRenderedFeatures(e.point, {
                    layers: [clusterLayerId]
                });
                
                if (!features.length) return;
                
                const clusterId = features[0].properties.cluster_id;
                const source = map.getSource(sourceId);
                
                source.getClusterExpansionZoom(clusterId, (err, zoom) => {
                    if (err) return;
                    
                    map.easeTo({
                        center: features[0].geometry.coordinates,
                        zoom: zoom + 0.5,
                        duration: 500
                    });
                });
            });
            
            // Click handler for individual stations
            map.on('click', layerId, async (e) => {
                if (!e.features || !e.features[0]) return;
                
                const feature = e.features[0];
                const props = feature.properties;
                
                await this._showStationPopup(props, e.lngLat);
            });
            
            // Cursor changes
            map.on('mouseenter', clusterLayerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', clusterLayerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Track IDs
            this.sourceIds.push(sourceId);
            this.layerIds.push(clusterLayerId, clusterCountLayerId, layerId, labelLayerId);
            
            console.log(`✅ Rendered ${this.stations.length} LRT stations with clustering`);
            
        } catch (error) {
            console.error('Failed to render LRT stations:', error);
        }
    }

    /**
     * Show station popup with details
     */
    async _showStationPopup(props, lngLat) {
        try {
            const stationName = props.name || 'Stasiun LRT';
            const stationNameEn = props.nameEn || props['name:en'] || '';
            
            // Find connected TransJakarta stops via intermodal mapping
            let connectedStopsHtml = '';
            try {
                const connectedStops = getConnectedTransJakartaStops(stationName, 'LRT', lngLat.lat, lngLat.lng);
                
                if (connectedStops.length > 0) {
                    connectedStopsHtml = `
                        <div style=\"margin-top:12px;margin-bottom:10px;\"> 
                            <div class=\"small im-header\"> 
                                <i class=\"fa-solid fa-arrow-right-arrow-left\"></i> 
                                <strong>Integrasi TransJakarta</strong>
                            </div>
                            <div style=\"display:flex;flex-direction:column;gap:10px;\">
                                ${connectedStops.map((stop) => {
                                    const extractKey = (s) => {
                                        if (!s) return { n: Number.POSITIVE_INFINITY, base: '', raw: '' };
                                        const raw = String(s).toUpperCase().trim();
                                        const m = raw.match(/(\\d+)/);
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
                                        ? `<div style=\"margin-top:8px;\"> 
                                            <div class=\"im-muted\" style=\"font-size:0.75em;margin-bottom:4px;font-weight:600;\">Layanan TransJakarta:</div>
                                            <div class=\"im-route-badges\">
                                                ${sortedRoutes.map(route => `
                                                    <div class=\"im-route-badge im-route-clickable\" 
                                                         data-route-id=\"${route.route_id}\"
                                                         style=\"background:#${route.route_color};cursor:pointer;\"
                                                         title=\"Klik untuk lihat rute ${route.route_short_name}\">
                                                        ${route.route_short_name}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>`
                                        : '';
                                    return `
                                        <div class=\"im-card\" style=\"padding:14px;\">
                                            <div style=\"display:flex;align-items:center;gap:10px;margin-bottom:4px;\">
                                                <div style=\"width:32px;height:32px;background:#8b5cf6;border-radius:8px;display:flex;align-items:center;justify-content:center;\"><i class=\"fa-solid fa-bus\" style=\"color:white;font-size:0.9em;\"></i></div>
                                                <div style=\"flex:1;\">
                                                    <div class=\"im-card-title\" style=\"font-size:0.95em;\">${stop.stop_name}</div>
                                                    <div class=\"im-muted\" style=\"font-size:0.7em;margin-top:2px;\">Halte TransJakarta</div>
                                                </div>
                                            </div>
                                            ${routesHtml}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }
            } catch (e) {
                console.warn('Failed to find connected stops:', e);
            }
            
            const html = `
                <div class="stop-popup plus-jakarta-sans" style="min-width:280px;max-width:350px;padding:12px;">
                    <!-- Header -->
                    <div style="
                        display:flex;
                        align-items:center;
                        gap:12px;
                        padding-bottom:10px;
                        border-bottom:2px solid #ede9fe;
                        margin-bottom:10px;
                    ">
                        <div style="
                            width:42px;
                            height:42px;
                            background:linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
                            border-radius:10px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            box-shadow:0 4px 12px rgba(139,92,246,0.3);
                        ">
                            <i class="fa-solid fa-train-tram" style="color:white;font-size:1.3em;"></i>
                        </div>
                        <div style="flex:1;">
                            <div class="im-card-title" style="font-weight:800;font-size:1.1em;">
                                ${stationName}
                            </div>
                            ${stationNameEn ? `
                                <div class="im-muted" style="font-size:0.8em;margin-top:2px;">
                                    ${stationNameEn}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Info -->
                    <div style="margin-bottom:10px;">
                        <div class="small im-muted" style="margin-bottom:6px;">
                            <i class="fa-solid fa-building"></i> <strong>Operator:</strong> LRT Jabodebek
                        </div>
                        <div class="small im-muted">
                            <i class="fa-solid fa-train-tram"></i> <strong>Jalur:</strong> Jabodebek
                        </div>
                    </div>
                    
                    <!-- Connected TransJakarta stops from intermodal mapping -->
                    ${connectedStopsHtml}
                    
                    <!-- LRT Info Badge -->
                    <div class="generic-info-box" style="
                        margin-top:12px;
                        background:#ede9fe;
                        border-left-color:#8b5cf6;
                        font-size:0.85em;
                        color:#6b21a8;
                    ">
                        <i class="fa-solid fa-circle-info"></i> 
                        <strong>Light Rail Transit Jabodebek</strong>
                    </div>
                </div>
            `;
            
            // Show popup using map manager
            this.app.modules.map.showHtmlPopupAt(lngLat.lng, lngLat.lat, html);
            
            // Attach click handlers for route badges
            setTimeout(() => {
                const badges = document.querySelectorAll('.im-route-clickable');
                badges.forEach(badge => {
                    badge.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const routeId = badge.getAttribute('data-route-id');
                        if (routeId && this.app.modules.routes) {
                            console.log(`🚌 Opening TransJakarta route: ${routeId}`);
                            this.app.modules.routes.selectRoute(routeId);
                            const popup = this.app.modules.map.featurePopup;
                            if (popup && popup.isOpen && popup.isOpen()) popup.remove();
                        }
                    });
                    badge.addEventListener('mouseenter', () => {
                        badge.style.transform = 'scale(1.08)';
                        badge.style.boxShadow = '0 3px 8px rgba(0,0,0,0.2)';
                    });
                    badge.addEventListener('mouseleave', () => {
                        badge.style.transform = 'scale(1)';
                        badge.style.boxShadow = '';
                    });
                });
            }, 50);
            
        } catch (error) {
            console.error('Failed to show LRT station popup:', error);
        }
    }

    /**
     * Check if LRT is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Check if LRT data is loaded
     */
    isLoaded() {
        return this._loaded;
    }
}

