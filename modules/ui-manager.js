// UI Manager Module
export class UIManager {
    constructor() {
        this.isInitialized = false;
    }

    // Initialize UI
    init() {
        if (this.isInitialized) return;
        
        this.setupRouteDropdowns();
        this.setupMapControls();
        this.isInitialized = true;
    }

    // Setup route dropdowns
    setupRouteDropdowns() {
        // Main routes dropdown
        this.setupMainRouteDropdown();
        
        // Map route dropdown
        this.setupMapRouteDropdown();
    }

    // Setup main route dropdown
    setupMainRouteDropdown() {
        const select = document.getElementById('routesDropdown');
        if (!select) return;

        select.innerHTML = '';
        
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const sortedRoutes = [...routes].sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        sortedRoutes.forEach(route => {
            const opt = document.createElement('option');
            opt.value = route.route_id;
            opt.textContent = (route.route_short_name ? route.route_short_name : route.route_id) + 
                            (route.route_long_name ? ' - ' + route.route_long_name : '');
            select.appendChild(opt);
        });

        select.onchange = (e) => {
            window.transJakartaApp.modules.routes.selectRoute(e.target.value);
        };
    }

    // Setup map route dropdown
    setupMapRouteDropdown() {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) return;

        // Create container if not exists (tengah atas)
        let container = document.getElementById('mapDropdownContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'mapDropdownContainer';
            container.style.position = 'absolute';
            container.style.left = '50%';
            container.style.top = '10px';
            container.style.transform = 'translateX(-50%)';
            container.style.zIndex = 999;
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
            container.style.gap = '8px';
            mapDiv.appendChild(container);
        }

		// Cleanup any previous basemap gallery in old position
		try { const old = document.getElementById('basemapGallery'); if (old) old.remove(); } catch(e){}

        // Create route dropdown (lebih pendek)
        let routeDropdown = document.getElementById('mapRouteDropdown');
        if (!routeDropdown) {
            routeDropdown = document.createElement('select');
            routeDropdown.id = 'mapRouteDropdown';
            routeDropdown.className = 'form-select form-select-sm plus-jakarta-sans';
            routeDropdown.style.minWidth = '140px';
            routeDropdown.style.maxWidth = '160px';
            routeDropdown.style.fontSize = '0.9em';
            routeDropdown.style.padding = '4px 6px';
            container.appendChild(routeDropdown);
        }

        // Populate dropdown
        this.populateMapRouteDropdown(routeDropdown);

        // Setup change handler
        routeDropdown.onchange = (e) => {
            const routeId = e.target.value;
            window.transJakartaApp.modules.routes.selectRoute(routeId);
            
            // Sync with main dropdown
            const mainDropdown = document.getElementById('routesDropdown');
            if (mainDropdown && mainDropdown.value !== routeId) {
                mainDropdown.value = routeId;
            }

            // Update variant dropdown
            this.updateMapVariantDropdown(routeId);
        };

