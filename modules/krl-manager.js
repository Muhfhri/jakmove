/**
 * KRLManager - Manages KRL (Commuter Line) display on map
 * Features:
 * - Load and parse KRL GeoJSON data (rail lines + stations)
 * - Render rail lines with appropriate colors
 * - Display stations as markers with facilities info
 * - Toggle visibility of KRL layer
 */

import { getUserLocation, calculateDistance, formatDistance, findNearestStops, getConnectedTransJakartaStops } from './distance-helper.js';

export class KRLManager {
    constructor(app) {
        this.app = app;
        this.enabled = false;
        this.geojsonData = null;
        this.stationsInfo = null; // Additional station facilities data
        this.railLines = [];
        this.stations = [];
        this.layerIds = []; // Track all map layers for cleanup
        this.sourceIds = []; // Track all map sources for cleanup
        this._loaded = false;
        
        // Line colors based on common KRL lines
        this.lineColors = {
            'Jakarta Kota–Bogor': '#FF6B6B',           // Red Line
            'Jakarta Kota–Tanjung Priuk': '#4ECDC4',   // Cyan
            'Tanah Abang–Rangkasbitung': '#95E1D3',    // Light Green
            'Tangerang': '#F38181',                     // Pink
            'Bekasi': '#AA96DA',                        // Purple
            'Serpong': '#FCBAD3',                       // Light Pink
            'Nambo': '#FFFFD2',                         // Light Yellow
            'default': '#2563eb'                        // Default Blue
        };
    }

    /**
     * Initialize and load KRL data
     */
    async init() {
        try {
            console.log('🚆 KRLManager: Initializing...');
            const startTime = performance.now();
            
            // Load both GeoJSON and stations info in parallel
            const [geojsonResponse, stationsInfoResponse] = await Promise.all([
                fetch('./modules/geojson/krljabodetabek.geojson'),
                fetch('./modules/krl-stations-info.json')
            ]);
            
            if (!geojsonResponse.ok) {
                throw new Error(`Failed to load KRL GeoJSON: ${geojsonResponse.statusText}`);
            }
            
            this.geojsonData = await geojsonResponse.json();
            console.log(`📦 KRL GeoJSON loaded: ${this.geojsonData.features.length} features`);
            
            // Load stations info (non-critical, don't fail if not available)
            if (stationsInfoResponse.ok) {
                this.stationsInfo = await stationsInfoResponse.json();
                console.log(`📋 Station facilities data loaded`);
            } else {
                console.warn('⚠️  Station facilities data not available');
            }
            
            // Parse features into rail lines and stations
            this._parseFeatures();
            
            const elapsed = (performance.now() - startTime).toFixed(2);
            console.log(`✅ KRLManager initialized in ${elapsed}ms`);
            console.log(`   📍 ${this.stations.length} stations`);
            console.log(`   🛤️  ${this.railLines.length} rail segments`);
            
            this._loaded = true;
            return true;
        } catch (error) {
            console.error('❌ KRLManager init failed:', error);
            return false;
        }
    }

