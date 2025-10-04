// Main application entry point
import { GTFSLoader } from './modules/gtfs-loader.js';
import { MapManager } from './modules/map-manager.js';
import { RouteManager } from './modules/route-manager.js';
import { StopManager } from './modules/stop-manager.js';
import { SearchManager } from './modules/search-manager.js';
import { LocationManager } from './modules/location-manager.js';
import { UIManager } from './modules/ui-manager.js';
import { SettingsManager } from './modules/settings-manager.js';
import { JourneyPlanner } from './modules/journey-planner.js';
import { TypedPlanner } from './modules/typed-planner.js';

class TransJakartaApp {
    constructor() {
        this.modules = {};
        this._clockTimer = null;
        this._activeRoutesTimer = null;
        this.init();
    }

    async init() {
        try {
            console.log('🚀 JakMove App initialization started');
            
            // Show loading immediately
            this.showInitialLoading();
            
            // Initialize modules
            this.modules.gtfs = new GTFSLoader();
            this.modules.map = new MapManager();
            this.modules.routes = new RouteManager();
            this.modules.stops = new StopManager();
            this.modules.search = new SearchManager();
            this.modules.settings = new SettingsManager();
            this.modules.location = new LocationManager();
            this.modules.ui = new UIManager();
            this.modules.journey = new JourneyPlanner(this);
            this.modules.typedPlanner = new TypedPlanner(this);

            // Step 1: Load GTFS data and basic settings
            const [gtfsData] = await Promise.all([
                this.modules.gtfs.loadData(),
                this.modules.settings.init()
            ]);
            
            // Step 2: Update UI with GTFS last modified date
            this.modules.gtfs.updateLastModifiedUI();
            
            // Step 3: Initialize map immediately
            this.modules.map.init();
            
            // Step 4: Ensure critical data structures are ready
            // This prevents race conditions with platform rendering on fast loads
            await this.ensureCriticalDataReady();
            
            // Step 5: Setup basic event listeners and clock
            this.setupEventListeners();
            this.initLiveClock();
            this.initActiveRoutesCounter();
            
            // Step 6: Wait for loading progress to finish and hide
            await this.waitForLoadingCompletion();

            // Step 7: Lazy load heavy UI components in background
            await this.deferredUIInit();

            // Step 8: Wait for complete UI readiness with slide notification
            await this.waitForCompleteUIReady();

            // Step 9: Handle URL parameter for direct route selection
            try {
                const url = new URL(window.location.href);
                const routeParam = url.searchParams.get('route_id');
                if (routeParam) {
                    this.modules.routes.selectRoute(routeParam);
                }
            } catch (e) {}
            
            // Step 10: Mark app as fully ready
            this.markAppAsReady();
            
            console.log('TransJakarta App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            
            // Hide loading screen on error
            this.hideLoadingScreen();
            this.showError('Gagal memuat aplikasi: ' + (error.message || 'Unknown error'));
        }
    }

    // Show initial loading screen
    showInitialLoading() {
        const loadingScreen = document.getElementById('appLoadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('active');
            
            // Lock body scroll completely
            document.body.classList.add('loading');
            document.documentElement.classList.add('loading-active');
            document.documentElement.style.overflow = 'hidden';
            
            // Set initial values
            const title = loadingScreen.querySelector('.loading-title');
            const status = loadingScreen.querySelector('.loading-status');
            const percentEl = loadingScreen.querySelector('.loading-percent');
            const progressFill = loadingScreen.querySelector('.loading-progress-fill');
            
            if (title) title.textContent = 'Memuat JakMove';
            if (status) status.textContent = 'Memulai aplikasi...';
            if (percentEl) percentEl.textContent = '0%';
            if (progressFill) progressFill.style.width = '0%';
        }
        
        // Update page title
        document.title = 'Memuat - JakMove';
        
        console.log('📱 Loading screen activated');
    }

    // Ensure critical data structures are ready before UI rendering
    async ensureCriticalDataReady() {
        try {
            console.log('🔍 Ensuring critical data structures are ready...');
            
            // Wait for essential modules to be fully initialized
            const essentialChecks = [
                // Ensure GTFS data is fully processed
                () => this.modules.gtfs && this.modules.gtfs.data && Object.keys(this.modules.gtfs.data).length > 0,
                
                // Ensure stop-to-routes mapping exists
                () => this.modules.gtfs && this.modules.gtfs.getStopToRoutes && Object.keys(this.modules.gtfs.getStopToRoutes()).length > 0,
                
                // Ensure map manager is initialized
                () => this.modules.map && this.modules.map.isInitialized,
                
                // Ensure route manager is ready
                () => this.modules.routes && typeof this.modules.routes.buildClusterPlatformMap === 'function'
            ];
            
            // Wait for essential checks with very fast polling
            const timeout = 1000; // Even faster timeout
            const startTime = Date.now();
            
            while (Date.now() - startTime < timeout) {
                const allReady = essentialChecks.every(check => {
                    try {
                        return check();
                    } catch (e) {
                        return false;
                    }
                });
                
                if (allReady) {
                    console.log('✅ All critical data structures ready');
                    // No extra wait for instant loading
                    break;
                }
                
                // Very fast polling for instant response
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Additional platform-specific initialization
            if (this.modules.map && this.modules.map._platformMapCache) {
                console.log('🏁 Platform cache ready for use');
            }
            
        } catch (error) {
            console.warn('⚠️ Critical data readiness check failed:', error);
            // Continue anyway - this is just a safety check
        }
    }

    // Wait for data loading completion
    async waitForLoadingCompletion() {
        console.log('⏳ Waiting for data loading completion...');
        
        // Wait for GTFS data to be marked as ready
        const timeout = 5000; // 5 second timeout (faster)
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (window.gtfsDataReady === true) {
                console.log('✅ GTFS data marked as ready');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 20)); // Faster polling
        }
        
        // Minimal wait for instant loading
        await new Promise(resolve => setTimeout(resolve, 50));
        
        console.log('🎯 Data loading completion verified');
    }

