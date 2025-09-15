# 📱 JakMove PWA Setup Guide

JakMove telah diupgrade menjadi Progressive Web App (PWA) yang dapat berjalan offline di Android dan perangkat mobile lainnya.

## ✨ Fitur PWA yang Ditambahkan

### 🔧 Core PWA Components
- ✅ **Web App Manifest** (`manifest.json`) - Konfigurasi instalasi dan metadata app
- ✅ **Enhanced Service Worker** (`sw.js`) - Cache management untuk penggunaan offline
- ✅ **PWA Meta Tags** - Optimisasi untuk berbagai platform mobile
- ✅ **Install Prompt** - Panduan instalasi untuk pengguna
- ✅ **Network Status Monitoring** - Indikator status online/offline
- ✅ **Auto-update Handling** - Notifikasi update otomatis

### 📱 Pengalaman Mobile yang Ditingkatkan
- **Standalone Mode** - Berjalan seperti aplikasi native tanpa browser UI
- **Offline Support** - Akses penuh ke fitur utama meski tanpa internet
- **App Shortcuts** - Quick access ke fitur favorit dari home screen
- **Touch Optimized** - UI yang dioptimalkan untuk sentuhan
- **Safe Area Support** - Kompatibilitas dengan notch dan edge displays

## 🚀 Cara Menginstall di Android

### Metode 1: Chrome Browser
1. Buka website JakMove di Chrome
2. Tunggu notifikasi "Install JakMove" muncul (sekitar 3 detik)
3. Tap "Install" pada banner yang muncul
4. Atau, tap menu ⋮ → "Add to Home screen" atau "Install app"

### Metode 2: Manual Add to Home Screen
1. Buka website di browser mobile
2. Tap menu browser → "Add to Home screen"
3. Edit nama jika perlu → Tap "Add"

### Metode 3: Samsung Internet & Browser Lain
1. Buka website JakMove
2. Tap menu → "Add page to" → "Home screen"

## 🔧 Fitur Offline

### Yang Bisa Diakses Offline:
- ✅ Semua halaman utama (Peta, Catatan Bus, dll)
- ✅ Data GTFS lengkap (halte, rute, jadwal)
- ✅ JavaScript modules dan CSS
- ✅ Logo dan aset gambar
- ✅ Pencarian halte dan rute
- ✅ Informasi koridor TransJakarta

### Yang Memerlukan Internet:
- 🌐 Peta tiles (akan menggunakan cache jika tersedia)
- 🌐 Live location dan GPS
- 🌐 Info cuaca
- 🌐 External resources (font icons, maps API)

## 📂 File PWA yang Ditambahkan

```
/
├── manifest.json              # PWA manifest
├── browserconfig.xml          # Windows tile config
├── sw.js                     # Enhanced service worker
├── css/pwa.css               # PWA-specific styles
└── PWA-SETUP.md              # Documentation ini
```

## 🛠 Technical Implementation

### Service Worker Cache Strategy
```javascript
// Core app files: Cache First
- HTML pages, CSS, JS modules
- GTFS data files
- Local images and assets

// External resources: Stale While Revalidate
- Map tiles, CDN resources
- External APIs and fonts

// Network requests: Network First with Cache Fallback
- API calls and dynamic content
```

### Cache Management
- **Primary Cache**: `jakmove-pwa-v2` (core app files)
- **External Cache**: `jakmove-external-v2` (external resources)
- **Auto-cleanup**: Old cache versions dihapus otomatis

## 🔄 Update Mechanism

1. **Automatic Check**: Service worker cek update otomatis
2. **Update Notification**: Banner notifikasi muncul jika ada update
3. **One-Click Update**: User tap "Update" untuk apply changes
4. **Seamless Experience**: Update berjalan di background

## 🎨 Visual Indicators

### Install Status
- **PWA Mode Badge**: Muncul saat app berjalan dalam mode standalone
- **Install Banner**: Prompt instalasi dengan design yang menarik

### Network Status
- **Offline Indicator**: "Mode offline - Data tersimpan lokal"
- **Online Indicator**: "Kembali online" (hilang otomatis)

### Update Status
- **Update Available**: Banner kuning dengan tombol update
- **Installing**: Progress indicator saat menginstall update

## 📋 Manifest Configuration

```json
{
  "name": "JakMove - Smart Transit Experience",
  "short_name": "JakMove",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#007bff",
  "background_color": "#ffffff",
  "categories": ["travel", "transportation", "maps"]
}
```

## 🧪 Testing PWA

### Development
1. Buka Chrome DevTools → Application → Service Workers
2. Check "Offline" untuk test offline functionality
3. Application → Manifest untuk validasi manifest.json

### Production
1. Deploy ke GitHub Pages / hosting
2. Test instalasi di berbagai browser mobile
3. Verify offline functionality
4. Test update mechanism

## 📊 Performance Benefits

### Before PWA:
- Reload penuh setiap kali buka website
- Tidak bisa akses offline
- Bergantung pada koneksi internet

### After PWA:
- ⚡ **Instant Load**: Core files di-cache locally
- 📱 **Native Feel**: Berjalan seperti app native
- 🔌 **Offline First**: Tetap berfungsi tanpa internet
- 🔄 **Background Updates**: Update otomatis tanpa ganggu UX

## 🛡 Browser Support

| Browser | Install Support | Service Worker | Offline |
|---------|----------------|----------------|---------|
| Chrome Android | ✅ | ✅ | ✅ |
| Samsung Internet | ✅ | ✅ | ✅ |
| Firefox Mobile | ⚠️ | ✅ | ✅ |
| Safari iOS | ⚠️ | ✅ | ✅ |
| Edge Mobile | ✅ | ✅ | ✅ |

*⚠️ = Add to Home Screen only (tidak ada install prompt)*

## 🔍 Troubleshooting

### App Tidak Muncul Install Prompt
1. Clear browser cache dan cookies
2. Pastikan akses via HTTPS
3. Check apakah sudah pernah dismiss prompt sebelumnya

### Offline Mode Tidak Berfungsi
1. Check Service Worker di DevTools → Application
2. Pastikan cache sudah terisi (tunggu beberapa menit setelah first load)
3. Hard refresh (Ctrl+Shift+R) untuk force update

### Update Tidak Muncul
1. Force refresh beberapa kali
2. Check Console untuk error Service Worker
3. Clear Application Storage di DevTools

## 📝 Notes for Developers

- Service Worker menggunakan versioning (`jakmove-pwa-v2`)
- Semua core assets harus di-cache untuk offline functionality
- External resources menggunakan stale-while-revalidate strategy
- Update cache version di `sw.js` untuk force refresh
- Test di real mobile device untuk best experience

## 🎯 Future Enhancements

- [ ] Push notifications untuk update rute
- [ ] Background sync untuk data GTFS
- [ ] Advanced caching dengan IndexedDB
- [ ] Share API integration
- [ ] Better iOS PWA support
- [ ] Dark mode splash screen

---

**🚀 JakMove PWA - Smart Transit Experience, Anywhere, Anytime!**

