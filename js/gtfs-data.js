// GTFS Data Loader and Display for Transjakarta Section
let gtfsRoutes = [];
let gtfsStops = [];
let gtfsTrips = [];
let gtfsStopTimes = [];

// Load GTFS data when the page loads
document.addEventListener('DOMContentLoaded', function() {
    loadGTFSData();
});

async function loadGTFSData() {
    try {
        // Load GTFS files
        const [routesTxt, stopsTxt, tripsTxt, stopTimesTxt] = await Promise.all([
            fetch('gtfs/routes.txt').then(r => r.text()),
            fetch('gtfs/stops.txt').then(r => r.text()),
            fetch('gtfs/trips.txt').then(r => r.text()),
            fetch('gtfs/stop_times.txt').then(r => r.text())
        ]);

        // Parse CSV data
        gtfsRoutes = parseCSV(routesTxt);
        gtfsStops = parseCSV(stopsTxt);
        gtfsTrips = parseCSV(tripsTxt);
        gtfsStopTimes = parseCSV(stopTimesTxt);

        // Display the data
        displayGTFSStatistics();
        displayRouteCategories();

    } catch (error) {
        console.error('Error loading GTFS data:', error);
        showGTFSError();
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
    }
    
    return data;
}

function displayGTFSStatistics() {
    // Update statistics
    document.getElementById('totalRoutes').textContent = gtfsRoutes.length;
    document.getElementById('totalStops').textContent = gtfsStops.length;
    document.getElementById('totalTrips').textContent = gtfsTrips.length;
    document.getElementById('totalStopTimes').textContent = gtfsStopTimes.length;
}

