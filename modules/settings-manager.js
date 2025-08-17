// Settings Manager Module
export class SettingsManager {
	constructor() {
		this.defaults = {
			showIntermodalIcons: true,
			showJaklingkoBadge: true,
			filterAccessStops: true,
			showAccessibilityIcon: true,
			batterySaver: false,
		};
		this.keys = Object.keys(this.defaults);
	}

	init() {
		this.keys.forEach(k => {
			if (localStorage.getItem('setting_' + k) == null) {
				localStorage.setItem('setting_' + k, String(this.defaults[k]));
			}
		});
	}

	get(key) {
		if (!this.keys.includes(key)) return this.defaults[key];
		const raw = localStorage.getItem('setting_' + key);
		if (raw == null) return this.defaults[key];
		if (raw === 'true') return true;
		if (raw === 'false') return false;
		return raw;
	}

	set(key, value) {
		if (!this.keys.includes(key)) return;
		localStorage.setItem('setting_' + key, String(value));
	}

	isEnabled(key) {
		return !!this.get(key);
	}

	reset() {
		this.keys.forEach(k => localStorage.setItem('setting_' + k, String(this.defaults[k])));
	}
} 