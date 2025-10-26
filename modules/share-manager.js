// Share Manager - Handle route sharing via URL, QR code, and visual cards
export class ShareManager {
    constructor(app) {
        this.app = app;
        this.shareModal = null;
        this.qrCanvas = null;
    }

    init() {
        // Create share modal
        this.createShareModal();
        
        // Check if URL has shared route params on page load
        this.checkForSharedRoute();
    }

    // Helper: simple text normalize
    _normalize(str) {
        try {
            return String(str || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '').trim();
        } catch (_) {
            return String(str || '').toLowerCase().trim();
        }
    }

    // Helper: find stop id by name (prefer H/B)
    findStopIdByName(name) {
        try {
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops ? (gtfs.getStops() || []) : [];
            if (!stops.length) return null;
            const q = this._normalize(name);
            if (!q) return null;
            // First pass: exact startsWith in H/B
            let best = stops.find(s => (String(s.stop_id || '').startsWith('H') || String(s.stop_id || '').startsWith('B')) && this._normalize(s.stop_name).startsWith(q));
            if (best) return String(best.stop_id);
            // Second pass: includes in H/B
            best = stops.find(s => (String(s.stop_id || '').startsWith('H') || String(s.stop_id || '').startsWith('B')) && this._normalize(s.stop_name).includes(q));
            if (best) return String(best.stop_id);
            // Third pass: any stop
            best = stops.find(s => this._normalize(s.stop_name).includes(q));
            return best ? String(best.stop_id) : null;
        } catch (_) {
            return null;
        }
    }