    // Deferred initialization for heavy UI components - now async to wait for completion
    async deferredUIInit() {
        console.log('🔄 Starting deferred UI initialization...');
        
        const deferredTasks = [
            { name: 'UI Manager', task: () => this.modules.ui.init() },
            { name: 'Journey Planner', task: () => this.modules.journey.init() },
            { name: 'Typed Planner', task: () => this.modules.typedPlanner.init() },
            { name: 'Saved State', task: () => this.loadSavedState() },
            { name: 'Map Stops', task: () => {
                if (this.modules.map.loadStopsLazy) {
                    this.modules.map.loadStopsLazy();
                }
            }},
            { name: 'Route Dropdowns', task: () => {
                if (this.modules.ui.populateDropdownsLazy) {
                    this.modules.ui.populateDropdownsLazy();
                }
            }}
        ];

        // Execute all tasks rapidly for faster loading
        for (const currentTask of deferredTasks) {
            console.log(`🔧 Executing: ${currentTask.name}`);
                    
                    try {
                        currentTask.task();
                    } catch (e) {
                        console.warn(`Deferred task failed (${currentTask.name}):`, e);
                    }
                    
            // Minimal delay between tasks for smooth execution
            await new Promise(resolve => setTimeout(resolve, 5));
        }
        
                    console.log('✅ All deferred UI tasks completed');
    }

