// Main application entry point
import { GTFSLoader } from './modules/gtfs-loader.js';
import { MapManager } from './modules/map-manager.js';
import { RouteManager } from './modules/route-manager.js';
import { StopManager } from './modules/stop-manager.js';
import { SearchManager } from './modules/search-manager.js';
import { LocationManager } from './modules/location-manager.js';
import { UIManager } from './modules/ui-manager.js';

class TransJakartaApp {
    constructor() {
        this.modules = {};
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
            this.modules.location = new LocationManager();
            this.modules.ui = new UIManager();

            // Load GTFS data
            await this.modules.gtfs.loadData();
            
            // Initialize map
            this.modules.map.init();
            
            // Setup UI (dropdowns, buttons)
            this.modules.ui.init();

            // Setup event listeners
            this.setupEventListeners();
            
            // Load saved state
            this.loadSavedState();
            
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
            });
        }

        // Search input
        const searchInput = document.getElementById('searchStop');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.modules.search.handleSearch(e.target.value);
            });
        }
    }

    loadSavedState() {
        const savedRouteId = localStorage.getItem('activeRouteId');
        if (savedRouteId) {
            this.modules.routes.selectRoute(savedRouteId);
        }
    }

    resetApp() {
        // Reset all modules
        Object.values(this.modules).forEach(module => {
            if (module.reset) module.reset();
        });
        
        // Clear localStorage
        localStorage.removeItem('activeRouteId');
        
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