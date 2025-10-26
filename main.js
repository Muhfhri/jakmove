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
import { KRLManager } from './modules/krl-manager.js';
import { MRTManager } from './modules/mrt-manager.js';
import { LRTManager } from './modules/lrt-manager.js';
import { LRTJakartaManager } from './modules/lrtj-manager.js';
import { ShareManager } from './modules/share-manager.js';

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
            this.modules.krl = new KRLManager(this);
            this.modules.mrt = new MRTManager(this);
            this.modules.lrt = new LRTManager(this);
            this.modules.lrtj = new LRTJakartaManager(this);
            this.modules.share = new ShareManager(this);

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
            
            // Step 10: Initialize ShareManager for route sharing
            try {
                this.modules.share.init();
                console.log('✅ ShareManager initialized');
            } catch (e) {
                console.warn('ShareManager init failed:', e);
            }
            
            // Step 11: Mark app as fully ready
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

    // Deferred initialization for heavy UI components - parallel execution for speed
    async deferredUIInit() {
        console.log('🔄 Starting deferred UI initialization (parallel mode)...');
        
        // Execute ONLY critical tasks in parallel, defer rest to background
        const criticalTasks = [
            (async () => { 
                try { this.modules.ui.init(); } 
                catch (e) { console.warn('UI Manager init failed:', e); }
            })(),
            (async () => { 
                try { this.modules.journey.init(); } 
                catch (e) { console.warn('Journey Planner init failed:', e); }
            })(),
            (async () => { 
                try { this.modules.typedPlanner.init(); } 
                catch (e) { console.warn('Typed Planner init failed:', e); }
            })()
        ];
        
        // Non-critical tasks - defer to background using requestIdleCallback
        const deferToBackground = () => {
            const callback = window.requestIdleCallback || ((cb) => setTimeout(cb, 100));
            
            callback(() => {
                try { this.loadSavedState(); } catch(e) {}
            }, { timeout: 500 });
            
            callback(() => {
                try { 
                if (this.modules.map.loadStopsLazy) {
                    this.modules.map.loadStopsLazy();
                }
                } catch(e) {}
            }, { timeout: 1000 });
            
            callback(() => {
                try { 
                if (this.modules.ui.populateDropdownsLazy) {
                    this.modules.ui.populateDropdownsLazy();
                }
                } catch(e) {}
            }, { timeout: 1500 });
        };
        
        // Start background tasks immediately (non-blocking)
        deferToBackground();
        
        const tasks = criticalTasks;

        // Wait for all tasks to complete in parallel (much faster!)
        await Promise.all(tasks);
        
        console.log('⚡ All deferred UI tasks completed in parallel');
    }

    // Wait for complete UI readiness using loading screen - ultra-fast mode
    async waitForCompleteUIReady() {
        console.log('⏳ Waiting for complete UI readiness (ultra-fast)...');
        
        // Update loading screen - start at higher percentage since we're already fast
        this.updateLoadingScreen(60, 'Menyiapkan komponen...');
        
        // Reduced checks - only essential ones
        const essentialChecks = [
            () => window.gtfsDataReady === true,
            () => this.modules.map && this.modules.map.isInitialized
        ];
        
        const timeout = 1000; // Much faster timeout
        const startTime = Date.now();
        
        // Ultra-fast polling with exponential backoff
        let pollDelay = 5; // Start with 5ms
        while (Date.now() - startTime < timeout) {
            const allReady = essentialChecks.every(check => {
                try {
                    return check();
                } catch (e) {
                    return false;
                }
            });
            
            if (allReady) {
                console.log('✅ Essential UI components ready');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, pollDelay));
            pollDelay = Math.min(pollDelay * 1.5, 30); // Exponential backoff up to 30ms
        }
        
        // Update progress smoothly to 90%
        this.updateLoadingScreen(90, 'Menyelesaikan...');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Final completion
        this.updateLoadingScreen(100, 'Siap!');
        
        // Minimal wait for smooth transition
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Hide loading screen
        this.hideLoadingScreen();
        
        console.log('⚡ UI readiness check completed (ultra-fast)');
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

        // Intermodal toggle button with checkbox dropdown
        const intermodalBtn = document.getElementById('toggleIntermodalBtn');
        const intermodalDropdown = document.getElementById('intermodalDropdown');
        
        if (intermodalBtn && intermodalDropdown) {
            // Toggle dropdown visibility
            intermodalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = intermodalDropdown.style.display === 'block';
                intermodalDropdown.style.display = isVisible ? 'none' : 'block';
            });
            
            // Keep dropdown open when clicking inside
            intermodalDropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                intermodalDropdown.style.display = 'none';
            });
            
            // Update button status based on active modes
            const updateButtonStatus = () => {
                const btnIcon = intermodalBtn.querySelector('iconify-icon:first-child');
                const btnSpan = intermodalBtn.querySelector('span');
                
                const activeCount = [
                    this.modules.krl.isEnabled(),
                    this.modules.mrt.isEnabled(),
                    this.modules.lrt.isEnabled(),
                    this.modules.lrtj.isEnabled()
                ].filter(Boolean).length;
                
                if (activeCount > 0) {
                    intermodalBtn.classList.remove('secondary');
                    intermodalBtn.classList.add('success');
                    
                    const activeNames = [];
                    if (this.modules.krl.isEnabled()) activeNames.push('KRL');
                    if (this.modules.mrt.isEnabled()) activeNames.push('MRT');
                    if (this.modules.lrt.isEnabled()) activeNames.push('LRT');
                    if (this.modules.lrtj.isEnabled()) activeNames.push('LRTJ');
                    
                    if (btnIcon) btnIcon.setAttribute('icon', 'mdi:train-car');
                    if (btnSpan) btnSpan.textContent = `${activeNames.join(' + ')} Aktif`;
                } else {
                    intermodalBtn.classList.remove('success');
                    intermodalBtn.classList.add('secondary');
                    if (btnIcon) btnIcon.setAttribute('icon', 'mdi:train-car');
                    if (btnSpan) btnSpan.textContent = 'Tampilkan Antarmoda';
                }
            };
            
            // Handle checkbox changes
            const krlCheck = document.getElementById('toggleKrlCheck');
            const mrtCheck = document.getElementById('toggleMrtCheck');
            const lrtCheck = document.getElementById('toggleLrtCheck');
            const lrtjCheck = document.getElementById('toggleLrtjCheck');
            
            if (krlCheck) {
                krlCheck.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    krlCheck.disabled = true;
                    
                    try {
                        if (e.target.checked) {
                            await this.modules.krl.enable();
                        } else {
                            this.modules.krl.disable();
                        }
                        updateButtonStatus();
                    } catch (error) {
                        console.error('Failed to toggle KRL:', error);
                        e.target.checked = !e.target.checked;
                    } finally {
                        krlCheck.disabled = false;
                    }
                });
            }
            
            if (mrtCheck) {
                mrtCheck.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    mrtCheck.disabled = true;
                    
                    try {
                        if (e.target.checked) {
                            await this.modules.mrt.enable();
                        } else {
                            this.modules.mrt.disable();
                        }
                        updateButtonStatus();
                    } catch (error) {
                        console.error('Failed to toggle MRT:', error);
                        e.target.checked = !e.target.checked;
                    } finally {
                        mrtCheck.disabled = false;
                    }
                });
            }
            
            if (lrtCheck) {
                lrtCheck.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    lrtCheck.disabled = true;
                    
                    try {
                        if (e.target.checked) {
                            await this.modules.lrt.enable();
                        } else {
                            this.modules.lrt.disable();
                        }
                        updateButtonStatus();
                    } catch (error) {
                        console.error('Failed to toggle LRT:', error);
                        e.target.checked = !e.target.checked;
                    } finally {
                        lrtCheck.disabled = false;
                    }
                });
            }

            if (lrtjCheck) {
                lrtjCheck.addEventListener('change', async (e) => {
                    e.stopPropagation();
                    lrtjCheck.disabled = true;
                    try {
                        if (e.target.checked) {
                            await this.modules.lrtj.enable();
                        } else {
                            this.modules.lrtj.disable();
                        }
                        updateButtonStatus();
                    } catch (error) {
                        console.error('Failed to toggle LRT Jakarta:', error);
                        e.target.checked = !e.target.checked;
                    } finally {
                        lrtjCheck.disabled = false;
                    }
                });
            }
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

    // Show active routes modal
    showActiveRoutesModal() {
        const modal = document.getElementById('activeRoutesModal');
        const modalBody = document.getElementById('activeRoutesModalBody');
        
        if (!modal) return;
        
        // Show modal
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Load active routes
        this.loadActiveRoutesIntoModal(modalBody);
    }

    hideActiveRoutesModal() {
        const modal = document.getElementById('activeRoutesModal');
        if (!modal) return;
        
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }

    loadActiveRoutesIntoModal(modalBody) {
        try {
            const routes = this.modules.gtfs.getRoutes();
            const routeManager = this.modules.routes;
            
            if (!routes || !routeManager) {
                modalBody.innerHTML = '<div class="no-active-routes"><iconify-icon icon="mdi:alert-circle"></iconify-icon><p>Data tidak tersedia</p></div>';
                return;
            }

            // Categorize routes by status
            const categorizedRoutes = {
                active: [],
                inactive: []
            };

            routes.forEach(route => {
                try {
                    const isActive = routeManager.isRouteActiveNow(route.route_id);
                    if (isActive) {
                        categorizedRoutes.active.push(route);
                    } else {
                        categorizedRoutes.inactive.push(route);
                    }
                } catch (e) {
                    categorizedRoutes.inactive.push(route);
                }
            });

            // Sort routes naturally
            categorizedRoutes.active.sort((a, b) => this.modules.gtfs.naturalSort(a, b));
            categorizedRoutes.inactive.sort((a, b) => this.modules.gtfs.naturalSort(a, b));

            // Store all routes for filtering/search
            this.allRoutesData = {
                active: categorizedRoutes.active,
                inactive: categorizedRoutes.inactive,
                all: [...categorizedRoutes.active, ...categorizedRoutes.inactive]
            };

            // Update counts
            document.getElementById('activeCount').textContent = categorizedRoutes.active.length;
            document.getElementById('inactiveCount').textContent = categorizedRoutes.inactive.length;
            document.getElementById('allCount').textContent = routes.length;

            // Setup filter tabs
            this.setupActiveRoutesFilters();
            
            // Setup search
            this.setupActiveRoutesSearch();

            // Show active routes by default
            this.filterActiveRoutes('active');

        } catch (error) {
            console.error('Error loading active routes:', error);
            modalBody.innerHTML = '<div class="no-active-routes"><iconify-icon icon="mdi:alert-circle"></iconify-icon><p>Gagal memuat data layanan</p></div>';
        }
    }

    setupActiveRoutesFilters() {
        const tabs = document.querySelectorAll('.active-route-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                tab.classList.add('active');
                
                // Filter routes
                const filter = tab.getAttribute('data-filter');
                this.filterActiveRoutes(filter);
            });
        });
    }

    setupActiveRoutesSearch() {
        const searchInput = document.getElementById('activeRoutesSearch');
        const clearBtn = document.getElementById('clearActiveRoutesSearch');
        
        if (!searchInput || !clearBtn) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            clearBtn.style.display = query ? 'flex' : 'none';
            
            // Get current filter
            const activeTab = document.querySelector('.active-route-tab.active');
            const filter = activeTab ? activeTab.getAttribute('data-filter') : 'active';
            
            this.filterActiveRoutes(filter, query);
        });

        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.style.display = 'none';
            
            const activeTab = document.querySelector('.active-route-tab.active');
            const filter = activeTab ? activeTab.getAttribute('data-filter') : 'active';
            this.filterActiveRoutes(filter);
        });
    }

    filterActiveRoutes(filter, searchQuery = '') {
        const modalBody = document.getElementById('activeRoutesModalBody');
        if (!modalBody || !this.allRoutesData) return;

        let routesToShow = [];
        
        // Select routes based on filter
        if (filter === 'active') {
            routesToShow = this.allRoutesData.active;
        } else if (filter === 'inactive') {
            routesToShow = this.allRoutesData.inactive;
        } else {
            routesToShow = this.allRoutesData.all;
        }

        // Apply search filter
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            routesToShow = routesToShow.filter(route => {
                const shortName = (route.route_short_name || '').toLowerCase();
                const longName = (route.route_long_name || '').toLowerCase();
                return shortName.includes(lowerQuery) || longName.includes(lowerQuery);
            });
        }

        // Display results
        if (routesToShow.length === 0) {
            const message = searchQuery 
                ? 'Tidak ada rute yang cocok dengan pencarian' 
                : (filter === 'active' ? 'Tidak ada layanan yang beroperasi saat ini' : 'Tidak ada layanan');
            modalBody.innerHTML = `<div class="no-active-routes"><iconify-icon icon="mdi:${searchQuery ? 'magnify-close' : 'bus-clock'}"></iconify-icon><p>${message}</p></div>`;
            return;
        }

        const routesList = document.createElement('div');
        routesList.className = 'active-routes-list';

        routesToShow.forEach(route => {
            const isActive = this.allRoutesData.active.includes(route);
            const routeItem = this.createActiveRouteItem(route, isActive);
            routesList.appendChild(routeItem);
        });

        modalBody.innerHTML = '';
        modalBody.appendChild(routesList);
    }

    createActiveRouteItem(route, isActive = true) {
        const item = document.createElement('div');
        item.className = `active-route-item ${isActive ? 'status-active' : 'status-inactive'}`;
        
        const routeShortName = route.route_short_name || route.route_id;
        const routeLongName = route.route_long_name || '';
        const routeColor = route.route_color ? `#${route.route_color}` : '#3b82f6';
        
        // Get operating hours
        const hours = this.getRouteOperatingHours(route.route_id);
        let hoursText = 'Waktu operasional tidak tersedia';
        let is24Hour = false;
        
        if (hours) {
            // Use route-manager's formatOperatingHours logic
            hoursText = this.formatOperatingHours(hours.start, hours.end);
            
            // Check if it's 24-hour service
            if (hoursText.includes('24 jam') || hoursText.includes('24 Jam')) {
                is24Hour = true;
            }
        }
        
        const statusIcon = isActive ? 'mdi:check-circle' : 'mdi:sleep';
        const statusText = isActive ? 'Beroperasi' : 'Tidak Beroperasi';
        const statusClass = isActive ? 'status-operating' : 'status-closed';
        
        item.innerHTML = `
            <div class="active-route-badge" style="background: ${routeColor};">
                ${routeShortName}
            </div>
            <div class="active-route-info">
                <div class="active-route-name" title="${routeLongName}">
                    ${routeLongName || routeShortName}
                </div>
                <div class="active-route-time ${is24Hour ? 'time-24hour' : ''}">
                    <iconify-icon icon="${is24Hour ? 'mdi:clock-fast' : 'mdi:clock-outline'}"></iconify-icon>
                    ${hoursText}
                </div>
                <div class="active-route-status ${statusClass}">
                    <iconify-icon icon="${statusIcon}"></iconify-icon>
                    ${statusText}
                </div>
            </div>
        `;
        
        // Click to select route
        item.addEventListener('click', () => {
            this.hideActiveRoutesModal();
            if (this.modules.routes) {
                this.modules.routes.selectRoute(route.route_id);
            }
        });
        
        return item;
    }

    formatOperatingHours(start, end) {
        if (!start || !end) return 'Tidak tersedia';
        
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        
        // Check for 24-hour operation (00:00 - 23:59)
        if ((sh === 0 && sm === 0) && (eh === 23 && em === 59)) {
            return '24 Jam';
        }
        
        // Handle times >= 24:00 (next day)
        if (eh >= 24) {
            // Special case: 05:00 - 29:00 = 24 jam starting from 05:00
            if (sh === 5 && sm === 0 && eh === 29 && em === 0) {
                return '24 Jam';
            }
            // Another 24-hour case
            if (sh === 0 && sm === 0 && (eh === 24 || (eh === 23 && em === 59))) {
                return '24 Jam';
            }
            // Show as next day
            let endH = eh - 24;
            let endStr = `${String(endH).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
            return `${this.formatTimeString(start)} - ${endStr} (+1)`;
        }
        
        return `${this.formatTimeString(start)} - ${this.formatTimeString(end)}`;
    }

    formatTimeString(time) {
        if (!time) return '';
        const parts = time.split(':');
        return `${parts[0]}:${parts[1]}`;
    }

    getRouteOperatingHours(routeId) {
        try {
            const trips = this.modules.gtfs.getTrips().filter(t => t.route_id === routeId);
            if (trips.length === 0) return null;

            const frequencies = this.modules.gtfs.getFrequencies();
            const stopTimes = this.modules.gtfs.getStopTimes();
            const tripIds = trips.map(t => t.trip_id);
            const freqsForRoute = frequencies.filter(f => tripIds.includes(f.trip_id));

            let minStart = null;
            let maxEnd = null;
            let minStartSeconds = Infinity;
            let maxEndSeconds = -Infinity;

            // Try to get from frequencies first (more accurate for scheduled routes)
            if (freqsForRoute.length > 0) {
                const startTimes = freqsForRoute.map(f => f.start_time).filter(Boolean);
                const endTimes = freqsForRoute.map(f => f.end_time).filter(Boolean);
                
                if (startTimes.length > 0 && endTimes.length > 0) {
                    // Find earliest start and latest end
                    startTimes.forEach(time => {
                        const seconds = this.timeToSeconds(time);
                        if (seconds < minStartSeconds) {
                            minStartSeconds = seconds;
                            minStart = time;
                        }
                    });
                    
                    endTimes.forEach(time => {
                        const seconds = this.timeToSeconds(time);
                        if (seconds > maxEndSeconds) {
                            maxEndSeconds = seconds;
                            maxEnd = time;
                        }
                    });
                }
            }

            // Fallback to stop_times if frequencies not available
            if (!minStart || !maxEnd) {
                trips.forEach(trip => {
                    const tripStopTimes = stopTimes.filter(st => st.trip_id === trip.trip_id);
                    tripStopTimes.forEach(st => {
                        const time = st.departure_time || st.arrival_time;
                        if (time) {
                            const seconds = this.timeToSeconds(time);
                            if (seconds < minStartSeconds) {
                                minStartSeconds = seconds;
                                minStart = time;
                            }
                            if (seconds > maxEndSeconds) {
                                maxEndSeconds = seconds;
                                maxEnd = time;
                            }
                        }
                    });
                });
            }

            if (!minStart || !maxEnd || minStartSeconds === Infinity || maxEndSeconds === -Infinity) {
                return null;
            }

            return {
                start: minStart,
                end: maxEnd,
                startSeconds: minStartSeconds,
                endSeconds: maxEndSeconds
            };
        } catch (e) {
            console.error('Error getting route operating hours:', e);
            return null;
        }
    }

    timeToSeconds(time) {
        if (!time) return 0;
        const parts = time.split(':');
        if (parts.length < 2) return 0;
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        const seconds = parseInt(parts[2]) || 0;
        return hours * 3600 + minutes * 60 + seconds;
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600) % 24;
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.transJakartaApp = new TransJakartaApp();
    
    // Setup active routes modal
    const activeRoutesCard = document.getElementById('activeRoutesCard');
    const closeModalBtn = document.getElementById('closeActiveRoutesModal');
    const modalBackdrop = document.querySelector('.active-routes-modal-backdrop');
    
    if (activeRoutesCard) {
        activeRoutesCard.addEventListener('click', () => {
            window.transJakartaApp.showActiveRoutesModal();
        });
    }
    
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            window.transJakartaApp.hideActiveRoutesModal();
        });
    }
    
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', () => {
            window.transJakartaApp.hideActiveRoutesModal();
        });
    }
}); 