    // Wait for complete UI readiness using loading screen
    async waitForCompleteUIReady() {
        console.log('⏳ Waiting for complete UI readiness...');
        
        // Update loading screen to UI preparation mode (start from 45% smoothly after GTFS 40%)
        this.updateLoadingScreen(45, 'Menyiapkan antarmuka...');
        
        // Wait for critical UI elements to be populated
        const uiReadyChecks = [
            { name: 'Route Dropdown', check: () => {
                const dropdown = document.getElementById('routesDropdown');
                return dropdown && dropdown.options.length > 1;
            }},
            { name: 'Map Route Dropdown', check: () => {
                const mapDropdown = document.querySelector('#mapRouteDropdown select');
                return mapDropdown && mapDropdown.options.length > 1;
            }},
            { name: 'GTFS Data Ready', check: () => window.gtfsDataReady === true },
            { name: 'Map Initialized', check: () => {
                const mapManager = this.modules.map;
                return mapManager && mapManager.isInitialized;
            }}
        ];
        
        const timeout = 3000; // Faster timeout
        const startTime = Date.now();
        let progress = 45;
        
        while (Date.now() - startTime < timeout) {
            const readyStates = uiReadyChecks.map(item => {
                try {
                    return item.check();
                } catch (e) {
                    return false;
                }
            });
            
            const readyCount = readyStates.filter(state => state).length;
            progress = 45 + ((readyCount / uiReadyChecks.length) * 55);
            
            const statusText = progress < 100 
                ? `Menyiapkan komponen...`
                : 'Siap digunakan!';
                
            this.updateLoadingScreen(progress, statusText);
            
            if (readyStates.every(state => state)) {
                console.log('✅ Complete UI is ready');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 30)); // Faster polling
        }
        
        // Final completion
        this.updateLoadingScreen(100, 'Siap digunakan!');
        
        // Very short wait for smooth transition
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Hide loading screen
        this.hideLoadingScreen();
        
