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

class TransJakartaApp {
    constructor() {
        this.modules = {};
        this._clockTimer = null;
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
            
            // Hide slide notification on error
            this.hideSlideNotification();
            this.showError('Gagal memuat aplikasi: ' + (error.message || 'Unknown error'));
        }
    }

    // Show initial slide notification
    showInitialLoading() {
        const notification = document.getElementById('slideNotification');
        if (notification) {
            notification.style.display = 'block';
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            
            // Set initial values
            const title = notification.querySelector('.slide-title');
            const subtitle = notification.querySelector('.slide-subtitle');
            const percentEl = notification.querySelector('.slide-percent');
            const icon = notification.querySelector('.slide-icon');
            
            if (title) title.textContent = 'Memuat JakMove';
            if (subtitle) subtitle.textContent = '🚀 Memulai aplikasi...';
            if (percentEl) percentEl.textContent = '1%';
            if (icon) icon.innerHTML = '<i class="fas fa-rocket" style="color: #ec4899;"></i>';
        }
        
        // Update page title
        document.title = '1% Loading - JakMove';
        
        console.log('📱 Initial slide notification activated');
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
            
            // Wait for essential checks with faster polling for quicker response
            const timeout = 2000; // Reduced timeout for faster loading
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
                    console.log('✅ All critical data structures ready (fast)');
                    // Minimal wait for faster loading
                    await new Promise(resolve => setTimeout(resolve, 25));
                    break;
                }
                
                // Faster polling for quicker response
                await new Promise(resolve => setTimeout(resolve, 25));
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
        const timeout = 10000; // 10 second timeout
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (window.gtfsDataReady === true) {
                console.log('✅ GTFS data marked as ready');
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Small wait to ensure slide notification had time to show completion
        await new Promise(resolve => setTimeout(resolve, 200));
        
        console.log('🎯 Data loading completion verified');
    }

    // Deferred initialization for heavy UI components - now async to wait for completion
    async deferredUIInit() {
        console.log('🔄 Starting deferred UI initialization...');
        
        const deferredTasks = [
            { name: 'UI Manager', task: () => this.modules.ui.init() },
            { name: 'Journey Planner', task: () => this.modules.journey.init() },
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

        // Execute all tasks and wait for completion
        return new Promise((resolve) => {
            let taskIndex = 0;
            
            const executeNextTask = () => {
                if (taskIndex < deferredTasks.length) {
                    const currentTask = deferredTasks[taskIndex];
                    console.log(`🔧 Executing: ${currentTask.name}`);
                    
                    try {
                        currentTask.task();
                    } catch (e) {
                        console.warn(`Deferred task failed (${currentTask.name}):`, e);
                    }
                    
                    taskIndex++;
                    
                    // Schedule next task
                    if (window.requestIdleCallback) {
                        requestIdleCallback(executeNextTask, { timeout: 1000 });
                    } else {
                        setTimeout(executeNextTask, 16);
                    }
                } else {
                    console.log('✅ All deferred UI tasks completed');
                    resolve();
                }
            };

            // Start executing deferred tasks
            if (window.requestIdleCallback) {
                requestIdleCallback(executeNextTask, { timeout: 1000 });
            } else {
                setTimeout(executeNextTask, 0);
            }
        });
    }

    // Wait for complete UI readiness using enhanced slide notification
    async waitForCompleteUIReady() {
        console.log('⏳ Waiting for complete UI readiness...');
        
        // Update slide notification to UI preparation mode
        this.updateSlideNotificationForUI(0, 'Menyiapkan antarmuka...');
        
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
        
        const timeout = 5000;
        const startTime = Date.now();
        let progress = 0;
        
        while (Date.now() - startTime < timeout) {
            const readyStates = uiReadyChecks.map(item => {
                try {
                    return item.check();
                } catch (e) {
                    return false;
                }
            });
            
            const readyCount = readyStates.filter(state => state).length;
            progress = (readyCount / uiReadyChecks.length) * 100;
            
            // Update slide notification for UI phase
            const readyNames = uiReadyChecks
                .filter((item, index) => readyStates[index])
                .map(item => item.name);
            
            const statusText = progress < 100 
                ? `Memuat komponen... (${readyCount}/${uiReadyChecks.length})`
                : 'Antarmuka siap!';
                
            this.updateSlideNotificationForUI(progress, statusText);
            
            if (readyStates.every(state => state)) {
                console.log('✅ Complete UI is ready');
                break;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Final completion
        this.updateSlideNotificationForUI(100, 'Antarmuka siap!');
        
        // Additional wait to ensure all rendering is complete
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Hide slide notification
        this.hideSlideNotification();
        
        console.log('🎯 UI readiness check completed');
    }

    // Mark app as fully ready
    markAppAsReady() {
        console.log('🎉 App is fully ready!');
        
        // Final slide notification update before hiding
        const notification = document.getElementById('slideNotification');
        if (notification) {
            const icon = notification.querySelector('.slide-icon');
            const title = notification.querySelector('.slide-title');
            const subtitle = notification.querySelector('.slide-subtitle');
            const percentEl = notification.querySelector('.slide-percent');
            
            if (icon) icon.innerHTML = '<i class="fas fa-check-circle" style="color: #22c55e;"></i>';
            if (title) title.textContent = 'Siap Digunakan!';
            if (subtitle) subtitle.textContent = 'Aplikasi berhasil dimuat';
            if (percentEl) percentEl.textContent = '100%';
            
            // Hide after showing completion
            setTimeout(() => {
                this.hideSlideNotification();
            }, 1500);
        }
        
        // Update page title
        document.title = 'JakMove - Transportasi Jakarta';
        
        // Mark global ready state
        window.jakMoveReady = true;
        
        console.log('🚀 App completely initialized and ready for use!');
    }

    // Show slide notification for UI preparation
    showSlideNotification() {
        const notification = document.getElementById('slideNotification');
        if (notification) {
            notification.style.display = 'block';
            // Small delay for smooth animation
            setTimeout(() => {
                notification.classList.add('show');
            }, 100);
            console.log('📱 Slide notification shown');
        }
    }

    // Update slide notification for UI preparation phase
    updateSlideNotificationForUI(progress, statusText) {
        const notification = document.getElementById('slideNotification');
        if (!notification) return;
        
        const progressBar = notification.querySelector('.slide-progress-bar');
        const title = notification.querySelector('.slide-title');
        const subtitle = notification.querySelector('.slide-subtitle');
        const percentEl = notification.querySelector('.slide-percent');
        const icon = notification.querySelector('.slide-icon');
        
        // Update progress bar
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.style.animation = 'none'; // Remove auto animation
        }
        
        // Update percentage
        if (percentEl) {
            percentEl.textContent = `${Math.round(progress)}%`;
        }
        
        // Update status text
        if (subtitle) {
            subtitle.textContent = statusText;
        }
        
        // Update icon and title for UI phase
        if (icon && title) {
            if (progress >= 100) {
                icon.innerHTML = '<i class="fas fa-star" style="color: #fbbf24;"></i>';
                title.textContent = 'Siap Digunakan!';
            } else {
                icon.innerHTML = '<i class="fas fa-bolt" style="color: #3b82f6;"></i>';
                title.textContent = 'Menyiapkan Antarmuka';
            }
        }
        
        console.log(`🔧 UI Preparation: ${Math.round(progress)}% - ${statusText}`);
    }

    // Hide slide notification
    hideSlideNotification() {
        const notification = document.getElementById('slideNotification');
        if (notification) {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.style.display = 'none';
                console.log('📱 Slide notification hidden');
            }, 500);
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