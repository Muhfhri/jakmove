// GTFS Utility Functions
// Shared utilities for getting GTFS last modified dates

class GTFSUtils {
    static async getGTFSLastModified() {
        try {
            // First try to get from stored cache with validation
            const storedLastModified = localStorage.getItem('jakmove_gtfs_last_modified');
            const storedLatestFile = localStorage.getItem('jakmove_gtfs_latest_file');
            
            // Check if cached date is reasonable (not today's date unless files were actually updated today)
            if (storedLastModified) {
                const cachedDate = new Date(storedLastModified);
                const today = new Date();
                const daysDiff = Math.floor((today - cachedDate) / (1000 * 60 * 60 * 24));
                
                // If cached date is from today, double-check actual file dates
                if (daysDiff === 0) {
                    console.log('🔍 Cached date is from today, verifying with actual file dates...');
                    const latestInfo = await GTFSUtils.checkAllGTFSFiles();
                    if (latestInfo.date) {
                        const actualDate = new Date(latestInfo.date);
                        const actualDaysDiff = Math.floor((today - actualDate) / (1000 * 60 * 60 * 24));
                        
                        // If actual file is older than today, use actual date instead
                        if (actualDaysDiff > 0) {
                            localStorage.setItem('jakmove_gtfs_last_modified', latestInfo.date);
                            localStorage.setItem('jakmove_gtfs_latest_file', latestInfo.file);
                            const formattedDate = GTFSUtils.formatIndonesianDate(actualDate);
                            return `${formattedDate} (${latestInfo.file})`;
                        }
                    }
                }
                
                // Use cached date if it seems reasonable
                const formattedDate = GTFSUtils.formatIndonesianDate(cachedDate);
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
            
            // Fallback: Use a reasonable default date instead of "unknown"
            // This prevents showing current date when files are not accessible
            const fallbackDate = new Date('2025-09-08'); // Set to when you last updated GTFS files
            const formattedFallback = GTFSUtils.formatIndonesianDate(fallbackDate);
            return `${formattedFallback} (estimasi)`;
        } catch (error) {
            console.error('Error getting GTFS last modified date:', error);
            // Fallback with estimated date
            const fallbackDate = new Date('2025-09-08');
            const formattedFallback = GTFSUtils.formatIndonesianDate(fallbackDate);
            return `${formattedFallback} (estimasi)`;
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
        let validDatesFound = 0;

        for (const file of gtfsFiles) {
            try {
                const response = await fetch(`gtfs/${file}`, { method: 'HEAD' });
                const lastModified = response.headers.get('Last-Modified');
                
                if (lastModified) {
                    const fileDate = new Date(lastModified);
                    const today = new Date();
                    const daysDiff = Math.floor((today - fileDate) / (1000 * 60 * 60 * 24));
                    
                    // Only consider dates that are reasonable (not from today unless actually updated)
                    // and not too far in the past (more than 1 year)
                    if (daysDiff >= 0 && daysDiff < 365) {
                        validDatesFound++;
                        if (!latestDate || fileDate > latestDate) {
                            latestDate = fileDate;
                            latestFile = file;
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to check modification date for ${file}:`, error);
            }
        }

        // If we found very few valid dates, it might be a hosting environment issue
        // In that case, return null to trigger fallback
        if (validDatesFound < 3) {
            console.log(`⚠️ Only found ${validDatesFound} valid file dates, using fallback`);
            return { date: null, file: null };
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
                element.textContent = `Diperbarui ${dateStr}`;
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

    // Force refresh the date display (clears problematic cache)
    static forceRefreshDate() {
        // Clear date-related cache
        localStorage.removeItem('jakmove_gtfs_last_modified');
        localStorage.removeItem('jakmove_gtfs_latest_file');
        
        // Force update the UI
        GTFSUtils.updateLastModifiedElement('.status-text');
        
        console.log('🔄 Date cache cleared and refreshed');
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

// Expose utility functions globally for debugging
window.clearAllGTFSCache = GTFSUtils.clearAllCache;
window.forceRefreshGTFSDate = GTFSUtils.forceRefreshDate;
