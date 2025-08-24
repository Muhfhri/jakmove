// Route Manager Module
export class RouteManager {
    constructor() {
        this.selectedRouteId = null;
        this.selectedRouteVariant = null;
        this.lastRouteId = null;
        this._cache = new Map(); // cache per route|variant
        // Manual intermodal mapping: key = stop_id or exact stop_name, value = array of modes ['MRT','LRT','KRL']
        this._intermodalByStopKey = {};
    }

    // Select a route
    selectRoute(routeId) {
        if (!routeId) {
            this.resetRoute();
            return;
        }

        this.selectedRouteId = routeId;
        this.saveActiveRouteId(routeId);
        localStorage.setItem('activeRouteId', routeId);
        
        // Reset variant when changing routes
        if (this.lastRouteId !== routeId) {
            this.selectedRouteVariant = null;
            this.lastRouteId = routeId;
        }

        // Before updating, close any popup and temp layers
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            if (typeof mapManager.closePopupAndTemp === 'function') {
                mapManager.closePopupAndTemp();
            } else if (typeof mapManager.closePopup === 'function') {
                mapManager.closePopup();
            }
        }

        // Update UI
        this.updateRouteDropdowns();
        this.renderRouteInfo();
        this.showStopsByRoute(routeId);
        
        // Update map
        this.updateMapRoute();

