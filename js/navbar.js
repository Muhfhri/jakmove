// Navbar Hamburger Animation
document.addEventListener('DOMContentLoaded', function() {
    const hamburgerBtn = document.querySelector('.custom-toggler');
    const hamburgerLines = document.querySelectorAll('.hamburger-line');
    const offcanvas = document.getElementById('navbarOffcanvas');
    
    // Function to reset hamburger to 2 lines
    function resetHamburger() {
        hamburgerBtn.classList.remove('active');
        hamburgerLines.forEach(line => {
            line.classList.remove('active');
            line.style.transform = 'rotate(0deg) translate(0px, 0px)';
        });
    }
    
    // Function to animate hamburger to X
    function animateToX() {
        hamburgerBtn.classList.add('active');
        hamburgerLines.forEach((line, index) => {
            line.classList.add('active');
            if (index === 0) {
                // First line rotates 45 degrees
                line.style.transform = 'rotate(45deg) translate(3px, 3px)';
            } else if (index === 1) {
                // Second line rotates -45 degrees
                line.style.transform = 'rotate(-45deg) translate(3px, -3px)';
            }
        });
    }
    
    // Function to prevent horizontal scroll
    function preventHorizontalScroll() {
        // Don't change scroll position, just prevent horizontal scroll
        document.body.classList.add('offcanvas-open');
    }
    
    // Function to allow horizontal scroll
    function allowHorizontalScroll() {
        document.body.classList.remove('offcanvas-open');
    }
    
    // Reset hamburger state when offcanvas is hidden (any method)
    offcanvas.addEventListener('hidden.bs.offcanvas', function() {
        setTimeout(resetHamburger, 100); // Small delay to ensure animation completes
        allowHorizontalScroll();
    });
    
    // Also reset when offcanvas starts hiding
    offcanvas.addEventListener('hide.bs.offcanvas', function() {
        resetHamburger();
        allowHorizontalScroll();
    });
    
    // Animate hamburger when offcanvas is shown
    offcanvas.addEventListener('shown.bs.offcanvas', function() {
        animateToX();
        preventHorizontalScroll();
    });
    
    // Prevent horizontal scroll when offcanvas starts showing
    offcanvas.addEventListener('show.bs.offcanvas', function() {
        preventHorizontalScroll();
    });
    
    // Toggle hamburger animation when clicked
    hamburgerBtn.addEventListener('click', function() {
        const isActive = hamburgerBtn.classList.contains('active');
        
        if (!isActive) {
            // Animate to X
            animateToX();
        } else {
            // Animate back to lines
            resetHamburger();
        }
    });
    
    // Close offcanvas when clicking on menu items
    const menuItems = document.querySelectorAll('.nav-menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            // Close offcanvas
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvas);
            if (offcanvasInstance) {
                offcanvasInstance.hide();
            }
            
            // Reset hamburger
            resetHamburger();
            allowHorizontalScroll();
        });
    });
    
    // Listen for close button clicks
    const closeBtn = document.querySelector('.btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            resetHamburger();
            allowHorizontalScroll();
        });
    }
    
    // Listen for backdrop clicks
    offcanvas.addEventListener('click', function(e) {
        if (e.target === offcanvas) {
            resetHamburger();
            allowHorizontalScroll();
        }
    });
    
    // Listen for ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const offcanvasInstance = bootstrap.Offcanvas.getInstance(offcanvas);
            if (offcanvasInstance && offcanvasInstance._isShown) {
                resetHamburger();
                allowHorizontalScroll();
            }
        }
    });
    
    // Force reset on page load to ensure clean state
    resetHamburger();
    allowHorizontalScroll();
}); 