    /**
     * Parse GeoJSON features into rail lines and stations
     * Updated to support new data format with route=train and @relations
     */
    _parseFeatures() {
        if (!this.geojsonData || !this.geojsonData.features) return;
        
        this.railLines = [];
        this.stations = [];
        
        for (const feature of this.geojsonData.features) {
            const props = feature.properties || {};
            const geom = feature.geometry;
            
            // Check if it's a rail line (LineString geometry with route=train)
            if (geom.type === 'LineString' && (props.route === 'train' || props.railway === 'rail')) {
                this.railLines.push({
                    id: feature.id || `rail-${this.railLines.length}`,
                    name: props.name || props.ref || 'Jalur KRL',
                    ref: props.ref || '',
                    from: props.from || '',
                    to: props.to || '',
                    via: props.via || '',
                    colour: props.colour || props.color || '',
                    geometry: geom,
                    properties: props
                });
            }
            
            // Check if it's a REAL station (Point with railway=station)
            else if (geom.type === 'Point' && props.railway === 'station') {
                // This is a real station with proper name and properties
                const stationName = props.name || 'Stasiun KRL';
                const stationCode = props['railway:ref'] || '';
                
                // Get additional info from JSON if available (using code as key)
                let transitLines = [];
                let isTransitHub = false;
                if (this.stationsInfo && this.stationsInfo.stations && stationCode) {
                    const stationData = this.stationsInfo.stations[stationCode];
                    if (stationData) {
                        transitLines = stationData.lines || [];
                        isTransitHub = stationData.isTransitHub || false;
                    }
                }
                
                this.stations.push({
                    id: feature.id || `station-${this.stations.length}`,
                    name: stationName,
                    code: stationCode,
                    coordinates: geom.coordinates, // [lon, lat]
                    lines: transitLines, // Transit lines from JSON
                    isTransitHub: isTransitHub,
                    facilities: this._extractFacilities(props, stationCode),
                    properties: props
                });
            }
        }
        
        console.log(`📊 Parsed: ${this.railLines.length} rail lines, ${this.stations.length} stations`);
    }

    /**
     * Extract facilities from station properties and additional info JSON (simplified)
     */
    _extractFacilities(props, stationCode) {
        const facilities = [];
        
        // Try to get info from stations info JSON
        if (this.stationsInfo && this.stationsInfo.stations && this.stationsInfo.stations[stationCode]) {
            const stationData = this.stationsInfo.stations[stationCode];
            const facilityList = stationData.facilities || [];
            const facilityIcons = this.stationsInfo.facilityIcons || {};
            
            // Map facility names to icons
            facilityList.forEach(facName => {
                const facInfo = facilityIcons[facName];
                if (facInfo) {
                    facilities.push({
                        icon: facInfo.icon,
                        label: facInfo.label,
                        color: facInfo.color
                    });
                }
            });
        } else {
            // Fallback to OSM data if no JSON info available
        if (props.wheelchair === 'yes') {
            facilities.push({ icon: 'fa-wheelchair', label: 'Akses Kursi Roda', color: '#3b82f6' });
        }
        
        if (props.toilets === 'yes') {
            facilities.push({ icon: 'fa-restroom', label: 'Toilet', color: '#8b5cf6' });
        }
        
        if (props.parking === 'yes') {
            facilities.push({ icon: 'fa-square-parking', label: 'Parkir', color: '#10b981' });
        }
        
        if (props.wifi === 'yes' || props['internet_access'] === 'wlan') {
            facilities.push({ icon: 'fa-wifi', label: 'WiFi', color: '#06b6d4' });
        }
        }
        
        return facilities;
    }

    /**
     * Get color for a rail line based on its properties
     * Priority: colour from data > ref-based color > name-based color > default
     */
    _getLineColor(rail) {
        // If rail is a string (legacy), try to match by name
        if (typeof rail === 'string') {
            const lineName = rail;
            for (const [key, color] of Object.entries(this.lineColors)) {
                if (lineName.includes(key)) {
                    return color;
                }
            }
            return this.lineColors.default;
        }
        
        // If rail is an object, check for colour property first
        if (rail.colour && rail.colour.startsWith('#')) {
            return rail.colour;
        }
        
        // Try to match by ref (B, T, C, etc.)
        if (rail.ref) {
            const refColors = {
                'B': '#ec2329',    // Bogor Line (Red)
                'T': '#a05723',    // Tangerang Line (Brown)
                'C': '#0066cc',    // Cikarang Line (Blue)
                'L': '#800080',    // Lingkar Line (Purple)
                'BJC': '#f47b00', // Bekasi-Jakarta Kota-Cikarang (Orange)
                'default': '#2563eb'
            };
            
            if (refColors[rail.ref]) {
                return refColors[rail.ref];
            }
        }
        
        // Fallback to name matching
        const lineName = rail.name || '';
        for (const [key, color] of Object.entries(this.lineColors)) {
            if (lineName.includes(key)) {
                return color;
            }
        }
        
        return this.lineColors.default;
    }

