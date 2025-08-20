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

            // Load GTFS data
            await this.modules.gtfs.loadData();
            this.modules.settings.init();
            
            // Initialize map
            this.modules.map.init();
            
            // Setup UI (dropdowns, buttons)
            this.modules.ui.init();
            this.modules.journey.init();

            // Setup event listeners
            this.setupEventListeners();
            
            // Start live clock
            this.initLiveClock();
            
            // Load saved state
            this.loadSavedState();

            // Handle URL parameter for direct route selection (e.g., index.html?route_id=3F)
            try {
                const url = new URL(window.location.href);
                const routeParam = url.searchParams.get('route_id');
                if (routeParam) {
                    this.modules.routes.selectRoute(routeParam);
                }
            } catch (e) {}
            
            console.log('TransJakarta App initialized successfully');
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Gagal memuat aplikasi');
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