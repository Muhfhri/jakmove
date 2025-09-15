// GTFS Utility Functions
// Shared utilities for getting GTFS last modified dates

class GTFSUtils {
    static async getGTFSLastModified() {
        try {
            // First try to get from stored cache
            const storedLastModified = localStorage.getItem('jakmove_gtfs_last_modified');
            const storedLatestFile = localStorage.getItem('jakmove_gtfs_latest_file');
            if (storedLastModified) {
                const formattedDate = GTFSUtils.formatIndonesianDate(new Date(storedLastModified));
                return storedLatestFile ? `${formattedDate} (${storedLatestFile})` : formattedDate;
            }

            // If not in cache, check all GTFS files
            const latestInfo = await GTFSUtils.checkAllGTFSFiles();
            
            if (latestInfo.date) {
                // Store for future use
                localStorage.setItem('jakmove_gtfs_last_modified', latestInfo.date);
                localStorage.setItem('jakmove_gtfs_latest_file', latestInfo.file);
                const formattedDate = GTFSUtils.formatIndonesianDate(new Date(latestInfo.date));
                return `${formattedDate} (${latestInfo.file})`;
            }
            
            return 'Tidak diketahui';
        } catch (error) {
            console.error('Error getting GTFS last modified date:', error);
            return 'Tidak diketahui';
        }
    }

    // Check all GTFS files and return the latest modification date
    static async checkAllGTFSFiles() {
        const gtfsFiles = [
            'agency.txt', 'calendar.txt', 'calendar_dates.txt', 'fare_attributes.txt',
            'fare_rules.txt', 'frequencies.txt', 'routes.txt', 'shapes.txt',
            'stop_times.txt', 'stops.txt', 'transfers.txt', 'trips.txt'
        ];

        let latestDate = null;
        let latestFile = null;

        for (const file of gtfsFiles) {
            try {
                const response = await fetch(`gtfs/${file}`, { method: 'HEAD' });
                const lastModified = response.headers.get('Last-Modified');
                
                if (lastModified) {
                    const fileDate = new Date(lastModified);
                    if (!latestDate || fileDate > latestDate) {
                        latestDate = fileDate;
                        latestFile = file;
                    }
                }
            } catch (error) {
                console.warn(`Failed to check modification date for ${file}:`, error);
            }
        }

        return {
            date: latestDate ? latestDate.toUTCString() : null,
            file: latestFile
        };
    }

    // Format date in Indonesian format
    static formatIndonesianDate(date) {
        const options = {
            weekday: 'long',
            year: 'numeric', 
            month: 'long',
            day: 'numeric',
            timeZone: 'Asia/Jakarta'
        };
        
        return new Intl.DateTimeFormat('id-ID', options).format(date);
    }

    // Update UI element with GTFS last modified date
    static async updateLastModifiedElement(selector) {
        try {
            const dateStr = await GTFSUtils.getGTFSLastModified();
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = `diperbarui ${dateStr}`;
                element.title = `Data GTFS terakhir diperbarui pada ${dateStr}`;
            }
        } catch (error) {
            console.error('Error updating last modified element:', error);
        }
    }

    // Update UI element for gtfs-raw-viewer format
    static async updateGTFSViewerDateElement(selector) {
        try {
            const dateStr = await GTFSUtils.getGTFSLastModified();
            const element = document.querySelector(selector);
            if (element) {
                element.textContent = `Data ini diambil dari GTFS Transjakarta (${dateStr})`;
            }
        } catch (error) {
            console.error('Error updating GTFS viewer date element:', error);
        }
    }

    // Clear all GTFS related cache (for debugging)
    static clearAllCache() {
        const keys = [
            'jakmove_gtfs_data',
            'jakmove_gtfs_version', 
            'jakmove_gtfs_last_modified',
            'jakmove_gtfs_latest_file',
            'jakmove_gtfs_etag'
        ];
        
        keys.forEach(key => localStorage.removeItem(key));
        
        // Also clear IndexedDB
        if (window.indexedDB) {
            const request = indexedDB.open('JakMoveGTFS', 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                if (db.objectStoreNames.contains('gtfs')) {
                    const transaction = db.transaction('gtfs', 'readwrite');
                    const store = transaction.objectStore('gtfs');
                    store.clear();
                }
                db.close();
            };
        }
        
        console.log('🗑️ All GTFS cache cleared. Please refresh the page.');
        alert('Cache telah dibersihkan. Silakan refresh halaman.');
    }
}

// Make it available globally
window.GTFSUtils = GTFSUtils;

// Expose cache clear function globally for debugging
window.clearAllGTFSCache = GTFSUtils.clearAllCache;
