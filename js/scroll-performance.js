// Scroll Performance Optimizer
// Mengatasi masalah jitter/lag saat scrolling

class ScrollPerformanceOptimizer {
    constructor() {
        this.isScrolling = false;
        this.scrollTimer = null;
        this.rafId = null;
        this.lastScrollTop = 0;
        this.scrollThrottle = this.throttle(this.handleScroll.bind(this), 16); // 60fps
        
        this.init();
    }

    init() {
        // Passive event listeners untuk better performance
        window.addEventListener('scroll', this.scrollThrottle, { passive: true });
        window.addEventListener('wheel', this.handleWheel.bind(this), { passive: true });
        window.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
        window.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
        
        // Intersection Observer untuk lazy animations
        this.setupIntersectionObserver();
        
        // Optimize selectors
        this.cacheSelectors();
    }

    cacheSelectors() {
        this.body = document.body;
        this.scrollableElements = document.querySelectorAll('.stops-container, .search-results, .list-group');
        this.animatedElements = document.querySelectorAll('.badge-koridor-interaktif, .list-group-item, .btn');
    }

    handleScroll() {
        if (!this.isScrolling) {
            this.isScrolling = true;
            this.body.classList.add('scrolling');
            
            // Disable hover effects saat scrolling
            this.disableHoverEffects();
        }

        // Clear previous timer
        clearTimeout(this.scrollTimer);
        
        // Optimize scroll berdasarkan direction
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const isScrollingDown = currentScrollTop > this.lastScrollTop;
        this.lastScrollTop = currentScrollTop;

        // Set timer untuk detect scroll end
        this.scrollTimer = setTimeout(() => {
            this.isScrolling = false;
            this.body.classList.remove('scrolling');
            this.body.classList.add('scroll-ended');
            
            // Re-enable hover effects
            this.enableHoverEffects();
            
            // Clean up class after transition
            setTimeout(() => {
                this.body.classList.remove('scroll-ended');
            }, 150);
            
        }, 150); // 150ms delay untuk detect scroll end
    }

    handleWheel(event) {
        // Optimize wheel events
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        this.rafId = requestAnimationFrame(() => {
            // Additional wheel-specific optimizations jika diperlukan
        });
    }

    handleTouchStart(event) {
        // Optimize touch scrolling
        this.body.classList.add('touching');
    }

    handleTouchMove(event) {
        // Throttle touch move events
        if (!this.touchMoveTimer) {
            this.touchMoveTimer = setTimeout(() => {
                this.touchMoveTimer = null;
            }, 16);
        }
    }

    disableHoverEffects() {
        // Disable expensive hover effects saat scrolling
        this.animatedElements.forEach(el => {
            el.style.pointerEvents = 'none';
        });
    }

    enableHoverEffects() {
        // Re-enable hover effects setelah scroll selesai
        this.animatedElements.forEach(el => {
            el.style.pointerEvents = '';
        });
    }

    setupIntersectionObserver() {
        // Lazy animation dengan Intersection Observer
        const observerOptions = {
            rootMargin: '50px 0px',
            threshold: 0.1
        };

        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    entry.target.classList.remove('out-view');
                } else {
                    entry.target.classList.add('out-view');
                    entry.target.classList.remove('in-view');
                }
            });
        }, observerOptions);

        // Observe lazy animated elements
        document.querySelectorAll('.lazy-animate').forEach(el => {
            this.intersectionObserver.observe(el);
        });
    }

    // Throttle function untuk better performance
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Debounce function
    debounce(func, wait, immediate) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            const later = function() {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    // Method untuk manually optimize elemen baru
    optimizeNewElements(container) {
        if (!container) return;
        
        // Add performance classes ke elemen baru
        const newItems = container.querySelectorAll('.list-group-item, .badge-koridor-interaktif');
        newItems.forEach(item => {
            item.style.willChange = 'transform, opacity';
            item.style.transform = 'translate3d(0, 0, 0)';
            item.style.backfaceVisibility = 'hidden';
        });

        // Setup lazy animation untuk elemen baru
        const lazyElements = container.querySelectorAll('.lazy-animate');
        lazyElements.forEach(el => {
            this.intersectionObserver.observe(el);
        });
    }

    // Clean up method
    destroy() {
        window.removeEventListener('scroll', this.scrollThrottle);
        window.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('touchstart', this.handleTouchStart);
        window.removeEventListener('touchmove', this.handleTouchMove);
        
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        clearTimeout(this.scrollTimer);
        clearTimeout(this.touchMoveTimer);
    }
}

// CSS-in-JS optimizations untuk dynamic elements
class CSSOptimizer {
    static applyPerformanceStyles(element) {
        if (!element) return;
        
        const performanceStyles = {
            willChange: 'transform, opacity',
            transform: 'translate3d(0, 0, 0)',
            backfaceVisibility: 'hidden',
            contain: 'layout paint'
        };
        
        Object.assign(element.style, performanceStyles);
    }
    
    static removePerformanceStyles(element) {
        if (!element) return;
        
        element.style.willChange = 'auto';
        element.style.transform = '';
        element.style.backfaceVisibility = '';
        element.style.contain = '';
    }
    
    // Optimize untuk search results yang frequently updated
    static optimizeSearchResults() {
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            this.applyPerformanceStyles(searchResults);
            
            // Setup mutation observer untuk auto-optimize new elements
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.applyPerformanceStyles(node);
                            
                            // Apply ke child elements juga
                            const children = node.querySelectorAll('.list-group-item, .badge-koridor-interaktif');
                            children.forEach(child => this.applyPerformanceStyles(child));
                        }
                    });
                });
            });
            
            observer.observe(searchResults, {
                childList: true,
                subtree: true
            });
        }
    }
}

// Memory management untuk long scrolling sessions
class MemoryOptimizer {
    constructor() {
        this.cleanupInterval = null;
        this.startCleanupCycle();
    }
    
    startCleanupCycle() {
        // Clean up setiap 30 detik
        this.cleanupInterval = setInterval(() => {
            this.cleanupUnusedElements();
            this.optimizeMemoryUsage();
        }, 30000);
    }
    
    cleanupUnusedElements() {
        // Remove akan-change dari elements yang tidak visible
        const allAnimatedElements = document.querySelectorAll('[style*="will-change"]');
        allAnimatedElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (!isVisible) {
                el.style.willChange = 'auto';
            }
        });
    }
    
    optimizeMemoryUsage() {
        // Force garbage collection hints
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
        
        // Clear unnecessary caches
        if (window.transJakartaApp && window.transJakartaApp.modules.search) {
            const searchModule = window.transJakartaApp.modules.search;
            if (searchModule._searchCache && searchModule._searchCache.size > 50) {
                // Clear old cache entries
                const entries = Array.from(searchModule._searchCache.entries());
                const toKeep = entries.slice(-25); // Keep last 25 entries
                searchModule._searchCache.clear();
                toKeep.forEach(([key, value]) => {
                    searchModule._searchCache.set(key, value);
                });
            }
        }
    }
    
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Initialize optimizers setelah DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize scroll performance optimizer
    window.scrollOptimizer = new ScrollPerformanceOptimizer();
    
    // Initialize CSS optimizer
    CSSOptimizer.optimizeSearchResults();
    
    // Initialize memory optimizer
    window.memoryOptimizer = new MemoryOptimizer();
    
    console.log('Scroll performance optimizations initialized');
});

// Export untuk digunakan di modules lain
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ScrollPerformanceOptimizer,
        CSSOptimizer,
        MemoryOptimizer
    };
}
