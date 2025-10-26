/**
 * Distance Helper - Calculate distances between coordinates
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return distance; // in meters
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
function toRad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export function formatDistance(meters) {
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    } else {
        return `${(meters / 1000).toFixed(1)} km`;
    }
}

/**
 * Find nearest TransJakarta stop to a coordinate
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {Array} stops - Array of stop objects with lat/lon
 * @param {number} maxCount - Maximum number of nearest stops to return
 * @returns {Array} Array of nearest stops with distance and routes
 */
export function findNearestStops(lat, lon, stops, maxCount = 3) {
    if (!stops || stops.length === 0) return [];
    
    const stopsWithDistance = stops.map(stop => {
        const distance = calculateDistance(lat, lon, stop.stop_lat, stop.stop_lon);
        
        // Get routes that pass through this stop
        const routes = getRoutesForStop(stop.stop_id);
        
        return {
            ...stop,
            distance: distance,
            distanceFormatted: formatDistance(distance),
            routes: routes
        };
    });
    
    // Sort by distance and return top N
    stopsWithDistance.sort((a, b) => a.distance - b.distance);
    return stopsWithDistance.slice(0, maxCount);
}

/**
 * Get all routes that pass through a stop
 * @param {string} stopId - Stop ID
 * @returns {Array} Array of route objects with route_id, route_short_name, route_color
 */
function getRoutesForStop(stopId) {
    try {
        const app = window.transJakartaApp;
        const gtfs = app?.modules?.gtfs;
        
        if (!gtfs || !gtfs.stopToRoutes) {
            return [];
        }
        
        const routeIds = (gtfs.stopToRoutes || {})[String(stopId)] || [];
        const routesList = typeof gtfs.getRoutes === 'function' ? gtfs.getRoutes() : (gtfs.data?.routes || []);
        const routeMap = new Map((routesList || []).map(r => [String(r.route_id), r]));
        
        const routes = [];
        for (const rawId of routeIds) {
            const routeId = String(rawId);
            const route = routeMap.get(routeId);
            if (route) {
                routes.push({
                    route_id: route.route_id,
                    route_short_name: route.route_short_name,
                    route_long_name: route.route_long_name,
                    route_color: route.route_color || 'dc2626'
                });
            }
        }
        
        const getKey = (s) => {
            if (!s) return { n: Number.POSITIVE_INFINITY, baseLen: 0, raw: '' };
            const raw = String(s).toUpperCase().trim();
            const m = raw.match(/(\d+)/);
            const n = m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
            // Base numeric token length for suffix ordering ("1" before "1A")
            const baseLen = m ? m[0].length : 0;
            return { n, baseLen, raw };
        };
        routes.sort((a, b) => {
            const ka = getKey(a.route_short_name);
            const kb = getKey(b.route_short_name);
            if (ka.n !== kb.n) return ka.n - kb.n;
            // Same number: plain number first (shorter base)
            if (ka.baseLen !== kb.baseLen) return kb.baseLen - ka.baseLen; // e.g., "1" (1) before "1A" (1)
            // Fallback lexicographic
            return ka.raw.localeCompare(kb.raw);
        });
        
        return routes;
    } catch (error) {
        console.warn('Failed to get routes for stop:', error);
        return [];
    }
}

/**
 * Normalize stop names for better matching
 * @param {string} raw - Raw stop name
 * @returns {string} Normalized stop name
 */
function normalizeName(raw) {
    if (!raw) return '';
    let s = String(raw).toLowerCase();
    // Remove punctuation
    s = s.replace(/[.,()\-_/]/g, ' ');
    // Tokenize and remove common qualifiers
    const blacklist = new Set([
        'st', 'stasiun', 'halte', 'pintu', 'air', 'istiqlal',
        'barat', 'timur', 'utara', 'selatan', 'arah', 'baratdaya', 'tenggara'
    ]);
    const tokens = s.split(/\s+/).filter(Boolean).filter(t => !blacklist.has(t));
    // Remove trailing numeric tokens (e.g., '2', 'III')
    const filtered = tokens.filter(t => !/^\d+$/.test(t) && !/^(i|v|x)+$/i.test(t));
    return filtered.join(' ').trim();
}