function displayRouteCategories() {
    const categoriesContainer = document.getElementById('routeCategories');
    categoriesContainer.innerHTML = '';

    const categories = [
        {
            name: 'BRT (Bus Rapid Transit)',
            description: 'Bus yang melintas di jalur khusus dan antar koridor. Layanan utama Transjakarta dengan jalur terpisah untuk kecepatan optimal.',
            icon: 'mdi:bus-rapid-transit',
            color: '#264697',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('BRT') || 
                route.route_desc?.includes('BRT') ||
                route.route_long_name?.includes('Koridor') ||
                route.route_desc?.includes('Koridor') ||
                (route.route_short_name && /^[1-9]$|^1[0-3]$/.test(route.route_short_name) && 
                 (route.route_long_name?.includes('Transjakarta') || route.route_desc?.includes('Transjakarta')))
            ).length
        },
        {
            name: 'Rusun',
            description: 'Layanan Pemprov Jakarta untuk meringankan mobilitas warga rusun. Menghubungkan perumahan rusun dengan pusat kota.',
            icon: 'mdi:home-city',
            color: '#4FA8DE',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Rusun') || 
                route.route_desc?.includes('Rusun') ||
                route.route_short_name?.startsWith('R')
            ).length
        },
        {
            name: 'Angkutan Umum Integrasi',
            description: 'Berfungsi sebagai feeder atau pengumpan bagi masyarakat yang tidak ada layanan BRT. Menghubungkan area yang belum terjangkau BRT.',
            icon: 'mdi:bus-multiple',
            color: '#28a745',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Integrasi') || 
                route.route_desc?.includes('Integrasi') ||
                route.route_short_name?.startsWith('I')
            ).length
        },
        {
            name: 'Royaltrans',
            description: 'Layanan premium cepat karena melintasi tol. Menyediakan perjalanan eksklusif dengan kenyamanan tinggi.',
            icon: 'mdi:crown',
            color: '#ffc107',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Royal') || 
                route.route_desc?.includes('Royal') ||
                route.route_short_name?.startsWith('RT')
            ).length
        },
        {
            name: 'Transjabodetabek',
            description: 'Mempermudah layanan masyarakat luar Jakarta yang ingin ke Jakarta tapi jauh dari layanan transportasi. Menghubungkan Jabodetabek.',
            icon: 'mdi:map-marker-multiple',
            color: '#dc3545',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Jabodetabek') || 
                route.route_desc?.includes('Jabodetabek') ||
                route.route_long_name?.includes('Bekasi') ||
                route.route_long_name?.includes('Depok') ||
                route.route_long_name?.includes('Bogor') ||
                route.route_long_name?.includes('Tangerang') ||
                route.route_short_name?.startsWith('TJ')
            ).length
        },
        {
            name: 'Bus Wisata',
            description: 'Berfungsi sebagai pengenalan kota Jakarta dengan keliling. Menyediakan tur wisata untuk mengenal berbagai destinasi Jakarta.',
            icon: 'mdi:camera',
            color: '#6f42c1',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Wisata') || 
                route.route_desc?.includes('Wisata') ||
                route.route_short_name?.startsWith('W')
            ).length
        },
        {
            name: 'MikroTrans',
            description: 'Berfungsi sebagai pengumpan atau feeder bagi penumpang Transjakarta yang ingin ke halte Transjakarta. Biasanya ke kampung-kampung atau daerah yang sulit dijangkau bus besar/medium, berbentuk angkot yang dimodifikasi agar semakin nyaman.',
            icon: 'mdi:bus-clock',
            color: '#fd7e14',
            count: gtfsRoutes.filter(route => 
                route.route_long_name?.includes('Mikro') || 
                route.route_desc?.includes('Mikro') ||
                route.route_short_name?.startsWith('M') ||
                route.route_short_name?.startsWith('MT')
            ).length
        }
    ];

    categories.forEach((category, idx) => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'col-lg-6 col-md-6 col-sm-12';
        const routesBoxId = 'cat-routes-' + idx;
        categoryCard.innerHTML = `
            <div class="category-card" data-category-name="${category.name}">
                <div class="category-header" style="cursor:pointer;">
                    <div class="category-icon" style="background: ${category.color}">
                        <iconify-icon icon="${category.icon}"></iconify-icon>
                    </div>
                    <div>
                        <h6 class="category-title">${category.name}</h6>
                        <p class="category-count">${category.count} rute tersedia</p>
                    </div>
                    <div class="ms-auto small text-muted d-none d-md-block">Klik untuk lihat daftar</div>
                </div>
                <p class="category-description mb-2">${category.description}</p>
                <div id="${routesBoxId}" class="category-routes" style="display:none; margin-top:6px; max-height:320px; overflow:auto;">
                    <!-- route list populated on first open -->
                </div>
            </div>
        `;
        categoriesContainer.appendChild(categoryCard);

        // Bind toggle & lazy populate
        const cardEl = categoryCard.querySelector('.category-card');
        const boxEl = categoryCard.querySelector('#' + routesBoxId);
        if (cardEl && boxEl) {
            cardEl.addEventListener('click', (ev) => {
                // Avoid toggling when clicking inside a link (if any later)
                if (ev.target && (ev.target.closest && ev.target.closest('.route-item-link'))) return;
                const isShown = boxEl.style.display !== 'none';
                if (!isShown && !boxEl.dataset.loaded) {
                    const list = document.createElement('div');
                    list.className = 'list-group list-group-flush';
                    const routes = filterRoutesByCategoryName(category.name);
                    routes.forEach(r => {
                        const short = (r.route_short_name || '').trim();
                        const long = (r.route_long_name || '').trim();
                        const color = r.route_color ? ('#' + r.route_color) : '#6c757d';
                        const rid = (r.route_id || '').trim();
                        const item = document.createElement('a');
                        item.className = 'list-group-item d-flex align-items-center gap-2 route-item-link';
                        item.href = `index.html?route_id=${encodeURIComponent(rid)}`;
                        item.innerHTML = `
                            <span class="badge" style="background:${color};color:#fff;min-width:38px;text-align:center;">${short || '-'}</span>
                            <div class="flex-grow-1">
                                <div class="small fw-semibold">${short ? ('Rute ' + short) : 'Rute'}</div>
                                <div class="small text-muted">${long || '&nbsp;'}</div>
                            </div>
                        `;
                        list.appendChild(item);
                    });
                    if (routes.length === 0) {
                        const empty = document.createElement('div');
                        empty.className = 'text-muted small';
                        empty.textContent = 'Tidak ada rute.';
                        boxEl.appendChild(empty);
                    } else {
                        boxEl.appendChild(list);
                    }
                    boxEl.dataset.loaded = '1';
                }
                boxEl.style.display = isShown ? 'none' : '';
            });
        }
    });
}

