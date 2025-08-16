// GTFS Data Loader Module
export class GTFSLoader {
    constructor() {
        this.data = {
            stops: [],
            routes: [],
            trips: [],
            stop_times: [],
            shapes: [],
            frequencies: [],
            fare_rules: [],
            fare_attributes: [],
            transfers: [],
            calendar: [],
            agency: []
        };
        this.stopToRoutes = {};
    }

    async loadData() {
        try {
            this.showLoadingProgress();
            this.updateLoadingProgress(10, 'Menyiapkan aplikasi...');

            const [
                stopsTxt, routesTxt, tripsTxt, stopTimesTxt, 
                shapesTxt, frequenciesTxt, fareRulesTxt, 
                fareAttributesTxt, transfersTxt, calendarTxt, agencyTxt
            ] = await Promise.all([
                this.fetchGTFSFile('gtfs/stops.txt', 25, 'Memuat data halte...'),
                this.fetchGTFSFile('gtfs/routes.txt', 40, 'Memuat data rute...'),
                this.fetchGTFSFile('gtfs/trips.txt', 55, 'Memuat data perjalanan...'),
                this.fetchGTFSFile('gtfs/stop_times.txt', 70, 'Memuat jadwal...'),
                this.fetchGTFSFile('gtfs/shapes.txt', 85, 'Memuat bentuk jalur...'),
                this.fetchGTFSFile('gtfs/frequencies.txt'),
                this.fetchGTFSFile('gtfs/fare_rules.txt'),
                this.fetchGTFSFile('gtfs/fare_attributes.txt'),
                this.fetchGTFSFile('gtfs/transfers.txt'),
                this.fetchGTFSFile('gtfs/calendar.txt'),
                this.fetchGTFSFile('gtfs/agency.txt')
            ]);

            this.updateLoadingProgress(95, 'Menyiapkan peta...');

            // Parse all data
            this.data.stops = this.parseCSV(stopsTxt);
            this.data.routes = this.parseCSV(routesTxt);
            this.data.trips = this.parseCSV(tripsTxt);
            this.data.stop_times = this.parseCSV(stopTimesTxt);
            this.data.shapes = this.parseCSV(shapesTxt);
            this.data.frequencies = this.parseCSV(frequenciesTxt);
            this.data.fare_rules = this.parseCSV(fareRulesTxt);
            this.data.fare_attributes = this.parseCSV(fareAttributesTxt);
            this.data.transfers = this.parseCSV(transfersTxt);
            this.data.calendar = this.parseCSV(calendarTxt);
            this.data.agency = this.parseCSV(agencyTxt);

            // Build stopToRoutes mapping
            this.buildStopToRoutesMapping();

            this.updateLoadingProgress(100, 'Selesai!');
            this.hideLoadingProgress();

            return this.data;
        } catch (error) {
            console.error('Error loading GTFS data:', error);
            this.updateLoadingProgress(0, 'Error: Gagal memuat data');
            setTimeout(() => this.hideLoadingProgress(), 3000);
            throw error;
        }
    }

    async fetchGTFSFile(url, progress, status) {
        if (progress && status) {
            this.updateLoadingProgress(progress, status);
        }
        
        const response = await fetch(url);
        if (response.ok) {
            return response.text();
        }
        return '';
    }

    parseCSV(text) {
        if (!text || text.trim() === '') return [];
        
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length === 0) return [];
        
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = values[i]);
            return obj;
        });
    }

    buildStopToRoutesMapping() {
        this.stopToRoutes = {};
        this.data.stop_times.forEach(st => {
            const trip = this.data.trips.find(t => t.trip_id === st.trip_id);
            if (trip) {
                if (!this.stopToRoutes[st.stop_id]) {
                    this.stopToRoutes[st.stop_id] = new Set();
                }
                this.stopToRoutes[st.stop_id].add(trip.route_id);
            }
        });
    }

    // Utility functions
    getStops() { return this.data.stops; }
    getRoutes() { return this.data.routes; }
    getTrips() { return this.data.trips; }
    getStopTimes() { return this.data.stop_times; }
    getShapes() { return this.data.shapes; }
    getFrequencies() { return this.data.frequencies; }
    getFareRules() { return this.data.fare_rules; }
    getFareAttributes() { return this.data.fare_attributes; }
    getStopToRoutes() { return this.stopToRoutes; }

    // Natural sort function for human-friendly sorting of route names
    naturalSort(a, b) {
        let ax = (typeof a === 'object' && a.route_short_name) ? a.route_short_name : a;
        let bx = (typeof b === 'object' && b.route_short_name) ? b.route_short_name : b;
        
        if (!ax && typeof a === 'object') ax = a.route_id;
        if (!bx && typeof b === 'object') bx = b.route_id;
        
        return ax.localeCompare(bx, undefined, { numeric: true, sensitivity: 'base' });
    }

    // Loading progress functions
    showLoadingProgress() {
        const loadingModal = document.getElementById('loadingProgress');
        if (loadingModal) {
            loadingModal.style.display = 'flex';
            setTimeout(() => loadingModal.classList.add('show'), 10);
        }
    }

    hideLoadingProgress() {
        const loadingModal = document.getElementById('loadingProgress');
        if (loadingModal) {
            loadingModal.classList.remove('show');
            setTimeout(() => loadingModal.style.display = 'none', 300);
        }
    }

    updateLoadingProgress(percent, status) {
        const progressBar = document.getElementById('progressBar');
        const progressPercent = document.getElementById('progressPercent');
        const progressStatus = document.getElementById('progressStatus');
        
        if (progressBar) {
            progressBar.style.width = percent + '%';
            progressBar.setAttribute('aria-valuenow', percent);
        }
        if (progressPercent) {
            progressPercent.textContent = Math.round(percent) + '%';
        }
        if (progressStatus && status) {
            progressStatus.textContent = status;
        }
    }
} 
 