// Strict tokenizer that preserves station qualifiers like "st"/"stasiun"
function simpleNormalize(raw) {
    if (!raw) return '';
    return String(raw)
        .toLowerCase()
        .replace(/[.,()\-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toTokens(raw) {
    const s = simpleNormalize(raw);
    return s.length ? s.split(' ') : [];
}

function containsAllTokens(targetTokens, candidateTokens) {
    if (!targetTokens.length) return false;
    const set = new Set(candidateTokens);
    for (const t of targetTokens) {
        if (!set.has(t)) return false;
    }
    return true;
}

/**
 * Get TransJakarta stops connected to a station via intermodal mapping
 * @param {string} stationName - Station name (e.g., "Dukuh Atas BNI")
 * @param {string} mode - Mode type (e.g., "MRT", "KRL", "LRT")
 * @returns {Array} Array of connected TransJakarta stops with routes
 */
export function getConnectedTransJakartaStops(stationName, mode, stationLat, stationLon) {
    try {
        const app = window.transJakartaApp;
        const routes = app?.modules?.routes;
        const gtfs = app?.modules?.gtfs;
        
        console.log('🔍 [Intermodal] Looking for connections:', { stationName, mode });
        console.log('🔍 [Intermodal] Module check:', {
            hasApp: !!app,
            hasRoutes: !!routes,
            hasGTFS: !!gtfs,
            hasStops: typeof gtfs?.getStops === 'function' ? (Array.isArray(gtfs.getStops()) && gtfs.getStops().length >= 0) : !!gtfs?.data?.stops
        });
        
        // Get intermodal mapping - try multiple sources
        let mapping = null;
        if (routes) {
            mapping = routes._intermodalMapping || routes._intermodalByStopKey;
        }
        if (!mapping || Object.keys(mapping).length === 0) {
            console.warn('⚠️  [Intermodal] Using fallback hardcoded mapping');
            mapping = getHardcodedIntermodalMapping();
        }
        console.log('📋 [Intermodal] Mapping available:', Object.keys(mapping).length, 'entries');
        if (Object.keys(mapping).length === 0) {
            console.warn('⚠️  [Intermodal] No mapping available');
            return [];
        }
        
        const connectedStops = [];
        const stopsArray = typeof gtfs?.getStops === 'function' ? gtfs.getStops() : (gtfs?.data?.stops || null);
        const hasStationCoords = typeof stationLat === 'number' && typeof stationLon === 'number';
        const NEAR_RADIUS_METERS = 500; // tighter fuzzy radius: 0.5 km
        
        for (const [tjStopName, modes] of Object.entries(mapping)) {
            if (modes[mode] === stationName) {
                console.log('✅ [Intermodal] Match found:', tjStopName, '→', stationName);
                const displayName = tjStopName; // prefer mapping label for consistency
                
                // If we have GTFS stops, aggregate all matching stops into one logical stop
                if (Array.isArray(stopsArray)) {
                    const targetKey = normalizeName(tjStopName);
                    // Phase 1: strict token match (preserve qualifiers like "st", "stasiun")
                    const targetStrictName = simpleNormalize(tjStopName);
                    const strictCandidates = stopsArray.filter(stop => simpleNormalize(stop.stop_name) === targetStrictName);
                    const candidates = strictCandidates.length > 0
                        ? strictCandidates
                        : stopsArray.filter(stop => {
                            const key = normalizeName(stop.stop_name);
                            if (!key || !targetKey) return false;
                            // Strict normalized equality
                            if (key === targetKey) return true;
                            // Nearby fuzzy with token overlap
                            if (hasStationCoords) {
                                const sLat = parseFloat(stop.stop_lat);
                                const sLon = parseFloat(stop.stop_lon);
                                if (Number.isFinite(sLat) && Number.isFinite(sLon)) {
                                    const d = calculateDistance(stationLat, stationLon, sLat, sLon);
                                    if (d <= NEAR_RADIUS_METERS) {
                                        const keyTokens = key.split(' ').filter(Boolean);
                                        const targetTokens = targetKey.split(' ').filter(Boolean);
                                        const hasTokenOverlap = keyTokens.some(t => targetTokens.includes(t));
                                        if (hasTokenOverlap) return true;
                                    }
                                }
                            }
                            return false;
                        });
                    console.log(`🔎 [Intermodal] Found ${candidates.length} matching TJ stops for "${tjStopName}" (key="${targetKey}")`);
                    
                    // Aggregate unique routes across candidates
                    const uniqueRoutesById = new Map();
                    for (const stop of candidates) {
                        const rts = getRoutesForStop(stop.stop_id);
                        for (const r of rts) {
                            const id = String(r.route_id || r.route_short_name);
                            if (!uniqueRoutesById.has(id)) uniqueRoutesById.set(id, r);
                        }
                    }
                    const aggregatedRoutes = Array.from(uniqueRoutesById.values());
                    
                    // Push single aggregated entry
                    connectedStops.push({
                        stop_id: `group:${targetKey}`,
                        stop_name: displayName,
                        routes: aggregatedRoutes,
                        mappingName: displayName,
                        isAggregated: true
                    });
                    continue;
                }
                
                // Fallback virtual entry when real stops are not available yet
                connectedStops.push({
                    stop_id: `virtual:${displayName}`,
                    stop_name: displayName,
                    routes: [],
                    mappingName: displayName,
                    isVirtual: true
                });
            }
        }
        
        console.log(`🎯 [Intermodal] Total connected stops: ${connectedStops.length}`);
        return connectedStops;
    } catch (error) {
        console.warn('❌ [Intermodal] Failed to get connected TransJakarta stops:', error);
        return [];
    }
}

/**
 * Hardcoded fallback intermodal mapping
 * This is used if intermodal.js hasn't loaded yet
 * @returns {Object} Intermodal mapping object
 */
function getHardcodedIntermodalMapping() {
    return {
        'Dukuh Atas': {
            'MRT': 'Dukuh Atas BNI',
            'KRL': 'Sudirman', 
            'LRT': 'Dukuh Atas BNI'
        },
    };
}

/**
 * Get user's current location if available
 * @returns {Promise<{lat: number, lon: number} | null>}
 */
export async function getUserLocation() {
    try {
        const app = window.transJakartaApp;
        const loc = app?.modules?.location;
        
        console.log('📍 Getting user location...', {
            hasApp: !!app,
            hasLocation: !!loc,
            isActive: loc?.isActive,
            hasLastUserPos: !!loc?.lastUserPos,
            hasLastUserPosSmoothed: !!loc?.lastUserPosSmoothed,
            lastUserPos: loc?.lastUserPos,
            lastUserPosSmoothed: loc?.lastUserPosSmoothed
        });
        
        // Check if location is active and has position data
        if (loc && loc.isActive) {
            // Prefer smoothed position for better accuracy, fallback to raw position
            const position = loc.lastUserPosSmoothed || loc.lastUserPos;
            
            if (position && position.lat && position.lon) {
                const userPos = {
                    lat: position.lat,
                    lon: position.lon
                };
                console.log('✅ User location found:', userPos);
                return userPos;
            }
        }
        
        console.warn('⚠️  User location not available');
        return null;
    } catch (error) {
        console.warn('❌ Could not get user location:', error);
        return null;
    }
}

