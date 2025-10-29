/**
 * QuizManager - Manages quiz functionality for TransJakarta and KRL
 */

export class QuizManager {
    constructor() {
        this.currentMode = null;
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.totalQuestions = 10;
        this.userSelectedQuestionCount = 10;
        this.startTime = null;
        this.timerInterval = null;
        this.gtfsData = null;
        this.krlData = null;
        this.answered = false;
        this.selectedRoutes = [];
        this.currentCategory = 'all';
        this.userAnswers = []; // Store user answers for review
        this.timeLimit = 180; // Default 3 minutes (in seconds), 0 = no limit
    }

    getRouteColorByShortName(shortName) {
        try {
            const routes = this.gtfsData?.routes || [];
            const r = routes.find(rt => String(rt.route_short_name || rt.route_id) === String(shortName));
            return r && r.route_color ? `#${r.route_color}` : '#2563eb';
        } catch (_) {
            return '#2563eb';
        }
    }

    renderRouteOptionBadges(optionString) {
        const tokens = String(optionString || '')
            .replace(/,/g, ' ')
            .split(/\s+/)
            .map(t => t.trim())
            .filter(Boolean);
        return tokens.map(tok => {
            const color = this.getRouteColorByShortName(tok);
            return `<span class=\"route-chip\" style=\"background:${color}\">${tok}</span>`;
        }).join(' ');
    }

    // Prefer iconic BRT haltes for more interesting questions
    getIconicBRTStopNames() {
        return [
            'Harmoni',
            'Kampung Melayu',
            'Dukuh Atas',
            'Dukuh Atas 2',
            'Monas',
            'Blok M',
            'Pulo Gadung',
            'Ragunan',
            'Senen',
            'Cawang UKI',
            'Bundaran Senayan',
            'Gelora Bung Karno',
            'Semanggi',
            'Grogol'
        ];
    }