function filterRoutesByCategoryName(name) {
    const n = String(name || '').toLowerCase();
    if (n.includes('brt')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('BRT') ||
            route.route_desc?.includes('BRT') ||
            route.route_long_name?.includes('Koridor') ||
            route.route_desc?.includes('Koridor') ||
            (route.route_short_name && /^[1-9]$|^1[0-3]$/.test(route.route_short_name) && (route.route_long_name?.includes('Transjakarta') || route.route_desc?.includes('Transjakarta')))
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('rusun')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Rusun') ||
            route.route_desc?.includes('Rusun') ||
            route.route_short_name?.startsWith('R')
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('angkutan umum integrasi')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Integrasi') ||
            route.route_desc?.includes('Integrasi') ||
            route.route_short_name?.startsWith('I')
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('royaltrans')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Royal') ||
            route.route_desc?.includes('Royal') ||
            route.route_short_name?.startsWith('RT')
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('transjabodetabek')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Jabodetabek') ||
            route.route_desc?.includes('Jabodetabek') ||
            route.route_long_name?.includes('Bekasi') ||
            route.route_long_name?.includes('Depok') ||
            route.route_long_name?.includes('Bogor') ||
            route.route_long_name?.includes('Tangerang') ||
            route.route_short_name?.startsWith('TJ')
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('bus wisata')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Wisata') ||
            route.route_desc?.includes('Wisata') ||
            route.route_short_name?.startsWith('W')
        ).sort(sortRoutesByShortName);
    }
    if (n.includes('mikrotrans')) {
        return gtfsRoutes.filter(route => 
            route.route_long_name?.includes('Mikro') ||
            route.route_desc?.includes('Mikro') ||
            route.route_short_name?.startsWith('M') ||
            route.route_short_name?.startsWith('MT')
        ).sort(sortRoutesByShortName);
    }
    return [];
}

function sortRoutesByShortName(a, b) {
    const sa = (a.route_short_name || '').trim();
    const sb = (b.route_short_name || '').trim();
    // numeric-first sort where possible
    const na = parseInt(sa, 10);
    const nb = parseInt(sb, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return sa.localeCompare(sb);
}

function getCategoryIcon(category) {
    const iconMap = {
        'BRT': 'mdi:bus',
        'Rusun': 'mdi:home-city',
        'Angkutan Umum Integrasi': 'mdi:bus-multiple',
        'Royaltrans': 'mdi:bus-clock',
        'Lainnya': 'mdi:routes'
    };
    
    return iconMap[category] || 'mdi:routes';
}

function getCategoryColor(category) {
    const colorMap = {
        'BRT': '#264697',
        'Rusun': '#e74c3c',
        'Angkutan Umum Integrasi': '#27ae60',
        'Royaltrans': '#f39c12',
        'Lainnya': '#95a5a6'
    };
    
    return colorMap[category] || '#95a5a6';
}

function showGTFSError() {
    const errorMessage = `
        <div class="alert alert-warning" role="alert">
            <iconify-icon icon="mdi:alert-circle"></iconify-icon>
            <strong>Peringatan:</strong> Data GTFS tidak dapat dimuat. Pastikan file GTFS tersedia di folder gtfs/.
        </div>
    `;
    
    const container = document.querySelector('.transjakarta-gtfs-section');
    if (container) {
        container.insertAdjacentHTML('afterbegin', errorMessage);
    }
} 