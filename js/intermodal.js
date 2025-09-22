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
				'LRT': 'Dukuh Atas'
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
				'LRT': 'Galunggung'
			},
			'Senen TOYOTA Rangga': {
				'KRL': 'Pasar Senen'
			},
			'Jaga Jakarta': {
				'KRL': 'Pasar Senen'
			},
			'Kota': {
				'KRL': 'Jakarta Kota'
			},
			'Simpang Buaran': {
				'KRL': 'Buaran'
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
				'KRL': 'Klender Baru'
			},
			'Stasiun Jatinegara': {
				'KRL': 'Jatinegara'
			},
			'Juanda': {
				'KRL': 'Juanda'
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
			'Kuningan': {
				'LRT': 'Kuningan'
			},
			'Rasuna Said': {
				'LRT': 'Rasuna Said'
			}
		};
		try {
			window.transJakartaApp.modules.routes.setIntermodalMapping(mapping);
			console.log('[intermodal] mapping applied');
		} catch (e) {
			console.warn('[intermodal] failed to apply mapping:', e);
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