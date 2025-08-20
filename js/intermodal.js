// Simple intermodal mapping bootstrapper
// Customize this file as needed. It safely waits for the app to initialize.
(function () {
	function applyMapping() {
		if (!window.transJakartaApp || !window.transJakartaApp.modules || !window.transJakartaApp.modules.routes) {
			return false;
		}
		// Example mapping; replace with your own
		const mapping = {
			// By stop_id
			'G123': ['MRT'],
			'G456': ['KRL', 'LRT'],
			// By exact stop_name
			'Dukuh Atas': ['MRT', 'KRL', 'LRT'],
			'Bundaran HI Astra': ['MRT'],
			'Asean': ['MRT'],
			'Blok M': ['MRT'],
			'Polda Metro Jaya': ['MRT'],
			'Bundaran Senayan': ['MRT'],
			'Tosari': ['MRT'],
			'Galunggung': ['LRT'],
			'Senen TOYOTA Rangga': ['KRL'],
			'Kota': ['KRL'],
			'Simpang Buaran': ['KRL'],
			'St. Cikini Barat': ['KRL'],
			'St. Cikini Selatan': ['KRL'],
			'St. Cikini Timur': ['KRL'],
			'Stasiun Klender': ['KRL'],
			'Stasiun Jatinegara': ['KRL'],
			'Juanda': ['KRL'],
			'Matraman Baru': ['KRL'],
			'Cikoko': ['LRT'],
			'Kuningan': ['LRT'],
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