    findStopsByNameFuzzy(name) {
        try {
            const stops = this.gtfsData?.stops || [];
            const norm = (s) => String(s || '')
                .toLowerCase()
                .replace(/halte\s+/g, '')
                .replace(/[0-9]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            const target = norm(name);
            return stops.filter(st => norm(st.stop_name).includes(target));
        } catch (_) {
            return [];
        }
    }

    formatRouteDisplay(route) {
        const shortName = route?.route_short_name || route?.route_id || '';
        const routeDesc = String(route?.route_desc || '').toLowerCase();
        const isBRT = routeDesc.includes('brt') || /^[0-9]/.test(shortName);
        const label = isBRT ? `Rute Koridor ${shortName}` : `Rute ${shortName}`;
        const color = `#${route?.route_color || '2563eb'}`;
        return { label, shortName, color };
    }

    async init() {
        console.log('🎮 QuizManager: Initializing...');
        
        // Load GTFS data
        await this.loadGTFSData();
        
        // Load KRL data
        await this.loadKRLData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        console.log('✅ QuizManager initialized');
    }

    async loadGTFSData() {
        try {
            const [routes, stops, stopTimes, trips] = await Promise.all([
                fetch('./gtfs/routes.txt').then(r => r.text()),
                fetch('./gtfs/stops.txt').then(r => r.text()),
                fetch('./gtfs/stop_times.txt').then(r => r.text()),
                fetch('./gtfs/trips.txt').then(r => r.text())
            ]);

            this.gtfsData = {
                routes: this.parseCSV(routes),
                stops: this.parseCSV(stops),
                stopTimes: this.parseCSV(stopTimes),
                trips: this.parseCSV(trips)
            };

            console.log('📦 GTFS Data loaded for quiz');
        } catch (e) {
            console.error('Failed to load GTFS data:', e);
        }
    }

    async loadKRLData() {
        try {
            const stationsInfo = await fetch('./modules/krl-stations-info.json').then(r => r.json());
            this.krlData = stationsInfo;
            console.log('🚆 KRL Data loaded for quiz');
        } catch (e) {
            console.warn('Failed to load KRL data:', e);
        }
    }

    parseCSV(csv) {
        const lines = csv.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, i) => {
                obj[header] = values[i] ? values[i].trim() : '';
            });
            return obj;
        });
    }

    setupEventListeners() {
        // Mode selection
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                if (mode === 'tj-custom') {
                    this.showRouteSelection();
                } else if (mode === 'krl') {
                    // Get question count and time limit from main selection
                    const questionCountMain = document.getElementById('questionCountMain');
                    if (questionCountMain) {
                        this.userSelectedQuestionCount = parseInt(questionCountMain.value);
                    }
                    const timeLimitSelect = document.getElementById('quizTimeLimit');
                    if (timeLimitSelect) {
                        this.timeLimit = parseInt(timeLimitSelect.value);
                    }
                    this.startQuiz('krl');
                }
            });
        });

        // Back to mode button
        document.getElementById('backToMode').addEventListener('click', () => {
            this.showModeSelection();
        });

        // Route search
        document.getElementById('routeSearch').addEventListener('input', (e) => {
            this.filterRoutes(e.target.value);
        });

        // Select all / Clear all
        document.getElementById('selectAllBtn').addEventListener('click', () => {
            this.selectAllVisible();
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            this.clearAllSelections();
        });

        // Category tabs
        document.querySelectorAll('#categoryTabs .nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('#categoryTabs .nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                const category = link.getAttribute('data-category');
                this.currentCategory = category;
                this.filterByCategory(category);
            });
        });

        // Start quiz button
        document.getElementById('startQuizBtn').addEventListener('click', () => {
            if (this.selectedRoutes.length > 0) {
                // Get question count and time limit from main selection screen
                const questionCountMain = document.getElementById('questionCountMain');
                if (questionCountMain) {
                    this.userSelectedQuestionCount = parseInt(questionCountMain.value);
                }
                const timeLimitSelect = document.getElementById('quizTimeLimit');
                if (timeLimitSelect) {
                    this.timeLimit = parseInt(timeLimitSelect.value);
                }
                this.startQuiz('tj-custom');
            }
        });

        // Next button
        document.getElementById('nextButton').addEventListener('click', () => {
            this.nextQuestion();
        });

        // Restart button
        document.getElementById('restartButton').addEventListener('click', () => {
            // Re-get question count from main dropdown
            const questionCountMain = document.getElementById('questionCountMain');
            if (questionCountMain) {
                this.userSelectedQuestionCount = parseInt(questionCountMain.value);
            }
            this.startQuiz(this.currentMode);
        });

        // Change mode button
        document.getElementById('changeModeButton').addEventListener('click', () => {
            this.showModeSelection();
        });

        // Review button
        document.getElementById('reviewButton').addEventListener('click', () => {
            this.showReview();
        });

        // Back to result button
        document.getElementById('backToResultBtn').addEventListener('click', () => {
            this.showResults();
        });

        // History navigation
        document.getElementById('historyNavBtn').addEventListener('click', (e) => {
            e.preventDefault();
            this.showHistory();
        });

        document.getElementById('backToModeFromHistory').addEventListener('click', () => {
            this.showModeSelection();
        });

        document.getElementById('clearHistoryBtn').addEventListener('click', () => {
            if (confirm('Yakin ingin menghapus semua riwayat kuis?')) {
                localStorage.removeItem('quizHistory');
                this.showHistory();
            }
        });

        document.getElementById('backToHistoryList').addEventListener('click', () => {
            this.showHistory();
        });
    }

    showRouteSelection() {
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('routeSelection').style.display = 'block';
        this.populateRouteList();
    }

    categorizeRoute(route) {
        // Use route_desc from GTFS data - this is the correct source!
        const routeDesc = (route.route_desc || '').trim().toLowerCase();
        
        if (routeDesc.includes('brt')) {
            return 'brt';
        }
        if (routeDesc.includes('rusun')) {
            return 'rusun';
        }
        if (routeDesc.includes('integrasi')) {
            return 'integrasi';
        }
        if (routeDesc.includes('royal')) {
            return 'royal';
        }
        if (routeDesc.includes('jabodetabek')) {
            return 'transjabodetabek';
        }
        if (routeDesc.includes('wisata')) {
            return 'wisata';
        }
        if (routeDesc.includes('mikro')) {
            return 'mikrotrans';
        }
        
        // Fallback to BRT if no route_desc
        return 'brt';
    }

    populateRouteList() {
        if (!this.gtfsData || !this.gtfsData.routes) return;

        const routeList = document.getElementById('routeList');
        routeList.innerHTML = '';
        this.selectedRoutes = [];

        this.gtfsData.routes.forEach(route => {
            const category = this.categorizeRoute(route);
            const routeItem = document.createElement('div');
            routeItem.className = 'route-item';
            routeItem.setAttribute('data-category', category);
            routeItem.setAttribute('data-route-id', route.route_id);
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'route-checkbox form-check-input';
            checkbox.value = route.route_id;
            
            checkbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectedRoutes.push(route.route_id);
                    routeItem.classList.add('selected');
                } else {
                    this.selectedRoutes = this.selectedRoutes.filter(id => id !== route.route_id);
                    routeItem.classList.remove('selected');
                }
                this.updateSelectedCount();
            });
            
            const badge = document.createElement('div');
            badge.className = 'route-badge';
            badge.style.background = `#${route.route_color || 'dc2626'}`;
            badge.textContent = route.route_short_name;
            
            const name = document.createElement('div');
            name.className = 'route-name';
            name.textContent = route.route_long_name || 'Rute TransJakarta';
            
            routeItem.appendChild(checkbox);
            routeItem.appendChild(badge);
            routeItem.appendChild(name);
            
            routeItem.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
            
            routeList.appendChild(routeItem);
        });
    }

    filterRoutes(searchTerm) {
        const items = document.querySelectorAll('.route-item');
        const term = searchTerm.toLowerCase();

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            const matchesSearch = text.includes(term);
            const matchesCategory = this.currentCategory === 'all' || item.getAttribute('data-category') === this.currentCategory;
            item.style.display = (matchesSearch && matchesCategory) ? 'flex' : 'none';
        });
    }

    filterByCategory(category) {
        const items = document.querySelectorAll('.route-item');
        const searchTerm = document.getElementById('routeSearch').value.toLowerCase();

        items.forEach(item => {
            const matchesCategory = category === 'all' || item.getAttribute('data-category') === category;
            const matchesSearch = !searchTerm || item.textContent.toLowerCase().includes(searchTerm);
            item.style.display = (matchesCategory && matchesSearch) ? 'flex' : 'none';
        });
    }

    selectAllVisible() {
        const visibleItems = document.querySelectorAll('.route-item[style*="flex"]');
        visibleItems.forEach(item => {
            const checkbox = item.querySelector('.route-checkbox');
            if (!checkbox.checked) {
                checkbox.checked = true;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    }

    clearAllSelections() {
        document.querySelectorAll('.route-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
            checkbox.dispatchEvent(new Event('change'));
        });
    }

    updateSelectedCount() {
        const count = this.selectedRoutes.length;
        document.getElementById('selectedCount').textContent = `${count} rute dipilih`;
        document.getElementById('startQuizBtn').disabled = count === 0;
    }

    startQuiz(mode) {
        this.currentMode = mode;
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.answered = false;
        this.userAnswers = []; // Reset user answers
        
        // Generate questions based on mode
        this.questions = this.generateQuestions(mode);
        
        if (this.questions.length === 0) {
            alert('Tidak ada pertanyaan yang bisa dibuat. Silakan pilih rute lain.');
            return;
        }
        
        // Start timer
        this.startTime = Date.now();
        this.startTimer();
        
        // Show quiz area
        document.getElementById('quizHeader').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('routeSelection').style.display = 'none';
        document.getElementById('quizArea').style.display = 'block';
        document.getElementById('resultArea').style.display = 'none';
        document.getElementById('reviewArea').style.display = 'none';
        
        // Show first question
        this.showQuestion();
    }

    generateQuestions(mode) {
        const questions = [];
        
        if (!this.gtfsData || !this.gtfsData.routes) {
            console.error('GTFS data not loaded');
            return [];
        }

        if (mode === 'krl') {
            return this.generateKRLQuestions();
        }

        // For custom mode, use selected routes
        if (mode === 'tj-custom' && this.selectedRoutes.length > 0) {
            const routes = this.gtfsData.routes.filter(r => this.selectedRoutes.includes(r.route_id));
            return this.generateQuestionsForMultipleRoutes(routes);
        }

        return [];
    }

    generateQuestionsForMultipleRoutes(routes) {
        const questions = [];
        
        // Get all stops for selected routes
        const routeStopsMap = new Map();
        
        routes.forEach(route => {
            const trip = this.gtfsData.trips.find(t => t.route_id === route.route_id);
            if (!trip) return;

            const stopsList = this.gtfsData.stopTimes
                .filter(st => st.trip_id === trip.trip_id)
                .sort((a, b) => parseInt(a.stop_sequence) - parseInt(b.stop_sequence))
                .map(st => {
                    const stop = this.gtfsData.stops.find(s => s.stop_id === st.stop_id);
                    return stop;
                })
                .filter(stop => stop);

            routeStopsMap.set(route.route_id, { route, stops: stopsList });
        });

        // Build stop-to-routes mapping for transit detection
        const stopRoutesMap = new Map();
        routeStopsMap.forEach(({ route, stops }) => {
            stops.forEach(stop => {
                if (!stopRoutesMap.has(stop.stop_id)) {
                    stopRoutesMap.set(stop.stop_id, { stop, routes: [] });
                }
                stopRoutesMap.get(stop.stop_id).routes.push(route);
            });
        });

        // Find transit stops (served by 2+ selected routes)
        const transitStops = Array.from(stopRoutesMap.values()).filter(s => s.routes.length >= 2);
        const routeArray = Array.from(routeStopsMap.values());
        
        // Track unique questions to avoid duplicates
        const seenQuestionKeys = new Set();
        const addQuestion = (question) => {
            if (!question) return false;
            const key = `${question.question}|${question.correct}`;
            if (seenQuestionKeys.has(key)) return false;
            seenQuestionKeys.add(key);
            questions.push(question);
            return true;
        };

        // Generate diverse questions with clear wording
        // Adjust question types based on number of routes selected
        let questionTypes = [
            'route-stops-at',     // Does route X stop at halte Y?
            'which-route-passes', // Which route passes through this stop?
            'terminal-stops',     // Both terminal stops
            'not-on-route',       // Which stop is NOT on this route?
        ];
        
        // Only include common-stop if 2+ routes selected
        if (routeArray.length >= 2) {
            questionTypes.push('common-stop'); // Common stops between routes
        }
        // New: routes-at-stop (list routes serving a stop)
        questionTypes.push('routes-at-stop');

        const targetCount = this.userSelectedQuestionCount || 10;
        
        console.log(`🎯 Target: ${targetCount} questions, Routes: ${routeArray.length}`);
        
        // Strategy: Generate more than needed, then shuffle and take targetCount
        const maxAttempts = targetCount * 30; // Even higher multiplier for reliability
        let attemptCount = 0;
        
        for (let i = 0; i < maxAttempts && questions.length < targetCount * 2; i++) {
            attemptCount++;
            
            // Prioritize easier question types if we're running low
            let qType;
            if (questions.length < targetCount && attemptCount > maxAttempts * 0.6) {
                // Use only most reliable question types in the last 40% of attempts
                const reliableTypes = ['route-stops-at', 'not-on-route'];
                qType = reliableTypes[Math.floor(Math.random() * reliableTypes.length)];
            } else {
                qType = questionTypes[Math.floor(Math.random() * questionTypes.length)];
            }
            
            let question = null;

            if (qType === 'route-stops-at') {
                // Question: Does route X stop at Y?
                const randomRouteData = routeArray[Math.floor(Math.random() * routeArray.length)];
                const { route, stops } = randomRouteData;
                const display = this.formatRouteDisplay(route);
                
                if (stops.length < 3) continue;
                
                // Prefer asking about iconic BRT haltes to make questions feel meaningful
                let targetStop;
                const useIconic = Math.random() > 0.3;
                if (useIconic) {
                    const iconicList = this.getIconicBRTStopNames();
                    const iconicName = iconicList[Math.floor(Math.random() * iconicList.length)];
                    const candidates = this.findStopsByNameFuzzy(iconicName);
                    if (candidates && candidates.length) {
                        targetStop = candidates[Math.floor(Math.random() * candidates.length)];
                    }
                }

                // If no iconic match, fallback to balanced correct/wrong
                const useCorrect = Math.random() > 0.5;
                
                if (useCorrect) {
                    if (!targetStop) {
                        targetStop = stops[Math.floor(Math.random() * stops.length)];
                    }
                } else {
                    // Find a stop NOT on this route
                    const allStops = Array.from(stopRoutesMap.values());
                    const wrongStops = allStops.filter(s => !stops.some(st => st.stop_id === s.stop.stop_id));
                    if (wrongStops.length > 0) {
                        if (!targetStop) {
                            targetStop = wrongStops[Math.floor(Math.random() * wrongStops.length)].stop;
                        }
                    }
                }
                
                if (targetStop) {
                    const correct = stops.some(s => s.stop_id === targetStop.stop_id);
                    question = {
                        question: `Apakah ${display.label} berhenti di halte "${targetStop.stop_name}"?`,
                        options: ['Ya', 'Tidak'].sort(() => 0.5 - Math.random()),
                        correct: correct ? 'Ya' : 'Tidak',
                        category: display.label,
                        routeShortName: display.shortName,
                        routeColor: display.color,
                        routeInfo: `${display.shortName} - ${route.route_long_name}`
                    };
                }
            } else if (qType === 'which-route-passes') {
                // Question: Which route passes through this stop?
                // Skip if only 1 route (not enough wrong answers)
                if (routeArray.length >= 2) {
                    const randomStop = Array.from(stopRoutesMap.values())[Math.floor(Math.random() * stopRoutesMap.size)];
                    const correctRouteObj = randomStop.routes[0];
                    const display = this.formatRouteDisplay(correctRouteObj);
                    const correctRoute = display.shortName;
                    
                    const wrongRoutes = routeArray
                        .filter(r => r.route.route_id !== correctRouteObj.route_id)
                        .map(r => r.route.route_short_name)
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 3);

                    if (wrongRoutes.length >= 1) { // Relaxed: at least 1 wrong answer
                        // Pad with duplicates if needed (for single route case)
                        while (wrongRoutes.length < 3 && routeArray.length === 1) {
                            wrongRoutes.push('Tidak ada rute lain');
                        }
                        
                        if (wrongRoutes.length >= 3 || routeArray.length === 1) {
                            question = {
                                question: `Rute manakah yang melewati halte "${randomStop.stop.stop_name}"?`,
                                options: [correctRoute, ...wrongRoutes.slice(0, 3)].sort(() => 0.5 - Math.random()),
                                correct: correctRoute,
                                category: display.label,
                                routeShortName: display.shortName,
                                routeColor: display.color,
                                routeInfo: `Halte ${randomStop.stop.stop_name}`
                            };
                        }
                    }
                }
            } else if (qType === 'terminal-stops') {
                // Question: Route destination using actual route_long_name
                const randomRouteData = routeArray[Math.floor(Math.random() * routeArray.length)];
                const { route, stops } = randomRouteData;
                const display = this.formatRouteDisplay(route);
                
                if (stops.length >= 6 && route.route_long_name) {
                    // Use the actual route_long_name as correct answer
                    const correctAnswer = route.route_long_name;
                    
                    // Generate wrong answers from other stops on THIS route
                    const wrongCombos = [];
                    const allStopNames = stops.map(s => s.stop_name);
                    
                    // Create fake destinations from stops in the route
                    for (let j = 0; j < 5; j++) {
                        const stop1 = allStopNames[Math.floor(Math.random() * allStopNames.length)];
                        const stop2 = allStopNames[Math.floor(Math.random() * allStopNames.length)];
                        if (stop1 !== stop2) {
                            const fakeDestination = `${stop1} - ${stop2}`;
                            if (fakeDestination !== correctAnswer && !wrongCombos.includes(fakeDestination)) {
                                wrongCombos.push(fakeDestination);
                            }
                        }
                    }
                    
                    if (wrongCombos.length >= 3) {
                        question = {
                            question: `${display.label} melayani jurusan kemana?`,
                            options: [correctAnswer, ...wrongCombos.slice(0, 3)].sort(() => 0.5 - Math.random()),
                            correct: correctAnswer,
                            category: display.label,
                            routeShortName: display.shortName,
                            routeColor: display.color,
                            routeInfo: `${display.shortName} - ${correctAnswer}`
                        };
                    }
                }
            } else if (qType === 'not-on-route') {
                // Question: Which stop is NOT on this route? (clearer than sequence)
                const randomRouteData = routeArray[Math.floor(Math.random() * routeArray.length)];
                const { route, stops } = randomRouteData;
                const display = this.formatRouteDisplay(route);
                
                if (stops.length >= 4) {
                    // Find stops NOT on this route
                    const allStops = Array.from(stopRoutesMap.values());
                    const stopsNotOnRoute = allStops.filter(s => 
                        !stops.some(st => st.stop_id === s.stop.stop_id)
                    );
                    
                    if (stopsNotOnRoute.length > 0) {
                        const correctStop = stopsNotOnRoute[Math.floor(Math.random() * stopsNotOnRoute.length)].stop.stop_name;
                        
                        // Wrong answers are stops that ARE on the route
                        const wrongStops = stops
                            .sort(() => 0.5 - Math.random())
                            .slice(0, 3)
                            .map(s => s.stop_name);
                        
                        if (wrongStops.length >= 3) {
                            question = {
                                question: `Halte mana yang TIDAK dilalui oleh ${display.label}?`,
                                options: [correctStop, ...wrongStops].sort(() => 0.5 - Math.random()),
                                correct: correctStop,
                                category: display.label,
                                routeShortName: display.shortName,
                                routeColor: display.color,
                                routeInfo: `${display.shortName}`
                            };
                        }
                    }
                }
            } else if (qType === 'common-stop' && routeArray.length >= 2) {
                // Question: Which stop is served by BOTH routes?
                // Simplified: just check if enough stops available
                const route1 = routeArray[Math.floor(Math.random() * routeArray.length)];
                const availableRoute2 = routeArray.filter(r => r.route.route_id !== route1.route.route_id);
                
                if (availableRoute2.length > 0 && route1.stops.length >= 3) {
                    const route2 = availableRoute2[Math.floor(Math.random() * availableRoute2.length)];
                    
                    // Find common stops
                    const commonStops = route1.stops.filter(s1 => 
                        route2.stops.some(s2 => s2.stop_id === s1.stop_id)
                    );
                    
                    if (commonStops.length > 0) {
                        const correctStop = commonStops[Math.floor(Math.random() * commonStops.length)];
                        
                        // Simple wrong answers: just get any stops not in common
                        const allStops = [...route1.stops, ...route2.stops];
                        const wrongStops = allStops
                            .filter(s => !commonStops.some(cs => cs.stop_id === s.stop_id))
                            .sort(() => 0.5 - Math.random())
                            .slice(0, 3);
                        
                        if (wrongStops.length >= 3) {
                            question = {
                                question: `Halte mana yang dilalui oleh KEDUA rute ${route1.route.route_short_name} DAN ${route2.route.route_short_name}?`,
                                options: [correctStop.stop_name, ...wrongStops.map(s => s.stop_name)].sort(() => 0.5 - Math.random()),
                                correct: correctStop.stop_name,
                                category: 'Transit',
                                routeInfo: `${route1.route.route_short_name} & ${route2.route.route_short_name}`
                            };
                        }
                    }
                }
            } else if (qType === 'routes-at-stop') {
                // Question: Which routes serve this stop? (space-separated list)
                try {
                    const chosen = routeArray[Math.floor(Math.random() * routeArray.length)];
                    if (!chosen || !chosen.stops?.length) continue;
                    const baseRoute = chosen.route;
                    const display = this.formatRouteDisplay(baseRoute);
                    const stop = chosen.stops[Math.floor(Math.random() * chosen.stops.length)];

                    // Find ALL routes (global) that serve this stop
                    const stopId = stop.stop_id;
                    const stimes = (this.gtfsData?.stopTimes || []).filter(st => st.stop_id === stopId);
                    const tripIds = new Set(stimes.map(st => st.trip_id));
                    const tripsById = new Map((this.gtfsData?.trips || []).map(t => [t.trip_id, t]));
                    const routeIds = new Set();
                    for (const tid of tripIds) {
                        const t = tripsById.get(tid);
                        if (t) routeIds.add(t.route_id);
                    }
                    const allRoutesById = new Map((this.gtfsData?.routes || []).map(r => [r.route_id, r]));
                    const servingRoutes = Array.from(routeIds)
                        .map(rid => allRoutesById.get(rid))
                        .filter(Boolean);
                    const servingShorts = servingRoutes
                        .map(r => String(r.route_short_name || r.route_id))
                        .filter(Boolean);
                    if (servingShorts.length < 2) continue; // need at least 2 to make options meaningful

                    const correctTokens = Array.from(new Set(servingShorts)).sort((a,b)=>a.localeCompare(b, 'id', {numeric:true}));
                    const correctAnswer = correctTokens.join(' ');

                    // Build distractors by swapping 1-2 tokens with similar ones (same numeric prefix)
                    const allShorts = Array.from(new Set((this.gtfsData?.routes || []).map(r => String(r.route_short_name || r.route_id))));
                    const byPrefix = new Map();
                    for (const s of allShorts) {
                        const m = s.match(/^(\d+)/);
                        const prefix = m ? m[1] : s[0] || s;
                        if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
                        if (!byPrefix.get(prefix).includes(s)) {
                            byPrefix.get(prefix).push(s);
                        }
                    }

                    const makeVariant = (numChanges, seed = 0) => {
                        const tokens = [...correctTokens];
                        const usedReplacements = new Set();
                        for (let i = 0; i < numChanges; i++) {
                            const idx = (Math.floor(Math.random() * tokens.length) + seed) % tokens.length;
                            const tok = tokens[idx];
                            const m = tok.match(/^(\d+)/);
                            const prefix = m ? m[1] : tok[0] || tok;
                            const pool = (byPrefix.get(prefix) || []).filter(x => 
                                x !== tok && 
                                !tokens.includes(x) && 
                                !usedReplacements.has(x)
                            );
                            if (pool.length) {
                                const repl = pool[Math.floor(Math.random() * pool.length)];
                                tokens[idx] = repl;
                                usedReplacements.add(repl);
                            }
                        }
                        // Ensure at least the base route is present
                        const baseShort = String(baseRoute.route_short_name || baseRoute.route_id);
                        if (!tokens.includes(baseShort)) {
                            tokens[Math.floor(Math.random() * tokens.length)] = baseShort;
                        }
                        // Remove duplicates and sort
                        const unique = Array.from(new Set(tokens)).sort((a,b)=>a.localeCompare(b,'id',{numeric:true}));
                        return unique.join(' ');
                    };

                    const distractors = new Set();
                    let seedCounter = 0;
                    const maxDistractorAttempts = 50;
                    
                    // Generate unique distractors
                    while (distractors.size < 3 && seedCounter < maxDistractorAttempts) {
                        const numChanges = distractors.size === 0 ? 1 : (distractors.size === 1 ? 2 : Math.floor(Math.random() * 2) + 1);
                        const variant = makeVariant(numChanges, seedCounter);
                        
                        // Only add if it's different from correct answer and not already in set
                        if (variant !== correctAnswer && !distractors.has(variant)) {
                            distractors.add(variant);
                        }
                        seedCounter++;
                    }
                    
                    // If we couldn't generate 3 unique distractors, skip this question
                    if (distractors.size < 3) continue;
                    
                    const options = [correctAnswer, ...Array.from(distractors)].sort(() => 0.5 - Math.random());
                    
                    // Final validation: ensure all options are unique
                    const uniqueOptions = Array.from(new Set(options));
                    if (uniqueOptions.length !== 4) {
                        console.warn(`Skipping question for ${stop.stop_name}: duplicate options detected`, options);
                        continue;
                    }
                    
                    question = {
                        question: `Halte "${stop.stop_name}" di ${display.label} melayani apa saja?`,
                        options: uniqueOptions,
                        correct: correctAnswer,
                        category: display.label,
                        routeShortName: display.shortName,
                        routeColor: display.color,
                        routeInfo: `${display.shortName} • ${stop.stop_name}`,
                        format: 'routes-badges'
                    };
                } catch (_) {
                    // ignore
                }
            }
            
            addQuestion(question);
        }

        const ensureMinimumQuestions = () => {
            if (questions.length >= targetCount) return;

            // Fallback 1: positive questions for stops on the route
            for (const { route, stops } of routeArray) {
                const routeName = route.route_short_name || route.route_id;
                const routeInfo = `${routeName} - ${route.route_long_name || ''}`;
                for (const stop of stops) {
                    if (questions.length >= targetCount) return;
                    addQuestion({
                        question: `Apakah rute ${routeName} berhenti di halte "${stop.stop_name}"?`,
                        options: ['Ya', 'Tidak'],
                        correct: 'Ya',
                        category: routeName,
                        routeInfo
                    });
                }
            }

            if (questions.length >= targetCount) return;

            // Fallback 2: negative questions using global stops not on the route
            const allStopsGlobal = this.gtfsData?.stops || [];
            if (!allStopsGlobal.length) return;

            for (const { route, stops } of routeArray) {
                const routeName = route.route_short_name || route.route_id;
                const routeInfo = `${routeName} - ${route.route_long_name || ''}`;
                const stopIds = new Set(stops.map(s => s.stop_id));

                let attempts = 0;
                while (questions.length < targetCount && attempts < 200) {
                    attempts++;
                    const candidate = allStopsGlobal[Math.floor(Math.random() * allStopsGlobal.length)];
                    if (!candidate || stopIds.has(candidate.stop_id)) continue;

                    if (addQuestion({
                        question: `Apakah rute ${routeName} berhenti di halte "${candidate.stop_name}"?`,
                        options: ['Ya', 'Tidak'],
                        correct: 'Tidak',
                        category: routeName,
                        routeInfo
                    }) && questions.length >= targetCount) {
                        break;
                    }
                }
                if (questions.length >= targetCount) return;
            }
        };

        ensureMinimumQuestions();

        // Shuffle and take exactly targetCount
        const shuffled = questions.sort(() => 0.5 - Math.random());
        const finalQuestions = shuffled.slice(0, targetCount);
        
        // Debug log
        console.log(`✅ Generated ${finalQuestions.length}/${targetCount} questions for TransJakarta`);
        if (finalQuestions.length < targetCount) {
            console.warn(`⚠️ Only generated ${finalQuestions.length} out of ${targetCount} requested questions`);
            console.log('Routes selected:', routeArray.length);
            console.log('Transit stops found:', transitStops.length);
            console.log('Total questions generated before filtering:', questions.length);
        }
        
        return finalQuestions;
    }


    generateKRLQuestions() {
        const questions = [];
        
        if (!this.krlData || !this.krlData.stations) {
            console.error('KRL data not loaded');
            return [];
        }

        const targetCount = this.userSelectedQuestionCount || 10;
        const stations = Object.values(this.krlData.stations);
        const shuffled = stations.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, Math.min(targetCount * 2, shuffled.length)); // *2 to have enough for generation

        selected.forEach(station => {
            const questionType = Math.random() > 0.33 ? (Math.random() > 0.5 ? 'station-to-line' : 'line-to-station') : 'is-transit';

            const lineNames = {
                'B': 'Bogor Line (Merah)',
                'C': 'Cikarang Line (Biru)',
                'L': 'Lingkar Line (Ungu)',
                'T': 'Tangerang Line (Coklat)',
                'BJC': 'Bekasi-Jakarta Kota-Cikarang (Orange)',
                'LIN': 'Lintas Line'
            };

            if (questionType === 'station-to-line') {
                // Question: Given station, identify ALL lines (including transit)
                const correctLines = station.lines || [];
                if (correctLines.length === 0) return;

                // If multiple lines, it's a transit station
                if (correctLines.length > 1) {
                    const allLinesList = correctLines.map(l => lineNames[l] || l).join(' & ');
                    const wrongOptions = [];
                    
                    // Generate wrong combinations
                    const allLines = ['B', 'C', 'L', 'T'];
                    for (let i = 0; i < 3; i++) {
                        const randomLines = allLines.sort(() => 0.5 - Math.random()).slice(0, Math.min(2, correctLines.length));
                        const combo = randomLines.map(l => lineNames[l] || l).join(' & ');
                        if (combo !== allLinesList && !wrongOptions.includes(combo)) {
                            wrongOptions.push(combo);
                        }
                    }

                    questions.push({
                        question: `Stasiun "${station.name}" berada di line mana? (Stasiun Transit)`,
                        options: [allLinesList, ...wrongOptions.slice(0, 3)].sort(() => 0.5 - Math.random()),
                        correct: allLinesList,
                        category: 'KRL',
                        routeInfo: `${station.name} - Stasiun Transit`,
                        isTransit: true
                    });
                } else {
                    // Single line station
                    const correctLine = correctLines[0];
                    const allLines = ['B', 'C', 'L', 'T', 'BJC'];
                    const otherLines = allLines
                        .filter(l => !correctLines.includes(l))
                        .sort(() => 0.5 - Math.random())
                        .slice(0, 3);

                    questions.push({
                        question: `Stasiun "${station.name}" berada di line mana?`,
                        options: [correctLine, ...otherLines].sort(() => 0.5 - Math.random()).map(l => lineNames[l] || l),
                        correct: lineNames[correctLine] || correctLine,
                        category: 'KRL',
                        routeInfo: `Stasiun ${station.name}`
                    });
                }
            } else if (questionType === 'line-to-station') {
                // Question: Given line, identify station that IS on this line
                const correctLines = station.lines || [];
                if (correctLines.length === 0) return;
                
                const targetLine = correctLines[0]; // Pick one line from this station
                const lineName = lineNames[targetLine] || targetLine;
                
                // Get all stations on the SAME line
                const allStations = Object.values(this.krlData.stations);
                const stationsOnSameLine = allStations.filter(s => 
                    s.lines && s.lines.includes(targetLine)
                );
                
                // Get stations NOT on this line for wrong answers
                const stationsNotOnLine = allStations.filter(s => 
                    !s.lines || !s.lines.includes(targetLine)
                );

                if (stationsNotOnLine.length < 3) return; // Not enough wrong answers

                const correctStation = station.name;
                const wrongStations = stationsNotOnLine
                    .sort(() => 0.5 - Math.random())
                    .slice(0, 3)
                    .map(s => s.name);

                questions.push({
                    question: `Stasiun mana yang ADA di ${lineName}?`,
                    options: [correctStation, ...wrongStations].sort(() => 0.5 - Math.random()),
                    correct: correctStation,
                    category: 'KRL',
                    routeInfo: `Line ${lineName}`
                });
            } else if (questionType === 'is-transit') {
                // Question: Is this a transit station?
                const isTransit = station.lines && station.lines.length > 1;
                const answer = isTransit ? 'Ya, Stasiun Transit' : 'Tidak, Stasiun Biasa';
                const wrong = isTransit ? 'Tidak, Stasiun Biasa' : 'Ya, Stasiun Transit';
                const otherOptions = ['Stasiun Ujung', 'Depo KRL'];

                questions.push({
                    question: `Apakah "${station.name}" adalah stasiun transit (2+ jalur)?`,
                    options: [answer, wrong, ...otherOptions].sort(() => 0.5 - Math.random()),
                    correct: answer,
                    category: 'KRL',
                    routeInfo: station.lines ? `${station.name} - ${station.lines.length} line(s)` : station.name
                });
            }
        });

        return questions.filter(q => q).slice(0, targetCount);
    }

    getCategoryBadge(mode) {
        const badges = {
            'tj-brt': 'BRT',
            'tj-non-brt': 'Non-BRT',
            'tj-pengumpan': 'Pengumpan',
            'tj-wisata': 'Wisata',
            'tj-jaklingko': 'JakLingko',
            'krl': 'KRL'
        };
        return badges[mode] || 'TransJakarta';
    }

    showQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            this.showResults();
            return;
        }

        const question = this.questions[this.currentQuestionIndex];
        this.answered = false;

        // Update progress
        document.getElementById('totalQuestions').textContent = this.questions.length;
        document.getElementById('scoreValue').textContent = this.score;
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;

        // Update question and category badge with colored route chip if available
        const catEl = document.getElementById('categoryBadge');
        catEl.className = `category-badge badge-${this.currentMode.replace('tj-', '')}`;
        if (question.routeShortName && question.routeColor) {
            catEl.innerHTML = `<span class="route-chip" style="background: ${question.routeColor};">${question.routeShortName}</span>${question.category}`;
        } else {
            catEl.textContent = question.category;
        }
        document.getElementById('questionText').textContent = question.question;

        // Update options
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        
        question.options.forEach(option => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'quiz-option';
            optionDiv.setAttribute('data-value', option);
            if (question.format === 'routes-badges') {
                optionDiv.innerHTML = this.renderRouteOptionBadges(option);
            } else {
                optionDiv.textContent = option;
            }
            optionDiv.addEventListener('click', () => this.selectAnswer(option, question.correct));
            optionsContainer.appendChild(optionDiv);
        });

        // Hide next button
        document.getElementById('nextButton').style.display = 'none';
    }

    normalizeAnswer(answer) {
        // Normalize for comparison: lowercase, split by separators, sort, rejoin
        const normalized = answer.toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
        
        // Check if it contains multiple items (comma, "&", or "dan" separated)
        if (normalized.includes(',') || normalized.includes('&') || normalized.includes(' dan ')) {
            const parts = normalized
                .replace(/ dan /g, ',')
                .replace(/&/g, ',')
                .split(',')
                .map(s => s.trim())
                .filter(s => s)
                .sort();
            return parts.join(',');
        }
        // Also support space-separated multi tokens like "5 5C 7U 4 4D"
        if (normalized.includes(' ')) {
            const tokens = normalized.split(/\s+/).filter(Boolean);
            if (tokens.length >= 2) {
                return tokens.sort().join(',');
            }
        }
        
        return normalized;
    }

    selectAnswer(selected, correct) {
        if (this.answered) return;
        this.answered = true;

        // Normalize both answers for comparison
        const normalizedSelected = this.normalizeAnswer(selected);
        const normalizedCorrect = this.normalizeAnswer(correct);
        const isCorrect = normalizedSelected === normalizedCorrect;

        // Store user answer for review
        const currentQuestion = this.questions[this.currentQuestionIndex];
        this.userAnswers.push({
            question: currentQuestion.question,
            userAnswer: selected,
            correctAnswer: correct,
            isCorrect: isCorrect,
            category: currentQuestion.category,
            routeInfo: currentQuestion.routeInfo
        });

        const options = document.querySelectorAll('.quiz-option');
        options.forEach(option => {
            option.classList.add('disabled');
            
            // Check if this option is the correct answer (normalized comparison)
            const optionRaw = option.getAttribute('data-value') || option.textContent;
            const normalizedOption = this.normalizeAnswer(optionRaw);
            if (normalizedOption === normalizedCorrect) {
                option.classList.add('correct');
            }
            
            // Check if this option was selected and is wrong
            if ((option.getAttribute('data-value') || option.textContent) === selected && !isCorrect) {
                option.classList.add('wrong');
            }
        });

        // Update score
        if (isCorrect) {
            this.score++;
            document.getElementById('scoreValue').textContent = this.score;
        }

        // Show next button
        document.getElementById('nextButton').style.display = 'block';
    }

    nextQuestion() {
        this.currentQuestionIndex++;
        this.showQuestion();
    }

    showResults() {
        clearInterval(this.timerInterval);
        
        const percentage = (this.score / this.questions.length) * 100;
        let message = '';
        
        if (percentage === 100) {
            message = '🏆 Sempurna! Anda master transportasi Jakarta!';
        } else if (percentage >= 80) {
            message = '🌟 Luar biasa! Pengetahuan Anda sangat baik!';
        } else if (percentage >= 60) {
            message = '👍 Bagus! Anda cukup familiar dengan rute ini!';
        } else if (percentage >= 40) {
            message = '📚 Lumayan! Masih perlu belajar lebih banyak!';
        } else {
            message = '💪 Jangan menyerah! Coba lagi dan pelajari rutenya!';
        }

        document.getElementById('finalScore').textContent = `${this.score}/${this.questions.length}`;
        document.getElementById('resultMessage').textContent = message;

        document.getElementById('quizArea').style.display = 'none';
        document.getElementById('resultArea').style.display = 'block';

        // Save to localStorage
        this.saveScore();
    }

    showModeSelection() {
        document.getElementById('quizHeader').style.display = 'block';
        document.getElementById('modeSelection').style.display = 'block';
        document.getElementById('routeSelection').style.display = 'none';
        document.getElementById('quizArea').style.display = 'none';
        document.getElementById('resultArea').style.display = 'none';
        document.getElementById('reviewArea').style.display = 'none';
        clearInterval(this.timerInterval);
    }

    showReview() {
        document.getElementById('resultArea').style.display = 'none';
        document.getElementById('reviewArea').style.display = 'block';
        
        const reviewContent = document.getElementById('reviewContent');
        reviewContent.innerHTML = '';
        
        this.userAnswers.forEach((answer, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${answer.isCorrect ? 'correct' : 'wrong'}`;
            
            reviewItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <span class="badge ${answer.isCorrect ? 'bg-success' : 'bg-danger'}">
                        Soal ${index + 1}
                    </span>
                    <span class="badge bg-secondary">${answer.category}</span>
                </div>
                <div class="review-question">
                    ${answer.question}
                </div>
                <div class="review-answer user-answer ${answer.isCorrect ? '' : 'wrong'}">
                    <i class="fa-solid ${answer.isCorrect ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
                    <div>
                        <strong>Jawaban Anda:</strong> ${answer.userAnswer}
                    </div>
                </div>
                ${!answer.isCorrect ? `
                <div class="review-answer correct-answer">
                    <i class="fa-solid fa-lightbulb"></i>
                    <div>
                        <strong>Jawaban Benar:</strong> ${answer.correctAnswer}
                    </div>
                </div>
                ` : ''}
                ${answer.routeInfo ? `
                <div class="mt-2 text-muted" style="font-size: 0.9rem;">
                    <i class="fa-solid fa-info-circle"></i> ${answer.routeInfo}
                </div>
                ` : ''}
            `;
            
            reviewContent.appendChild(reviewItem);
        });
        
        // Add summary at the bottom
        const summary = document.createElement('div');
        summary.className = 'alert alert-info mt-3';
        const correctCount = this.userAnswers.filter(a => a.isCorrect).length;
        const wrongCount = this.userAnswers.length - correctCount;
        summary.innerHTML = `
            <h5><i class="fa-solid fa-chart-pie"></i> Ringkasan</h5>
            <div class="d-flex gap-4">
                <div><i class="fa-solid fa-check-circle text-success"></i> Benar: <strong>${correctCount}</strong></div>
                <div><i class="fa-solid fa-times-circle text-danger"></i> Salah: <strong>${wrongCount}</strong></div>
                <div><i class="fa-solid fa-percentage"></i> Akurasi: <strong>${((correctCount / this.userAnswers.length) * 100).toFixed(1)}%</strong></div>
            </div>
        `;
        reviewContent.appendChild(summary);
    }

    startTimer() {
        const timerEl = document.getElementById('timerValue');
        const timerDisplay = document.querySelector('.timer-display');
        
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            
            if (this.timeLimit > 0) {
                // Countdown mode
                const remaining = this.timeLimit - elapsed;
                
                if (remaining <= 0) {
                    clearInterval(this.timerInterval);
                    timerEl.textContent = '00:00';
                    timerDisplay.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
                    
                    // Auto submit quiz when time runs out
                    alert('⏰ Waktu habis! Kuis akan diselesaikan otomatis.');
                    this.showResults();
                    return;
                }
                
                const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
                const seconds = (remaining % 60).toString().padStart(2, '0');
                timerEl.textContent = `${minutes}:${seconds}`;
                
                // Warning color when < 30 seconds
                if (remaining <= 30) {
                    timerDisplay.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                } else if (remaining <= 60) {
                    timerDisplay.style.background = 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)';
                }
            } else {
                // Count up mode (no limit)
                const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
                const seconds = (elapsed % 60).toString().padStart(2, '0');
                timerEl.textContent = `${minutes}:${seconds}`;
            }
        }, 1000);
    }

    saveScore() {
        const scores = JSON.parse(localStorage.getItem('quizScores') || '[]');
        const timeElapsed = Math.floor((Date.now() - this.startTime) / 1000);
        
        scores.push({
            mode: this.currentMode,
            score: this.score,
            total: this.questions.length,
            date: new Date().toISOString(),
            time: timeElapsed
        });
        localStorage.setItem('quizScores', JSON.stringify(scores.slice(-20))); // Keep last 20 scores

        // Save detailed history with questions and answers
        this.saveHistory(timeElapsed);
    }

    saveHistory(timeElapsed) {
        const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        
        const modeLabel = this.currentMode === 'krl' ? 'KRL Jabodetabek' : 'TransJakarta';
        const percentage = (this.score / this.questions.length) * 100;
        
        const historyEntry = {
            id: Date.now(),
            mode: this.currentMode,
            modeLabel: modeLabel,
            score: this.score,
            total: this.questions.length,
            percentage: percentage,
            date: new Date().toISOString(),
            timeElapsed: timeElapsed,
            timeLimit: this.timeLimit,
            selectedRoutes: this.selectedRoutes || [],
            userAnswers: this.userAnswers.map(answer => ({
                question: answer.question,
                userAnswer: answer.userAnswer,
                correctAnswer: answer.correctAnswer,
                isCorrect: answer.isCorrect,
                category: answer.category,
                routeInfo: answer.routeInfo,
                format: answer.format
            }))
        };

        history.unshift(historyEntry); // Add to beginning
        localStorage.setItem('quizHistory', JSON.stringify(history.slice(0, 50))); // Keep last 50 entries
    }

    showHistory() {
        document.getElementById('quizHeader').style.display = 'none';
        document.getElementById('modeSelection').style.display = 'none';
        document.getElementById('routeSelection').style.display = 'none';
        document.getElementById('quizArea').style.display = 'none';
        document.getElementById('resultArea').style.display = 'none';
        document.getElementById('reviewArea').style.display = 'none';
        document.getElementById('historyArea').style.display = 'block';
        document.getElementById('historyDetailArea').style.display = 'none';

        const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        const historyList = document.getElementById('historyList');

        if (history.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fa-solid fa-clock-rotate-left"></i>
                    <h4>Belum Ada Riwayat</h4>
                    <p>Mulai kuis untuk melihat riwayat di sini</p>
                </div>
            `;
            return;
        }

        historyList.innerHTML = history.map(entry => {
            const percentage = entry.percentage;
            let gradeClass = 'poor';
            let gradeLabel = 'Perlu Belajar';
            
            if (percentage === 100) {
                gradeClass = 'excellent';
                gradeLabel = 'Sempurna!';
            } else if (percentage >= 80) {
                gradeClass = 'excellent';
                gradeLabel = 'Luar Biasa!';
            } else if (percentage >= 60) {
                gradeClass = 'good';
                gradeLabel = 'Bagus!';
            } else if (percentage >= 40) {
                gradeClass = 'fair';
                gradeLabel = 'Lumayan';
            }

            const date = new Date(entry.date);
            const dateStr = date.toLocaleDateString('id-ID', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            const timeStr = date.toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });

            const minutes = Math.floor(entry.timeElapsed / 60);
            const seconds = entry.timeElapsed % 60;
            const timeElapsedStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const timeLimitStr = entry.timeLimit > 0 
                ? `/ ${Math.floor(entry.timeLimit / 60)}:${(entry.timeLimit % 60).toString().padStart(2, '0')}` 
                : '';

            return `
                <div class="history-item ${gradeClass}" onclick="window.quizManager.showHistoryDetail(${entry.id})">
                    <div class="history-header">
                        <div class="history-mode">
                            <i class="fa-solid fa-${entry.mode === 'krl' ? 'train' : 'bus'}"></i>
                            ${entry.modeLabel}
                        </div>
                        <div class="history-score ${gradeClass}">
                            ${entry.score}/${entry.total}
                        </div>
                    </div>
                    <div class="history-meta">
                        <div class="history-meta-item">
                            <i class="fa-solid fa-calendar"></i>
                            ${dateStr}
                        </div>
                        <div class="history-meta-item">
                            <i class="fa-solid fa-clock"></i>
                            ${timeStr}
                        </div>
                        <div class="history-meta-item">
                            <i class="fa-solid fa-stopwatch"></i>
                            ${timeElapsedStr}${timeLimitStr}
                        </div>
                        <div class="history-meta-item">
                            <i class="fa-solid fa-chart-line"></i>
                            ${percentage.toFixed(0)}% • ${gradeLabel}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showHistoryDetail(historyId) {
        const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
        const entry = history.find(h => h.id === historyId);

        if (!entry) {
            alert('Riwayat tidak ditemukan');
            return;
        }

        document.getElementById('historyArea').style.display = 'none';
        document.getElementById('historyDetailArea').style.display = 'block';

        const percentage = entry.percentage;
        let gradeClass = 'poor';
        let gradeLabel = 'Perlu Belajar';
        
        if (percentage === 100) {
            gradeClass = 'excellent';
            gradeLabel = 'Sempurna!';
        } else if (percentage >= 80) {
            gradeClass = 'excellent';
            gradeLabel = 'Luar Biasa!';
        } else if (percentage >= 60) {
            gradeClass = 'good';
            gradeLabel = 'Bagus!';
        } else if (percentage >= 40) {
            gradeClass = 'fair';
            gradeLabel = 'Lumayan';
        }

        const date = new Date(entry.date);
        const dateStr = date.toLocaleDateString('id-ID', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
        const timeStr = date.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const minutes = Math.floor(entry.timeElapsed / 60);
        const seconds = entry.timeElapsed % 60;
        const timeElapsedStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const timeLimitStr = entry.timeLimit > 0 
            ? `/ ${Math.floor(entry.timeLimit / 60)}:${(entry.timeLimit % 60).toString().padStart(2, '0')}` 
            : '';

        // Header
        document.getElementById('historyDetailHeader').innerHTML = `
            <div class="result-card">
                <h3><i class="fa-solid fa-${entry.mode === 'krl' ? 'train' : 'bus'}"></i> ${entry.modeLabel}</h3>
                <div class="result-score">${entry.score}/${entry.total}</div>
                <div class="result-message">${gradeLabel} - ${percentage.toFixed(0)}%</div>
                <div class="d-flex gap-3 justify-content-center flex-wrap text-white mt-3">
                    <div><i class="fa-solid fa-calendar"></i> ${dateStr} ${timeStr}</div>
                    <div><i class="fa-solid fa-stopwatch"></i> ${timeElapsedStr}${timeLimitStr}</div>
                </div>
            </div>
        `;

        // Review content (reuse review rendering logic)
        const reviewContent = document.getElementById('historyDetailContent');
        reviewContent.innerHTML = '';

        entry.userAnswers.forEach((answer, index) => {
            const reviewItem = document.createElement('div');
            reviewItem.className = `review-item ${answer.isCorrect ? 'correct' : 'wrong'}`;
            
            const categoryBadgeHtml = answer.routeInfo 
                ? `<div class="category-badge badge-brt mb-2">${answer.category}</div>`
                : '';

            const formatAnswer = (ans) => {
                if (answer.format === 'routes-badges') {
                    return this.renderRouteOptionBadges(ans);
                }
                return ans;
            };

            reviewItem.innerHTML = `
                ${categoryBadgeHtml}
                <div class="review-question">
                    <strong>Soal ${index + 1}:</strong> ${answer.question}
                </div>
                <div class="review-answer user-answer ${answer.isCorrect ? '' : 'wrong'}">
                    <i class="fa-solid fa-${answer.isCorrect ? 'check-circle text-success' : 'times-circle text-danger'}"></i>
                    <strong>Jawaban Anda:</strong> 
                    <div class="ms-2">${formatAnswer(answer.userAnswer)}</div>
                </div>
                ${!answer.isCorrect ? `
                <div class="review-answer correct-answer">
                    <i class="fa-solid fa-lightbulb text-warning"></i>
                    <strong>Jawaban Benar:</strong> 
                    <div class="ms-2">${formatAnswer(answer.correctAnswer)}</div>
                </div>
                ` : ''}
                ${answer.routeInfo ? `
                <div class="mt-2 text-muted" style="font-size: 0.9rem;">
                    <i class="fa-solid fa-info-circle"></i> ${answer.routeInfo}
                </div>
                ` : ''}
            `;
            
            reviewContent.appendChild(reviewItem);
        });

        // Add summary
        const summary = document.createElement('div');
        summary.className = 'alert alert-info mt-3';
        const correctCount = entry.userAnswers.filter(a => a.isCorrect).length;
        const wrongCount = entry.userAnswers.length - correctCount;
        summary.innerHTML = `
            <h5><i class="fa-solid fa-chart-pie"></i> Ringkasan</h5>
            <div class="d-flex gap-4">
                <div><i class="fa-solid fa-check-circle text-success"></i> Benar: <strong>${correctCount}</strong></div>
                <div><i class="fa-solid fa-times-circle text-danger"></i> Salah: <strong>${wrongCount}</strong></div>
                <div><i class="fa-solid fa-percentage"></i> Akurasi: <strong>${percentage.toFixed(1)}%</strong></div>
            </div>
        `;
        reviewContent.appendChild(summary);
    }
}

