// Simple intermodal mapping bootstrapper
// Customize this file as needed. It safely waits for the app to initialize.
(function () {
	function applyMapping() {
		if (!window.transJakartaApp || !window.transJakartaApp.modules || !window.transJakartaApp.modules.routes) {
			return false;
		}
		// Enhanced mapping with station names
		const mapping = {
			// Format: 'Halte TransJakarta': { 'MODE': 'Nama Stasiun Asli' }
			'Dukuh Atas': {
				'MRT': 'Dukuh Atas BNI',
				'KRL': 'Sudirman', 
				'LRT': 'Dukuh Atas BNI'
			},
			'Pemuda Rawamangun': {
				'LRTJ': 'Velodrome'
			},
			'Boulevard Utara': {
				'LRTJ': 'Boulevard Utara'
			},
			'Boulevard Selatan': {
				'LRTJ': 'Boulevard Selatan'
			},
			'St. LRT Pegangsaan Dua': {
				'LRTJ': 'Pegangsaan Dua'
			},
			'Equestrian': {
				'LRTJ': 'Equestrian'
			},
			'Kelapa Gading': {
				'LRTJ': 'Kelapa Gading'
			},
			'Bundaran HI Astra': {
				'MRT': 'Bundaran HI Bank Jakarta'
			},
			'Asean': {
				'MRT': 'ASEAN'
			},
			'Blok M': {
				'MRT': 'Blok M BCA'
			},
			'Polda Metro Jaya': {
				'MRT': 'Istora Mandiri'
			},
			'Bundaran Senayan': {
				'MRT': 'Senayan Mastercard'
			},
			'Galunggung': {
				'MRT': 'Dukuh Atas BNI',
				'KRL': 'Sudirman', 
				'LRT': 'Dukuh Atas BNI'
			},
			'Senen TOYOTA Rangga': {
				'KRL': 'Pasar Senen'
			},
			'Jaga Jakarta': {
				'KRL': 'Pasar Senen'
			},
			'Term. Senen': {
				'KRL': 'Pasar Senen'
			},
			'Kota': {
				'KRL': 'Jakarta Kota'
			},
			'Transjakarta Tanah Abang': {
				'KRL': 'Tanah Abang'
			},
			'Simpang Buaran': {
				'KRL': 'Buaran'
			},
			'St. Klender Baru': {
				'KRL': 'Klender Baru'
			},
			'St. Karet': {
				'KRL': 'Karet'
			},
			'St. Palmerah': {
				'KRL': 'Palmerah'
			},
			'Ps. Palmerah': {
				'KRL': 'Palmerah'
			},
			'Kebayoran': {
				'KRL': 'Kebayoran'
			},
			'Taman Kota': {
				'KRL': 'Taman Kota'
			},
			'Stasiun Cakung 1': {
				'KRL': 'Cakung'
			},
			'St. Klender Baru 1': {
				'KRL': 'Klender Baru'
			},
			'St. Cikini Barat': {
				'KRL': 'Cikini'
			},
			'St. Cikini Selatan': {
				'KRL': 'Cikini'
			},
			'St. Cikini Timur': {
				'KRL': 'Cikini'
			},
			'Stasiun Klender': {
				'KRL': 'Klender'
			},
			'St. Gg. Sentiong': {
				'KRL': 'Gang Sentiong'
			},
			'St. Pondok Jati': {
				'KRL': 'Pondok Jati'
			},
			'St. Ancol': {
				'KRL': 'Ancol'
			},
			'Tanjung Priok': {
				'KRL': 'Tanjung Priuk'
			},
			'Stasiun Jatinegara': {
				'KRL': 'Jatinegara'
			},
			'Juanda': {
				'KRL': 'Juanda'
			},
			'Manggarai': {
				'KRL': 'Manggarai'
			},
			'Timur St. Manggarai': {
				'KRL': 'Manggarai'
			},
			'Lebak Bulus': {
				'MRT' : 'Lebak Bulus'
			},
			'Matraman Baru': {
				'KRL': 'Matraman'
			},
			'Cikoko Arah Timur': {
				'LRT': 'Cikoko',
				'KRL': 'Cawang'
			},
			'Cikoko Arah Barat': {
				'LRT': 'Cikoko', 
				'KRL': 'Cawang'
			},
			'Ciliwung Arah Barat': {
				'LRT': 'Ciliwung', 
			},
			'Pancoran Arah Barat': {
				'LRT': 'Pancoran Bank BJB', 
			},
			'Cawang': {
				'LRT': 'Cawang', 
			},
			'St. Duren Kalibata': { 
				'KRL': 'Duren Kalibata'
			},
			'St. Tebet': { 
				'KRL': 'Tebet'
			},
			'Kuningan': {
				'LRT': 'Kuningan'
			},
			'Rasuna Said': {
				'LRT': 'Rasuna Said'
			},
			'Setiabudi': {
				'LRT': 'Setiabudi'
			}
		};
		try {
			window.transJakartaApp.modules.routes.setIntermodalMapping(mapping);
			console.log('[intermodal] ✅ Mapping applied successfully:', Object.keys(mapping).length, 'entries');
			console.log('[intermodal] 📋 Available connections:', Object.keys(mapping));
		} catch (e) {
			console.warn('[intermodal] ❌ Failed to apply mapping:', e);
		}
		return true;
	}

	function onReady() {
		if (!applyMapping()) {
			setTimeout(onReady, 300);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', onReady);
	} else {
		onReady();
	}
})(); 