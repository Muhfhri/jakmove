// Stop Manager Module
export class StopManager {
    constructor() {
        this.stops = [];
        this.stopToRoutes = {};
    }

    // Initialize with GTFS data
    init(gtfsData) {
        this.stops = gtfsData.stops || [];
        this.stopToRoutes = gtfsData.stopToRoutes || {};
    }

    // Get stops by route
    getStopsByRoute(routeId, variant = null) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        let filteredTrips = trips;
        if (variant) {
            const variantRegex = /^(.*?)-(\w+)$/;
            filteredTrips = trips.filter(t => {
                const m = t.trip_id.match(variantRegex);
                return m && m[2] === variant;
            });
        }

        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        const stops = window.transJakartaApp.modules.gtfs.getStops();
        
        if (!variant) {
            // Combine all stops from all trips (no duplicates)
            const halteMap = new Map();
            filteredTrips.forEach(trip => {
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop) {
                        const key = stop.stop_id;
                        if (!halteMap.has(key)) halteMap.set(key, stop);
                    }
                });
            });
            return Array.from(halteMap.values());
        } else {
            // Only selected variant
            const allStops = [];
            filteredTrips.forEach(trip => {
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop) allStops.push(stop);
                });
            });
            return allStops;
        }
    }

    // Get stop type
    getStopType(stopId) {
        if (stopId.startsWith('B')) return 'Pengumpan';
        if (stopId.startsWith('G')) return 'Platform';
        if (stopId.startsWith('E') || stopId.startsWith('H')) return 'Akses Masuk';
        return 'Koridor';
    }

    // Get stops within radius
    getStopsWithinRadius(centerLat, centerLon, radius = 300) {
        return this.stops.filter(stop => {
            if (!stop.stop_lat || !stop.stop_lon) return false;
            
            const distance = this.haversine(
                centerLat, centerLon,
                parseFloat(stop.stop_lat),
                parseFloat(stop.stop_lon)
            );
            
            return distance <= radius && 
                   this.stopToRoutes[stop.stop_id] && 
                   this.stopToRoutes[stop.stop_id].size > 0;
        });
    }

    // Find nearest stop
    findNearestStop(lat, lon) {
        let minDist = Infinity;
        let nearest = null;
        
        this.stops.forEach(stop => {
            if (stop.stop_lat && stop.stop_lon) {
                const dist = this.haversine(lat, lon, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
                if (dist < minDist) {
                    minDist = dist;
                    nearest = stop;
                }
            }
        });
        
        return { stop: nearest, distance: minDist };
    }

    // Haversine distance calculation
    haversine(lat1, lon1, lat2, lon2) {
        function toRad(x) { return x * Math.PI / 180; }
        const R = 6371e3; // meter
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Get all stops
    getAllStops() {
        return this.stops;
    }

    // Get stop by ID
    getStopById(stopId) {
        return this.stops.find(s => s.stop_id === stopId);
    }

    // Get routes for stop
    getRoutesForStop(stopId) {
        return this.stopToRoutes[stopId] ? Array.from(this.stopToRoutes[stopId]) : [];
    }
} 
 