        // If location is active and user has a last stop context, activate live service from that stop
        try {
            const loc = window.transJakartaApp.modules.location;
            const gtfs = window.transJakartaApp.modules.gtfs;
            if (loc && loc.isActive && window.lastStopId) {
                const stop = gtfs.getStops().find(s => s.stop_id === window.lastStopId);
                if (stop) loc.activateLiveServiceFromStop(stop, routeId);
            }
        } catch (e) {
            console.warn('[RouteManager] live service activation skipped:', e);
        }
    }

    // Reset route selection
    resetRoute() {
        this.selectedRouteId = null;
        this.selectedRouteVariant = null;
        this.lastRouteId = null;
        this.saveActiveRouteId(null);
        
        // Clear UI
        this.clearRouteInfo();
        this.clearMapRoute();
    }

    // Select route variant
    selectRouteVariant(variant) {
        this.selectedRouteVariant = variant;
        
        // Save to localStorage
        if (this.selectedRouteId) {
            const localVarKey = 'selectedRouteVariant_' + this.selectedRouteId;
            localStorage.setItem(localVarKey, variant || '');
        }
        
        // Update UI
        this.updateVariantDropdowns();
        this.renderRouteInfo();
        this.showStopsByRoute(this.selectedRouteId);
    }

    // Update route dropdowns
    updateRouteDropdowns() {
        // Main dropdown
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) {
            mainDropdown.value = this.selectedRouteId;
        }

        // Map dropdown via UI manager
        try {
            const ui = window.transJakartaApp.modules.ui;
            if (ui && typeof ui.updateRouteDropdowns === 'function') {
                ui.updateRouteDropdowns(this.selectedRouteId);
            } else {
                // Fallback direct
                const mapDropdown = document.getElementById('mapRouteDropdown');
                if (mapDropdown) mapDropdown.value = this.selectedRouteId;
            }
        } catch (e) {}
    }

    // Update variant dropdowns
    updateVariantDropdowns() {
        // Map variant dropdown
        const mapVariantDropdown = document.getElementById('mapRouteVariantDropdown');
        if (mapVariantDropdown) {
            mapVariantDropdown.value = this.selectedRouteVariant || '';
        }

        // Stops variant dropdown
        const stopsVariantDropdown = document.getElementById('stopsVariantDropdown');
        if (stopsVariantDropdown) {
            stopsVariantDropdown.value = this.selectedRouteVariant || '';
        }
    }

    // Render route information
    renderRouteInfo() {
        if (!this.selectedRouteId) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === this.selectedRouteId);
        
        if (!route) return;

        const title = document.getElementById('stopsTitle');
        if (!title) return;

        const routeInfo = this.buildRouteInfoHTML(route);
        title.innerHTML = routeInfo;
        title.className = 'fs-3 fw-bold plus-jakarta-sans';

        // Setup variant dropdown if needed
        this.setupVariantDropdown(route);
    }

    // Build route info HTML
    buildRouteInfoHTML(route) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const variantInfo = this.getRouteVariants(trips);
        const variants = Object.keys(variantInfo).sort(
            (a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        let variantDropdownHTML = '';
        if (variants.length > 1) {
            variantDropdownHTML = this.buildVariantDropdownHTML(variants, variantInfo);
        }

        const serviceInfo = this.buildServiceInfoHTML(route, trips);
        
        return `
            <div class='route-info-card'>
                <div class='route-info-header'>
                    ${this.buildRouteBadgeHTML(route)}
                    ${this.buildRouteJurusanHTML(route)}
                    ${this.buildServiceTypeHTML(route)}
                    ${this.buildShareRouteButton(route)}
                </div>
                <div class='route-info-main'>
                    <div class='route-info-details'>
                        <div class='route-info-details-content'>
                            ${serviceInfo}
                        </div>
                    </div>
                </div>
            </div>
            ${variantDropdownHTML}
        `;
    }

    // NEW: Build combined service info HTML (days, hours, frequency, fare, length)
    buildServiceInfoHTML(route, trips) {
        const parts = [];
        parts.push(this.buildOperatingDaysHTML(trips));
        parts.push(this.buildOperatingHoursHTML(trips));
        parts.push(this.buildFrequencyHTML(trips));
        parts.push(this.buildFareHTML(route));
        parts.push(this.buildRouteLengthHTML(trips));
        return parts.filter(Boolean).join('');
    }

    // Build route badge HTML
    buildRouteBadgeHTML(route) {
        const badgeText = route.route_short_name || route.route_id || '';
        const badgeColor = route.route_color ? ('#' + route.route_color) : '#264697';
        
        return `
            <div class='route-badge-container'>
                <span class='badge badge-koridor-interaktif rounded-pill me-2' 
                      style='background:${badgeColor};color:#fff;font-weight:bold;font-size:2rem !important;padding:0.8em 1.6em;box-shadow:0 4px 15px rgba(38,70,151,0.2);border-radius:2em;letter-spacing:2px;'>
                    ${badgeText}
                </span>
            </div>
        `;
    }

    // Build route jurusan HTML
    buildRouteJurusanHTML(route) {
        if (!route.route_long_name) return '';
        
        // Check if route has via
        const hasVia = route.route_long_name.toLowerCase().includes('via');
        const routeName = hasVia ? route.route_long_name.split('via')[0].trim() : route.route_long_name;
        const viaInfo = hasVia ? route.route_long_name.split('via')[1].trim() : null;
        
        return `
            <div class='route-jurusan-container text-center'>
                <h3 class='route-jurusan pt-sans fw-bold mb-1' style='font-size: 1.8rem;'>${routeName}</h3>
                ${hasVia ? `<div class='route-via-info pt-sans' style='font-size: 1rem; margin-bottom: 0.5rem;'><strong>VIA ${viaInfo.toUpperCase()}</strong></div>` : ''}
            </div>
        `;
    }

    // Build service type HTML
    buildServiceTypeHTML(route) {
        if (!route.route_desc) return '';

        let serviceType = route.route_desc;
        if (route.route_id && route.route_id.startsWith('JAK.') && 
            serviceType.trim() === 'Angkutan Umum Integrasi') {
            serviceType = 'MikroTrans';
        }

        const serviceTypeMap = {
            'BRT': 'Bus Rapid Transit',
            'TransJakarta': 'Bus Rapid Transit',
            'Angkutan Umum Integrasi': 'Angkutan Umum Integrasi',
            'MikroTrans': 'MikroTrans',
            'Royal Trans': 'Royal Trans',
            'Bus Wisata': 'Bus Wisata'
        };

        const displayServiceType = serviceTypeMap[serviceType] || serviceType;
        
        let serviceBadgeClass = 'bg-primary';
        if (serviceType.includes('BRT') || serviceType.includes('TransJakarta')) {
            serviceBadgeClass = 'bg-primary';
        } else if (serviceType.includes('Angkutan Umum Integrasi')) {
            serviceBadgeClass = 'bg-warning';
        } else if (serviceType.includes('Royal')) {
            serviceBadgeClass = 'bg-success text-dark';
        } else if (serviceType.includes('Wisata')) {
            serviceBadgeClass = 'bg-danger';
        } else if (serviceType.includes('Rusun')) {
            serviceBadgeClass = 'bg-secondary';
        } else if (serviceType.includes('Mikro')) {
            serviceBadgeClass = 'bg-info';
        }

        return `
            <div class='service-type-container text-center'>
                <span class='badge ${serviceBadgeClass} fs-6 px-3 py-2 rounded-pill' style='font-weight: 600; letter-spacing: 0.5px; margin-top: 0.5rem;'>
                ${displayServiceType}
            </span>
            </div>
        `;
    }

    infoIconLink(url, title) {
        if (!url) return '';
        return `<a href="${url}" target="_blank" title="${title}" class="info-link" style="margin-left:6px; text-decoration:none; display:inline-flex; align-items:center;"><iconify-icon icon="mdi:information-outline" inline></iconify-icon></a>`;
    }

    // Build share route button HTML
    buildShareRouteButton(route) {
        return `
            <div class='share-route-container mt-3'>
                <button class='btn btn-outline-primary btn-lg share-route-btn' 
                        onclick="window.transJakartaApp.modules.routes.shareRoute('${route.route_id}')"
                        style='border-radius: 25px; padding: 12px 24px; font-weight: 600;'>
                    <iconify-icon icon="mdi:share-variant" inline style="margin-right: 8px;"></iconify-icon>
                    Bagikan Rute
                </button>
            </div>
        `;
    }

    // Share route functionality
    shareRoute(routeId) {
        console.log('shareRoute called with routeId:', routeId);
        
        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeId);
        
        if (!route) {
            console.error('Route not found:', routeId);
            return;
        }
        
        console.log('Route found:', route);

        const routeInfo = {
            routeId: route.route_id,
            routeName: route.route_short_name || route.route_id,
            routeLongName: route.route_long_name || '',
            routeType: route.route_desc || 'Bus Rapid Transit',
            url: window.location.href.split('?')[0] + '?route_id=' + routeId
        };

        // Get additional route information
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const variantInfo = this.getRouteVariants(trips);
        const variants = Object.keys(variantInfo).sort(
            (a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );
        
        // Get operating hours
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        const tripIds = trips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        let operatingHours = '';
        if (freqsForRoute.length > 0) {
            const startTimes = freqsForRoute.map(f => f.start_time).filter(Boolean);
            const endTimes = freqsForRoute.map(f => f.end_time).filter(Boolean);
            if (startTimes.length > 0 && endTimes.length > 0) {
                const minStart = startTimes.reduce((a, b) => this.timeToSeconds(a) < this.timeToSeconds(b) ? a : b);
                const maxEnd = endTimes.reduce((a, b) => this.timeToSeconds(a) > this.timeToSeconds(b) ? a : b);
                operatingHours = `Jam Operasi: ${this.formatOperatingHours(minStart, maxEnd)}`;
            }
        }

        // Get service days for share text
        const serviceIds = Array.from(new Set(trips.map(t => t.service_id)));
        const serviceIdMap = {
            'SH': 'Setiap Hari',
            'HK': 'Hari Kerja',
            'HL': 'Hari Libur',
            'HM': 'Hanya Minggu',
            'X': 'Khusus',
        };
        const operatingDays = serviceIds.map(sid => serviceIdMap[sid] || sid).join(' / ');

        // Create share text with complete information
        const shareText = `JakMove - Transjakarta Fan Made Website

📱 ${routeInfo.routeName} - ${routeInfo.routeLongName}
🏢 ${routeInfo.routeType}
💰 Tarif: ${this.getFareInfo(route.route_id)}
⏰ ${operatingHours}
📅 ${operatingDays}

🔗 Link Rute: ${routeInfo.url}
🌐 github.com/muhfhri/jakmove

#INTEGRASI #KINILEBIHBAIK #JakLingko`;

        // Always show modal first for better user experience
        // Web Share API can be accessed from within the modal if needed
        this.showShareOptions(routeInfo, shareText);
    }

    // Show share options modal
    showShareOptions(routeInfo, shareText) {
        // Get route object for card generation
        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeInfo.routeId);
        
        if (!route) {
            console.error('Route not found for card generation');
            return;
        }
        // Remove existing modal if any
        const existingModal = document.getElementById('shareRouteModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHTML = `
            <div class="modal fade" id="shareRouteModal" tabindex="-1" aria-labelledby="shareRouteModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content border-0 shadow-lg">
                        <div class="modal-header bg-primary text-white border-0">
                            <h5 class="modal-title fw-bold" id="shareRouteModalLabel">
                                <iconify-icon icon="mdi:share-variant" inline style="margin-right: 12px; font-size: 1.2em;"></iconify-icon>
                                Bagikan Rute ${routeInfo.routeName}
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body p-4">
                            <!-- Route Preview -->
                            <div class="route-preview mb-4">
                                <div class="route-preview-header text-center mb-3">
                                    <h6 class="text-primary fw-semibold mb-3">
                                        <iconify-icon icon="mdi:eye" inline style="margin-right: 8px;"></iconify-icon>
                                        Preview Kartu Rute
                                        <small class="d-block text-muted mt-1" style="font-size: 0.8rem;">
                                            <iconify-icon icon="mdi:arrow-up-down" inline style="margin-right: 4px;"></iconify-icon>
                                            Geser untuk melihat seluruh konten
                                        </small>
                                    </h6>
                                    <div class="route-preview-content p-0 bg-gradient-light rounded-3 border overflow-hidden">
                                        <div class="route-preview-scrollable" style="max-height: 400px; overflow-y: auto; padding: 20px;">
                                            <div class="route-card" id="routeCard_${routeInfo.routeId}" style="width: 100%; max-width: 380px; margin: 0 auto;">
                                                <!-- Route card content will be generated here -->
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="share-options">
                                <h6 class="text-center text-muted mb-3 fw-semibold">
                                    <iconify-icon icon="mdi:share-variant-outline" inline style="margin-right: 8px;"></iconify-icon>
                                    Pilih Metode Berbagi
                                </h6>
                                <p class="text-center text-muted mb-4" style="font-size: 0.9rem;">
                                    <iconify-icon icon="mdi:information-outline" inline style="margin-right: 4px;"></iconify-icon>
                                    Pilih metode berbagi yang paling sesuai dengan kebutuhan Anda
                                </p>
                                
                                <!-- Image Share Options -->
                                <div class="share-option" onclick="window.transJakartaApp.modules.routes.downloadRouteImage('${routeInfo.routeId}', this)">
                                    <div class="share-option-icon bg-warning bg-opacity-10 text-warning">
                                        <iconify-icon icon="mdi:download" inline></iconify-icon>
                                    </div>
                                    <div class="share-option-text">
                                        <div class="share-option-title">Download Gambar</div>
                                        <div class="share-option-desc">Simpan kartu rute sebagai gambar</div>
                                    </div>
                                </div>
                                
                                <div class="share-option" onclick="window.transJakartaApp.modules.routes.nativeShare('${routeInfo.routeName}', '${encodeURIComponent(shareText)}', '${routeInfo.url}', this)">
                                    <div class="share-option-icon bg-secondary bg-opacity-10 text-secondary">
                                        <iconify-icon icon="mdi:share-variant" inline></iconify-icon>
                                    </div>
                                    <div class="share-option-text">
                                        <div class="share-option-title">Bagikan</div>
                                        <div class="share-option-desc">Gunakan fitur share sistem</div>
                                    </div>
                                </div>
                                
                                <div class="share-option" onclick="window.transJakartaApp.modules.routes.shareRouteTextToWhatsApp('${routeInfo.routeId}', '${routeInfo.routeName}', this, '${encodeURIComponent(shareText)}')">
                                    <div class="share-option-icon bg-success bg-opacity-10 text-success">
                                        <iconify-icon icon="mdi:whatsapp" inline></iconify-icon>
                                    </div>
                                    <div class="share-option-text">
                                        <div class="share-option-title">Bagikan di WhatsApp</div>
                                        <div class="share-option-desc">Bagikan teks rute ke WhatsApp</div>
                                    </div>
                                </div>
                                
                                <div class="share-option" onclick="window.transJakartaApp.modules.routes.shareRouteTextToTelegram('${routeInfo.routeId}', '${routeInfo.routeName}', this, '${encodeURIComponent(shareText)}', '${encodeURIComponent(routeInfo.url)}')">
                                    <div class="share-option-icon bg-primary bg-opacity-10 text-primary">
                                        <iconify-icon icon="mdi:telegram" inline></iconify-icon>
                                    </div>
                                    <div class="share-option-text">
                                        <div class="share-option-title">Bagikan di Telegram</div>
                                        <div class="share-option-desc">Bagikan teks rute ke Telegram</div>
                                    </div>
                                </div>
                                

                            </div>
                        </div>
                        <div class="modal-footer border-0 pt-0">
                            <button type="button" class="btn btn-outline-secondary px-4 py-2 rounded-pill" data-bs-dismiss="modal">
                                <iconify-icon icon="mdi:close" inline style="margin-right: 8px;"></iconify-icon>
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Show modal
        try {
            const modal = new bootstrap.Modal(document.getElementById('shareRouteModal'));
            modal.show();
            
            // Generate route card after modal is shown
            setTimeout(() => {
                this.generateRouteCard(routeInfo, route);
            }, 100);
        } catch (error) {
            console.error('Error showing modal:', error);
            // Fallback: show alert with share options
            alert(`Bagikan Rute ${routeInfo.routeName}:\n\n${shareText}`);
        }
    }

    // Generate route card for sharing
    generateRouteCard(routeInfo, route) {
        const cardContainer = document.getElementById(`routeCard_${routeInfo.routeId}`);
        if (!cardContainer) return;

        // Get additional route information
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        const tripIds = trips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        // Get operating hours
        let operatingHours = 'Tidak tersedia';
        if (freqsForRoute.length > 0) {
            const startTimes = freqsForRoute.map(f => f.start_time).filter(Boolean);
            const endTimes = freqsForRoute.map(f => f.end_time).filter(Boolean);
            if (startTimes.length > 0 && endTimes.length > 0) {
                const minStart = startTimes.reduce((a, b) => this.timeToSeconds(a) < this.timeToSeconds(b) ? a : b);
                const maxEnd = endTimes.reduce((a, b) => this.timeToSeconds(a) > this.timeToSeconds(b) ? a : b);
                operatingHours = this.formatOperatingHours(minStart, maxEnd);
            }
        }

        // Get operating days
        const serviceIds = Array.from(new Set(trips.map(t => t.service_id)));
        const serviceIdMap = {
            'SH': 'Setiap Hari',
            'HK': 'Hari Kerja',
            'HL': 'Hari Libur',
            'HM': 'Hanya Minggu',
            'X': 'Khusus',
        };
        const operatingDays = serviceIds.map(sid => serviceIdMap[sid] || sid).join(' / ');

        // Get fare info
        const fareInfo = this.getFareInfo(route.route_id) || 'Tidak tersedia';

        // Get frequency info
        let frequencyInfo = 'Tidak tersedia';
        if (freqsForRoute.length > 0) {
            const avgHeadway = freqsForRoute.reduce((sum, f) => sum + (parseInt(f.headway_secs) || 0), 0) / freqsForRoute.length;
            if (avgHeadway > 0) {
                const minutes = Math.round(avgHeadway / 60);
                frequencyInfo = `Setiap ${minutes} menit`;
            }
        }

        // Create route card HTML - Improved layout
        const routeCardHTML = `
            <div class="route-card-container" style="width: 380px; background: white; border: 2px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header dengan badge warna rute -->
                <div class="route-card-header" style="background: ${route.route_color ? '#' + route.route_color : '#3b82f6'}; color: white; padding: 24px 20px; text-align: center;">
                    <div class="route-badge" style="background: white; color: ${route.route_color ? '#' + route.route_color : '#3b82f6'}; border-radius: 12px; padding: 10px 20px; font-size: 1.8rem; font-weight: bold; display: inline-block; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">
                        ${routeInfo.routeName}
                    </div>
                    <div class="route-jurusan" style="font-size: 1.3rem; font-weight: 600; line-height: 1.4; color: white; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5); max-width: 320px; margin: 0 auto;">
                        ${routeInfo.routeLongName && routeInfo.routeLongName.toLowerCase().includes('via') ? 
                            routeInfo.routeLongName.split('via')[0].trim() : 
                            (routeInfo.routeLongName || 'Tidak tersedia')
                        }
                    </div>
                    ${routeInfo.routeLongName && routeInfo.routeLongName.toLowerCase().includes('via') ? 
                        `<div class="route-via pt-sans" style="font-size: 1rem; margin-top: 8px; color: white; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);">
                            <strong>VIA ${routeInfo.routeLongName.split('via')[1].trim().toUpperCase()}</strong>
                        </div>` : ''
                    }
                    <div class="route-service-type" style="font-size: 1rem; font-weight: 500; line-height: 1.3; color: rgba(255, 255, 255, 0.9); margin-top: 12px; padding: 6px 16px; background: rgba(255, 255, 255, 0.15); border-radius: 20px; display: inline-block; backdrop-filter: blur(10px);">
                        ${routeInfo.routeType}
                    </div>
                </div>
                
                <!-- Body dengan informasi rute -->
                <div class="route-card-body" style="padding: 24px 20px; background: white;">
                    <div class="route-info-list" style="display: flex; flex-direction: column; gap: 14px;">
                        <div class="route-info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #3b82f6;">
                            <span style="font-weight: 600; color: #374151; font-size: 0.95rem;">Tarif:</span>
                            <span style="font-weight: 600; color: #1f2937; font-size: 0.95rem;">${fareInfo}</span>
                        </div>
                        
                        <div class="route-info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #10b981;">
                            <span style="font-weight: 600; color: #374151; font-size: 0.95rem;">Jam Operasi:</span>
                            <span style="font-weight: 600; color: #1f2937; font-size: 0.95rem;">${operatingHours}</span>
                        </div>
                        
                        <div class="route-info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #f59e0b;">
                            <span style="font-weight: 600; color: #374151; font-size: 0.95rem;">Hari Operasi:</span>
                            <span style="font-weight: 600; color: #1f2937; font-size: 0.95rem;">${operatingDays}</span>
                        </div>
                        
                        <div class="route-info-item" style="display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #8b5cf6;">
                            <span style="font-weight: 600; color: #374151; font-size: 0.95rem;">Frekuensi:</span>
                            <span style="font-weight: 600; color: #1f2937; font-size: 0.95rem;">${frequencyInfo}</span>
                        </div>
                    </div>
                    
                    <!-- Web Info section -->
                    <div class="route-web-section" style="text-align: center; margin-top: 24px; padding: 20px; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 12px; border: 1px solid #e2e8f0;">
                        <div class="web-info" style="text-align: center; margin-bottom: 12px;">
                            <div style="font-size: 1.2rem; color: #3b82f6; font-weight: 700; margin-bottom: 6px; font-family: 'PT Sans Narrow', sans-serif; letter-spacing: 0.5px;">github.com/muhfhri/jakmove</div>
                            <div style="font-size: 1rem; color: #64748b; font-weight: 500; font-family: 'PT Sans Narrow', sans-serif; font-style: italic;">Smart Transit Experience</div>
                        </div>
                        <div class="web-url" style="margin-top: 8px;">
                            <a href="https://github.com/muhfhri/jakmove" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 8px 16px; background: white; border-radius: 8px; border: 1px solid #e2e8f0; transition: all 0.2s ease;">
                                🔗 Lihat di GitHub
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        cardContainer.innerHTML = routeCardHTML;
    }

    // Get fare information
    getFareInfo(routeId) {
        try {
            const fareRules = window.transJakartaApp.modules.gtfs.getFareRules();
            const fareAttributes = window.transJakartaApp.modules.gtfs.getFareAttributes();
            
            const routeFare = fareRules.find(rule => rule.route_id === routeId);
            if (routeFare) {
                const fare = fareAttributes.find(attr => attr.fare_id === routeFare.fare_id);
                if (fare && fare.price) {
                    return `Rp ${parseInt(fare.price).toLocaleString('id-ID')}`;
                }
            }
            
            // Default fare for TransJakarta
            return 'Rp 3.500';
        } catch (error) {
            return 'Rp 3.500';
        }
    }

    // Download route image
    downloadRouteImage(routeId, buttonElement) {
        const hasButton = !!buttonElement;
        let originalContent = '';
        if (hasButton) {
            // Show loading state on button
            originalContent = buttonElement.innerHTML;
            buttonElement.innerHTML = `
                <div class="share-option-icon bg-warning bg-opacity-10 text-warning">
                    <div class="spinner-border spinner-border-sm text-warning" role="status"></div>
                </div>
                <div class="share-option-text">
                    <div class="share-option-title">Membuat Gambar...</div>
                    <div class="share-option-desc">Mohon tunggu sebentar</div>
                </div>
            `;
            buttonElement.style.pointerEvents = 'none';
        }

        this.generateRouteImage(routeId).then(canvas => {
            if (!canvas) {
                this.showError('Gagal membuat gambar. Silakan coba lagi.');
                if (hasButton) {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.style.pointerEvents = 'auto';
                }
                return;
            }
            try {
                canvas.toBlob((blob) => {
                    if (!blob) {
                        throw new Error('Blob kosong dari canvas');
                    }
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `rute-${routeId}-transjakarta.png`;
                    link.href = url;
                    document.body.appendChild(link);
                    link.click();
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                        link.remove();
                    }, 0);

                    if (hasButton) {
                        // Show success state briefly
                        buttonElement.innerHTML = `
                            <div class="share-option-icon bg-success bg-opacity-10 text-success">
                                <iconify-icon icon="mdi:check" inline></iconify-icon>
                            </div>
                            <div class="share-option-text">
                                <div class="share-option-title">Berhasil!</div>
                                <div class="share-option-desc">Gambar telah di-download</div>
                            </div>
                        `;
                        // Restore original content after 2 seconds
                        setTimeout(() => {
                            buttonElement.innerHTML = originalContent;
                            buttonElement.style.pointerEvents = 'auto';
                        }, 2000);
                    }
                }, 'image/png');
            } catch (error) {
                console.error('Error downloading image:', error);
                this.showError('Gagal mengunduh gambar. Silakan coba lagi.');
                if (hasButton) {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.style.pointerEvents = 'auto';
                }
            }
        }).catch(error => {
            console.error('Error in downloadRouteImage:', error);
            this.showError('Terjadi kesalahan. Silakan coba lagi.');
            if (hasButton) {
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }
        });
    }

    // Share route image using Web Share API
    shareRouteImage(routeId, routeName, buttonElement) {
        if (!buttonElement) return;
        
        // Show loading state on button
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <div class="share-option-icon bg-success bg-opacity-10 text-success">
                <div class="spinner-border spinner-border-sm text-success" role="status"></div>
            </div>
            <div class="share-option-text">
                <div class="share-option-title">Membuat Gambar...</div>
                <div class="share-option-desc">Mohon tunggu sebentar</div>
            </div>
        `;
        buttonElement.style.pointerEvents = 'none';

        this.generateRouteImage(routeId).then(canvas => {
            if (canvas) {
                canvas.toBlob(blob => {
                    if (navigator.share && navigator.canShare) {
                        const file = new File([blob], `rute-${routeId}.png`, { type: 'image/png' });
                        navigator.share({
                            title: `Rute ${routeName} - TransJakarta`,
                            text: `Kartu rute ${routeName} TransJakarta`,
                            files: [file]
                        }).catch(err => {
                            console.log('Share failed:', err);
                            this.downloadRouteImage(routeId);
                        });
                    } else {
                        this.downloadRouteImage(routeId);
                    }
                });
                
                // Restore button content
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            } else {
                this.showError('Gagal membuat gambar untuk dibagikan.');
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }
        }).catch(error => {
            console.error('Error in shareRouteImage:', error);
            this.showError('Terjadi kesalahan saat membagikan gambar.');
            buttonElement.innerHTML = originalContent;
            buttonElement.style.pointerEvents = 'auto';
        });
    }

    // Share route text to WhatsApp/Telegram
    shareRouteTextToWhatsApp(routeId, routeName, buttonElement, shareText) {
        if (!buttonElement) return;
        
        // Show loading state on button
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <div class="share-option-icon bg-success bg-opacity-10 text-success">
                <div class="spinner-border spinner-border-sm text-success" role="status"></div>
            </div>
            <div class="share-option-text">
                <div class="share-option-title">Membuka WhatsApp...</div>
                <div class="share-option-desc">Mohon tunggu sebentar</div>
            </div>
        `;
        buttonElement.style.pointerEvents = 'none';

        try {
            // Decode the share text
            const decodedText = decodeURIComponent(shareText);
            
            // Create WhatsApp share URL
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(decodedText)}`;
            
            // Open WhatsApp in new tab
            window.open(whatsappUrl, '_blank');
            
            // Show success state briefly
            buttonElement.innerHTML = `
                <div class="share-option-icon bg-success bg-opacity-10 text-success">
                    <iconify-icon icon="mdi:check" inline style="color: #10b981;"></iconify-icon>
                </div>
                <div class="share-option-text">
                    <div class="share-option-title">Berhasil!</div>
                    <div class="share-option-desc">WhatsApp telah dibuka</div>
                </div>
            `;
            
            // Restore original content after 2 seconds
            setTimeout(() => {
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }, 2000);
            
        } catch (error) {
            console.error('Error in shareRouteTextToWhatsApp:', error);
            this.showError('Terjadi kesalahan saat membuka WhatsApp.');
            buttonElement.innerHTML = originalContent;
            buttonElement.style.pointerEvents = 'auto';
        }
    }

    // Native share using Web Share API
    nativeShare(routeName, shareText, routeUrl, buttonElement) {
        if (!buttonElement) return;
        
        // Check if Web Share API is available
        if (!navigator.share || !navigator.canShare) {
            this.showError('Native share tidak tersedia di browser ini. Gunakan opsi share lainnya.');
            return;
        }
        
        // Show loading state on button
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <div class="share-option-icon bg-secondary bg-opacity-10 text-secondary">
                <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            </div>
            <div class="share-option-text">
                <div class="share-option-title">Membuka Share...</div>
                <div class="share-option-desc">Mohon tunggu sebentar</div>
            </div>
        `;
        buttonElement.style.pointerEvents = 'none';

        try {
            // Decode the share text and URL
            const decodedText = decodeURIComponent(shareText);
            const decodedUrl = decodeURIComponent(routeUrl);
            
            // Use Web Share API
            navigator.share({
                title: `Rute ${routeName} - TransJakarta`,
                text: decodedText,
                url: decodedUrl
            }).then(() => {
                // Show success state briefly
                buttonElement.innerHTML = `
                    <div class="share-option-icon bg-success bg-opacity-10 text-success">
                        <iconify-icon icon="mdi:check" inline style="color: #10b981;"></iconify-icon>
                    </div>
                    <div class="share-option-text">
                        <div class="share-option-title">Berhasil!</div>
                        <div class="share-option-desc">Share dialog telah dibuka</div>
                    </div>
                `;
                
                // Restore original content after 2 seconds
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.style.pointerEvents = 'auto';
                }, 2000);
                
            }).catch(err => {
                console.error('Native share failed:', err);
                this.showError('Gagal membuka native share. Gunakan opsi share lainnya.');
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            });
            
        } catch (error) {
            console.error('Error in nativeShare:', error);
            this.showError('Terjadi kesalahan saat membuka native share.');
            buttonElement.innerHTML = originalContent;
            buttonElement.style.pointerEvents = 'auto';
        }
    }

    // Share route text to Telegram
    shareRouteTextToTelegram(routeId, routeName, buttonElement, shareText, routeUrl) {
        if (!buttonElement) return;
        
        // Show loading state on button
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <div class="share-option-icon bg-primary bg-opacity-10 text-primary">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            </div>
            <div class="share-option-text">
                <div class="share-option-title">Membuka Telegram...</div>
                <div class="share-option-desc">Mohon tunggu sebentar</div>
            </div>
        `;
        buttonElement.style.pointerEvents = 'none';

        try {
            // Decode the share text and URL
            const decodedText = decodeURIComponent(shareText);
            const decodedUrl = decodeURIComponent(routeUrl);
            
            // Create Telegram share URL
            const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(decodedUrl)}&text=${encodeURIComponent(decodedText)}`;
            
            // Open Telegram in new tab
            window.open(telegramUrl, '_blank');
            
            // Show success state briefly
            buttonElement.innerHTML = `
                <div class="share-option-icon bg-primary bg-opacity-10 text-primary">
                    <iconify-icon icon="mdi:check" inline style="color: #3b82f6;"></iconify-icon>
                </div>
                <div class="share-option-text">
                    <div class="share-option-title">Berhasil!</div>
                    <div class="share-option-desc">Telegram telah dibuka</div>
                </div>
            `;
            
            // Restore original content after 2 seconds
            setTimeout(() => {
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }, 2000);
            
        } catch (error) {
            console.error('Error in shareRouteTextToTelegram:', error);
            this.showError('Terjadi kesalahan saat membuka Telegram.');
            buttonElement.innerHTML = originalContent;
            buttonElement.style.pointerEvents = 'auto';
        }
    }

    // Generate route image from HTML
    async generateRouteImage(routeId) {
        const cardElement = document.getElementById(`routeCard_${routeId}`);
        if (!cardElement) {
            console.error('Card element not found:', `routeCard_${routeId}`);
            return null;
        }
        if (!window.html2canvas) {
            console.error('HTML2Canvas not available');
            return null;
        }

        // Ensure content is present; if not, rebuild and wait a moment
        try {
            const contentLen = (cardElement.innerHTML || '').length;
            if (contentLen < 100) {
                const route = window.transJakartaApp.modules.gtfs.getRoutes().find(r => r.route_id === routeId);
                if (route) {
                    const routeInfo = {
                        routeId: route.route_id,
                        routeName: route.route_short_name || route.route_id,
                        routeLongName: route.route_long_name || '',
                        routeType: route.route_desc || 'Bus Rapid Transit',
                        url: window.location.href.split('?')[0] + '?route_id=' + routeId
                    };
                    this.generateRouteCard(routeInfo, route);
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        } catch (e) {}

        // Calculate exact size to avoid cropping on various environments
        const width = Math.max(cardElement.scrollWidth, cardElement.offsetWidth, 380);
        const height = Math.max(cardElement.scrollHeight, cardElement.offsetHeight, 600);

        const baseOpts = {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: false,
            width,
            height,
            logging: false,
            removeContainer: true,
            imageTimeout: 15000,
            onclone: (clonedDoc) => {
                const clonedElement = clonedDoc.getElementById(`routeCard_${routeId}`);
                if (clonedElement) {
                    clonedElement.style.fontFamily = "'PT Sans Narrow', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
                    clonedElement.style.height = 'auto';
                    clonedElement.style.overflow = 'visible';
                    clonedElement.style.maxHeight = 'none';
                }
            }
        };

        // Try twice: first with foreignObjectRendering true (SVG), then fallback to canvas renderer
        try {
            const canvas = await html2canvas(cardElement, { ...baseOpts, foreignObjectRendering: true });
            if (canvas) return canvas;
        } catch (err1) {
            console.warn('html2canvas FO render failed, retrying with canvas renderer:', err1);
        }
        try {
            const canvas2 = await html2canvas(cardElement, { ...baseOpts, foreignObjectRendering: false });
            if (canvas2) return canvas2;
        } catch (err2) {
            console.error('html2canvas canvas render failed:', err2);
        }
        return null;
    }

    // Build operating days HTML
    buildOperatingDaysHTML(trips) {
        const serviceIds = Array.from(new Set(trips.map(t => t.service_id)));
        if (serviceIds.length === 0) return '';

        const serviceIdMap = {
            'SH': 'Setiap Hari',
            'HK': 'Hari Kerja',
            'HL': 'Hari Libur',
            'HM': 'Hanya Minggu',
            'X': 'Khusus',
        };

        const hariText = serviceIds.map(sid => serviceIdMap[sid] || sid).join(' / ');
        const rawUrl = `gtfs-raw-viewer.html?file=calendar&service_id=${encodeURIComponent(serviceIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data calendar');
        
        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:calendar-week" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Hari Operasi</div>
                    <div class='info-value'>${hariText}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build operating hours HTML
    buildOperatingHoursHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        
        const tripIds = filteredTrips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        let startTimes = [], endTimes = [];
        if (freqsForRoute.length > 0) {
            freqsForRoute.forEach(f => {
                if (f.start_time && f.end_time) {
                    startTimes.push(f.start_time);
                    endTimes.push(f.end_time);
                }
            });
        }

        if (startTimes.length === 0 || endTimes.length === 0) {
            let stopTimesForRoute = stopTimes.filter(st => tripIds.includes(st.trip_id));
            if (stopTimesForRoute.length > 0) {
                startTimes = stopTimesForRoute.map(st => st.arrival_time).filter(Boolean);
                endTimes = stopTimesForRoute.map(st => st.departure_time).filter(Boolean);
            }
        }

        if (startTimes.length === 0 || endTimes.length === 0) return '';

        const minStart = startTimes.reduce((a, b) => this.timeToSeconds(a) < this.timeToSeconds(b) ? a : b);
        const maxEnd = endTimes.reduce((a, b) => this.timeToSeconds(a) > this.timeToSeconds(b) ? a : b);

        const rawUrl = `gtfs-raw-viewer.html?file=stop_times&trip_id=${encodeURIComponent(tripIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data stop_times');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:clock-outline" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Jam Operasi</div>
                    <div class='info-value'>${this.formatOperatingHours(minStart, maxEnd)}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build frequency HTML
    buildFrequencyHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const frequencies = window.transJakartaApp.modules.gtfs.getFrequencies();
        
        const tripIds = filteredTrips.map(t => t.trip_id);
        const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));
        
        if (freqsForRoute.length === 0) return '';

        let headwaySeconds = [];
        freqsForRoute.forEach(f => {
            if (f.min_headway_secs) headwaySeconds.push(parseInt(f.min_headway_secs));
            if (f.max_headway_secs) headwaySeconds.push(parseInt(f.max_headway_secs));
            if (f.headway_secs) headwaySeconds.push(parseInt(f.headway_secs));
        });

        let headwayMinutes = headwaySeconds
            .filter(v => !isNaN(v))
            .map(v => Math.round(v/60))
            .filter((v, i, arr) => arr.indexOf(v) === i)
            .sort((a, b) => a - b);

        const headwayText = headwayMinutes.length > 0 ? headwayMinutes.map(v => `${v} menit`).join(', ') : '-';
        const rawUrl = `gtfs-raw-viewer.html?file=frequencies&trip_id=${encodeURIComponent(tripIds.join(','))}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data frequencies');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:repeat" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Frekuensi</div>
                    <div class='info-value'>${headwayText}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build fare HTML
    buildFareHTML(route) {
        const fareRules = window.transJakartaApp.modules.gtfs.getFareRules();
        const fareAttributes = window.transJakartaApp.modules.gtfs.getFareAttributes();
        
        const fareRule = fareRules.find(fr => fr.route_id === route.route_id);
        if (!fareRule) return '';

        const fareAttr = fareAttributes.find(fa => fa.fare_id === fareRule.fare_id);
        if (!fareAttr) return '';

        const price = parseInt(fareAttr.price).toLocaleString('id-ID');
        const currency = fareAttr.currency_type === 'IDR' ? 'Rp' : (fareAttr.currency_type + ' ');
        const rawUrl = `gtfs-raw-viewer.html?file=fare_attributes&fare_id=${encodeURIComponent(fareRule.fare_id)}&route_id=${encodeURIComponent(route.route_id)}&show_rules=1`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data fare');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:ticket-percent" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Tarif</div>
                    <div class='info-value'>${currency}${price}${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build route length HTML
    buildRouteLengthHTML(trips) {
        const filteredTrips = this.getFilteredTrips(trips);
        const shapes = window.transJakartaApp.modules.gtfs.getShapes();
        
        if (filteredTrips.length === 0) return '';

        const mainShapeId = filteredTrips[0].shape_id;
        if (!mainShapeId) return '';

        const shapePoints = shapes.filter(s => s.shape_id === mainShapeId)
            .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));

        let totalLength = 0;
        for (let i = 1; i < shapePoints.length; i++) {
            const lat1 = parseFloat(shapePoints[i-1].shape_pt_lat);
            const lon1 = parseFloat(shapePoints[i-1].shape_pt_lon);
            const lat2 = parseFloat(shapePoints[i].shape_pt_lat);
            const lon2 = parseFloat(shapePoints[i].shape_pt_lon);
            totalLength += this.haversine(lat1, lon1, lat2, lon2);
        }

        if (totalLength === 0) return '';
        const rawUrl = `gtfs-raw-viewer.html?file=shapes&shape_id=${encodeURIComponent(mainShapeId)}`;
        const infoIcon = this.infoIconLink(rawUrl, 'Lihat data shapes');

        return `
            <div class='info-item mb-2'>
                <div class='info-icon'>
                    <iconify-icon icon="mdi:ruler" style="color: #264697;"></iconify-icon>
                </div>
                <div class='info-content'>
                    <div class='info-label'>Panjang Trayek</div>
                    <div class='info-value'>${(totalLength/1000).toFixed(2)} km${infoIcon}</div>
                </div>
            </div>
        `;
    }

    // Build variant dropdown HTML
    buildVariantDropdownHTML(variants, variantInfo) {
        return `
            <div class="variant-selector-stops">
                <label class="form-label">
                    <iconify-icon icon="mdi:routes"></iconify-icon>
                    Pilih Varian Trayek (Default untuk semua)
                </label>
                <select id="stopsVariantDropdown" class="form-select plus-jakarta-sans">
                    <option value="">Default (Semua Varian)</option>
                    ${variants.map(v => {
                        const trip = variantInfo[v];
                        const jurusan = trip.trip_headsign || trip.trip_long_name || '';
                        const label = v + (jurusan ? ' - ' + jurusan : '');
                        const selected = this.selectedRouteVariant === v ? 'selected' : '';
                        return `<option value="${v}" ${selected}>${label}</option>`;
                    }).join('')}
                </select>
                <div class="help-text lancip">
                    <iconify-icon icon="mdi:information-outline"></iconify-icon>
                    Pilih varian untuk melihat arah spesifik
                </div>
            </div>
        `;
    }

    // Setup variant dropdown
    setupVariantDropdown(route) {
        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === route.route_id);
        
        const variantInfo = this.getRouteVariants(trips);
        const variants = Object.keys(variantInfo).sort(
            (a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        if (variants.length > 1) {
            // Load saved variant
            const localVarKey = 'selectedRouteVariant_' + route.route_id;
            const localVar = localStorage.getItem(localVarKey);
            if (localVar && !this.selectedRouteVariant) {
                this.selectedRouteVariant = localVar;
            }

            // Setup event listener
            setTimeout(() => {
                const stopsVariantDropdown = document.getElementById('stopsVariantDropdown');
                if (stopsVariantDropdown) {
                    stopsVariantDropdown.onchange = (e) => {
                        this.selectRouteVariant(e.target.value || null);
                    };
                }
            }, 10);
        }
    }

    // Extract variant suffix from trip_id (more robust than regex \w)
    extractVariantFromTripId(tripId) {
        if (!tripId) return null;
        const idx = tripId.lastIndexOf('-');
        if (idx === -1) return null;
        const suffix = tripId.substring(idx + 1).trim();
        return suffix || null;
    }

    // Get route variants
    getRouteVariants(trips) {
        const variantInfo = {};
        trips.forEach(t => {
            const varKey = this.extractVariantFromTripId(t.trip_id);
            if (varKey) {
                if (!variantInfo[varKey]) variantInfo[varKey] = t;
            }
        });
        return variantInfo;
    }

    // Get filtered trips based on variant
    getFilteredTrips(trips) {
        if (!this.selectedRouteVariant) return trips;
        return trips.filter(t => this.extractVariantFromTripId(t.trip_id) === this.selectedRouteVariant);
    }

    // Show stops by route
    showStopsByRoute(routeId) {
        if (!routeId) {
            this.clearStopsList();
            return;
        }

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === routeId);
        
        if (!route) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        const filteredTrips = this.getFilteredTrips(trips);
        const allStops = this.getStopsForRoute(filteredTrips);
        
        this.renderStopsList(allStops);
        this.updateMapRoute();
    }

    // Get stops for route
    getStopsForRoute(trips) {
        const stopTimes = window.transJakartaApp.modules.gtfs.getStopTimes();
        const stops = window.transJakartaApp.modules.gtfs.getStops();
        
        if (!this.selectedRouteVariant) {
            // Combine all stops from all trips (no duplicates)
            const halteMap = new Map();
            trips.forEach(trip => {
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop && !this.isAccessStop(stop)) {
                        const key = stop.stop_id;
                        if (!halteMap.has(key)) halteMap.set(key, stop);
                    }
                });
            });
            return Array.from(halteMap.values());
        } else {
            // Only selected variant
            const allStops = [];
            trips.forEach(trip => {
                if (this.extractVariantFromTripId(trip.trip_id) !== this.selectedRouteVariant) return;
                const stopsForTrip = stopTimes.filter(st => st.trip_id === trip.trip_id)
                    .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence));
                stopsForTrip.forEach(st => {
                    const stop = stops.find(s => s.stop_id === st.stop_id);
                    if (stop && !this.isAccessStop(stop)) allStops.push(stop);
                });
            });
            return allStops;
        }
    }

    // Render stops list
    renderStopsList(stops) {
        const ul = document.getElementById('stopsByRoute');
        if (!ul) return;

        const directionTabs = document.getElementById('directionTabs');
        if (directionTabs) {
            directionTabs.innerHTML = `<h4 class='plus-jakarta-sans fw-bold mb-2'>Daftar Halte</h4>`;
        }

        if (stops.length === 0) {
            ul.innerHTML = '<li class="list-group-item">Tidak ada halte ditemukan</li>';
            return;
        }

        ul.innerHTML = '';
        stops.forEach((stop, idx) => {
            const li = this.createStopListItem(stop, idx);
            li.setAttribute('data-stop-id', stop.stop_id || '');
            ul.appendChild(li);
        });

        // Setup click handler (event delegation) for switching routes via badges
        if (!this._stopsListClickBound) {
            ul.addEventListener('click', (e) => {
                const badge = e.target.closest('.other-route-badge');
                if (badge) {
                    e.preventDefault(); e.stopPropagation();
                    const routeId = badge.getAttribute('data-routeid');
                    if (routeId) {
                        window.transJakartaApp.modules.routes.selectRoute(routeId);
                    }
                }
            });
            this._stopsListClickBound = true;
        }
    }

    // Create stop list item
    createStopListItem(stop, idx) {
        const li = document.createElement('li');
        li.className = 'stop-item';
        
        const stopContainer = document.createElement('div');
        stopContainer.className = 'stop-container';
        
        const stopHeader = document.createElement('div');
        stopHeader.className = 'stop-header';
        
        const stopNumber = document.createElement('div');
        stopNumber.className = 'stop-number pt-sans';
        stopNumber.textContent = (idx + 1).toString().padStart(2, '0');
        // Use current route color for the number background
        try {
            const route = window.transJakartaApp.modules.gtfs.getRoutes().find(r => r.route_id === this.selectedRouteId);
            const routeColor = route && route.route_color ? ('#' + route.route_color) : null;
            if (routeColor) {
                stopNumber.style.background = routeColor;
            }
        } catch (e) {}
        
        const stopName = document.createElement('div');
        stopName.className = 'stop-name pt-sans';
        stopName.textContent = stop.stop_name;
        
        // Intermodal icons next to stop name (manual mapping by stop_id or stop_name)
        const interIconsHtml = this.buildIntermodalIconsForStop(stop);
        const iconsSpan = document.createElement('span');
        if (interIconsHtml) {
            iconsSpan.className = 'intermodal-icons';
            iconsSpan.innerHTML = interIconsHtml;
        }
        
        // Accessibility icon (wheelchair)
        const isAccessible = (stop.wheelchair_boarding === '1');
        const wcIcon = document.createElement('span');
        if (isAccessible) {
            const settings = window.transJakartaApp.modules.settings;
            if (!settings || settings.isEnabled('showAccessibilityIcon')) {
                wcIcon.className = 'wc-icon';
                wcIcon.title = 'Ramah kursi roda';
                wcIcon.style.marginLeft = '6px';
                wcIcon.innerHTML = '<iconify-icon icon="fontisto:paralysis-disability" inline></iconify-icon>';
            }
        }
        
        // Coordinate link (placed at the far left)
        let coordLink = null;
        if (stop.stop_lat && stop.stop_lon) {
            coordLink = document.createElement('a');
            coordLink.href = `https://www.google.com/maps/search/?api=1&query=${stop.stop_lat},${stop.stop_lon}`;
            coordLink.target = '_blank';
            coordLink.rel = 'noopener';
            coordLink.className = 'coord-link';
            coordLink.title = 'Buka di Google Maps';
            // Ensure no background on the link container
            coordLink.style.background = 'transparent';
            coordLink.style.border = 'none';
            coordLink.style.padding = '0';
            coordLink.style.display = 'inline-flex';
            coordLink.style.alignItems = 'center';
            // Use BRT/Feeder icon instead of map marker
            const brtIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/JakIcon_BusBRT.svg/1200px-JakIcon_BusBRT.svg.png';
            const feederIconUrl = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/JakIcon_Bus_Light.svg/2048px-JakIcon_Bus_Light.svg.png';
            const sid = String(stop.stop_id || '');
            const iconUrl = sid.startsWith('B') ? feederIconUrl : brtIconUrl;
            coordLink.innerHTML = `<img src="${iconUrl}" alt="Map" title="Buka di Google Maps" style="width:20px;height:20px;object-fit:contain;background:transparent;"/>`;
        }
        
        // Name block combining name and intermodal icons
        const nameBlock = document.createElement('div');
        nameBlock.className = 'stop-title';
        nameBlock.appendChild(stopName);
        if (interIconsHtml) {
            nameBlock.appendChild(iconsSpan);
        }
        // JakLingko badge when integrated (intermodal present) or many services
        if (this.shouldShowJaklingkoBadge(stop)) {
            const jl = document.createElement('img');
            jl.src = 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/jaklingko-w-AR0bObLen0c7yK8n-768x768.png';
            jl.alt = 'JakLingko';
            jl.title = 'Terintegrasi JakLingko';
            jl.className = 'jaklingko-badge';
            nameBlock.appendChild(jl);
        }
        
        // Assemble header in required order: coord | name (with icons) | accessibility (wc)
        const parts = [];
        if (coordLink) parts.push(coordLink.outerHTML);
        // include number after coord to ensure it is present
        parts.push(stopNumber.outerHTML);
        parts.push(nameBlock.outerHTML);
        if (isAccessible) parts.push(wcIcon.outerHTML);
        stopHeader.innerHTML = parts.join('');
        
        // Stop type badge
        const stopTypeBadge = this.createStopTypeBadge(stop);
        
        // Other routes badges
        const otherRoutesBadges = this.createOtherRoutesBadges(stop);
        
        stopContainer.innerHTML = `
            ${stopHeader.outerHTML}
            ${stopTypeBadge}
            ${otherRoutesBadges}
        `;
        
        li.appendChild(stopContainer);

        // Make stop name clickable to open on our map with popup
        try {
            const nameEl = li.querySelector('.stop-name');
            if (nameEl) {
                nameEl.style.cursor = 'pointer';
                nameEl.addEventListener('click', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    try {
                        const mapManager = window.transJakartaApp.modules.map;
                        if (!mapManager) return;
                        // Center map
                        if (stop.stop_lat && stop.stop_lon) {
                            mapManager.setView(parseFloat(stop.stop_lat), parseFloat(stop.stop_lon), 17);
                        }
                        // Build pseudo feature similar to search
                        const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
                        const f = {
                            properties: {
                                stopId: stop.stop_id,
                                stopName: stop.stop_name,
                                stopType: mapManager.getStopType ? mapManager.getStopType(String(stop.stop_id)) : '',
                                routeIds: (stopToRoutes[stop.stop_id] ? Array.from(stopToRoutes[stop.stop_id]) : [])
                            }
                        };
                        // Show popup
                        mapManager.showStopPopup(f, { lng: parseFloat(stop.stop_lon), lat: parseFloat(stop.stop_lat) });
                    } catch(_) {}
                });
            }
        } catch(_) {}
        
        // Event handlers
        li.onclick = (e) => {
            if (e.target.tagName === 'A' || e.target.closest('a')) return;
            window.lastStopId = stop.stop_id;
        };
        
        return li;
    }

    // Create stop type badge
    createStopTypeBadge(stop) {
        let stopTypeBadge = '';
        if (stop.stop_id && stop.stop_id.startsWith('B')) {
            stopTypeBadge = `<div class='stop-type-badge feeder pt-sans'>Pengumpan</div>`;
        } else if (stop.stop_id && stop.stop_id.startsWith('G') && stop.platform_code) {
            stopTypeBadge = `<div class='stop-type-badge platform pt-sans'>Platform ${stop.platform_code}</div>`;
        } else if (stop.stop_id && (stop.stop_id.startsWith('E') || stop.stop_id.startsWith('H'))) {
            stopTypeBadge = `<div class='stop-type-badge access pt-sans'>Akses Masuk</div>`;
        } else {
            stopTypeBadge = `<div class='stop-type-badge corridor pt-sans'>Koridor</div>`;
        }
        return stopTypeBadge;
    }

    // Create other routes badges
    createOtherRoutesBadges(stop) {
        const gtfs = window.transJakartaApp.modules.gtfs;
        const stopToRoutes = gtfs.getStopToRoutes();
        const allStops = gtfs.getStops() || [];
        const routesAll = gtfs.getRoutes() || [];
        if (!stop) return '';
        // Build cluster key similar to popup logic
        const normalizeName = (n) => String(n || '').trim().replace(/\s+/g, ' ');
        const buildKey = (s) => {
            const sid = String(s.stop_id || '');
            if (s.parent_station) return String(s.parent_station);
            if (sid.startsWith('H')) return sid;
            return `NAME:${normalizeName(s.stop_name)}`;
        };
        const sid = String(stop.stop_id || '');
        let unionRouteIds = [];
        if (sid.startsWith('B')) {
            // Feeder: keep this stop's services only
            unionRouteIds = stopToRoutes[sid] ? Array.from(stopToRoutes[sid]) : [];
        } else {
            // BRT/others: union services across cluster (merge platforms)
            try {
                const key = buildKey(stop);
                const cluster = allStops.filter(s => buildKey(s) === key);
                const set = new Set();
                cluster.forEach(cs => {
                    const cid = String(cs.stop_id || '');
                    // skip access E*
                    if (cid.startsWith('E')) return;
                    const rids = stopToRoutes[cid] ? Array.from(stopToRoutes[cid]) : [];
                    rids.forEach(r => set.add(String(r)));
                });
                unionRouteIds = Array.from(set);
            } catch (e) {
                unionRouteIds = stopToRoutes[sid] ? Array.from(stopToRoutes[sid]) : [];
            }
        }
        // Filter out currently selected route
        const others = unionRouteIds.filter(rid => String(rid) !== String(this.selectedRouteId));
        if (others.length === 0) return '';
        let otherRoutesBadges = `<div class='other-routes'>
            <div class='other-routes-label pt-sans'>Layanan lain:</div>
            <div class='other-routes-badges'>`;
        others.forEach(rid => {
            const route = routesAll.find(r => String(r.route_id) === String(rid));
            if (route) {
                const badgeColor = route.route_color ? ('#' + route.route_color) : '#6c757d';
                otherRoutesBadges += `<span class='badge badge-koridor-interaktif rounded-pill me-1 mb-1 other-route-badge pt-sans' data-routeid='${route.route_id}' style='background:${badgeColor};color:#fff;font-weight:bold;font-size:0.8em;padding:4px 8px;' title='${route.route_long_name || ''}'>${route.route_short_name || route.route_id}</span>`;
            }
        });
        otherRoutesBadges += `</div></div>`;
        return otherRoutesBadges;
    }

    // Clear stops list
    clearStopsList() {
        const ul = document.getElementById('stopsByRoute');
        const title = document.getElementById('stopsTitle');
        const directionTabs = document.getElementById('directionTabs');
        
        if (ul) ul.innerHTML = '';
        if (title) title.textContent = '';
        if (directionTabs) directionTabs.innerHTML = '';
        
        // Remove variant dropdowns
        this.removeVariantDropdowns();
    }

    // Remove variant dropdowns
    removeVariantDropdowns() {
        let old = document.getElementById('routeVariantDropdown');
        if (old) {
            old.previousSibling && old.previousSibling.remove();
            old.remove();
        }
        
        let oldStops = document.getElementById('stopsVariantDropdown');
        if (oldStops) {
            oldStops.closest('.variant-selector-stops')?.remove();
        }
    }

    // Update map route
    updateMapRoute() {
        if (!this.selectedRouteId) return;

        const route = window.transJakartaApp.modules.gtfs.getRoutes()
            .find(r => r.route_id === this.selectedRouteId);
        
        if (!route) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === this.selectedRouteId);
        
        let filteredTrips = this.getFilteredTrips(trips);
        let shapes = this.getShapesForTrips(filteredTrips);

        // Fallback: jika varian menghasilkan shapes kosong (mis. di mobile), gunakan semua trips
        const shapesEmpty = !shapes || shapes.length === 0 || shapes.every(arr => !arr || arr.length === 0);
        if (shapesEmpty) {
            filteredTrips = trips;
            shapes = this.getShapesForTrips(filteredTrips);
        }

        // Try use cache
        const cacheKey = `${this.selectedRouteId}|${this.selectedRouteVariant || ''}`;
        let cached = this._cache.get(cacheKey);
        let stops;
        if (cached && cached.shapes && cached.stops) {
            shapes = cached.shapes;
            stops = cached.stops;
            // Restore linear ref
            this.linearRef = cached.linearRef;
            this.stopMeasureById = cached.stopMeasureById;
            this.orderedStops = cached.orderedStops;
        } else {
            stops = this.getStopsForRoute(filteredTrips);
            // Prepare linear referencing for live layanan
            this.prepareLinearRef(shapes, stops);
            // Save to cache
            this._cache.set(cacheKey, {
                shapes,
                stops,
                linearRef: this.linearRef,
                stopMeasureById: this.stopMeasureById,
                orderedStops: this.orderedStops
            });
        }
        
        // Update map
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            // Close popup and temporary layers before rendering new route
            if (typeof mapManager.closePopupAndTemp === 'function') mapManager.closePopupAndTemp();

            mapManager.addRoutePolyline(this.selectedRouteId, shapes, route.route_color ? '#' + route.route_color : '#264697');
            
            const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
            mapManager.addStopsMarkers(stops, stopToRoutes, window.transJakartaApp.modules.gtfs.getRoutes());
        }
    }

    // Flatten shapes into single polyline and compute cumulative distances; project stops
    prepareLinearRef(shapes, stops) {
        // Flatten shapes (array of arrays of {lat,lng}) into one continuous polyline
        const poly = [];
        shapes.forEach(seg => { if (seg && seg.length) seg.forEach(p => poly.push({ lat: p.lat, lon: p.lng })); });
        if (poly.length < 2) { this.linearRef = null; this.stopMeasureById = null; this.orderedStops = stops || []; return; }
        const cum = [0];
        for (let i = 1; i < poly.length; i++) {
            cum[i] = cum[i - 1] + this.haversine(poly[i - 1].lat, poly[i - 1].lon, poly[i].lat, poly[i].lon);
        }
        // Helper project lat/lon onto segment i-1 -> i
        const projectOnSegment = (i, lat, lon) => {
            const ax = poly[i - 1].lon, ay = poly[i - 1].lat;
            const bx = poly[i].lon, by = poly[i].lat;
            const px = lon, py = lat;
            const abx = bx - ax, aby = by - ay;
            const apx = px - ax, apy = py - ay;
            const ab2 = abx * abx + aby * aby;
            if (ab2 === 0) return { t: 0, dist: cum[i - 1] };
            let t = (apx * abx + apy * aby) / ab2;
            t = Math.max(0, Math.min(1, t));
            const projLat = ay + aby * t;
            const projLon = ax + abx * t;
            const segLen = this.haversine(ay, ax, projLat, projLon);
            return { t, dist: cum[i - 1] + segLen };
        };
        // Project stop to nearest segment
        const stopMeasureById = new Map();
        const orderedStops = Array.isArray(stops) ? [...stops] : [];
        orderedStops.forEach(stop => {
            let best = { dist: Infinity };
            for (let i = 1; i < poly.length; i++) {
                const pr = projectOnSegment(i, parseFloat(stop.stop_lat), parseFloat(stop.stop_lon));
                if (pr.dist < best.dist) best = pr;
            }
            stopMeasureById.set(stop.stop_id, best.dist);
        });
        this.linearRef = { poly, cum };
        this.stopMeasureById = stopMeasureById;
        this.orderedStops = orderedStops;
    }

    getLinearRef() { return this.linearRef || null; }
    getStopMeasureById() { return this.stopMeasureById || new Map(); }
    getOrderedStops() { return this.orderedStops || []; }

    // Get shapes for trips
    getShapesForTrips(trips) {
        const shapes = window.transJakartaApp.modules.gtfs.getShapes();
        const shapeIds = trips.map(t => t.shape_id).filter(Boolean);
        
        return shapeIds.map(shapeId => {
            const shapePoints = shapes.filter(s => s.shape_id === shapeId)
                .sort((a, b) => parseInt(a.shape_pt_sequence) - parseInt(b.shape_pt_sequence));
            
            return shapePoints.map(s => ({
                lat: parseFloat(s.shape_pt_lat),
                lng: parseFloat(s.shape_pt_lon)
            }));
        });
    }

    // Clear map route
    clearMapRoute() {
        const mapManager = window.transJakartaApp.modules.map;
        if (mapManager) {
            mapManager.clearLayers();
        }
    }

    // Clear route info
    clearRouteInfo() {
        const title = document.getElementById('stopsTitle');
        if (title) {
            title.textContent = 'Informasi layanan akan tampil di sini setelah anda memilihnya.';
            title.className = 'fs-3 fw-bold plus-jakarta-sans';
        }
    }

    // Save active route ID
    saveActiveRouteId(routeId) {
        if (routeId) {
            localStorage.setItem('activeRouteId', routeId);
        } else {
            localStorage.removeItem('activeRouteId');
        }
    }

    // Utility functions
    timeToSeconds(time) {
        if (!time) return null;
        const [h, m, s] = time.split(':').map(Number);
        return h * 3600 + m * 60 + s;
    }

    formatOperatingHours(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        if (eh >= 24) {
            if (sh === 5 && sm === 0 && eh === 29 && em === 0) {
                return '24 jam (05:00)';
            }
            if (sh === 0 && sm === 0 && (eh === 24 || (eh === 23 && em === 59))) {
                return '24 jam';
            }
            let endH = eh - 24;
            let endStr = `${String(endH).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
            return `${this.formatTime(start)} - ${endStr} (+1)`;
        }
        return `${this.formatTime(start)} - ${this.formatTime(end)}`;
    }

    formatTime(time) {
        if (!time) return '';
        const [h, m] = time.split(':');
        return `${h}:${m}`;
    }

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

    formatDistance(meters) {
        if (meters == null) return '';
        if (meters < 1000) return `${meters} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    }

    // Access stop detector (E*/H*)
    isAccessStop(stop) {
        // Allow user to disable access filtering
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (settings && !settings.isEnabled('filterAccessStops')) return false;
        } catch (e) {}
        const id = (stop && stop.stop_id) ? String(stop.stop_id) : '';
        return id.startsWith('E') || id.startsWith('H');
    }

    // Determine whether to show JakLingko badge near stop name
    shouldShowJaklingkoBadge(stop) {
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (settings && !settings.isEnabled('showJaklingkoBadge')) return false;
            // Intermodal mapping
            const modes = this._intermodalByStopKey[stop.stop_id] || this._intermodalByStopKey[stop.stop_name];
            const hasIntermodal = Array.isArray(modes) ? modes.length > 0 : !!modes;
            // Count of services at stop
            const stopToRoutes = window.transJakartaApp.modules.gtfs.getStopToRoutes();
            const servicesCount = stopToRoutes[stop.stop_id] ? Array.from(stopToRoutes[stop.stop_id]).length : 0;
            // Show if services >= 4, otherwise only when intermodal exists
            return servicesCount >= 4 || hasIntermodal;
        } catch (e) {
            return false;
        }
    }

    // Reset function
    reset() {
        this.resetRoute();
    }

    // Configure manual intermodal mapping
    setIntermodalMapping(mapping) {
        this._intermodalByStopKey = mapping || {};
        // Build normalized name mapping for robust lookup (case/space insensitive)
        try {
            this._intermodalByStopKeyNormalized = {};
            Object.keys(this._intermodalByStopKey).forEach((key) => {
                const value = this._intermodalByStopKey[key];
                const normalized = this.normalizeStopKey(key);
                this._intermodalByStopKeyNormalized[normalized] = value;
            });
        } catch (e) { this._intermodalByStopKeyNormalized = {}; }
        if (this.selectedRouteId) {
            this.showStopsByRoute(this.selectedRouteId);
        }
    }

    // Build intermodal icons HTML based on mapping
    buildIntermodalIconsForStop(stop) {
        try {
            const settings = window.transJakartaApp.modules.settings;
            if (settings && !settings.isEnabled('showIntermodalIcons')) return '';
        } catch (e) {}
        if (!this._intermodalByStopKey) return '';
        // Try by stop_id first (exact), then by exact name, then normalized name
        let modes = this._intermodalByStopKey[stop.stop_id] || this._intermodalByStopKey[stop.stop_name];
        if (!modes && this._intermodalByStopKeyNormalized) {
            const normalizedName = this.normalizeStopKey(stop.stop_name || '');
            modes = this._intermodalByStopKeyNormalized[normalizedName];
        }
        if (!modes) return '';
        const arr = Array.isArray(modes) ? modes : [modes];
        const iconUrlMap = {
            'MRT': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-mrt-icon-w-mePn2LwZXQCglMGN-768x768.png',
            'LRT': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-lrt-icon-w-AQEpaJBkWOcwoNrr-768x768.png',
            'KRL': 'https://transportforjakarta.or.id/wp-content/uploads/2024/10/roundel-krl-icon-w-YBg4WpGk8phW4kOL-768x768.png'
        };
        return arr.map(m => {
            const key = String(m).toUpperCase();
            const url = iconUrlMap[key];
            if (!url) return '';
            const alt = key;
            const cls = key.toLowerCase();
            return `<img class="intermodal-icon-img ${cls}" src="${url}" alt="${alt}" title="${alt}"/>`;
        }).join('');
    }

    // Normalize stop key for name-based mapping: trim, collapse spaces, lowercase
    normalizeStopKey(key) {
        if (key == null) return '';
        const s = String(key);
        // If it looks like an internal stop_id (e.g., starts with capital letter + digits), keep as-is
        if (/^[A-Z]\d/.test(s)) return s;
        return s.trim().replace(/\s+/g, ' ').toLowerCase();
    }

    // Show error message
    showError(message) {
        alert(message);
    }

    // Copy to clipboard with visual feedback
    copyToClipboard(text, buttonElement, successMessage) {
        if (!buttonElement) return;
        
        // Show loading state
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = `
            <div class="share-option-icon bg-success bg-opacity-10 text-success">
                <div class="spinner-border spinner-border-sm text-success" role="status"></div>
            </div>
            <div class="share-option-text">
                <div class="share-option-title">Menyalin...</div>
                <div class="share-option-desc">Mohon tunggu sebentar</div>
            </div>
        `;
        buttonElement.style.pointerEvents = 'none';

        // Try to copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            // Show success state
            buttonElement.innerHTML = `
                <div class="share-option-icon bg-success bg-opacity-10 text-success">
                    <iconify-icon icon="mdi:check" inline style="color: #10b981;"></iconify-icon>
                </div>
                <div class="share-option-text">
                    <div class="share-option-title">Berhasil!</div>
                    <div class="share-option-desc">${successMessage}</div>
                </div>
            `;
            
            // Show alert
            alert(successMessage);
            
            // Restore original content after 2 seconds
            setTimeout(() => {
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }, 2000);
            
        }).catch(err => {
            console.error('Failed to copy:', err);
            
            // Fallback: try old method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                alert(successMessage);
                
                // Show success state
                buttonElement.innerHTML = `
                    <div class="share-option-icon bg-success bg-opacity-10 text-success">
                        <iconify-icon icon="mdi:check" inline style="color: #10b981;"></iconify-icon>
                    </div>
                    <div class="share-option-text">
                        <div class="share-option-title">Berhasil!</div>
                        <div class="share-option-desc">${successMessage}</div>
                    </div>
                `;
                
                // Restore original content after 2 seconds
                setTimeout(() => {
                    buttonElement.innerHTML = originalContent;
                    buttonElement.style.pointerEvents = 'auto';
                }, 2000);
                
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
                alert('Gagal menyalin ke clipboard. Silakan salin manual.');
                buttonElement.innerHTML = originalContent;
                buttonElement.style.pointerEvents = 'auto';
            }
            document.body.removeChild(textArea);
        });
    }
} 
 