        console.log('🎯 UI readiness check completed');
    }

    // Mark app as fully ready
    markAppAsReady() {
        console.log('🎉 App is fully ready!');
        
        // Update page title
        document.title = 'JakMove - Transportasi Jakarta';
        
        // Mark global ready state
        window.jakMoveReady = true;
        
        console.log('🚀 App completely initialized and ready for use!');
    }

    // Update loading screen with progress and status
    updateLoadingScreen(progress, statusText) {
        const loadingScreen = document.getElementById('appLoadingScreen');
        if (!loadingScreen) return;
        
        const progressFill = loadingScreen.querySelector('.loading-progress-fill');
        const status = loadingScreen.querySelector('.loading-status');
        const percentEl = loadingScreen.querySelector('.loading-percent');
        const title = loadingScreen.querySelector('.loading-title');
        
        // Update progress bar
        if (progressFill) {
            progressFill.style.width = `${Math.min(progress, 100)}%`;
        }
        
        // Update percentage
        if (percentEl) {
            percentEl.textContent = `${Math.round(Math.min(progress, 100))}%`;
        }
        
        // Update status text
        if (status) {
            status.textContent = statusText;
        }
        
        // Update title for completion
        if (title && progress >= 100) {
                title.textContent = 'Siap Digunakan!';
        }
        
        console.log(`📊 Loading: ${Math.round(progress)}% - ${statusText}`);
    }

    // Hide loading screen
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('appLoadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.remove('active');
            
            // Unlock body scroll completely
            document.body.classList.remove('loading');
            document.documentElement.classList.remove('loading-active');
            document.documentElement.style.overflow = '';
            
            console.log('📱 Loading screen hidden');
        }
    }

    setupEventListeners() {
        // Route selection
        const routesDropdown = document.getElementById('routesDropdown');
        if (routesDropdown) {
            routesDropdown.addEventListener('change', (e) => {
                this.modules.routes.selectRoute(e.target.value);
            });
        }

        // Live location toggle
        const liveBtn = document.getElementById('liveLocationBtn');
        if (liveBtn) {
            liveBtn.addEventListener('click', () => {
                this.modules.location.toggleLiveLocation();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('resetRouteBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetApp();
                try { this.modules.journey.reset(); } catch(e) {}
            });
        }

        // Search input
        const searchInput = document.getElementById('searchStop');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.modules.search.handleSearch(e.target.value);
            });
        }
        // Temporary: press J to toggle Journey Planner
        document.addEventListener('keydown', (ev) => {
            if ((ev.key === 'j' || ev.key === 'J') && !ev.repeat) {
                const jp = this.modules.journey;
                if (!jp.enabled) jp.enable(); else jp.disable();
            }
        });
    }

    initLiveClock() {
        const el = document.getElementById('liveClock');
        if (!el) return;
        if (this._clockTimer) clearInterval(this._clockTimer);
        const formatter = new Intl.DateTimeFormat('id-ID', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Jakarta'
        });
        const dateFormatter = new Intl.DateTimeFormat('id-ID', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
        });
        const update = () => {
            const now = new Date();
            el.textContent = formatter.format(now);
            el.title = dateFormatter.format(now);
        };
        update();
        this._clockTimer = setInterval(update, 1000);
    }

    // Initialize active routes counter (real-time based on GTFS data)
    initActiveRoutesCounter() {
        const el = document.getElementById('activeRoutesCount');
        if (!el) return;
        
        if (this._activeRoutesTimer) clearInterval(this._activeRoutesTimer);
        
        const update = () => {
            try {
                const count = this.countActiveRoutes();
                el.textContent = count.toString();
                el.title = `${count} layanan beroperasi saat ini`;
                console.log(`🚌 Active routes count: ${count}`);
            } catch (error) {
                console.error('Error updating active routes count:', error);
                el.textContent = '0';
            }
        };
        
        update();
        // Update every minute
        this._activeRoutesTimer = setInterval(update, 60000);
    }

    // Count how many routes are currently active based on GTFS data
    countActiveRoutes() {
        try {
            const routes = this.modules.gtfs.getRoutes();
            const trips = this.modules.gtfs.getTrips();
            const calendar = this.modules.gtfs.getCalendar();
            const stopTimes = this.modules.gtfs.getStopTimes();
            
            if (!routes || !trips || !calendar || !stopTimes) {
                console.warn('GTFS data not available');
                return 0;
            }

            const now = new Date();
            const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
            const currentTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Map day index to GTFS calendar field
            const dayFields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const todayField = dayFields[currentDay];

            console.log(`📅 Checking active routes for ${dayFields[currentDay]} at ${now.toLocaleTimeString()}`);

            // Build service ID to calendar entry map
            const serviceMap = new Map();
            calendar.forEach(cal => {
                if (!serviceMap.has(cal.service_id)) {
                    serviceMap.set(cal.service_id, []);
                }
                serviceMap.get(cal.service_id).push(cal);
            });

            // Helper to check if service is active today
            const isServiceActiveToday = (serviceId) => {
                const entries = serviceMap.get(serviceId) || [];
                for (const cal of entries) {
                    try {
                        // Check if today's day of week is active
                        if (cal[todayField] !== '1') continue;

                        // Check date range
                        const startDate = this.parseGTFSDate(cal.start_date);
                        const endDate = this.parseGTFSDate(cal.end_date);
                        
                        if (startDate && endDate && currentDate >= startDate && currentDate <= endDate) {
                            return true;
                        }
                    } catch (e) {
                        // Ignore parse errors
                    }
                }
                return false;
            };

            // Build trip to stop times map for faster lookup
            const tripStopTimesMap = new Map();
            stopTimes.forEach(st => {
                if (!tripStopTimesMap.has(st.trip_id)) {
                    tripStopTimesMap.set(st.trip_id, []);
                }
                tripStopTimesMap.get(st.trip_id).push(st);
            });

            // Helper to get first and last trip times for a route
            const getRouteOperatingHours = (routeId) => {
                const routeTrips = trips.filter(t => t.route_id === routeId);
                if (routeTrips.length === 0) return null;

                let firstTime = Infinity;
                let lastTime = -Infinity;

                routeTrips.forEach(trip => {
                    const tripStopTimes = tripStopTimesMap.get(trip.trip_id) || [];
                    
                    tripStopTimes.forEach(st => {
                        const arrivalTime = this.parseGTFSTime(st.arrival_time);
                        const departureTime = this.parseGTFSTime(st.departure_time);
                        
                        if (arrivalTime !== null) {
                            firstTime = Math.min(firstTime, arrivalTime);
                            lastTime = Math.max(lastTime, arrivalTime);
                        }
                        if (departureTime !== null) {
                            firstTime = Math.min(firstTime, departureTime);
                            lastTime = Math.max(lastTime, departureTime);
                        }
                    });
                });

                return (firstTime !== Infinity && lastTime !== -Infinity) 
                    ? { start: firstTime, end: lastTime } 
                    : null;
            };

            // Use RouteManager logic to determine active routes
            const routeManager = this.modules.routes;
            let activeCount = 0;
            for (const route of routes) {
                try {
                    if (routeManager && typeof routeManager.isRouteActiveNow === 'function') {
                        if (routeManager.isRouteActiveNow(route.route_id)) {
                            activeCount++;
                        }
                    }
                } catch (_) { /* ignore */ }
            }

            return activeCount;
        } catch (error) {
            console.error('Error in countActiveRoutes:', error);
            return 0;
        }
    }

    // Parse GTFS date format (YYYYMMDD) to Date object
    parseGTFSDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return null;
        try {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
            const day = parseInt(dateStr.substring(6, 8));
            return new Date(year, month, day);
        } catch (e) {
            return null;
        }
    }

    // Parse GTFS time format (HH:MM:SS) to seconds since midnight
    parseGTFSTime(timeStr) {
        if (!timeStr) return null;
        try {
            const parts = timeStr.split(':');
            if (parts.length !== 3) return null;
            
            let hours = parseInt(parts[0]);
            const minutes = parseInt(parts[1]);
            const seconds = parseInt(parts[2]);
            
            // Don't modify hours for times >= 24:00:00 to maintain operating hours calculation
            // Just keep the actual value to calculate duration
            return hours * 3600 + minutes * 60 + seconds;
        } catch (e) {
            return null;
        }
    }

    loadSavedState() {
        const savedStyle = localStorage.getItem('baseMapStyle');
        if (savedStyle) {
            this.modules.map.setBaseStyle(savedStyle);
        }
        const savedRouteId = localStorage.getItem('activeRouteId');
        if (savedRouteId) {
            this.modules.routes.selectRoute(savedRouteId);
            const savedVar = localStorage.getItem('selectedRouteVariant_' + savedRouteId) || '';
            if (savedVar) {
                this.modules.routes.selectRouteVariant(savedVar);
            }
        }
        // Initialize weather if WeatherAPI available
        if (window.WeatherAPI && typeof window.WeatherAPI.initWeather === 'function') {
            try { window.WeatherAPI.initWeather(); } catch (e) { console.warn('Weather init failed:', e); }
        }
    }


    // Show error message to user
    showError(message) {
        console.error('App Error:', message);
        
        // Create enhanced error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: #fee2e2; border: 2px solid #fecaca; color: #dc2626;
            padding: 25px; border-radius: 12px; z-index: 10001; text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 400px; width: 90%;
        `;
        errorDiv.innerHTML = `
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 15px;">❌ Gagal Memuat Aplikasi</div>
            <div style="margin-bottom: 15px; font-size: 14px;">${message}</div>
            <button onclick="window.location.reload()" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
                🔄 Muat Ulang
            </button>
        `;
        
        document.body.appendChild(errorDiv);
    }

    resetApp() {
        // Reset all modules
        Object.values(this.modules).forEach(module => {
            if (module.reset) module.reset();
        });
        
        // Clear localStorage
        localStorage.removeItem('activeRouteId');
        // Do not clear baseMapStyle so user preference persists
        
        // Reset UI
        if (this.modules.ui && this.modules.ui.reset) {
            this.modules.ui.reset();
        }
    }

    showError(message) {
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.textContent = message;
        document.body.insertBefore(errorDiv, document.body.firstChild);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.transJakartaApp = new TransJakartaApp();
}); 