        // Sync main dropdown -> map dropdown
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) {
            mainDropdown.onchange = (e) => {
                const routeId = e.target.value;
                const currentValue = routeDropdown.value;
                if (currentValue !== routeId) routeDropdown.value = routeId;
                window.transJakartaApp.modules.routes.selectRoute(routeId);
                this.updateMapVariantDropdown(routeId);
            };
        }
    }

    // Populate map route dropdown
    populateMapRouteDropdown(dropdown) {
        dropdown.innerHTML = '';
        
        const routes = window.transJakartaApp.modules.gtfs.getRoutes();
        const sortedRoutes = [...routes].sort((a, b) => 
            window.transJakartaApp.modules.gtfs.naturalSort(a, b)
        );

        sortedRoutes.forEach(route => {
            const opt = document.createElement('option');
            opt.value = route.route_id;
            // Truncate long names to keep dropdown compact
            let displayText = route.route_short_name || route.route_id;
            if (route.route_long_name) {
                const longName = route.route_long_name.length > 25 ? 
                    route.route_long_name.substring(0, 25) + '...' : 
                    route.route_long_name;
                displayText += ' - ' + longName;
            }
            opt.textContent = displayText;
            dropdown.appendChild(opt);
        });

        // Set selected value
        const selectedRouteId = window.transJakartaApp.modules.routes.selectedRouteId;
        if (selectedRouteId) {
            dropdown.value = selectedRouteId;
        } else if (sortedRoutes.length > 0) {
            dropdown.value = sortedRoutes[0].route_id;
        }
    }

    // Update map variant dropdown
    updateMapVariantDropdown(routeId) {
        // Remove old variant dropdown
        let old = document.getElementById('mapRouteVariantDropdown');
        if (old) old.remove();

        if (!routeId) return;

        const trips = window.transJakartaApp.modules.gtfs.getTrips()
            .filter(t => t.route_id === routeId);
        
        // Robust extractor: ambil suffix setelah '-' terakhir
        const extractVariantFromTripId = (tripId) => {
            if (!tripId) return null;
            const idx = tripId.lastIndexOf('-');
            if (idx === -1) return null;
            const suffix = tripId.substring(idx + 1).trim();
            return suffix || null;
        };

        let variantInfo = {};
        trips.forEach(t => {
            const varKey = extractVariantFromTripId(t.trip_id);
            if (varKey && !variantInfo[varKey]) variantInfo[varKey] = t;
        });

        let variants = Object.keys(variantInfo).sort((a, b) => window.transJakartaApp.modules.gtfs.naturalSort(a, b));

        // Only show if more than 1 variant
        if (variants.length > 1) {
            const container = document.getElementById('mapDropdownContainer');
            if (!container) return;

            let variantDropdown = document.createElement('select');
            variantDropdown.id = 'mapRouteVariantDropdown';
            variantDropdown.className = 'form-select form-select-sm plus-jakarta-sans';
            variantDropdown.style.minWidth = '140px';
            variantDropdown.style.maxWidth = '160px';
            variantDropdown.style.fontSize = '0.9em';
            variantDropdown.style.padding = '4px 6px';

            let localVarKey = 'selectedRouteVariant_' + routeId;
            let localVar = localStorage.getItem(localVarKey) || '';

            variantDropdown.innerHTML = `<option value="">Default</option>` +
                variants.map(v => {
                    let trip = variantInfo[v];
                    let jurusan = trip.trip_headsign || trip.trip_long_name || '';
                    if (jurusan.length > 20) jurusan = jurusan.substring(0, 20) + '...';
                    let label = v + (jurusan ? ' - ' + jurusan : '');
                    let selected = localVar === v ? 'selected' : '';
                    return `<option value="${v}" ${selected}>${label}</option>`;
                }).join('');

            variantDropdown.onchange = (e) => {
                const variant = e.target.value || null;
                window.transJakartaApp.modules.routes.selectRouteVariant(variant);
            };

            container.appendChild(variantDropdown);
        }
    }

    // Setup map controls (dipindah ke kanan)
    setupMapControls() {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) return;

		// Geocoding Search (center top, above route dropdown)
		(() => {
			const container = document.getElementById('mapDropdownContainer');
			if (!container) return;
			if (document.getElementById('geoSearchWrap')) return;

			const wrap = document.createElement('div');
			wrap.id = 'geoSearchWrap';
			wrap.style.position = 'relative';
			wrap.style.zIndex = 1000;
			wrap.style.display = 'flex';
			wrap.style.flexDirection = 'column';
			wrap.style.gap = '6px';
			// Insert as first child (above route dropdown)
			container.insertBefore(wrap, container.firstChild);

			const box = document.createElement('div');
			box.style.display = 'flex';
			box.style.alignItems = 'center';
			box.style.gap = '6px';
			box.style.background = 'rgba(255,255,255,0.95)';
			box.style.borderRadius = '999px';
			box.style.padding = '6px 10px';
			box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
			box.style.minWidth = '240px';
			box.style.maxWidth = '56vw';
			box.style.width = '100%';
			wrap.appendChild(box);

			const icon = document.createElement('span');
			icon.innerHTML = '<iconify-icon icon="mdi:magnify" inline></iconify-icon>';
			icon.style.color = '#64748b';
			box.appendChild(icon);

			const input = document.createElement('input');
			input.type = 'search';
			input.id = 'geoSearchInput';
			input.placeholder = 'Cari tempat (mis. GBK, Monas)';
			input.className = 'plus-jakarta-sans';
			input.style.border = 'none';
			input.style.outline = 'none';
			input.style.background = 'transparent';
			input.style.flex = '1';
			input.style.minWidth = '120px';
			box.appendChild(input);

			const clearBtn = document.createElement('button');
			clearBtn.type = 'button';
			clearBtn.id = 'geoSearchClear';
			clearBtn.className = 'btn btn-sm btn-light';
			clearBtn.innerHTML = '<iconify-icon icon="mdi:close" inline></iconify-icon>';
			clearBtn.style.borderRadius = '999px';
			clearBtn.style.padding = '4px 6px';
			clearBtn.title = 'Bersihkan';
			box.appendChild(clearBtn);

			const list = document.createElement('div');
			list.id = 'geoSearchResults';
			list.style.position = 'absolute';
			list.style.left = '0';
			list.style.top = '48px';
			list.style.background = 'rgba(255,255,255,0.98)';
			list.style.borderRadius = '10px';
			list.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
			list.style.padding = '6px';
			list.style.minWidth = '260px';
			list.style.maxWidth = '56vw';
			list.style.maxHeight = '50vh';
			list.style.overflow = 'auto';
			list.style.display = 'none';
			wrap.appendChild(list);

			let debounceTimer = null;
			const renderResults = (results) => {
				list.innerHTML = '';
				if (!results || results.length === 0) {
					list.style.display = 'none';
					return;
				}
				results.forEach((r) => {
					const item = document.createElement('button');
					item.type = 'button';
					item.className = 'btn btn-light btn-sm w-100 text-start';
					item.style.whiteSpace = 'nowrap';
					item.style.overflow = 'hidden';
					item.style.textOverflow = 'ellipsis';
					const title = r.display_name || r.name || r.address?.city || 'Hasil';
					item.textContent = title;
					item.addEventListener('click', () => {
						try {
							const lat = parseFloat(r.lat);
							const lon = parseFloat(r.lon);
							const mm = window.transJakartaApp.modules.map;
							if (mm) {
								try { mm.removeSearchResultMarker(); } catch(_){}
								mm.setView(lat, lon, 17);
								const label = title.length > 60 ? title.slice(0, 60) + '…' : title;
								mm.addSearchResultMarker(lat, lon, label);
							}
						} catch(_){ }
						list.style.display = 'none';
					});
					list.appendChild(item);
				});
				list.style.display = 'block';
			};

			const fetchGeocode = async (q) => {
				if (!q || q.trim().length < 2) { renderResults([]); return; }
				const query = encodeURIComponent(q.trim());
				const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&countrycodes=id&q=${query}`;
				try {
					const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
					const data = await res.json();
					renderResults(Array.isArray(data) ? data : []);
				} catch (_) {
					renderResults([]);
				}
			};

			input.addEventListener('input', () => {
				const val = input.value || '';
				if (debounceTimer) clearTimeout(debounceTimer);
				debounceTimer = setTimeout(() => fetchGeocode(val), 250);
			});
			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					const val = input.value || '';
					fetchGeocode(val);
				} else if (e.key === 'Escape') {
					list.style.display = 'none';
				}
			});
			clearBtn.addEventListener('click', () => {
				input.value = '';
				list.style.display = 'none';
				try { const mm = window.transJakartaApp.modules.map; if (mm) mm.removeSearchResultMarker(); } catch(_){ }
			});
			document.addEventListener('click', (e) => {
				const within = wrap.contains(e.target);
				if (!within) list.style.display = 'none';
			});
		})();

		// Basemap toggle and panel (bottom-left)
		if (!document.getElementById('basemapToggleBtn')) {
			const wrap = document.createElement('div');
			wrap.id = 'basemapControlWrap';
			wrap.style.position = 'absolute';
			wrap.style.left = '12px';
			wrap.style.bottom = '12px';
			wrap.style.zIndex = 1000;
			mapDiv.appendChild(wrap);

			const btn = document.createElement('button');
			btn.id = 'basemapToggleBtn';
			btn.type = 'button';
			btn.className = 'btn btn-primary rounded-5 btn-sm';
			btn.style.display = 'inline-flex';
			btn.style.alignItems = 'center';
			btn.style.gap = '6px';
			btn.innerHTML = '<iconify-icon icon="mdi:layers" inline></iconify-icon> <span class="d-none d-md-inline">Basemap</span>';
			wrap.appendChild(btn);

			const panel = document.createElement('div');
			panel.id = 'basemapPanel';
			panel.style.position = 'absolute';
			panel.style.left = '0';
			panel.style.bottom = '48px';
			panel.style.background = 'rgba(255,255,255,0.95)';
			panel.style.backdropFilter = 'blur(2px)';
			panel.style.borderRadius = '12px';
			panel.style.boxShadow = '0 8px 20px rgba(0,0,0,0.12)';
			panel.style.padding = '10px';
			panel.style.maxWidth = '70vw';
			panel.style.maxHeight = '46vh';
			panel.style.overflow = 'auto';
			panel.style.display = 'none';
			wrap.appendChild(panel);

			const grid = document.createElement('div');
			grid.id = 'basemapGrid';
			grid.style.display = 'grid';
			grid.style.gridTemplateColumns = 'repeat( auto-fill, minmax(64px, 1fr) )';
			grid.style.gap = '10px';
			panel.appendChild(grid);

			// thumbnails
			const lonLatToTile = (lon, lat, z) => {
				const latRad = lat * Math.PI / 180;
				const n = Math.pow(2, z);
				const x = Math.floor((lon + 180) / 360 * n);
				const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * n);
				return { x, y };
			};
			const center = { lon: 106.8, lat: -6.2 };
			const z = 11;
			const { x, y } = lonLatToTile(center.lon, center.lat, z);
			const omtKey = (()=>{ try { return localStorage.getItem('openmaptilesKey') || 'RVJ0OE10B7aw0wl2Tdyl'; } catch(e){ return 'RVJ0OE10B7aw0wl2Tdyl'; } })();
			const thumbs = [
				{ id: 'positron', title: 'Positron', url: `https://basemaps.cartocdn.com/rastertiles/light_all/${z}/${x}/${y}.png` },
				{ id: 'voyager', title: 'Voyager', url: `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png` },
				{ id: 'dark', title: 'Dark', url: `https://basemaps.cartocdn.com/rastertiles/dark_all/${z}/${x}/${y}.png` },
				{ id: 'streets', title: 'Esri Streets', url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}` },
				{ id: 'topo', title: 'Esri Topo', url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}` },
				{ id: 'gray', title: 'Esri Gray', url: `https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${z}/${y}/${x}` },
				{ id: 'opentopo', title: 'OpenTopo', url: `https://a.tile.opentopomap.org/${z}/${x}/${y}.png` },
				{ id: 'satellite', title: 'Satellite', url: `https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}` },
				{ id: 'openmaptiles-streets', title: 'OMT Streets', url: `https://api.maptiler.com/maps/streets/256/${z}/${x}/${y}.png?key=${omtKey}` },
				{ id: 'openmaptiles-bright', title: 'OMT Bright', url: `https://api.maptiler.com/maps/bright/256/${z}/${x}/${y}.png?key=${omtKey}` },
				{ id: 'openmaptiles-dark', title: 'OMT Dark', url: `https://api.maptiler.com/maps/darkmatter/256/${z}/${x}/${y}.png?key=${omtKey}` },
				{ id: 'openmaptiles-positron', title: 'OMT Positron', url: `https://api.maptiler.com/maps/positron/256/${z}/${x}/${y}.png?key=${omtKey}` }
			];

			const saved = (localStorage.getItem('baseMapStyle') || 'positron');
			const selectStyle = (id) => {
				try {
					if (id && id.startsWith('openmaptiles-')) {
						const suppliedKey = 'RVJ0OE10B7aw0wl2Tdyl';
						const stored = localStorage.getItem('openmaptilesKey');
						if (stored !== suppliedKey) localStorage.setItem('openmaptilesKey', suppliedKey);
					}
					localStorage.setItem('baseMapStyle', id);
					window.transJakartaApp.modules.map.setBaseStyle(id);
					// highlight
					grid.querySelectorAll('.bm-thumb').forEach(el => el.classList.remove('active'));
					const el = grid.querySelector(`.bm-thumb[data-style="${CSS.escape(id)}"]`);
					if (el) el.classList.add('active');
					// close after select
					panel.style.display = 'none';
				} catch (e) {}
			};

			thumbs.forEach(({ id, title, url }) => {
				const item = document.createElement('button');
				item.type = 'button';
				item.className = 'bm-thumb';
				item.setAttribute('data-style', id);
				item.title = title;
				item.style.border = '2px solid rgba(0,0,0,0.08)';
				item.style.borderRadius = '10px';
				item.style.padding = '0';
				item.style.overflow = 'hidden';
				item.style.width = '64px';
				item.style.height = '64px';
				item.style.cursor = 'pointer';
				item.style.background = '#fff';
				item.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.4)';
				item.onclick = () => selectStyle(id);
				const img = document.createElement('img');
				img.src = url;
				img.alt = title;
				img.style.width = '100%';
				img.style.height = '100%';
				img.style.objectFit = 'cover';
				item.appendChild(img);
				grid.appendChild(item);
			});

			// Active highlight style
			const styleEl = document.createElement('style');
			styleEl.textContent = `#basemapPanel .bm-thumb.active{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,0.2) inset}`;
			document.head.appendChild(styleEl);
			// Initialize selection
			setTimeout(() => selectStyle(saved), 0);

			// Toggle behavior
			btn.addEventListener('click', (e) => {
				try { e.preventDefault(); e.stopPropagation(); } catch(_){ }
				panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
			});
			// Close on outside click
			document.addEventListener('click', (e) => {
				const within = wrap.contains(e.target);
				if (!within) panel.style.display = 'none';
			});
		}

        // Reset Button (kanan)
        if (!document.getElementById('resetMapBtn')) {
            const btn = document.createElement('button');
            btn.id = 'resetMapBtn';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '70px';
            btn.style.zIndex = 1000;
            btn.innerHTML = '<iconify-icon icon="mdi:refresh" inline></iconify-icon>';
            btn.onclick = () => { window.transJakartaApp.resetApp(); };
            mapDiv.appendChild(btn);
        }

        // Radius Button (kanan)
        if (!document.getElementById('radiusHalteBtnMap')) {
            const btn = document.createElement('button');
            btn.id = 'radiusHalteBtnMap';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '118px';
            btn.style.zIndex = 1000;
            btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Halte Radius</span>';
            btn.onclick = (e) => {
                e.preventDefault();
                if (!window.radiusHalteActive) {
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager && mapManager.map) {
                        const center = mapManager.map.getCenter();
                        mapManager.showHalteRadius(center.lng, center.lat, 300);
                    }
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-warning');
                    btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Sembunyikan</span>';
                    window.radiusHalteActive = true;
                } else {
                    const mapManager = window.transJakartaApp.modules.map;
                    if (mapManager) { mapManager.removeHalteRadiusMarkers(); }
                    btn.classList.remove('btn-warning');
                    btn.classList.add('btn-primary');
                    btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius" inline></iconify-icon> <span class="d-none d-md-inline">Halte Radius</span>';
                    window.radiusHalteActive = false;
                }
            };
            mapDiv.appendChild(btn);
        }

        // Nearest Stops Button (kanan)
        if (!document.getElementById('nearestStopsBtn')) {
            const btn = document.createElement('button');
            btn.id = 'nearestStopsBtn';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '166px';
            btn.style.zIndex = 1000;
            btn.style.cursor = 'pointer';
            btn.innerHTML = '<iconify-icon icon="mdi:map-marker-radius-outline" inline></iconify-icon> <span class="d-none d-md-inline">Halte Terdekat</span>';
            btn.onclick = (e) => {
                console.debug('[nearestStopsBtn] click handler fired');
                if (e) { e.preventDefault(); e.stopPropagation(); }
                const locationManager = window.transJakartaApp.modules.location;
                if (locationManager) {
                    locationManager.requestNearestStops(6);
                } else {
                    console.warn('[nearestStopsBtn] locationManager not available');
                }
                return false;
            };
            // Deduplicate buttons if any exist accidentally
            setTimeout(() => {
                const buttons = document.querySelectorAll('#nearestStopsBtn');
                if (buttons.length > 1) {
                    console.warn('[nearestStopsBtn] Duplicate buttons detected:', buttons.length);
                    for (let i = 1; i < buttons.length; i++) buttons[i].remove();
                }
            }, 100);
            btn.style.display = 'none';
            mapDiv.appendChild(btn);
        } else {
            // Ensure existing button behaves correctly
            const btn = document.getElementById('nearestStopsBtn');
            if (btn && btn.tagName.toLowerCase() === 'button' && btn.type !== 'button') {
                btn.type = 'button';
                console.debug('[nearestStopsBtn] fixed type=button on existing element');
            }
        }

        // Camera Lock Button (kanan)
        if (!document.getElementById('cameraLockBtn')) {
            const btn = document.createElement('button');
            btn.id = 'cameraLockBtn';
            btn.type = 'button';
            btn.className = 'btn btn-primary rounded-5 btn-sm position-absolute';
            btn.style.right = '12px';
            btn.style.top = '214px';
            btn.style.zIndex = 1000;
            btn.style.display = 'none';
            btn.innerHTML = '<iconify-icon icon="mdi:compass" inline></iconify-icon> <span class="d-none d-md-inline">Lock</span>';
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                const mapManager = window.transJakartaApp.modules.map;
                if (!mapManager) return;
                mapManager.toggleCameraLock();
                const locked = mapManager.isCameraLock();
                if (locked) {
                    btn.classList.remove('btn-primary');
                    btn.classList.add('btn-success');
                    btn.innerHTML = '<iconify-icon icon="mdi:compass" inline></iconify-icon> <span class="d-none d-md-inline">Locked</span>';
                } else {
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-primary');
                    btn.innerHTML = '<iconify-icon icon="mdi:compass" inline></iconify-icon> <span class="d-none d-md-inline">Lock</span>';
                }
            };
            mapDiv.appendChild(btn);
        }
    }

    // Update route dropdowns
    updateRouteDropdowns(routeId) {
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown && mainDropdown.value !== routeId) mainDropdown.value = routeId;
        const mapDropdown = document.getElementById('mapRouteDropdown');
        if (mapDropdown && mapDropdown.value !== routeId) mapDropdown.value = routeId;
        this.updateMapVariantDropdown(routeId);
    }

    // Reset function
    reset() {
        // Reset dropdowns
        const mainDropdown = document.getElementById('routesDropdown');
        if (mainDropdown) mainDropdown.value = '';
        const mapDropdown = document.getElementById('mapRouteDropdown');
        if (mapDropdown) mapDropdown.value = '';
        this.removeVariantDropdowns();

        // Bersihkan daftar halte pada card
        const ul = document.getElementById('stopsByRoute');
        const directionTabs = document.getElementById('directionTabs');
        const title = document.getElementById('stopsTitle');
        if (ul) ul.innerHTML = '';
        if (directionTabs) directionTabs.innerHTML = '';
        if (title) title.textContent = 'Informasi layanan akan tampil di sini setelah anda memilihnya.';

        // Reset buttons
        this.resetButtons();
    }

    removeVariantDropdowns() {
        let old = document.getElementById('mapRouteVariantDropdown');
        if (old) old.remove();
        let oldStops = document.getElementById('stopsVariantDropdown');
        if (oldStops) oldStops.closest('.variant-selector-stops')?.remove();
    }

    resetButtons() {
        const liveLocationBtn = document.getElementById('liveLocationBtn');
        if (liveLocationBtn) {
            liveLocationBtn.classList.remove('btn-primary');
            liveLocationBtn.classList.add('btn-outline-primary');
            liveLocationBtn.setAttribute('data-active', 'off');
            liveLocationBtn.innerHTML = '<span id="liveLocationIcon" class="bi bi-geo-alt"></span> Live Location: OFF';
        }
        const nearestBtn = document.getElementById('nearestStopsBtn');
        if (nearestBtn) nearestBtn.style.display = 'none';
    }
} 
 