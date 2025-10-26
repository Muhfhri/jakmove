// Typed Planner - Form-based route planning that leverages JourneyPlanner compute APIs
export class TypedPlanner {
    constructor(app) {
        this.app = app;
        this.fromInput = null;
        this.toInput = null;
        this.swapBtn = null;
        this.planBtn = null;
        this.modeGroup = null;
        this.resultsDiv = null;
        this.stopsList = null;
        this.currentMode = 'balanced';
        this._stopsIndex = []; // {id, name}
        this._cachedPlans = new Map(); // Cache computed plans to avoid recomputation inconsistencies
        this._sharedPlanMap = new Map(); // In-memory store for shareable plans (cross-platform safe)
    }

    init() {
        // Bind elements
        this.fromInput = document.getElementById('jpFromInput');
        this.toInput = document.getElementById('jpToInput');
        this.swapBtn = document.getElementById('jpSwapBtn');
        this.planBtn = document.getElementById('jpPlanBtn');
        this.modeGroup = document.getElementById('jpModeGroup');
        this.resultsDiv = document.getElementById('jpResults');
        this.stopsList = document.getElementById('jpStopsList');
        this.dateInput = document.getElementById('jpDateInput');
        this.timeInput = document.getElementById('jpTimeInput');
        if (!this.fromInput || !this.toInput || !this.planBtn || !this.resultsDiv) return;

        // Load saved preference
        try {
            const savedMode = localStorage.getItem('jp_mode');
            if (savedMode && ['balanced', 'fastest', 'cheapest'].includes(savedMode)) {
                this.currentMode = savedMode;
            }
        } catch (_) {}

        // Build stop index + datalist lazily
        this.populateStopsIndex();
        this.installAutocomplete(this.fromInput, 'from');
        this.installAutocomplete(this.toInput, 'to');

        // Set initial mode UI
        this.setMode(this.currentMode);
        
        // Initialize date/time inputs
        this.initializeDateTimeInputs();

        // Handlers
        if (this.swapBtn) this.swapBtn.addEventListener('click', () => this.swapInputs());
        this.planBtn.addEventListener('click', () => this.plan());
        if (this.modeGroup) {
            this.modeGroup.querySelectorAll('button[data-mode]')?.forEach(btn => {
                btn.addEventListener('click', () => this.setMode(btn.getAttribute('data-mode')));
            });
        }

        // Enter to plan
        const tryEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); this.plan(); } };
        this.fromInput.addEventListener('keydown', tryEnter);
        this.toInput.addEventListener('keydown', tryEnter);
    }

    setMode(mode) {
        const allowed = new Set(['balanced', 'fastest', 'cheapest']);
        if (!allowed.has(String(mode))) mode = 'balanced';
        this.currentMode = mode;
        // Update UI buttons with new modern styling
        try {
            this.modeGroup.querySelectorAll('button[data-mode]').forEach(b => {
                const m = b.getAttribute('data-mode');
                if (m === mode) { 
                    b.classList.add('active');
                } else { 
                    b.classList.remove('active');
                }
            });
        } catch (_) {}
        // Store preference
        try { localStorage.setItem('jp_mode', mode); } catch (_) {}
        // Immediately re-plan with current inputs (if valid)
        try {
            const fromName = this.fromInput?.value?.trim();
            const toName = this.toInput?.value?.trim();
            if (fromName && toName) {
                this.plan();
            }
        } catch(_) {}
    }
    
    initializeDateTimeInputs() {
        try {
            const now = new Date();
            
            // Set default date to today
            if (this.dateInput) {
                const today = now.toISOString().split('T')[0];
                this.dateInput.value = today;
            }
            
            // Set default time to current time (rounded to next 5 minutes)
            if (this.timeInput) {
                const minutes = now.getMinutes();
                const roundedMinutes = Math.ceil(minutes / 5) * 5;
                const adjustedTime = new Date(now);
                adjustedTime.setMinutes(roundedMinutes, 0, 0);
                
                const timeString = adjustedTime.toTimeString().slice(0, 5);
                this.timeInput.value = timeString;
            }
        } catch (error) {
            console.warn('Failed to initialize date/time inputs:', error);
        }
    }
    
    getDepartureDateTime() {
        try {
            const dateValue = this.dateInput?.value;
            const timeValue = this.timeInput?.value;
            
            if (!dateValue || !timeValue) {
                return new Date(); // Default to now
            }
            
            const [year, month, day] = dateValue.split('-').map(Number);
            const [hour, minute] = timeValue.split(':').map(Number);
            
            return new Date(year, month - 1, day, hour, minute);
        } catch (error) {
            return new Date(); // Fallback to current time
        }
    }

    populateStopsIndex() {
        try {
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const routes = gtfs.getRoutes() || [];
            const stopToRoutes = gtfs.getStopToRoutes() || {};
            
            // Create route type mapping
            const routeTypeMap = new Map();
            for (const route of routes) {
                const routeId = String(route.route_id || '');
                const routeType = String(route.route_type || '');
                // BRT routes typically have route_type 3 and specific naming patterns
                const isBRT = routeType === '3' && (
                    String(route.route_short_name || '').match(/^(1[A-Z]?|2[A-Z]?|3[A-Z]?|4[A-Z]?|5[A-Z]?|6[A-Z]?|7[A-Z]?|8[A-Z]?|9[A-Z]?|1[0-9][A-Z]?)$/) ||
                    String(route.route_long_name || '').toLowerCase().includes('transjakarta')
                );
                routeTypeMap.set(routeId, isBRT ? 'brt' : 'regular');
            }
            
            const valid = stops.filter(s => {
                const id = String(s.stop_id || '');
                return !!stopToRoutes[id] && (stopToRoutes[id].length > 0);
            });
            
            // Deduplicate by name and determine stop type
            const seen = new Set();
            const list = [];
            for (const s of valid) {
                const key = String(s.stop_name || '').trim().toLowerCase();
                if (!key) continue;
                if (seen.has(key)) continue;
                seen.add(key);
                
                // Determine stop type based on stop_id pattern (more reliable)
                const stopId = String(s.stop_id);
                let stopType = 'regular';
                
                // BRT stops: Don't start with 'B' (Feeder stops start with 'B')
                // Regular/BRT stops: G*, E*, H*, or numeric patterns
                if (stopId.startsWith('B')) {
                    stopType = 'regular'; // Feeder/Pengumpan
                } else {
                    // BRT stops (G*, E*, H*, or main corridor stops)
                    stopType = 'brt';
                }
                
                list.push({ 
                    id: stopId, 
                    name: String(s.stop_name),
                    type: stopType
                });
            }
            list.sort((a, b) => a.name.localeCompare(b.name, 'id'));
            this._stopsIndex = list;
        } catch (_) {}
    }

    installAutocomplete(inputEl, key) {
        try {
            const container = inputEl && inputEl.closest('.planner-input-wrapper');
            if (!container) return;
            
            // Create dropdown list element
            const list = document.createElement('div');
            list.className = 'planner-suggest-list';
            list.style.position = 'absolute';
            list.style.left = '0';
            list.style.top = '100%';
            list.style.width = '100%';
            list.style.maxHeight = '280px';
            list.style.overflow = 'auto';
            list.style.zIndex = '1000';
            list.style.display = 'none';
            list.style.marginTop = '4px';
            container.style.position = 'relative';
            container.appendChild(list);

            const render = (items) => {
                list.innerHTML = '';
                if (!items || items.length === 0) { 
                    list.style.display = 'none'; 
                    return; 
                }
                
                const ul = document.createElement('ul');
                ul.style.listStyle = 'none'; 
                ul.style.margin = '0'; 
                ul.style.padding = '8px';
                
                items.slice(0, 15).forEach(it => {
                    const li = document.createElement('li');
                    li.className = 'planner-suggest-item';
                    
                    // Create icon based on stop type
                    const iconClass = it.type === 'brt' ? 'brt' : 'regular';
                    const iconName = it.type === 'brt' ? 'mdi:bus' : 'mdi:bus-stop';
                    
                    li.innerHTML = `
                        <div class="stop-icon ${iconClass}">
                            <iconify-icon icon="${iconName}"></iconify-icon>
                        </div>
                        <span>${this.escape(it.name)}</span>
                                        <small class="ms-auto text-muted">${it.type === 'brt' ? 'BRT' : 'Pengumpan'}</small>
                    `;
                    
                    li.addEventListener('click', () => {
                        inputEl.value = it.name;
                        list.style.display = 'none';
                        inputEl.dispatchEvent(new Event('input'));
                        inputEl.focus();
                    });
                    
                    ul.appendChild(li);
                });
                
                list.appendChild(ul);
                list.style.display = 'block';
            };

            let debounceId = null;
            const onInput = () => {
                const q = (inputEl.value || '').trim().toLowerCase();
                if (debounceId) clearTimeout(debounceId);
                debounceId = setTimeout(() => {
                    if (!q) { 
                        list.style.display = 'none'; 
                        return; 
                    }
                    // Sort results: BRT stops first, then by name match quality
                    const results = this._stopsIndex
                        .filter(s => s.name.toLowerCase().includes(q))
                        .sort((a, b) => {
                            // BRT stops first
                            if (a.type === 'brt' && b.type !== 'brt') return -1;
                            if (b.type === 'brt' && a.type !== 'brt') return 1;
                            
                            // Then by exact match at start
                            const aStartsWithQ = a.name.toLowerCase().startsWith(q);
                            const bStartsWithQ = b.name.toLowerCase().startsWith(q);
                            if (aStartsWithQ && !bStartsWithQ) return -1;
                            if (bStartsWithQ && !aStartsWithQ) return 1;
                            
                            // Finally by alphabetical
                            return a.name.localeCompare(b.name, 'id');
                        })
                        .slice(0, 50);
                    render(results);
                }, 120);
            };
            
            inputEl.addEventListener('input', onInput);
            inputEl.addEventListener('focus', onInput);
            inputEl.addEventListener('blur', () => setTimeout(() => { 
                list.style.display = 'none'; 
            }, 200));
            
            // Keyboard navigation
            inputEl.addEventListener('keydown', (e) => {
                const items = list.querySelectorAll('.planner-suggest-item');
                if (!items.length) return;
                
                let currentIndex = Array.from(items).findIndex(item => item.classList.contains('highlighted'));
                
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (currentIndex < items.length - 1) currentIndex++;
                    else currentIndex = 0;
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (currentIndex > 0) currentIndex--;
                    else currentIndex = items.length - 1;
                } else if (e.key === 'Enter' && currentIndex >= 0) {
                    e.preventDefault();
                    items[currentIndex].click();
                    return;
                } else {
                    return;
                }
                
                // Update highlighting
                items.forEach((item, idx) => {
                    if (idx === currentIndex) {
                        item.classList.add('highlighted');
                        item.style.background = 'rgba(79, 70, 229, 0.15)';
                    } else {
                        item.classList.remove('highlighted');
                        item.style.background = '';
                    }
                });
            });
        } catch(_) {}
    }

    resolveStopIdByName(name) {
        const n = String(name || '').trim().toLowerCase();
        if (!n) return null;
        const found = this._stopsIndex.find(s => String(s.name).trim().toLowerCase() === n);
        if (found) return found.id;
        // Fallback: try contains
        const contains = this._stopsIndex.find(s => String(s.name).toLowerCase().includes(n));
        return contains ? contains.id : null;
    }

    swapInputs() {
        const a = this.fromInput.value;
        this.fromInput.value = this.toInput.value;
        this.toInput.value = a;
        try {
            // Immediately re-plan after swap
            const fromName = this.fromInput?.value?.trim();
            const toName = this.toInput?.value?.trim();
            if (fromName && toName) this.plan();
        } catch(_) {}
    }

    plan() {
        try {
            this.resultsDiv.innerHTML = '';
            // Clear cached plans for new search
            this._cachedPlans.clear();
            
            const fromName = this.fromInput.value;
            const toName = this.toInput.value;
            const fromId = this.resolveStopIdByName(fromName);
            const toId = this.resolveStopIdByName(toName);
            if (!fromId || !toId) {
                this.resultsDiv.innerHTML = `<div class="row g-3">${this.renderError('Mohon pilih halte yang valid dari daftar.')}</div>`;
                return;
            }
            const jp = this.app.modules.journey;
            // Apply chosen departure date/time to planner (time-aware filtering)
            try { jp.setDepartureDateTime(this.getDepartureDateTime()); } catch(_) {}
            
            // Get all three modes but prioritize user's preferred mode
            const allModes = ['balanced', 'fastest', 'cheapest'];
            const results = [];
            
            // Compute all plans and cache them
            for (const m of allModes) {
                const p = jp.computePlanByStopIds(fromId, toId, m);
                if (p) {
                    p.mode = m; // Ensure mode is set
                    results.push(p);
                    // Cache the plan with a unique key
                    const cacheKey = `${fromId}|${toId}|${m}`;
                    this._cachedPlans.set(cacheKey, p);
                    console.log(`✅ Cached plan: ${cacheKey}`);
                }
            }
            
            if (results.length === 0) {
                // Show error and try alternatives (time shift and longer walk to nearby stops)
                const errHtml = `<div class="row g-3">${this.renderError('Rute tidak ditemukan pada tanggal/jam tersebut. Kami carikan alternatif lainnya di bawah.')}</div>`;
                this.resultsDiv.innerHTML = errHtml;
                this.findAndRenderAlternatives(fromId, toId);
                return;
            }
            
            // Calculate accuracy and determine best route
            const enhancedResults = this.enhanceResultsWithMetrics(results);
            
            // Sort results: preferred mode first, then by overall score
            const sortedResults = this.sortResultsByPreference(enhancedResults);
            
            console.log('Current mode:', this.currentMode);
            console.log('Enhanced results:', enhancedResults.map(r => ({mode: r.mode, score: r.score, duration: r.duration, fare: r.fare})));
            console.log('Sorted results:', sortedResults.map(r => ({mode: r.mode, score: r.score})));
            
            // Render cards
            const cards = sortedResults.map((r, index) => this.renderPlanCard(r, index === 0)).join('');
            this.resultsDiv.innerHTML = `<div class="row g-3">${cards}</div>`;
            
            // Wire map buttons - USE CACHED PLANS instead of recomputing
            this.resultsDiv.querySelectorAll('[data-show-map]')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-mode');
                    const from = btn.getAttribute('data-from');
                    const to = btn.getAttribute('data-to');
                    try {
                        // Retrieve cached plan instead of recomputing
                        const cacheKey = `${from}|${to}|${mode}`;
                        const cachedPlan = this._cachedPlans.get(cacheKey);
                        
                        if (cachedPlan) {
                            console.log(`🗺️ Using cached plan for: ${cacheKey}`);
                            jp.showPlanOnMap(cachedPlan);
                        } else {
                            // Fallback: compute if not in cache (shouldn't happen)
                            console.warn(`⚠️ Plan not in cache, recomputing: ${cacheKey}`);
                            const plan = jp.computePlanByStopIds(from, to, mode);
                            if (plan) jp.showPlanOnMap(plan);
                        }
                    } catch (e) {
                        console.error('Error showing plan on map:', e);
                    }
                });
            });

            // Wire share buttons (cross-platform safe via in-memory plan map)
            this.resultsDiv.querySelectorAll('[data-share]')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    try {
                        const planId = btn.getAttribute('data-plan-id');
                        if (!planId) return;
                        const plan = this._sharedPlanMap.get(planId);
                        if (!plan) return;
                        const shareManager = this.app.modules.share;
                        if (shareManager && typeof shareManager.showShareDialog === 'function') {
                            shareManager.showShareDialog(plan);
                        } else {
                            console.error('ShareManager not available');
                        }
                    } catch (e) {
                        console.error('Error sharing plan:', e);
                    }
                });
            });
        } catch (e) {
            console.error('Error in plan():', e);
            this.resultsDiv.innerHTML = `<div class="row g-3">${this.renderError('Terjadi kesalahan saat merencanakan rute.')}</div>`;
        }
    }

    enhanceResultsWithMetrics(results) {
        if (!results || results.length === 0) return results;
        
        // Calculate metrics for each result
        const enhanced = results.map(plan => {
            const duration = plan.duration?.totalSec || 0;
            const fare = plan.fare?.total || 0;
            const transfers = (plan.legs || []).filter(leg => leg.mode === 'TRANSIT').length - 1;
            const walkingDistance = (plan.legs || []).filter(leg => leg.mode === 'WALK')
                .reduce((sum, leg) => sum + (leg.distance || 0), 0);
            
            // Get frequency information for all routes in the plan
            const frequencyInfo = this.calculatePlanFrequency(plan);
            const avgFrequency = frequencyInfo.bestFrequency; // Use BEST (fastest) frequency instead of average
            const worstFrequency = frequencyInfo.worstFrequency; // in minutes
            
            // Calculate accuracy score with more variation (70-95%)
            let accuracy = 78; // Lower base accuracy for more variation
            
            // Add randomization based on route characteristics for realistic variation
            const routeHash = this.hashRouteForVariation(plan);
            const randomVariation = (routeHash % 8) - 4; // -4 to +3 variation
            accuracy += randomVariation;
            
            // Adjust based on route complexity
            if (transfers === 0) accuracy += 8; // Direct route
            else if (transfers === 1) accuracy += 4; // One transfer
            else accuracy -= (transfers - 1) * 4; // Multiple transfers reduce accuracy more
            
            // Adjust based on walking distance
            if (walkingDistance < 200) accuracy += 6; // Short walk
            else if (walkingDistance > 800) accuracy -= 8; // Long walk penalty
            else if (walkingDistance > 500) accuracy -= 3; // Medium walk penalty
            
            // Adjust based on service availability
            const statusBadge = this.getServiceStatusBadge(plan);
            if (statusBadge.includes('Beroperasi')) accuracy += 4;
            else accuracy -= 12; // Bigger penalty for non-operating
            
            // Adjust based on frequency (VERY IMPORTANT)
            if (avgFrequency <= 15) accuracy += 8; // Excellent frequency
            else if (avgFrequency <= 20) accuracy += 5; // Good frequency
            else if (avgFrequency <= 30) accuracy += 2; // Decent frequency
            else if (avgFrequency >= 60) accuracy -= 12; // Poor frequency (like 11M)
            else if (avgFrequency >= 45) accuracy -= 6; // Bad frequency
            
            // Time of day variation (rush hour vs off-peak)
            const currentHour = new Date().getHours();
            if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
                accuracy -= 3; // Rush hour is less predictable
            }
            
            // Ensure accuracy is within realistic bounds
            accuracy = Math.max(72, Math.min(95, accuracy));
            
            // Calculate frequency score (CRITICAL for route selection)
            let frequencyScore = 0;
            if (avgFrequency > 0) {
                // Inverse relationship: lower frequency (minutes) = higher score
                if (avgFrequency <= 10) frequencyScore = 100; // Excellent (every 10 min or less)
                else if (avgFrequency <= 15) frequencyScore = 80; // Very good (every 15 min)
                else if (avgFrequency <= 20) frequencyScore = 60; // Good (every 20 min)
                else if (avgFrequency <= 30) frequencyScore = 40; // Decent (every 30 min)
                else if (avgFrequency <= 45) frequencyScore = 20; // Poor (every 45 min)
                else frequencyScore = 5; // Very poor (every 60+ min like 11M)
            }
            
            // Calculate overall score for ranking
            let score = 0;
            switch (plan.mode) {
                case 'fastest':
                    // For fastest: prioritize time but heavily weight frequency
                    const fastTimeScore = duration > 0 ? (3600 / duration) * 60 : 0;
                    score = fastTimeScore + (frequencyScore * 2); // Frequency is 2x important
                    break;
                case 'cheapest':
                    // For cheapest: prioritize cost but still consider frequency
                    const cheapCostScore = fare > 0 ? (10000 / fare) * 70 : 1000;
                    score = cheapCostScore + frequencyScore; // Frequency still matters
                    break;
                case 'balanced':
                default:
                    // Balanced score: time + cost + convenience + frequency (frequency is most important)
                    const timeScore = duration > 0 ? (3600 / duration) * 30 : 0;
                    const costScore = fare > 0 ? (10000 / fare) * 20 : 300;
                    const convenienceScore = (10 - transfers * 2) * 8;
                    score = timeScore + costScore + convenienceScore + (frequencyScore * 2.5); // Frequency is 2.5x important
                    break;
            }
            
            return {
                ...plan,
                accuracy: Math.round(accuracy),
                score: score,
                transfers: transfers,
                walkingDistance: walkingDistance,
                avgFrequency: avgFrequency,
                worstFrequency: worstFrequency,
                frequencyScore: frequencyScore
            };
        });
        
        return enhanced;
    }

    async findAndRenderAlternatives(fromId, toId) {
        try {
            const jp = this.app.modules.journey;
            const gtfs = this.app.modules.gtfs;
            const stops = gtfs.getStops() || [];
            const stopsById = new Map(stops.map(s => [String(s.stop_id||''), s]));
            const fromStop = stopsById.get(String(fromId));
            const toStop = stopsById.get(String(toId));
            const when = this.getDepartureDateTime();

            const suggestions = [];
            const cards = [];

            // 1) Try future times (next 30/60/120/180 minutes)
            const offsets = [30, 60, 120, 180];
            for (const off of offsets) {
                try {
                    const t2 = new Date(when.getTime() + off*60000);
                    jp.setDepartureDateTime(t2);
                    const p = jp.computePlanByStopIds(fromId, toId, this.currentMode);
                    if (p) {
                        suggestions.push({ type: 'time', minutes: off, plan: p, when: t2 });
                        // Only collect up to 2 time alternatives
                        if (suggestions.filter(s=>s.type==='time').length >= 2) break;
                    }
                } catch(_) {}
            }

            // 2) Try longer walk alternatives (nearby start or end stops up to ~1.2km)
            const maxDist = 1200; // meters
            const nearest = (center, limit=6) => {
                const res = [];
                for (const s of stops) {
                    if (!s || !s.stop_lat || !s.stop_lon) continue;
                    const sid = String(s.stop_id||'');
                    // Only consider main/feeder stops that appear in stop_times
                    // We approximate by checking they're in stopToRoutes
                    try {
                        const str = gtfs.getStopToRoutes(); if (!str[sid] || str[sid].length===0) continue;
                    } catch(_) { continue; }
                    const d = this.haversine(center.stop_lat, center.stop_lon, s.stop_lat, s.stop_lon);
                    if (d>0 && d<=maxDist) res.push({ s, d });
                }
                res.sort((a,b) => a.d - b.d);
                return res.slice(0, limit).map(x=>x);
            };
            if (fromStop && toStop && suggestions.length < 2) {
                const nearFrom = nearest(fromStop, 6);
                for (const cand of nearFrom) {
                    try {
                        jp.setDepartureDateTime(when);
                        const p = jp.computePlanByStopIds(String(cand.s.stop_id), toId, this.currentMode);
                        if (p) {
                            suggestions.push({ type: 'walk_from', meters: Math.round(cand.d), altFrom: cand.s, plan: p, when });
                            if (suggestions.filter(s=>s.type!=='time').length >= 2) break;
                        }
                    } catch(_){}
                }
                if (suggestions.filter(s=>s.type!=='time').length < 2) {
                    const nearTo = nearest(toStop, 6);
                    for (const cand of nearTo) {
                        try {
                            jp.setDepartureDateTime(when);
                            const p = jp.computePlanByStopIds(fromId, String(cand.s.stop_id), this.currentMode);
                            if (p) {
                                suggestions.push({ type: 'walk_to', meters: Math.round(cand.d), altTo: cand.s, plan: p, when });
                                if (suggestions.filter(s=>s.type!=='time').length >= 2) break;
                            }
                        } catch(_){}
                    }
                }
            }

            // Render suggestions
            if (suggestions.length === 0) return;
            const grid = document.createElement('div');
            grid.className = 'row g-3';

            const fmtMin = (m)=> `${m} mnt lagi`;
            const fmtWalk = (m)=> (m<1000? `${m} m` : `${(m/1000).toFixed(1)} km`);
            const timeStr = (d)=> d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});

            suggestions.slice(0,3).forEach((sug, idx) => {
                const plan = sug.plan;
                const dur = this.formatDuration(plan && plan.duration ? plan.duration.totalSec : 0);
                let title = '';
                let subtitle = '';
                if (sug.type === 'time') {
                    title = `Berangkat ${fmtMin(sug.minutes)}`;
                    subtitle = `ETA ${timeStr(sug.when)}`;
                } else if (sug.type === 'walk_from') {
                    title = `Jalan ke ${this.escape(String(sug.altFrom.stop_name))}`;
                    subtitle = `${fmtWalk(sug.meters)} • Durasi ${dur}`;
                } else if (sug.type === 'walk_to') {
                    title = `Turun di ${this.escape(String(sug.altTo.stop_name))}`;
                    subtitle = `${fmtWalk(sug.meters)} • Durasi ${dur}`;
                }

                const col = document.createElement('div');
                col.className = 'col-12 col-lg-4';
                col.innerHTML = `
                    <div class="planner-result-card h-100">
                        <div class="planner-result-header">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="planner-result-mode">
                                    <iconify-icon icon="mdi:lightbulb-on"></iconify-icon>
                                    <span>Alternatif</span>
                                </div>
                                <div class="planner-result-badges">
                                    <div class="planner-result-badge">${this.escape(dur)}</div>
                                </div>
                            </div>
                        </div>
                        <div class="planner-result-body">
                            <div class="planner-result-summary">
                                <div class="planner-result-info">
                                    <div class="planner-result-info-item">
                                        <div class="planner-result-info-label">Opsi</div>
                                        <div class="planner-result-info-value">${title}</div>
                                    </div>
                                    <div class="planner-result-info-item">
                                        <div class="planner-result-info-label">Detail</div>
                                        <div class="planner-result-info-value">${subtitle}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="planner-result-actions">
                                <button type="button" class="planner-result-map-btn" data-alt-idx="${idx}">
                                    <iconify-icon icon="mdi:map"></iconify-icon>
                                    <span>Tampilkan di Peta</span>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
                cards.push(plan);
            });

            this.resultsDiv.appendChild(grid);
            // Wire buttons
            this.resultsDiv.querySelectorAll('[data-alt-idx]')?.forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-alt-idx'), 10) || 0;
                    const plan = cards[idx];
                    if (plan) {
                        this.app.modules.journey.showPlanOnMap(plan);
                    }
                });
            });
        } catch (e) {
            console.warn('findAndRenderAlternatives error:', e);
        } finally {
            // restore selected time on journey planner
            try { this.app.modules.journey.setDepartureDateTime(this.getDepartureDateTime()); } catch(_) {}
        }
    }

    haversine(lat1, lon1, lat2, lon2) {
        const toRad = (x)=> x*Math.PI/180;
        const R = 6371e3; // meters
        const dLat = toRad(lat2-lat1);
        const dLon = toRad(lon2-lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
        return 2*R*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    
    sortResultsByPreference(results) {
        if (!results || results.length === 0) return results;
        
        console.log('Sorting with current mode:', this.currentMode);
        console.log('Available modes:', results.map(r => r.mode));
        
        // First, sort by user's preferred mode, then by score
        const preferred = results.filter(r => r.mode === this.currentMode);
        const others = results.filter(r => r.mode !== this.currentMode);
        
        console.log('Preferred results:', preferred.length);
        console.log('Other results:', others.length);
        
        // Sort each group by score (descending)
        preferred.sort((a, b) => b.score - a.score);
        others.sort((a, b) => b.score - a.score);
        
        const sorted = [...preferred, ...others];
        console.log('Final sorted order:', sorted.map(r => r.mode));
        
        return sorted;
    }
    
    hashRouteForVariation(plan) {
        // Create a hash based on route characteristics for consistent variation
        try {
            const routeIds = (plan.legs || [])
                .filter(leg => leg.mode === 'TRANSIT' && leg.routeId)
                .map(leg => String(leg.routeId))
                .join('');
            
            const startStop = String(plan.startStop?.stop_id || '');
            const endStop = String(plan.goalStop?.stop_id || '');
            const mode = String(plan.mode || '');
            
            const hashString = routeIds + startStop + endStop + mode;
            let hash = 0;
            for (let i = 0; i < hashString.length; i++) {
                const char = hashString.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
        } catch (error) {
            return 42; // Fallback hash
        }
    }
    
    calculatePlanFrequency(plan) {
        try {
            const gtfs = this.app.modules.gtfs;
            const frequencies = gtfs.getFrequencies() || [];
            const trips = gtfs.getTrips() || [];
            
            // Get all route IDs from transit legs
            const routeIds = (plan.legs || [])
                .filter(leg => leg.mode === 'TRANSIT' && leg.routeId)
                .map(leg => String(leg.routeId));
            
            if (routeIds.length === 0) {
                return { avgFrequency: 30, worstFrequency: 30 }; // Default for walking-only
            }
            
            const routeFrequencies = [];
            
            for (const routeId of routeIds) {
                // Get trips for this route
                const routeTrips = trips.filter(t => String(t.route_id) === routeId);
                const tripIds = routeTrips.map(t => t.trip_id);
                
                // Get frequencies for these trips
                const routeFreqs = frequencies.filter(f => tripIds.includes(f.trip_id));
                
                let routeFrequency = 60; // Default poor frequency
                
                if (routeFreqs.length > 0) {
                    // Calculate average headway for this route
                    let totalHeadway = 0;
                    let count = 0;
                    
                    routeFreqs.forEach(f => {
                        let headway = null;
                        
                        // Try different headway fields
                        if (f.headway_secs) {
                            headway = parseInt(f.headway_secs) / 60; // Convert to minutes
                        } else if (f.min_headway_secs && f.max_headway_secs) {
                            const minHeadway = parseInt(f.min_headway_secs) / 60;
                            const maxHeadway = parseInt(f.max_headway_secs) / 60;
                            headway = (minHeadway + maxHeadway) / 2; // Average
                        } else if (f.min_headway_secs) {
                            headway = parseInt(f.min_headway_secs) / 60;
                        }
                        
                        if (headway && headway > 0 && headway <= 120) { // Reasonable range
                            totalHeadway += headway;
                            count++;
                        }
                    });
                    
                    if (count > 0) {
                        routeFrequency = totalHeadway / count;
                    }
                } else {
                    // Fallback: estimate based on route pattern with more realistic frequencies
                    const routeShortName = this.getRouteShortName(routeId);
                    if (routeShortName) {
                        // Add variation based on route characteristics
                        const routeHash = Math.abs(routeId.split('').reduce((a, b) => {
                            a = ((a << 5) - a) + b.charCodeAt(0);
                            return a & a;
                        }, 0));
                        const variation = (routeHash % 6) - 3; // -3 to +2 minutes variation
                        
                        // Main corridors (1-13) have better frequency
                        if (routeShortName.match(/^([1-9]|1[0-3])$/)) {
                            // Popular corridors like 1, 2, 3, 6, 9, 11 have excellent frequency
                            if (['1', '2', '3', '6', '9', '11'].includes(routeShortName)) {
                                routeFrequency = Math.max(8, 12 + variation); // 8-15 minutes (very good)
                            } else if (['4', '5', '7', '8', '10', '12', '13'].includes(routeShortName)) {
                                routeFrequency = Math.max(10, 15 + variation); // 10-18 minutes (good)
                            } else {
                                routeFrequency = Math.max(12, 18 + variation); // 12-21 minutes (decent)
                            }
                        } else if (routeShortName.match(/^([1-9]|1[0-3])[A-Z]$/)) {
                            routeFrequency = Math.max(15, 20 + variation); // Branch routes: 15-23 minutes
                        } else if (routeShortName.includes('M')) {
                            // Mikrotrans varies significantly more
                            if (routeShortName === '11M') {
                                routeFrequency = Math.max(50, 65 + variation); // 11M: 50-68 minutes (very poor)
                            } else if (routeShortName === '1M' || routeShortName === '2M') {
                                routeFrequency = Math.max(30, 40 + variation); // Better M routes: 30-43 minutes
                            } else {
                                routeFrequency = Math.max(40, 50 + variation); // Other M routes: 40-53 minutes
                            }
                        } else if (routeShortName.match(/^[A-Z]+$/)) {
                            // Letter routes (like JAK, etc.) - more variation
                            const letterVariation = (routeHash % 12) - 6; // -6 to +5 variation
                            routeFrequency = Math.max(15, 25 + letterVariation); // 15-30 minutes
                        } else if (routeShortName.startsWith('B')) {
                            // Feeder routes - generally less frequent
                            routeFrequency = Math.max(20, 30 + variation); // 20-33 minutes
                        } else {
                            routeFrequency = Math.max(15, 22 + variation); // Other routes: 15-25 minutes
                        }
                    }
                }
                
                routeFrequencies.push(routeFrequency);
            }
            
            if (routeFrequencies.length === 0) {
                return { avgFrequency: 30, worstFrequency: 30, bestFrequency: 30 };
            }
            
            // Calculate best (fastest), average, and worst frequency
            const bestFrequency = Math.min(...routeFrequencies); // FASTEST headway
            const avgFrequency = routeFrequencies.reduce((sum, freq) => sum + freq, 0) / routeFrequencies.length;
            const worstFrequency = Math.max(...routeFrequencies);
            
            return {
                avgFrequency: Math.round(avgFrequency),
                worstFrequency: Math.round(worstFrequency),
                bestFrequency: Math.round(bestFrequency) // Add best frequency
            };
            
        } catch (error) {
            console.warn('Error calculating plan frequency:', error);
            return { avgFrequency: 30, worstFrequency: 30, bestFrequency: 30 };
        }
    }
    
    getRouteShortName(routeId) {
        try {
            const gtfs = this.app.modules.gtfs;
            const routes = gtfs.getRoutes() || [];
            const route = routes.find(r => String(r.route_id) === String(routeId));
            return route ? route.route_short_name : null;
        } catch (error) {
            return null;
        }
    }

    renderPlanCard(plan, isBest = false) {
        try {
            const mode = String(plan.mode || 'balanced');
            const modeLabel = mode === 'fastest' ? 'Tercepat' : (mode === 'cheapest' ? 'Terhemat' : 'Seimbang');
            const modeIcon = mode === 'fastest' ? 'mdi:speedometer' : (mode === 'cheapest' ? 'mdi:currency-usd' : 'fa-solid fa-scale-balanced');
            const fareText = (() => { 
                const f = plan.fare; 
                if (f && isFinite(f.total)) { 
                    const rp = new Intl.NumberFormat('id-ID').format(f.total); 
                    
                    // JakLingko savings display
                    if (f.paymentMethod === 'jaklingko' && f.originalTotal && f.savings > 0) {
                        const rpOriginal = new Intl.NumberFormat('id-ID').format(f.originalTotal);
                        const rpSavings = new Intl.NumberFormat('id-ID').format(f.savings);
                        return `
                            <div style="display:flex;flex-direction:column;gap:4px;">
                                <div style="font-size:0.75rem;color:#9ca3af;text-decoration:line-through;">
                                    Rp${rpOriginal}
                                </div>
                                <div style="font-size:1rem;font-weight:700;color:#065f46;">
                                    Rp${rp}
                                </div>
                                <div style="background:#10b981;color:white;font-size:0.7rem;padding:2px 6px;border-radius:4px;display:inline-block;width:fit-content;">
                                    💰 -Rp${rpSavings}
                                </div>
                            </div>
                        `;
                    }
                    
                    return `Rp${rp}`; 
                } 
                return '-'; 
            })();
            const durLabel = this.formatDuration(plan && plan.duration ? plan.duration.totalSec : 0);
            
            // Calculate ETA based on selected departure time
            const departureTime = this.getDepartureDateTime();
            const durationSec = plan && plan.duration ? plan.duration.totalSec : 0;
            const arrivalTime = new Date(departureTime.getTime() + (durationSec * 1000));
            const eta = arrivalTime.toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
            
            // Get status based on selected departure time
            const statusBadge = this.getServiceStatusBadgeAtTime(plan, departureTime);
            const steps = Array.isArray(plan.steps) ? plan.steps : [];
            let currentTime = new Date(departureTime);
            
            const stepsHtml = steps.map((s, index) => {
                const stepType = s.text.toLowerCase().includes('jalan') || s.text.toLowerCase().includes('walk') ? 'walk' : 'transit';
                const stepIcon = stepType === 'walk' ? 'mdi:walk' : 'mdi:bus';
                let stepText = this.escape(s.text);
                
                // Platform info removed per request
                
                // Update current time for next step (estimate 2-3 minutes per step)
                currentTime = new Date(currentTime.getTime() + (3 * 60 * 1000));
                
                return `
                    <div class="planner-result-step">
                        <div class="planner-result-step-icon ${stepType}">
                            <iconify-icon icon="${stepIcon}"></iconify-icon>
                        </div>
                        <div class="planner-result-step-text">${stepText}</div>
                    </div>
                `;
            }).join('');
            const fromId = String(plan.startStop?.stop_id || '');
            const toId = String(plan.goalStop?.stop_id || '');
            
            const isActive = statusBadge.includes('Beroperasi');
            const statusClass = isActive ? 'status' : 'status inactive';
            const statusText = isActive ? 'Beroperasi' : 'Tidak beroperasi';
            
            // Get accuracy and best route indicator
            const accuracy = plan.accuracy || 85;
            const accuracyColor = accuracy >= 90 ? '#10b981' : accuracy >= 80 ? '#f59e0b' : '#ef4444';
            const accuracyIcon = accuracy >= 90 ? 'mdi:check-circle' : accuracy >= 80 ? 'mdi:alert-circle' : 'mdi:information';
            
            // Create a lightweight share ID and store plan in memory (avoid huge HTML data attributes)
            const planId = `jp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            try { this._sharedPlanMap.set(planId, plan); } catch(_) {}

            return `
                <div class="col-12 col-lg-4">
                    <div class="planner-result-card h-100">
                        <div class="planner-result-header">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="planner-result-mode">
                                    ${modeIcon.startsWith('fa-') ? `<i class="${modeIcon}"></i>` : `<iconify-icon icon="${modeIcon}"></iconify-icon>`}
                                    <span>${modeLabel}</span>
                                </div>
                                <div class="planner-result-badges">
                                    <div class="planner-result-badge eta">
                                        ETA ${eta || '-'}
                                    </div>
                                    <div class="planner-result-badge ${statusClass}">
                                        ${statusText}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="planner-result-body">
                            <div class="planner-result-summary">
                                <div class="planner-result-info">
                                    <div class="planner-result-info-item">
                                        <div class="planner-result-info-label">Durasi</div>
                                        <div class="planner-result-info-value">${durLabel}</div>
                                    </div>
                                    <div class="planner-result-info-item">
                                        <div class="planner-result-info-label">Tarif</div>
                                        <div class="planner-result-info-value">${fareText}</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="planner-result-steps">
                                <div class="planner-result-steps-header">
                                    <iconify-icon icon="mdi:format-list-numbered"></iconify-icon>
                                    <span>Langkah Perjalanan (${steps.length})</span>
                                </div>
                                <div class="planner-result-steps-list">
                                    ${stepsHtml}
                                </div>
                            </div>
                            
                            <div class="planner-result-actions">
                                <button type="button" class="planner-result-map-btn" data-show-map data-mode="${mode}" data-from="${this.escape(fromId)}" data-to="${this.escape(toId)}">
                                    <iconify-icon icon="mdi:map"></iconify-icon>
                                    <span>Tampilkan di Peta</span>
                                </button>
                                <button type="button" class="planner-result-share-btn" data-share data-plan-id="${planId}">
                                    <iconify-icon icon="mdi:share-variant"></iconify-icon>
                                    <span>Bagikan Rute</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
        } catch (_) {
            return '';
        }
    }

    formatDuration(totalSec) {
        try {
            const sec = parseInt(totalSec || 0, 10);
            if (!isFinite(sec) || sec <= 0) return '-';
            const mins = Math.round(sec / 60);
            if (mins < 60) return `${mins} menit`;
            const hours = Math.floor(mins / 60);
            const rem = mins % 60;
            if (rem === 0) return `${hours} jam`;
            return `${hours} jam ${rem} mnt`;
        } catch (_) { return '-'; }
    }
    
    formatFrequency(avgFrequency) {
        try {
            if (!avgFrequency || avgFrequency <= 0) return '-';
            const freq = Math.round(avgFrequency);
            if (freq <= 15) return `${freq} mnt ⭐`; // Excellent
            else if (freq <= 20) return `${freq} mnt 👍`; // Good
            else if (freq <= 30) return `${freq} mnt ✓`; // Decent
            else if (freq <= 45) return `${freq} mnt ⚠️`; // Poor
            else return `${freq} mnt ❌`; // Very poor
        } catch (_) { return '-'; }
    }

    getServiceStatusBadge(plan) {
        try {
            const gtfs = this.app.modules.gtfs;
            const trips = gtfs.getTrips ? (gtfs.getTrips() || []) : [];
            const calendar = gtfs.getCalendar ? (gtfs.getCalendar() || []) : [];
            if (!Array.isArray(calendar) || calendar.length === 0) return '';

            // Build service_id -> calendar entries map
            const calByService = new Map();
            for (const c of calendar) {
                const sid = String(c.service_id || '');
                if (!sid) continue;
                if (!calByService.has(sid)) calByService.set(sid, []);
                calByService.get(sid).push(c);
            }

            // For each route in the plan, ensure there exists at least one active service today
            const routeIds = new Set((plan.legs || []).map(l => String(l.routeId || '')));
            const today = new Date();
            const dayMap = { 0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday' };
            const dayKey = dayMap[today.getDay()];

            const yyyymmddToDate = (s) => {
                if (!s || String(s).length !== 8) return null;
                const y = parseInt(String(s).slice(0, 4), 10);
                const m = parseInt(String(s).slice(4, 6), 10) - 1;
                const d = parseInt(String(s).slice(6, 8), 10);
                return new Date(y, m, d);
            };

            const isServiceActiveToday = (serviceId) => {
                const entries = calByService.get(String(serviceId) || '') || [];
                for (const c of entries) {
                    try {
                        if (String(c[dayKey]) !== '1') continue;
                        const start = yyyymmddToDate(c.start_date);
                        const end = yyyymmddToDate(c.end_date);
                        if (!start || !end) continue;
                        // Compare by date only
                        const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        if (t >= start && t <= end) return true;
                    } catch (_) { /* ignore */ }
                }
                return false;
            };

            const tripsByRoute = new Map();
            for (const t of trips) {
                const rid = String(t.route_id || '');
                if (!rid) continue;
                if (!tripsByRoute.has(rid)) tripsByRoute.set(rid, []);
                tripsByRoute.get(rid).push(t);
            }

            let allRoutesActive = true;
            for (const rid of routeIds) {
                const ts = tripsByRoute.get(rid) || [];
                let routeActive = false;
                for (const t of ts) {
                    const sid = String(t.service_id || '');
                    if (sid && isServiceActiveToday(sid)) { routeActive = true; break; }
                }
                if (!routeActive) { allRoutesActive = false; break; }
            }

            // Additional check for operation hours
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();
            const currentTime = hour * 60 + minute;
            
            let operatingNow = allRoutesActive;
            if (allRoutesActive) {
                // Check if routes are operating at current time
                for (const rid of routeIds) {
                    const routeShortName = this.getRouteShortName(rid);
                    const operationHours = this.getRouteOperationHours(routeShortName);
                    if (!this.isRouteOperatingNow(operationHours, currentTime)) {
                        operatingNow = false;
                        break;
                    }
                }
            }
            
            if (operatingNow) {
                return '<span class="badge bg-success-subtle text-success">Beroperasi</span>';
            } else if (allRoutesActive) {
                return '<span class="badge bg-warning-subtle text-warning">Tidak beroperasi saat ini</span>';
            } else {
                return '<span class="badge bg-secondary-subtle text-secondary">Tidak beroperasi</span>';
            }
        } catch (_) { return ''; }
    }
    
    getServiceStatusBadgeAtTime(plan, checkTime) {
        try {
            const jp = this.app.modules.journey;
            if (!jp) return '';
            const routeIds = new Set((plan.legs || []).map(l => String(l.routeId || '')));
            const ok = Array.from(routeIds).every(rid => jp.isRouteOperatingAt(String(rid), checkTime));
            return ok
                ? '<span class="badge bg-success-subtle text-success">Beroperasi</span>'
                : '<span class="badge bg-secondary-subtle text-secondary">Tidak beroperasi</span>';
        } catch (_) { return ''; }
    }
    
    getRouteOperationHours(routeShortName) {
        // Define operation hours for different route types (in minutes since midnight)
        const operationHours = {
            // Main corridors (5 AM - 10 PM)
            'main': { start: 5 * 60, end: 22 * 60 },
            // Branch routes (5:30 AM - 9:30 PM) 
            'branch': { start: 5 * 60 + 30, end: 21 * 60 + 30 },
            // Mikrotrans (6 AM - 8 PM)
            'mikrotrans': { start: 6 * 60, end: 20 * 60 },
            // Feeder (5:30 AM - 9 PM)
            'feeder': { start: 5 * 60 + 30, end: 21 * 60 },
            // Night services (extended hours)
            'night': { start: 5 * 60, end: 23 * 60 }
        };
        const always = { start: 0, end: (24 * 60) - 1 };
        
        if (!routeShortName) return operationHours.main;
        
        // Classify route type based on route name
        if (routeShortName.match(/^([1-9]|1[0-4])$/)) {
            // Main corridors 1-14 operate 24 hours
            return always;
        } else if (routeShortName.match(/^([1-9]|1[0-4])[A-Z]$/)) {
            return operationHours.branch; // Branch routes like 1A, 2B, etc.
        } else if (routeShortName.includes('M')) {
            return operationHours.mikrotrans; // Mikrotrans routes
        } else if (routeShortName.startsWith('B') || routeShortName.match(/^[A-Z]+$/)) {
            return operationHours.feeder; // Feeder routes
        }
        
        return operationHours.main; // Default
    }
    
    isRouteOperatingNow(operationHours, currentTime) {
        return currentTime >= operationHours.start && currentTime <= operationHours.end;
    }
    
    
    detectStopTypeByName(stopName) {
        try {
            const gtfs = this.app.modules.gtfs;
            const allStops = gtfs.getStops() || [];
            const key = this._buildClusterKeyForName(stopName);
            const cluster = allStops.filter(s => this._buildClusterKeyForStop(s) === key);
            for (const s of cluster) {
                const sid = String(s.stop_id || '');
                if (sid.startsWith('B')) return 'Halte Pengumpan';
                if (sid.startsWith('E') || sid.startsWith('H')) return 'Akses Masuk';
            }
            return '';
        } catch(_) { return ''; }
    }
    
    
    getRouteFrequencyByName(routeName) {
        try {
            // Use similar logic as calculatePlanFrequency but for individual route names
            if (!routeName) return 25; // Default
            
            // Add more significant variation based on route name for realistic frequencies
            const routeHash = Math.abs(routeName.split('').reduce((a, b) => {
                a = ((a << 5) - a) + b.charCodeAt(0);
                return a & a;
            }, 0));
            const variation = (routeHash % 10) - 5; // -5 to +4 minutes variation (more spread)
            
            // Main corridors (1-13) have better frequency
            if (routeName.match(/^([1-9]|1[0-3])$/)) {
                // Popular corridors like 1, 2, 3, 6, 9, 11 have excellent frequency
                if (['1', '2', '3', '6', '9', '11'].includes(routeName)) {
                    return Math.max(8, 12 + variation); // 8-16 minutes (very good)
                } else if (['4', '5', '7', '8', '10', '12', '13'].includes(routeName)) {
                    return Math.max(10, 15 + variation); // 10-19 minutes (good)
                } else {
                    return Math.max(12, 18 + variation); // 12-22 minutes (decent)
                }
            } else if (routeName.match(/^([1-9]|1[0-3])[A-Z]$/)) {
                return Math.max(15, 20 + variation); // Branch routes: 15-24 minutes
            } else if (routeName.includes('M')) {
                // Mikrotrans varies significantly more
                if (routeName === '11M') {
                    return Math.max(50, 65 + variation); // 11M: 50-69 minutes (very poor)
                } else if (routeName === '1M' || routeName === '2M') {
                    return Math.max(30, 40 + variation); // Better M routes: 30-44 minutes
                } else {
                    return Math.max(40, 50 + variation); // Other M routes: 40-54 minutes
                }
            } else if (routeName.match(/^[A-Z]+$/)) {
                // Letter routes (like JAK, etc.) - more variation
                const letterVariation = (routeHash % 15) - 7; // -7 to +7 variation
                return Math.max(15, 25 + letterVariation); // 15-32 minutes
            } else if (routeName.startsWith('B')) {
                // Feeder routes - generally less frequent
                return Math.max(20, 30 + variation); // 20-34 minutes
            } else {
                return Math.max(15, 22 + variation); // Other routes: 15-26 minutes
            }
        } catch (error) {
            return 25; // Fallback
        }
    }

    renderError(msg) {
        return `
            <div class="col-12">
                <div class="planner-result-card">
                    <div class="planner-result-body text-center py-4">
                        <iconify-icon icon="mdi:alert-circle" style="font-size: 2rem; color: #f59e0b; margin-bottom: 12px;"></iconify-icon>
                        <h5 class="mb-2">Rute Tidak Ditemukan</h5>
                        <p class="text-muted mb-0">${this.escape(msg)}</p>
                    </div>
                </div>
            </div>
        `;
    }

    escape(s) {
        try { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; } catch (_) { return String(s); }
    }
}


