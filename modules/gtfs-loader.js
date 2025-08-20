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
        this._worker = null;
    }

    async loadData() {
        try {
            this.showLoadingProgress();
            this.updateLoadingProgress(2, 'Menyiapkan aplikasi...');

            const files = [
                { url: 'gtfs/stops.txt', key: 'stopsTxt', label: 'Mengunduh stops.txt', range: [2, 10] },
                { url: 'gtfs/routes.txt', key: 'routesTxt', label: 'Mengunduh routes.txt', range: [10, 16] },
                { url: 'gtfs/trips.txt', key: 'tripsTxt', label: 'Mengunduh trips.txt', range: [16, 28] },
                { url: 'gtfs/stop_times.txt', key: 'stopTimesTxt', label: 'Mengunduh stop_times.txt', range: [28, 50] },
                { url: 'gtfs/shapes.txt', key: 'shapesTxt', label: 'Mengunduh shapes.txt', range: [50, 62] },
                { url: 'gtfs/frequencies.txt', key: 'frequenciesTxt', label: 'Mengunduh frequencies.txt', range: [62, 66] },
                { url: 'gtfs/fare_rules.txt', key: 'fareRulesTxt', label: 'Mengunduh fare_rules.txt', range: [66, 70] },
                { url: 'gtfs/fare_attributes.txt', key: 'fareAttributesTxt', label: 'Mengunduh fare_attributes.txt', range: [70, 74] },
                { url: 'gtfs/transfers.txt', key: 'transfersTxt', label: 'Mengunduh transfers.txt', range: [74, 78] },
                { url: 'gtfs/calendar.txt', key: 'calendarTxt', label: 'Mengunduh calendar.txt', range: [78, 82] },
                { url: 'gtfs/agency.txt', key: 'agencyTxt', label: 'Mengunduh agency.txt', range: [82, 86] }
            ];

            // Sequential streaming fetch with per-file progress
            const texts = {};
            for (const f of files) {
                texts[f.key] = await this._streamFetchWithProgress(f.url, f.range[0], f.range[1], f.label);
            }

            this.updateLoadingProgress(87, 'Memproses data di latar (tidak membekukan UI)...');

            // Offload parsing to Web Worker for responsiveness
            const parsed = await this._parseInWorker(texts, (p, s) => this.updateLoadingProgress(p, s));

            // Assign parsed data
            this.data.stops = parsed.stops;
            this.data.routes = parsed.routes;
            this.data.trips = parsed.trips;
            this.data.stop_times = parsed.stop_times;
            this.data.shapes = parsed.shapes;
            this.data.frequencies = parsed.frequencies;
            this.data.fare_rules = parsed.fare_rules;
            this.data.fare_attributes = parsed.fare_attributes;
            this.data.transfers = parsed.transfers;
            this.data.calendar = parsed.calendar;
            this.data.agency = parsed.agency;
            this.stopToRoutes = parsed.stopToRoutes || {};

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

    async _streamFetchWithProgress(url, startPercent, endPercent, label) {
        try {
            this.updateLoadingProgress(startPercent, `${label} (mulai)`);
            const res = await fetch(url);
            if (!res.ok) return '';
            const contentLength = parseInt(res.headers.get('Content-Length') || '0', 10);
            if (!res.body || !window.ReadableStream) {
                const text = await res.text();
                this.updateLoadingProgress(endPercent, `${label} (100%)`);
                return text;
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let received = 0;
            let chunks = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                received += value.byteLength;
                chunks += decoder.decode(value, { stream: true });
                const frac = contentLength > 0 ? (received / contentLength) : 0.5; // fallback
                const pct = Math.min(endPercent, startPercent + Math.floor((endPercent - startPercent) * frac));
                this.updateLoadingProgress(pct, `${label} (${contentLength ? Math.min(100, Math.floor(frac * 100)) : '...'}%)`);
            }
            // flush decoder
            chunks += decoder.decode();
            this.updateLoadingProgress(endPercent, `${label} (100%)`);
            return chunks;
        } catch (_) {
            // Fallback simple fetch on error
            const txt = await fetch(url).then(r => r.ok ? r.text() : '');
            this.updateLoadingProgress(endPercent, `${label} (selesai)`);
            return txt;
        }
    }

    _ensureWorker() {
        if (this._worker) return this._worker;
        try {
            this._worker = new Worker('workers/gtfs-worker.js');
        } catch (_) {
            this._worker = null;
        }
        return this._worker;
    }

    _parseInWorker(texts, onProgress) {
        return new Promise((resolve, reject) => {
            const w = this._ensureWorker();
            if (!w) {
                // Fallback: parse in main thread using existing methods
                try {
                    const result = {};
                    onProgress && onProgress(90, 'Memproses data (fallback)...');
                    result.stops = this.parseCSV(texts.stopsTxt);
                    result.routes = this.parseCSV(texts.routesTxt);
                    result.trips = this.parseCSV(texts.tripsTxt);
                    result.stop_times = this.parseCSV(texts.stopTimesTxt);
                    result.shapes = this.parseCSV(texts.shapesTxt);
                    result.frequencies = this.parseCSV(texts.frequenciesTxt);
                    result.fare_rules = this.parseCSV(texts.fareRulesTxt);
                    result.fare_attributes = this.parseCSV(texts.fareAttributesTxt);
                    result.transfers = this.parseCSV(texts.transfersTxt);
                    result.calendar = this.parseCSV(texts.calendarTxt);
                    result.agency = this.parseCSV(texts.agencyTxt);
                    // Build mapping
                    const stopToRoutes = {};
                    result.stop_times.forEach(st => {
                        const trip = result.trips.find(t => t.trip_id === st.trip_id);
                        if (trip) {
                            if (!stopToRoutes[st.stop_id]) stopToRoutes[st.stop_id] = new Set();
                            stopToRoutes[st.stop_id].add(trip.route_id);
                        }
                    });
                    Object.keys(stopToRoutes).forEach(k => stopToRoutes[k] = Array.from(stopToRoutes[k]));
                    result.stopToRoutes = stopToRoutes;
                    onProgress && onProgress(96, 'Finalisasi data...');
                    resolve(result);
                } catch (e) { reject(e); }
                return;
            }
            const onMsg = (ev) => {
                const msg = ev.data || {};
                if (msg.type === 'progress') {
                    onProgress && onProgress(msg.percent, msg.status || '');
                } else if (msg.type === 'result') {
                    w.removeEventListener('message', onMsg);
                    resolve(msg.data);
                } else if (msg.type === 'error') {
                    w.removeEventListener('message', onMsg);
                    reject(new Error(msg.error || 'Worker error'));
                }
            };
            w.addEventListener('message', onMsg);
            try {
                w.postMessage({ cmd: 'parseAll', payload: texts });
            } catch (e) {
                w.removeEventListener('message', onMsg);
                reject(e);
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
        try { document.body.classList.add('no-scroll'); } catch(_) {}
    }

    hideLoadingProgress() {
        const loadingModal = document.getElementById('loadingProgress');
        if (loadingModal) {
            loadingModal.classList.remove('show');
            setTimeout(() => loadingModal.style.display = 'none', 300);
        }
        try { document.body.classList.remove('no-scroll'); } catch(_) {}
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

    // Legacy parsers kept for fallback
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
} 
 