    /**
     * Enable KRL display on map (OPTIMIZED with async rendering)
     */
    async enable() {
        if (!this._loaded) {
            console.log('🚆 Loading KRL data...');
            const success = await this.init();
            if (!success) {
                console.error('Cannot enable KRL: initialization failed');
                return false;
            }
        }
        
        if (this.enabled) {
            console.log('KRL already enabled');
            return true;
        }
        
        console.log('🚆 Enabling KRL display...');
        
        try {
            // Use requestAnimationFrame for smoother rendering
            await new Promise(resolve => {
                requestAnimationFrame(() => {
            this._renderRailLines();
                    // Skip station rendering if no valid stations found
                    // (GeoJSON might only contain routes without station points)
                    if (this.stations.length > 0) {
                        requestAnimationFrame(() => {
            this._renderStations();
                            resolve();
                        });
                    } else {
                        console.log('ℹ️  No station data available in GeoJSON (only rail lines)');
                        resolve();
                    }
                });
            });
            
            this.enabled = true;
            console.log('✅ KRL display enabled (rail lines only)');
            return true;
        } catch (error) {
            console.error('❌ Failed to enable KRL:', error);
            return false;
        }
    }

    /**
     * Disable KRL display on map
     */
    disable() {
        if (!this.enabled) return;
        
        console.log('🚆 Disabling KRL display...');
        
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
            
            console.log('✅ KRL display disabled');
        } catch (error) {
            console.error('❌ Failed to disable KRL:', error);
        }
    }

    /**
     * Toggle KRL display
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
        
        console.log(`🛤️  Rendering ${this.railLines.length} rail lines (optimized)...`);
        
        // OPTIMIZATION: Combine all rail lines into a single GeoJSON source
        const sourceId = 'krl-all-rails-source';
        const layerId = 'krl-all-rails-layer';
        
        // Create features array with line colors stored in properties
        const features = this.railLines.map(rail => ({
                    type: 'Feature',
                    properties: {
                        name: rail.name,
                ref: rail.ref,
                from: rail.from,
                to: rail.to,
                via: rail.via,
                color: this._getLineColor(rail), // Pass rail object for smart color detection
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
                tolerance: 0.375, // Simplify geometry for faster rendering
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
                        10, 1.5,  // Thinner at far zoom
                        14, 3,    // Normal at medium zoom
                        18, 4     // Thicker when zoomed in
                    ],
                        'line-opacity': 0.7
                    }
                });
            
            // Add hover effect for rail lines (cursor only, NO popup)
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'default'; // Keep default cursor for lines
            });
            
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Explicitly prevent click on rail lines from bubbling to other layers
            map.on('click', layerId, (e) => {
                // Do nothing - prevent popup from showing
                e.preventDefault();
                if (e.originalEvent) {
                    e.originalEvent.stopPropagation();
                    }
                });
                
                // Track IDs for cleanup
                this.sourceIds.push(sourceId);
                this.layerIds.push(layerId);
                
            console.log(`✅ Rendered ${this.railLines.length} rail lines in single layer (no popups)`);
                
            } catch (error) {
            console.error(`Failed to render rail lines:`, error);
            }
    }

    /**
     * Render stations on map (OPTIMIZED with clustering and zoom-based visibility)
     */
    _renderStations() {
        const map = this.app.modules.map.getMap();
        
        console.log(`📍 Rendering ${this.stations.length} stations (optimized)...`);
        
        // Create single GeoJSON source for all stations
        const sourceId = 'krl-stations-source';
        const clusterLayerId = 'krl-stations-clusters';
        const clusterCountLayerId = 'krl-stations-cluster-count';
        const layerId = 'krl-stations-layer';
        const labelLayerId = 'krl-stations-labels';
        
        const features = this.stations.map(station => ({
            type: 'Feature',
            properties: {
                id: station.id,
                name: station.name,
                code: station.code,
                isTransitHub: station.isTransitHub || false,
                // Store facilities and lines as JSON strings for retrieval
                facilities: JSON.stringify(station.facilities),
                lines: JSON.stringify(station.lines || []),
                // Store all properties for popup
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
            // Add source with clustering enabled for performance
            map.addSource(sourceId, {
                type: 'geojson',
                data: geojsonSource,
                cluster: true,
                clusterMaxZoom: 12, // Max zoom to cluster points
                clusterRadius: 50, // Radius of each cluster when clustering points
                // Performance optimization
                tolerance: 0.375
            });
            
            // Layer for clustered points
            map.addLayer({
                id: clusterLayerId,
                type: 'circle',
                source: sourceId,
                filter: ['has', 'point_count'],
                paint: {
                    'circle-color': [
                        'step',
                        ['get', 'point_count'],
                        '#dc2626', 3,
                        '#b91c1c', 5,
                        '#991b1b'
                    ],
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
            
            // Layer for cluster count labels
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
            
            // Add circle layer for individual stations (visible at higher zoom)
            map.addLayer({
                id: layerId,
                type: 'circle',
                source: sourceId,
                filter: ['!', ['has', 'point_count']], // Only show unclustered points
                paint: {
                    'circle-radius': [
                        'interpolate',
                        ['linear'],
                        ['zoom'],
                        10, 4,   // Smaller at far zoom
                        14, 8,   // Normal at medium zoom
                        18, 10   // Larger when zoomed in
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
                    'circle-stroke-color': '#dc2626', // Red for KRL
                    'circle-opacity': 1
                }
            });
            
            // Add text labels for stations (only visible at zoom >= 12)
            map.addLayer({
                id: labelLayerId,
                type: 'symbol',
                source: sourceId,
                filter: ['!', ['has', 'point_count']], // Only show labels for unclustered points
                minzoom: 12, // Only show labels when zoomed in enough
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
            
            // Add click handler for clusters - zoom in on click
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
            
            // Add click handler for individual stations
            map.on('click', layerId, async (e) => {
                if (!e.features || !e.features[0]) return;
                
                const feature = e.features[0];
                const props = feature.properties;
                
                // Parse facilities and lines back from JSON
                let facilities = [];
                let lines = [];
                try {
                    facilities = JSON.parse(props.facilities || '[]');
                    lines = JSON.parse(props.lines || '[]');
                } catch (err) {
                    console.warn('Failed to parse station data:', err);
                }
                
                await this._showStationPopup(props, facilities, lines, e.lngLat);
            });
            
            // Change cursor on hover for clusters
            map.on('mouseenter', clusterLayerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', clusterLayerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Change cursor on hover for individual stations
            map.on('mouseenter', layerId, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            
            map.on('mouseleave', layerId, () => {
                map.getCanvas().style.cursor = '';
            });
            
            // Track IDs for cleanup
            this.sourceIds.push(sourceId);
            this.layerIds.push(clusterLayerId, clusterCountLayerId, layerId, labelLayerId);
            
            console.log(`✅ Rendered ${this.stations.length} stations with clustering`);
            
        } catch (error) {
            console.error('Failed to render stations:', error);
        }
    }

    /**
     * Show station popup with enhanced details including lines info
     */
    async _showStationPopup(props, facilities, lines, lngLat) {
        try {
            const stationName = props.name || 'Stasiun KRL';
            const stationCode = props.code || props['railway:ref'] || '';
            const operator = props.network || props.operator || 'KAI Commuter';
            const elevation = props.ele ? `${props.ele}m` : '';
            
            // Find connected TransJakarta stops via intermodal mapping
            let connectedStopsHtml = '';
            try {
                const connectedStops = getConnectedTransJakartaStops(stationName, 'KRL', lngLat.lat, lngLat.lng);
                
                if (connectedStops.length > 0) {
                    connectedStopsHtml = `
                        <div style="margin-top:12px;margin-bottom:10px;">
                            <div class="small im-header">
                                <i class="fa-solid fa-arrow-right-arrow-left"></i> 
                                <strong>Integrasi TransJakarta</strong>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:10px;">
                                ${connectedStops.map((stop) => {
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
                                        if (ka.base.length !== kb.base.length) return kb.base.length - ka.base.length; // plain number first
                                        return ka.raw.localeCompare(kb.raw);
                                    });
                                    const routesHtml = sortedRoutes.length > 0
                                        ? `<div style="margin-top:8px;">
                                            <div class="im-muted" style="font-size:0.75em;margin-bottom:4px;font-weight:600;">
                                                Layanan TransJakarta:
                                            </div>
                                            <div class="im-route-badges">
                                                ${sortedRoutes.map(route => `
                                                    <div class="im-route-badge" style="background:#${route.route_color};">
                                                        ${route.route_short_name}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>`
                                        : '';
                                    return `
                                        <div class="im-card" style="padding:14px;">
                                            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
                                                <div style="
                                                    width:32px;
                                                    height:32px;
                                                    background:#dc2626;
                                                    border-radius:8px;
                                                    display:flex;
                                                    align-items:center;
                                                    justify-content:center;
                                                ">
                                                    <i class="fa-solid fa-bus" style="color:white;font-size:0.9em;"></i>
                                                </div>
                                                <div style="flex:1;">
                                                    <div class="im-card-title" style="font-size:0.95em;">
                                                        ${stop.stop_name}
                                                    </div>
                                                    <div class="im-muted" style="font-size:0.7em;margin-top:2px;">
                                                        Halte TransJakarta
                                                    </div>
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
            
            // Build lines HTML (show which lines pass through this station)
            const isTransitHub = props.isTransitHub === 'true' || props.isTransitHub === true;
            let linesHtml = '';
            
            // Check if lines is array of strings (from JSON) or array of objects (from @relations)
            const isStringArray = lines && lines.length > 0 && typeof lines[0] === 'string';
            
            if (lines && lines.length > 0 && !isStringArray) {
                // Lines from @relations (array of objects with ref, name, etc)
                const uniqueLines = [];
                const seenRefs = new Set();
                
                for (const line of lines) {
                    if (line.ref && !seenRefs.has(line.ref)) {
                        seenRefs.add(line.ref);
                        uniqueLines.push(line);
                    }
                }
                
                if (uniqueLines.length > 0) {
                linesHtml = `
                    <div style="margin-top:12px;margin-bottom:12px;">
                        <div class="small station-info-subtitle">
                            <i class="fa-solid fa-train"></i> Jalur yang Melewati
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            ${uniqueLines.map(line => {
                                const lineColor = line.colour || '#dc2626';
                                const lineRef = line.ref || '';
                                const lineName = line.name || '';
                                const lineRoute = line.from && line.to 
                                    ? `${line.from} → ${line.to}${line.via ? ' via ' + line.via : ''}`
                                    : lineName;
                                
                                return `
                                    <div class="line-item" style="
                                        display:flex;
                                        align-items:center;
                                        gap:10px;
                                        border-left:4px solid ${lineColor};
                                    ">
                                        <div style="
                                            background:${lineColor};
                                            color:white;
                                            padding:4px 10px;
                                            border-radius:6px;
                                            font-size:0.85em;
                                            font-weight:800;
                                            min-width:35px;
                                            text-align:center;
                                        ">
                                            ${lineRef}
                                        </div>
                                        <div class="line-route-text" style="
                                            flex:1;
                                            font-size:0.8em;
                                        ">
                                            ${lineRoute}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
                }
            } else if (isStringArray && this.stationsInfo && this.stationsInfo.lines) {
                // Lines is array of line codes from JSON (e.g., ["B", "C"])
                try {
                    const lineRefs = lines; // Already an array of strings
                    if (Array.isArray(lineRefs) && lineRefs.length > 0) {
                    // Build transit info HTML
                    const transitTitle = isTransitHub 
                        ? '<i class="fa-solid fa-arrows-turn-to-dots"></i> Stasiun Transit - Ganti Jalur Disini'
                        : '<i class="fa-solid fa-train"></i> Jalur yang Melewati';
                    
                    linesHtml = `
                        <div style="margin-top:12px;margin-bottom:12px;">
                            <div class="small ${isTransitHub ? 'transit-hub-title' : 'station-info-subtitle'}" style="
                                margin-bottom:10px;
                                font-size:0.9em;
                            ">
                                ${transitTitle}
                            </div>
                                <div style="display:flex;flex-direction:column;gap:8px;">
                                    ${lineRefs.map(ref => {
                                        const lineData = this.stationsInfo.lines[ref];
                                        if (!lineData) return '';
                                        
                                // Show destinations for transit hubs
                                const destinations = isTransitHub && lineData.destinations 
                                    ? `<div class="transit-line-desc" style="font-size:0.7em;margin-top:2px;">
                                         <i class="fa-solid fa-location-dot" style="font-size:0.8em;"></i> 
                                         ${lineData.destinations.join(' • ')}
                                       </div>`
                                    : '';
                                
                                return `
                                    <div class="transit-card" style="
                                        display:flex;
                                        flex-direction:column;
                                        background:${lineData.color}08;
                                        border:2px solid ${lineData.color};
                                        transition:all 0.2s;
                                    ">
                                        <div style="display:flex;align-items:center;gap:10px;">
                                            <div style="
                                                background:${lineData.color};
                                                color:white;
                                                padding:4px 12px;
                                                border-radius:6px;
                                                font-size:0.85em;
                                                font-weight:800;
                                                min-width:30px;
                                                text-align:center;
                                                box-shadow:0 2px 4px ${lineData.color}40;
                                            ">
                                                ${ref}
                                            </div>
                                            <div style="flex:1;">
                                                <div class="transit-line-name" style="font-size:0.85em;">
                                                    ${lineData.name}
                                                </div>
                                                <div class="transit-line-desc" style="font-size:0.7em;margin-top:2px;">
                                                    ${lineData.fullName || ''}
                                                </div>
                                            </div>
                                        </div>
                                        ${destinations}
                                    </div>
                                `;
                                    }).join('')}
                                </div>
                            ${isTransitHub ? `
                                <div class="transit-info-box" style="
                                    margin-top:8px;
                                    padding:8px 10px;
                                    font-size:0.75em;
                                ">
                                    <i class="fa-solid fa-circle-info"></i> 
                                    <strong>Transit:</strong> Anda bisa berganti jalur di stasiun ini
                                </div>
                            ` : ''}
                            </div>
                        `;
                    }
                } catch (e) {
                    console.warn('Failed to render transit info:', e);
                }
            } else {
                // No line data available - show generic info
                linesHtml = `
                    <div style="margin-top:12px;margin-bottom:12px;">
                        <div class="small station-info-subtitle">
                            <i class="fa-solid fa-train"></i> Info Stasiun
                        </div>
                        <div class="generic-info-box" style="font-size:0.85em;">
                            Stasiun KRL Jabodetabek
                        </div>
                    </div>
                `;
            }
            
            // Build facilities HTML
            let facilitiesHtml = '';
            if (facilities && facilities.length > 0) {
                facilitiesHtml = `
                    <div style="margin-top:12px;">
                        <div class="small" style="color:#6b7280;font-weight:600;margin-bottom:8px;">
                            <i class="fa-solid fa-circle-info"></i> Fasilitas
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;">
                            ${facilities.map(f => `
                                <div style="
                                    display:flex;
                                    align-items:center;
                                    gap:6px;
                                    background:${f.color}15;
                                    border:1px solid ${f.color}40;
                                    border-radius:8px;
                                    padding:6px 10px;
                                    font-size:0.75em;
                                    color:${f.color};
                                    font-weight:600;
                                ">
                                    <i class="fa-solid ${f.icon}"></i>
                                    <span>${f.label}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            // Build popup HTML
            const html = `
                <div class="stop-popup plus-jakarta-sans" style="min-width:300px;max-width:400px;padding:12px;">
                    <!-- Header -->
                    <div style="
                        display:flex;
                        align-items:center;
                        gap:12px;
                        padding-bottom:10px;
                        border-bottom:2px solid #fee2e2;
                        margin-bottom:10px;
                    ">
                        <div style="
                            width:42px;
                            height:42px;
                            background:linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                            border-radius:10px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            box-shadow:0 4px 12px rgba(220,38,38,0.3);
                        ">
                            <i class="fa-solid fa-train" style="color:white;font-size:1.3em;"></i>
                        </div>
                        <div style="flex:1;">
                            <div style="font-weight:800;font-size:1.1em;color:#1f2937;">
                                ${stationName}
                            </div>
                            ${stationCode ? `
                                <div style="
                                    display:inline-block;
                                    background:#dc2626;
                                    color:white;
                                    padding:2px 8px;
                                    border-radius:6px;
                                    font-size:0.7em;
                                    font-weight:700;
                                    margin-top:4px;
                                    letter-spacing:0.5px;
                                ">
                                    ${stationCode}
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Info -->
                    <div style="margin-bottom:${linesHtml ? '8px' : '10px'};">
                        <div class="small" style="color:#6b7280;margin-bottom:6px;">
                            <i class="fa-solid fa-building"></i> <strong>Operator:</strong> ${operator}
                        </div>
                        ${elevation ? `
                            <div class="small" style="color:#6b7280;">
                                <i class="fa-solid fa-mountain"></i> <strong>Elevasi:</strong> ${elevation}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Lines passing through this station -->
                    ${linesHtml}
                    
                    <!-- Connected TransJakarta stops from intermodal mapping -->
                    ${connectedStopsHtml}
                    
                    <!-- Facilities -->
                    ${facilitiesHtml}
                    
                    <!-- Wikipedia Link -->
                    ${props.wikipedia ? `
                        <div style="margin-top:12px;padding-top:10px;border-top:1px solid #f3f4f6;">
                            <a href="https://id.wikipedia.org/wiki/${props.wikipedia.replace('id:', '')}" 
                               target="_blank"
                               style="
                                   display:inline-flex;
                                   align-items:center;
                                   gap:6px;
                                   color:#3b82f6;
                                   text-decoration:none;
                                   font-size:0.85em;
                                   font-weight:600;
                               ">
                                <i class="fa-brands fa-wikipedia-w"></i>
                                <span>Lihat di Wikipedia</span>
                                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75em;"></i>
                            </a>
                        </div>
                    ` : ''}
                </div>
            `;
            
            // Show popup using map manager
            this.app.modules.map.showHtmlPopupAt(lngLat.lng, lngLat.lat, html);
            
        } catch (error) {
            console.error('Failed to show station popup:', error);
        }
    }

    /**
     * Get station by name or code
     */
    findStation(query) {
        if (!query) return null;
        
        const q = String(query).toLowerCase().trim();
        
        return this.stations.find(station => 
            station.name.toLowerCase().includes(q) ||
            station.code.toLowerCase() === q
        );
    }

    /**
     * Get all stations
     */
    getAllStations() {
        return [...this.stations];
    }

    /**
     * Check if KRL is enabled
     */
    isEnabled() {
        return this.enabled;
    }

    /**
     * Check if KRL data is loaded
     */
    isLoaded() {
        return this._loaded;
    }
}