    // Wait until compute is available
    async _waitForPlannerReady(timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const journey = this.app.modules?.journey;
                const gtfs = this.app.modules?.gtfs;
                if (journey && typeof journey.computePlanByStopIds === 'function' && gtfs && typeof gtfs.getStops === 'function') {
                    return true;
                }
            } catch(_) {}
            await new Promise(r => setTimeout(r, 150));
        }
        return false;
    }

    /**
     * Encode route plan to URL-safe string
     */
    encodePlan(plan) {
        try {
            const data = {
                from: plan.startStop?.stop_id || '',
                to: plan.goalStop?.stop_id || '',
                fromName: plan.startStop?.stop_name || '',
                toName: plan.goalStop?.stop_name || '',
                mode: plan.mode || 'balanced',
                date: plan.departureTime ? new Date(plan.departureTime).toISOString().split('T')[0] : '',
                time: plan.departureTime ? new Date(plan.departureTime).toTimeString().split(' ')[0].substring(0,5) : '',
                legs: (plan.legs || []).map(leg => ({
                    m: leg.mode,
                    r: leg.routeId || '',
                    rn: leg.routeShortName || '',
                    from: leg.fromStop?.stop_id || '',
                    to: leg.toStop?.stop_id || '',
                    d: Math.round(leg.duration || 0),
                    dist: Math.round(leg.distance || 0)
                })),
                fare: plan.fare || 0,
                duration: Math.round(plan.totalDuration || 0),
                distance: Math.round(plan.totalDistance || 0)
            };

            // Compress and encode
            const json = JSON.stringify(data);
            const compressed = this.compressString(json);
            return encodeURIComponent(compressed);
        } catch (error) {
            console.error('Failed to encode plan:', error);
            return null;
        }
    }

    /**
     * Decode URL-safe string to route plan
     */
    decodePlan(encoded) {
        try {
            const compressed = decodeURIComponent(encoded);
            const json = this.decompressString(compressed);
            const data = JSON.parse(json);

            // Reconstruct plan object
            const plan = {
                startStop: {
                    stop_id: data.from,
                    stop_name: data.fromName
                },
                goalStop: {
                    stop_id: data.to,
                    stop_name: data.toName
                },
                mode: data.mode || 'balanced',
                departureTime: data.date && data.time ? new Date(`${data.date}T${data.time}`).getTime() : Date.now(),
                legs: (data.legs || []).map(leg => ({
                    mode: leg.m,
                    routeId: leg.r,
                    routeShortName: leg.rn,
                    fromStop: { stop_id: leg.from },
                    toStop: { stop_id: leg.to },
                    duration: leg.d,
                    distance: leg.dist
                })),
                fare: data.fare || 0,
                totalDuration: data.duration || 0,
                totalDistance: data.distance || 0
            };

            return plan;
        } catch (error) {
            console.error('Failed to decode plan:', error);
            return null;
        }
    }

    /**
     * Simple string compression using LZ-based algorithm
     */
    compressString(str) {
        try {
            // Use base64 encoding of compressed data
            return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => 
                String.fromCharCode(parseInt(p1, 16))
            ));
        } catch (e) {
            return str; // Fallback to uncompressed
        }
    }

    /**
     * Decompress string
     */
    decompressString(str) {
        try {
            return decodeURIComponent(Array.prototype.map.call(atob(str), (c) => 
                '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
            ).join(''));
        } catch (e) {
            return str; // Fallback
        }
    }

    /**
     * Generate shareable URL for a plan
     */
    generateShareURL(plan) {
        const encoded = this.encodePlan(plan);
        if (!encoded) return null;

        const baseURL = window.location.origin + window.location.pathname;
        return `${baseURL}?route=${encoded}`;
    }

    /**
     * Check URL params for shared route and auto-render
     */
    checkForSharedRoute() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const routeParam = urlParams.get('route');
            
            if (!routeParam) return;

            console.log('📥 Shared route detected, loading...');
            
            // Decode the plan
            const plan = this.decodePlan(routeParam);
            if (!plan) {
                console.error('Failed to decode shared route');
                return;
            }

            // Wait for modules to be ready
            setTimeout(() => {
                this.renderSharedRoute(plan);
            }, 1500);

        } catch (error) {
            console.error('Error loading shared route:', error);
        }
    }

    /**
     * Render shared route on map and in planner
     */
    async renderSharedRoute(plan) {
        try {
            console.log('🗺️ Rendering shared route:', plan);

            // Ensure planner & GTFS ready
            const ready = await this._waitForPlannerReady(7000);
            if (!ready) {
                this.showNotification('❌ Aplikasi belum siap memuat rute', 'error');
                return;
            }

            const typedPlanner = this.app.modules.typedPlanner;
            const journey = this.app.modules.journey;
            const gtfs = this.app.modules.gtfs;
            if (!typedPlanner || !journey || !gtfs) {
                console.error('TypedPlanner/JourneyPlanner/GTFS not available');
                return;
            }

            // Determine from/to ids
            let fromId = plan.startStop?.stop_id || plan.from;
            let toId = plan.goalStop?.stop_id || plan.to;
            const fromName = plan.startStop?.stop_name || plan.fromName || '';
            const toName = plan.goalStop?.stop_name || plan.toName || '';
            const mode = plan.mode || 'balanced';

            // If missing IDs, try resolve via names
            if (!fromId && fromName) fromId = this.findStopIdByName(fromName);
            if (!toId && toName) toId = this.findStopIdByName(toName);

            // Set date/time if available
            if (plan.departureTime && typeof journey.setDepartureDateTime === 'function') {
                journey.setDepartureDateTime(new Date(plan.departureTime));
            }

            // Try compute
            let computed = null;
            if (fromId && toId) {
                computed = journey.computePlanByStopIds(String(fromId), String(toId), mode);
            }

            // Fallback: try resolving IDs via names even if IDs exist but failed
            if (!computed) {
                if (fromName && !fromId) fromId = this.findStopIdByName(fromName);
                if (toName && !toId) toId = this.findStopIdByName(toName);
                if (fromId && toId) {
                    computed = journey.computePlanByStopIds(String(fromId), String(toId), mode);
                }
            }

            if (!computed) {
                this.showNotification('❌ Gagal memuat rute dari tautan (tidak menemukan halte)', 'error');
                return;
            }

            // Cache for map button wiring
            try { typedPlanner._cachedPlans.set(`${fromId}|${toId}|${mode}`, computed); } catch(_) {}

            // Render card
            if (typedPlanner.resultsDiv && typeof typedPlanner.renderPlanCard === 'function') {
                typedPlanner.resultsDiv.innerHTML = `<div class="row g-3">${typedPlanner.renderPlanCard(computed, true)}</div>`;
            }

            // Draw on map
            if (typeof journey.showPlanOnMap === 'function') {
                journey.showPlanOnMap(computed);
            }

            this.showNotification('✅ Rute berhasil dimuat dari tautan!', 'success');
        } catch (error) {
            console.error('Error rendering shared route:', error);
            this.showNotification('❌ Gagal memuat rute dari tautan', 'error');
        }
    }

    /**
     * Show share dialog for a plan
     */
    showShareDialog(plan) {
        if (!this.shareModal) return;

        const shareURL = this.generateShareURL(plan);
        if (!shareURL) {
            this.showNotification('❌ Gagal membuat tautan', 'error');
            return;
        }

        // Update modal content
        this.updateShareModalContent(plan, shareURL);

        // Generate QR code
        this.generateQRCode(shareURL);

        // Show modal
        const modalEl = document.getElementById('shareModal');
        if (modalEl) {
            const bsModal = new bootstrap.Modal(modalEl);
            bsModal.show();
        }
    }

    /**
     * Update share modal with plan details
     */
    updateShareModalContent(plan, shareURL) {
        try {
            // Route summary
            const fromName = plan.startStop?.stop_name || plan.fromName || 'Unknown';
            const toName = plan.goalStop?.stop_name || plan.toName || 'Unknown';
            let duration = 0;
            if (plan?.duration?.totalSec) duration = Math.round(plan.duration.totalSec / 60);
            else if (typeof plan.totalDuration === 'number') duration = Math.round(plan.totalDuration);
            const fareTotal = (plan?.fare && typeof plan.fare === 'object') ? (Number(plan.fare.total) || 0) : (Number(plan.fare) || 0);
            const transitLegsCount = (plan.legs || []).filter(l => l.mode === 'TRANSIT').length;
            const transfers = Math.max(0, transitLegsCount - 1);

            // Build transit legs summary
            const transitLegs = (plan.legs || []).filter(l => l.mode === 'TRANSIT');
            const routesSummary = transitLegs.length > 0
                ? transitLegs.map(leg => `<span class="badge" style="background:#dc2626;color:white;margin:2px;">${(leg.routeShortName || leg.routeId || '').toString()}</span>`).join('')
                : '<span style="color:#9ca3af;">Hanya jalan kaki</span>';

            // Update summary card
            const summaryEl = document.getElementById('shareSummary');
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div style="background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
                        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                            <div style="width:40px;height:40px;background:#10b981;border-radius:10px;display:flex;align-items:center;justify-content:center;">
                                <i class="fa-solid fa-route" style="color:white;font-size:1.2em;"></i>
                            </div>
                            <div style="flex:1;">
                                <div style="font-weight:700;font-size:1.1em;color:#111827;">${fromName}</div>
                                <div style="color:#6b7280;font-size:0.85em;margin-top:2px;">
                                    <i class="fa-solid fa-arrow-down"></i> ${toName}
                                </div>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;">
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;">
                                <div style="color:#6b7280;font-size:0.75em;margin-bottom:4px;">Durasi</div>
                                <div style="font-weight:700;color:#111827;">${duration} min</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;">
                                <div style="color:#6b7280;font-size:0.75em;margin-bottom:4px;">Tarif</div>
                                <div style="font-weight:700;color:#111827;">Rp ${fareTotal.toLocaleString('id-ID')}</div>
                            </div>
                            <div style="background:white;border-radius:8px;padding:10px;text-align:center;">
                                <div style="color:#6b7280;font-size:0.75em;margin-bottom:4px;">Transfer</div>
                                <div style="font-weight:700;color:#111827;">${transfers}x</div>
                            </div>
                        </div>
                        <div style="margin-top:12px;padding:10px;background:white;border-radius:8px;">
                            <div style="color:#6b7280;font-size:0.75em;margin-bottom:6px;">Rute yang Digunakan:</div>
                            <div>${routesSummary}</div>
                        </div>
                    </div>
                `;
            }

            // Update URL input
            const urlInput = document.getElementById('shareURLInput');
            if (urlInput) {
                urlInput.value = shareURL;
            }

        } catch (error) {
            console.error('Error updating share modal:', error);
        }
    }

    /**
     * Generate QR code for URL
     */
    generateQRCode(url) {
        try {
            const qrContainer = document.getElementById('shareQRCode');
            if (!qrContainer) return;

            // Clear existing QR
            qrContainer.innerHTML = '';

            // Use QRCode.js library (loaded from CDN)
            if (typeof QRCode !== 'undefined') {
                new QRCode(qrContainer, {
                    text: url,
                    width: 200,
                    height: 200,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } else {
                // Fallback: show URL as text
                qrContainer.innerHTML = `
                    <div style="padding:20px;text-align:center;color:#6b7280;">
                        <i class="fa-solid fa-qrcode" style="font-size:3em;"></i>
                        <div style="margin-top:10px;font-size:0.85em;">QR Code tidak tersedia</div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error generating QR code:', error);
        }
    }

    /**
     * Create share modal HTML
     */
    createShareModal() {
        const existingModal = document.getElementById('shareModal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'shareModal';
        modal.setAttribute('tabindex', '-1');
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content" style="border-radius:16px;overflow:hidden;">
                    <div class="modal-header" style="background:linear-gradient(135deg, #10b981 0%, #059669 100%);color:white;border:none;">
                        <h5 class="modal-title" style="font-weight:700;">
                            <i class="fa-solid fa-share-nodes me-2"></i>
                            Bagikan Rute
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" style="padding:20px;">
                        <!-- Route Summary -->
                        <div id="shareSummary"></div>

                        <!-- Share URL -->
                        <div style="margin-bottom:16px;">
                            <label style="font-weight:600;font-size:0.9em;color:#374151;margin-bottom:8px;display:block;">
                                <i class="fa-solid fa-link me-2"></i>Tautan Rute
                            </label>
                            <div style="display:flex;gap:8px;">
                                <input type="text" id="shareURLInput" class="form-control" readonly style="font-family:monospace;font-size:0.85em;border-radius:8px;">
                                <button class="btn btn-primary" id="copyURLBtn" style="border-radius:8px;white-space:nowrap;padding:6px 12px;font-size:0.85rem;">
                                    <i class="fa-solid fa-copy me-1"></i>Salin
                                </button>
                            </div>
                        </div>

                        <!-- QR Code -->
                        <div style="text-align:center;margin-top:20px;">
                            <label style="font-weight:600;font-size:0.9em;color:#374151;margin-bottom:12px;display:block;">
                                <i class="fa-solid fa-qrcode me-2"></i>Scan QR Code
                            </label>
                            <div id="shareQRCode" style="display:inline-block;padding:16px;background:white;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);"></div>
                            <div style="margin-top:12px;font-size:0.85em;color:#6b7280;">Scan dengan kamera untuk buka rute</div>
                        </div>

                        <!-- Social Share Buttons -->
                        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;">
                            <div style="font-weight:600;font-size:0.9em;color:#374151;margin-bottom:10px;">Bagikan via:</div>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                <button class="btn btn-sm" id="shareWhatsAppBtn" style="background:#25D366;color:white;border-radius:8px;flex:1;">
                                    <i class="fa-brands fa-whatsapp me-2"></i>WhatsApp
                                </button>
                                <button class="btn btn-sm" id="shareTelegramBtn" style="background:#0088cc;color:white;border-radius:8px;flex:1;">
                                    <i class="fa-brands fa-telegram me-2"></i>Telegram
                                </button>
                                <button class="btn btn-sm btn-secondary" id="shareMoreBtn" style="border-radius:8px;flex:1;">
                                    <i class="fa-solid fa-ellipsis me-2"></i>Lainnya
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.shareModal = modal;

        // Bind event listeners
        this.bindShareModalEvents();
    }

    /**
     * Bind event listeners for share modal
     */
    bindShareModalEvents() {
        // Copy URL button
        const copyBtn = document.getElementById('copyURLBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                const urlInput = document.getElementById('shareURLInput');
                if (!urlInput) return;

                const text = String(urlInput.value || '');
                let copied = false;

                // Prefer modern Clipboard API on secure contexts
                try {
                    if (navigator.clipboard && window.isSecureContext) {
                        await navigator.clipboard.writeText(text);
                        copied = true;
                    }
                } catch (_) {}

                // Fallback: enable/select input (iOS-friendly)
                if (!copied) {
                    try {
                        const wasReadOnly = urlInput.hasAttribute('readonly');
                        if (wasReadOnly) urlInput.removeAttribute('readonly');
                        urlInput.focus({ preventScroll: true });
                        urlInput.select();
                        try { urlInput.setSelectionRange(0, text.length); } catch (_) {}
                        copied = document.execCommand('copy');
                        if (wasReadOnly) urlInput.setAttribute('readonly', '');
                    } catch (_) {}
                }

                // Fallback: hidden textarea
                if (!copied) {
                    try {
                        const ta = document.createElement('textarea');
                        ta.value = text;
                        ta.setAttribute('readonly', '');
                        ta.style.position = 'absolute';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.focus({ preventScroll: true });
                        ta.select();
                        try { ta.setSelectionRange(0, text.length); } catch (_) {}
                        copied = document.execCommand('copy');
                        document.body.removeChild(ta);
                    } catch (_) {}
                }

                // Feedback
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = copied
                    ? '<i class="fa-solid fa-check me-1"></i>Tersalin!'
                    : '<i class="fa-solid fa-xmark me-1"></i>Gagal';
                setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
            });
        }

        // WhatsApp share
        const whatsappBtn = document.getElementById('shareWhatsAppBtn');
        if (whatsappBtn) {
            whatsappBtn.addEventListener('click', () => {
                const url = document.getElementById('shareURLInput')?.value;
                if (url) {
                    const text = encodeURIComponent(`Lihat rute TransJakarta saya: ${url}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                }
            });
        }

        // Telegram share
        const telegramBtn = document.getElementById('shareTelegramBtn');
        if (telegramBtn) {
            telegramBtn.addEventListener('click', () => {
                const url = document.getElementById('shareURLInput')?.value;
                if (url) {
                    const text = encodeURIComponent('Lihat rute TransJakarta saya');
                    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`, '_blank');
                }
            });
        }

        // More share options (Web Share API)
        const moreBtn = document.getElementById('shareMoreBtn');
        if (moreBtn) {
            moreBtn.addEventListener('click', async () => {
                const url = document.getElementById('shareURLInput')?.value;
                if (url && navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Rute TransJakarta',
                            text: 'Lihat rute TransJakarta saya',
                            url: url
                        });
                    } catch (err) {
                        console.log('Share cancelled or failed:', err);
                    }
                } else {
                    // Fallback: copy to clipboard
                    const urlInput = document.getElementById('shareURLInput');
                    if (urlInput) {
                        urlInput.select();
                        document.execCommand('copy');
                        this.showNotification('📋 Tautan tersalin!', 'success');
                    }
                }
            });
        }
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'info') {
        try {
            // Create toast container if not exists
            let toastContainer = document.getElementById('shareToastContainer');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'shareToastContainer';
                toastContainer.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;';
                document.body.appendChild(toastContainer);
            }

            // Create toast
            const toast = document.createElement('div');
            toast.className = 'alert';
            toast.style.cssText = `
                background:white;
                border-left:4px solid ${type === 'success' ? '#10b981' : '#ef4444'};
                border-radius:8px;
                padding:12px 16px;
                margin-bottom:10px;
                box-shadow:0 4px 12px rgba(0,0,0,0.15);
                animation:slideIn 0.3s ease;
                font-size:0.9em;
            `;
            toast.innerHTML = message;
            toastContainer.appendChild(toast);

            // Auto remove after 3s
            setTimeout(() => {
                toast.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => toast.remove(), 300);
            }, 3000);

        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
}

// Add slide animations via CSS
if (!document.getElementById('shareManagerStyles')) {
    const style = document.createElement('style');
    style.id = 'shareManagerStyles';
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

