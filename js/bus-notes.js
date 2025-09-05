// Bus Notes Manager
class BusNotesManager {
    constructor() {
        this.notes = [];
        this.gtfsRoutes = [];
        this.init();
    }

    async init() {
        await this.loadGTFSRoutes();
        this.loadNotes();
        this.initializeEventListeners();
        this.updateNotesDisplay();
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Form submission
        document.getElementById('busNoteForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNote();
        });

        // Bus number input for real-time detection
        document.getElementById('busNumber').addEventListener('input', (e) => {
            this.detectBusInfo(e.target.value);
        });

        // Clear form button
        document.getElementById('clearForm').addEventListener('click', () => {
            this.clearForm();
        });

        // Export notes button
        document.getElementById('exportNotes').addEventListener('click', () => {
            this.exportNotes();
        });

        // Clear all notes button
        document.getElementById('clearAllNotes').addEventListener('click', () => {
            this.clearAllNotes();
        });

        // Route filter
        document.getElementById('routeFilter').addEventListener('change', (e) => {
            this.filterByRoute(e.target.value);
        });
    }

    // Load GTFS routes data
    async loadGTFSRoutes() {
        try {
            const response = await fetch('gtfs/routes.txt');
            const csvText = await response.text();
            this.gtfsRoutes = this.parseCSV(csvText);
            console.log('GTFS routes loaded:', this.gtfsRoutes.length);
        } catch (error) {
            console.error('Error loading GTFS routes:', error);
            this.gtfsRoutes = [];
        }
    }

    // Parse CSV data (handle quotes and commas properly)
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = this.parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = this.parseCSVLine(lines[i]);
                const row = {};
                headers.forEach((header, index) => {
                    row[header.trim()] = values[index] ? values[index].trim() : '';
                });
                data.push(row);
            }
        }
        
        return data;
    }

    // Parse a single CSV line (handle quotes)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    current += '"';
                    i++; // skip next quote
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        return result;
    }

    // Get route info from GTFS data
    getRouteInfo(routeCode) {
        if (!this.gtfsRoutes || this.gtfsRoutes.length === 0) {
            console.log('No GTFS routes loaded yet');
            return null;
        }

        const upperCode = routeCode.toUpperCase();
        console.log('Looking for route:', upperCode, 'in', this.gtfsRoutes.length, 'routes');
        
        const route = this.gtfsRoutes.find(r => 
            r.route_short_name === upperCode || 
            r.route_id === upperCode
        );

        console.log('Found route:', route);

        if (route) {
            const color = route.route_color ? '#' + route.route_color : '#6c757d';
            return {
                name: route.route_long_name || route.route_short_name || routeCode,
                color: color
            };
        }

        return null;
    }

    // Detect bus info from number input
    detectBusInfo(input) {
        const busInfoPreview = document.getElementById('busInfoPreview');
        const busTypeInput = document.getElementById('busType');
        const busOperatorInput = document.getElementById('busOperator');

        if (!input.trim()) {
            busInfoPreview.style.display = 'none';
            busTypeInput.value = '';
            busOperatorInput.value = '';
            return;
        }

        // Use the searchBusByNumber function from tjNumberSearch.js
        if (typeof searchBusByNumber === 'function') {
            const results = searchBusByNumber(input);
            
            if (results.length > 0) {
                const bus = results[0];
                busTypeInput.value = bus.tipe || '';
                busOperatorInput.value = bus.operator || '';
                
                // Show preview
                busInfoPreview.innerHTML = this.generateBusPreview(bus);
                busInfoPreview.style.display = 'block';
            } else {
                busInfoPreview.style.display = 'none';
                busTypeInput.value = 'Tidak dikenali';
                busOperatorInput.value = 'Tidak dikenali';
            }
        } else {
            // Fallback if function not available
            busTypeInput.value = 'Membutuhkan data bus';
            busOperatorInput.value = 'Membutuhkan data bus';
        }
    }

    // Generate bus preview HTML
    generateBusPreview(bus) {
        const badgeNumber = `${bus.operatorCode || ''}-${bus.number || ''}`;
        
        // Get bus image if available from tjNumberSearch
        let busImage = '';
        if (typeof busImages !== 'undefined' && bus.tipe) {
            // Try to find exact match first
            let imageUrl = busImages[bus.tipe];
            
            // Fallback search for partial matches
            if (!imageUrl) {
                const tipeNormalized = bus.tipe.toLowerCase();
                for (const [key, url] of Object.entries(busImages)) {
                    if (key.toLowerCase().includes(tipeNormalized.split(' ')[0]) || 
                        tipeNormalized.includes(key.toLowerCase().split(' ')[0])) {
                        imageUrl = url;
                        break;
                    }
                }
            }
            
            // Special cases for specific operators and types
            if (!imageUrl) {
                if (bus.operator === 'Bianglala Metropolitan' && bus.tipe === 'SAG Golden Dragon Pivot E12') {
                    if (bus.number && bus.number.startsWith('23')) {
                        imageUrl = busImages['SAG Golden Dragon Pivot E12 Non BRT'];
                    } else {
                        imageUrl = busImages['SAG Golden Dragon Pivot E12'];
                    }
                } else if (bus.operator === 'Mayasari Bakti' && bus.tipe === 'VKTR BYD B12') {
                    if (bus.warna && bus.warna.toLowerCase().includes('tosca')) {
                        imageUrl = busImages['Mayasari VKTR BYD B12 Tosca'];
                    } else {
                        imageUrl = busImages['Mayasari VKTR BYD B12 Putih Orange'];
                    }
                }
            }
            
            if (imageUrl) {
                busImage = `
                    <div class="col-12 mb-3">
                        <img src="${imageUrl}" alt="${bus.tipe}" 
                             style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px;" 
                             class="bus-preview-image">
                    </div>
                `;
            }
        }
        
        return `
            <div class="bus-info-preview">
                <div class="row align-items-center">
                    ${busImage}
                    <div class="col-md-4 text-center mb-2 mb-md-0">
                        <span class="badge bg-primary fs-5 px-3 py-2 bus-preview-badge">${badgeNumber}</span>
                    </div>
                    <div class="col-md-8">
                        <div class="bus-preview-details">
                            <div class="row g-2">
                                <div class="col-sm-6">
                                    <strong>Operator:</strong><br>
                                    <span class="text-primary">${bus.operator || 'Tidak diketahui'}</span>
                                </div>
                                <div class="col-sm-6">
                                    <strong>Tipe Bus:</strong><br>
                                    <span class="text-success">${bus.tipe || 'Tidak diketahui'}</span>
                                </div>
                                ${bus.warna ? `
                                <div class="col-sm-6">
                                    <strong>Warna:</strong><br>
                                    <span>${bus.warna}</span>
                                </div>
                                ` : ''}
                                ${bus.bahanBakar ? `
                                <div class="col-sm-6">
                                    <strong>Bahan Bakar:</strong><br>
                                    <span>${bus.bahanBakar}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Add new note
    addNote() {
        const busNumber = document.getElementById('busNumber').value.trim();
        const busType = document.getElementById('busType').value.trim();
        const busOperator = document.getElementById('busOperator').value.trim();
        const busRoute = document.getElementById('busRoute').value.trim();
        const noteText = document.getElementById('noteText').value.trim();

        if (!busNumber) {
            this.showAlert('Nomor bus harus diisi!', 'warning');
            return;
        }

        // Check if note already exists
        const existingNote = this.notes.find(note => 
            note.busNumber.toLowerCase() === busNumber.toLowerCase()
        );

        if (existingNote) {
            this.showAlert('Catatan untuk nomor bus ini sudah ada!', 'warning');
            return;
        }

        // Get bus image URL if available
        let busImageUrl = '';
        if (typeof busImages !== 'undefined' && busType && busType !== 'Tidak diketahui') {
            busImageUrl = this.getBusImageUrl(busType, busOperator, busNumber);
        }

        const newNote = {
            id: Date.now().toString(),
            busNumber: busNumber.toUpperCase(),
            busType: busType || 'Tidak diketahui',
            busOperator: busOperator || 'Tidak diketahui',
            busRoute: busRoute || '',
            noteText: noteText,
            busImageUrl: busImageUrl,
            dateAdded: new Date().toISOString(),
            timestamp: Date.now()
        };

        this.notes.unshift(newNote); // Add to beginning of array
        this.saveNotes();
        this.updateNotesDisplay();
        this.clearForm();
        this.showAlert('Catatan berhasil disimpan!', 'success');
    }

    // Get bus image URL from busImages
    getBusImageUrl(busType, busOperator, busNumber) {
        if (typeof busImages === 'undefined') return '';
        
        // Try exact match first
        let imageUrl = busImages[busType];
        
        // Fallback search for partial matches
        if (!imageUrl) {
            const tipeNormalized = busType.toLowerCase();
            for (const [key, url] of Object.entries(busImages)) {
                if (key.toLowerCase().includes(tipeNormalized.split(' ')[0]) || 
                    tipeNormalized.includes(key.toLowerCase().split(' ')[0])) {
                    imageUrl = url;
                    break;
                }
            }
        }
        
        // Special cases
        if (!imageUrl) {
            if (busOperator === 'Bianglala Metropolitan' && busType === 'SAG Golden Dragon Pivot E12') {
                if (busNumber && busNumber.includes('23')) {
                    imageUrl = busImages['SAG Golden Dragon Pivot E12 Non BRT'];
                } else {
                    imageUrl = busImages['SAG Golden Dragon Pivot E12'];
                }
            } else if (busOperator === 'Mayasari Bakti' && busType === 'VKTR BYD B12') {
                imageUrl = busImages['Mayasari VKTR BYD B12 Tosca'] || busImages['Mayasari VKTR BYD B12 Putih Orange'];
            }
        }
        
        return imageUrl || '';
    }

    // Delete note
    deleteNote(noteId) {
        if (confirm('Yakin ingin menghapus catatan ini?')) {
            this.notes = this.notes.filter(note => note.id !== noteId);
            this.saveNotes();
            this.updateNotesDisplay();
            this.showAlert('Catatan berhasil dihapus!', 'info');
        }
    }

    // Clear form
    clearForm() {
        document.getElementById('busNoteForm').reset();
        document.getElementById('busInfoPreview').style.display = 'none';
        document.getElementById('busType').value = '';
        document.getElementById('busOperator').value = '';
        document.getElementById('busRoute').value = '';
    }

    // Update notes display
    updateNotesDisplay() {
        const savedNotesContainer = document.getElementById('savedNotes');
        const noteCountBadge = document.getElementById('noteCount');
        const totalNotesDisplay = document.getElementById('totalNotesDisplay');
        
        noteCountBadge.textContent = this.notes.length;
        if (totalNotesDisplay) {
            totalNotesDisplay.textContent = this.notes.length;
        }
        
        // Update route statistics
        this.updateRouteStats();

        if (this.notes.length === 0) {
            savedNotesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <iconify-icon icon="mdi:note-outline"></iconify-icon>
                    </div>
                    <h6 class="empty-title">Belum ada catatan tersimpan</h6>
                    <p class="empty-subtitle">Mulai catat nomor bus untuk kemudahan di masa depan</p>
                </div>
            `;
            return;
        }

        savedNotesContainer.innerHTML = this.notes.map(note => 
            this.generateNoteCard(note)
        ).join('');
    }

    // Update route statistics
    updateRouteStats() {
        const totalRoutesDisplay = document.getElementById('totalRoutesDisplay');
        if (totalRoutesDisplay) {
            // Get unique routes from notes
            const uniqueRoutes = new Set(
                this.notes
                    .filter(note => note.busRoute && note.busRoute.trim() !== '')
                    .map(note => note.busRoute.trim().toUpperCase())
            );
            totalRoutesDisplay.textContent = uniqueRoutes.size;
        }
        
        // Update route filter dropdown
        this.updateRouteFilter();
    }

    // Update route filter dropdown
    updateRouteFilter() {
        const routeFilter = document.getElementById('routeFilter');
        if (routeFilter) {
            // Get unique routes
            const uniqueRoutes = new Set(
                this.notes
                    .filter(note => note.busRoute && note.busRoute.trim() !== '')
                    .map(note => note.busRoute.trim().toUpperCase())
            );

            // Sort routes
            const sortedRoutes = Array.from(uniqueRoutes).sort((a, b) => {
                // Sort numerically if possible, otherwise alphabetically
                const aNum = parseInt(a);
                const bNum = parseInt(b);
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return aNum - bNum;
                }
                return a.localeCompare(b);
            });

            // Clear existing options except "Semua Rute"
            const currentValue = routeFilter.value;
            routeFilter.innerHTML = '<option value="">Semua Rute</option>';
            
            // Add route options
            sortedRoutes.forEach(route => {
                const option = document.createElement('option');
                option.value = route;
                option.textContent = `Rute ${route}`;
                routeFilter.appendChild(option);
            });

            // Restore selected value if it still exists
            if (currentValue && sortedRoutes.includes(currentValue)) {
                routeFilter.value = currentValue;
            }
        }
    }

    // Filter notes by route
    filterByRoute(selectedRoute) {
        const savedNotesContainer = document.getElementById('savedNotes');
        
        let filteredNotes = this.notes;
        if (selectedRoute) {
            filteredNotes = this.notes.filter(note => 
                note.busRoute && note.busRoute.trim().toUpperCase() === selectedRoute
            );
        }

        if (filteredNotes.length === 0) {
            const message = selectedRoute 
                ? `Tidak ada catatan untuk rute ${selectedRoute}`
                : 'Belum ada catatan tersimpan';
            
            savedNotesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <iconify-icon icon="mdi:note-outline"></iconify-icon>
                    </div>
                    <h6 class="empty-title">${message}</h6>
                    <p class="empty-subtitle">Mulai catat nomor bus untuk kemudahan di masa depan</p>
                </div>
            `;
        } else {
            savedNotesContainer.innerHTML = filteredNotes.map(note => 
                this.generateNoteCard(note)
            ).join('');
        }
    }

    // Generate route display with color and full name from GTFS
    generateRouteDisplay(routeCode) {
        const routeInfo = this.getRouteInfo(routeCode);
        
        console.log('Route lookup for:', routeCode, 'Found:', routeInfo, 'Total routes:', this.gtfsRoutes.length);
        
        if (routeInfo) {
            return `
                <div class="bus-note-route mb-3">
                    <iconify-icon icon="mdi:map-marker-path" class="me-2"></iconify-icon>
                    <span class="route-badge" style="background-color: ${routeInfo.color};">
                        ${routeCode} ${routeInfo.name}
                    </span>
                </div>
            `;
        } else {
            // Fallback jika rute tidak ditemukan di data GTFS
            return `
                <div class="bus-note-route mb-3">
                    <iconify-icon icon="mdi:map-marker-path" class="me-2"></iconify-icon>
                    <span class="route-badge">Rute ${routeCode}</span>
                </div>
            `;
        }
    }

    // Generate note card HTML
    generateNoteCard(note) {
        const date = new Date(note.dateAdded);
        const formattedDate = date.toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Get bus image URL (for older notes that might not have it saved)
        let busImageUrl = note.busImageUrl;
        if (!busImageUrl && note.busType && note.busType !== 'Tidak diketahui') {
            busImageUrl = this.getBusImageUrl(note.busType, note.busOperator, note.busNumber);
        }

        return `
            <div class="bus-note-card">
                ${busImageUrl ? `
                    <div class="bus-note-image mb-3">
                        <img src="${busImageUrl}" alt="${note.busType}" 
                             style="width: 100%; height: 150px; object-fit: cover; border-radius: 8px;" 
                             class="bus-card-image">
                    </div>
                ` : ''}
                
                <div class="d-flex justify-content-between align-items-start mb-3">
                    <span class="badge bg-primary bus-note-number">${note.busNumber}</span>
                    <button class="btn-action btn-action-danger delete-note-btn" onclick="busNotesManager.deleteNote('${note.id}')" title="Hapus catatan">
                        <iconify-icon icon="mdi:delete"></iconify-icon>
                    </button>
                </div>
                
                <div class="bus-note-operator mb-2">${note.busOperator}</div>
                <div class="bus-note-type mb-2">${note.busType}</div>
                
                ${note.busRoute ? this.generateRouteDisplay(note.busRoute) : ''}
                
                ${note.noteText ? `
                    <div class="bus-note-text mb-3">
                        <iconify-icon icon="mdi:note-text" class="me-2"></iconify-icon>
                        ${note.noteText}
                    </div>
                ` : ''}
                
                <div class="bus-note-date">
                    <iconify-icon icon="mdi:clock-outline" class="me-2"></iconify-icon>
                    ${formattedDate}
                </div>
            </div>
        `;
    }

    // Load notes from localStorage
    loadNotes() {
        const saved = localStorage.getItem('jakMoveBusNotes');
        if (saved) {
            try {
                this.notes = JSON.parse(saved);
                // Sort by timestamp (newest first)
                this.notes.sort((a, b) => b.timestamp - a.timestamp);
            } catch (e) {
                console.error('Error loading notes:', e);
                this.notes = [];
            }
        }
    }

    // Save notes to localStorage
    saveNotes() {
        try {
            localStorage.setItem('jakMoveBusNotes', JSON.stringify(this.notes));
        } catch (e) {
            console.error('Error saving notes:', e);
            this.showAlert('Gagal menyimpan catatan!', 'danger');
        }
    }

    // Export notes
    exportNotes() {
        if (this.notes.length === 0) {
            this.showAlert('Tidak ada catatan untuk diekspor!', 'warning');
            return;
        }

        const csvContent = this.generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `catatan-bus-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showAlert('Catatan berhasil diekspor!', 'success');
        }
    }

    // Generate CSV content
    generateCSV() {
        const headers = ['Nomor Bus', 'Operator', 'Tipe Bus', 'Catatan', 'Tanggal'];
        const rows = this.notes.map(note => [
            note.busNumber,
            note.busOperator,
            note.busType,
            note.noteText || '',
            new Date(note.dateAdded).toLocaleString('id-ID')
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return '\uFEFF' + csvContent; // Add BOM for proper UTF-8 encoding
    }

    // Clear all notes
    clearAllNotes() {
        if (this.notes.length === 0) {
            this.showAlert('Tidak ada catatan untuk dihapus!', 'warning');
            return;
        }

        if (confirm(`Yakin ingin menghapus semua ${this.notes.length} catatan? Tindakan ini tidak dapat dibatalkan!`)) {
            this.notes = [];
            this.saveNotes();
            this.updateNotesDisplay();
            this.showAlert('Semua catatan berhasil dihapus!', 'info');
        }
    }

    // Show alert message
    showAlert(message, type = 'info') {
        // Create alert element
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        alertDiv.style.cssText = 'top: 80px; right: 20px; z-index: 9999; min-width: 300px;';
        
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(alertDiv);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.busNotesManager = new BusNotesManager();
});

// Export for global access
window.BusNotesManager = BusNotesManager;
