self.onmessage = (ev) => {
    const msg = ev.data || {};
    if (msg.cmd !== 'parseAll') return;
    const texts = msg.payload || {};
    const post = (type, data) => self.postMessage({
        type,
        ...data
    });

    try {
        post('progress', {
            percent: 88,
            status: 'Mem-parse CSV: stops...'
        });
        const stops = parseCSV(texts.stopsTxt || '');
        post('progress', {
            percent: 89,
            status: 'Mem-parse CSV: routes...'
        });
        const routes = parseCSV(texts.routesTxt || '');
        post('progress', {
            percent: 90,
            status: 'Mem-parse CSV: trips...'
        });
        const trips = parseCSV(texts.tripsTxt || '');
        post('progress', {
            percent: 91,
            status: 'Mem-parse CSV: stop_times...'
        });
        const stop_times = parseCSV(texts.stopTimesTxt || '');
        post('progress', {
            percent: 92,
            status: 'Mem-parse CSV: shapes...'
        });
        const shapes = parseCSV(texts.shapesTxt || '');
        post('progress', {
            percent: 93,
            status: 'Mem-parse CSV: lainnya...'
        });
        const frequencies = parseCSV(texts.frequenciesTxt || '');
        const fare_rules = parseCSV(texts.fareRulesTxt || '');
        const fare_attributes = parseCSV(texts.fareAttributesTxt || '');
        const transfers = parseCSV(texts.transfersTxt || '');
        const calendar = parseCSV(texts.calendarTxt || '');
        const agency = parseCSV(texts.agencyTxt || '');

        post('progress', {
            percent: 94,
            status: 'Membangun indeks halte→rute...'
        });
        const stopToRoutes = buildStopToRoutes(stop_times, trips);

        post('progress', {
            percent: 96,
            status: 'Finalisasi data...'
        });
        post('result', {
            data: {
                stops,
                routes,
                trips,
                stop_times,
                shapes,
                frequencies,
                fare_rules,
                fare_attributes,
                transfers,
                calendar,
                agency,
                stopToRoutes
            }
        });
    } catch (e) {
        post('error', {
            error: e && e.message ? e.message : 'Unknown error'
        });
    }
};

function parseCSV(text) {
    if (!text || (text = String(text)).trim() === '') return [];
    const lines = text.split('\n').filter(l => l.trim() !== '');
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const out = new Array(lines.length - 1);
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const obj = {};
        for (let j = 0; j < headers.length; j++) obj[headers[j]] = values[j];
        out[i - 1] = obj;
    }
    return out;
}

function buildStopToRoutes(stop_times, trips) {
    const stopToRoutesSet = Object.create(null);
    const tripById = new Map(trips.map(t => [t.trip_id, t]));
    for (let i = 0; i < stop_times.length; i++) {
        const st = stop_times[i];
        const trip = tripById.get(st.trip_id);
        if (!trip) continue;
        const sid = st.stop_id;
        if (!stopToRoutesSet[sid]) stopToRoutesSet[sid] = new Set();
        stopToRoutesSet[sid].add(trip.route_id);
    }
    const result = {};
    for (const k in stopToRoutesSet) result[k] = Array.from(stopToRoutesSet[k]);
    return result;
}