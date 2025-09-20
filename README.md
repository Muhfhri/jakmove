# JakMove - Smart Transit Experience

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/yourusername/jakmove)
[![License](https://img.shields.io/badge/License-Open%20Source-green)](#)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange)](#)

JakMove adalah aplikasi web interaktif yang menyediakan informasi lengkap tentang sistem transportasi publik Jakarta, khususnya Transjakarta, dengan fitur-fitur canggih dan tampilan modern.

## 🚀 Fitur Utama

### 🗺️ **Peta Interaktif**
- **Peta Real-time**: Menampilkan halte dan rute Transjakarta secara interaktif menggunakan MapLibre GL JS
- **Multiple Map Styles**: Tersedia berbagai gaya peta termasuk satelit (Esri, Google Satellite, Google Hybrid), street maps, dan dark mode
- **3D Navigation**: Mode kamera 3D dengan smooth animation untuk pengalaman navigasi yang immersive
- **Live Location Tracking**: Pelacakan posisi real-time dengan animasi smooth dan debounce

### 🔍 **Sistem Pencarian**
- **Pencarian Halte**: Cari halte berdasarkan nama atau koridor dengan autocomplete
- **Pencarian Rute**: Sistem pencarian rute yang cepat dan akurat
- **Filter Koridor**: Filter berdasarkan koridor tertentu
- **Search Suggestions**: Saran pencarian otomatis saat mengetik

### 🚌 **Informasi Transportasi**
- **Detail Rute**: Informasi lengkap setiap rute termasuk:
  - Jadwal operasional
  - Daftar halte
  - Jarak tempuh
  - Waktu perjalanan estimasi
  - Tarif perjalanan
- **Live Route Info**: Informasi rute real-time saat menggunakan live location
- **Badge Koridor**: Setiap koridor memiliki warna badge yang unik sesuai identitas resmi

### 📍 **Live Location & Navigation**
- **GPS Tracking**: Pelacakan GPS dengan akurasi tinggi
- **Nearest Stop Detection**: Deteksi halte terdekat otomatis
- **Route Simulation**: Simulasi perjalanan dengan kamera 3D yang mengikuti pergerakan
- **Smooth Animations**: Animasi halus untuk marker dan popup user
- **Camera Lock Mode**: Mode kamera terkunci dengan auto-tilt adaptif berdasarkan kecepatan

### 🧭 **Journey Planner**
- **Multi-Transit Routing**: Perencanaan perjalanan dengan multiple transit
- **Step-by-Step Directions**: Panduan langkah demi langkah
- **Alternative Routes**: Pencarian rute alternatif
- **Transfer Points**: Informasi titik transfer antar koridor

### 📝 **Catatan Bus**
- **Bus Number Logger**: Catat nomor bus dan tipe bus
- **Auto Detection**: Deteksi otomatis tipe bus berdasarkan nomor
- **Route Capitalization**: Otomatis mengubah input rute menjadi kapital (contoh: 6v → 6V)
- **Flexible Input**: Mendukung input dengan berbagai format (BMP223, BMP-223, BMP 223)
- **Persistent Storage**: Penyimpanan catatan secara lokal

### 🌙 **Dark Mode**
- **Toggle Dark/Light**: Tema gelap dan terang yang dapat disesuaikan
- **Auto Detection**: Deteksi preferensi sistem otomatis
- **Consistent Design**: Desain konsisten di semua komponen

### 📊 **GTFS Data Viewer**
- **Raw GTFS Data**: Viewer untuk data GTFS mentah
- **Data Explorer**: Eksplorasi data stops, routes, trips, dan stop_times
- **Filter & Search**: Filter dan pencarian dalam dataset GTFS

### 🛠️ **Fitur Teknis**
- **Service Worker**: Caching otomatis untuk performa optimal
- **Progressive Web App**: Dapat diinstall sebagai aplikasi mobile
- **Responsive Design**: Tampilan responsif untuk semua ukuran layar
- **Real-time Clock**: Jam live dengan zona waktu Jakarta
- **Error Handling**: Penanganan error yang robust
- **Accessibility**: Dukungan accessibility untuk screen reader

## 🏗️ Teknologi

### Frontend
- **HTML5** - Struktur markup modern
- **CSS3** - Styling dengan Grid, Flexbox, dan CSS Variables
- **JavaScript ES6+** - Logic aplikasi modern
- **Bootstrap 5** - Framework CSS untuk responsive design

### Maps & Geolocation
- **MapLibre GL JS** - Rendering peta interaktif
- **Geolocation API** - GPS dan location services
- **Multiple Tile Providers** - Esri, Google, OpenStreetMap, dll

### Data & Storage
- **GTFS (General Transit Feed Specification)** - Data transportasi standar
- **LocalStorage** - Penyimpanan lokal browser
- **Service Workers** - Offline caching

### Libraries & Icons
- **Iconify** - Icon system
- **PT Sans** - Typography
- **HTML2Canvas** - Screenshot functionality

## 📱 Halaman Aplikasi

1. **Peta Interaktif** (`index.html`) - Halaman utama dengan peta interaktif
2. **Catatan Bus** (`bus-notes.html`) - Fitur untuk mencatat nomor dan tipe bus
3. **Transportasi Jakarta** (`transportasi-jakarta.html`) - Informasi lengkap transportasi publik Jakarta
4. **Tentang Pembuat** (`tentang-pembuat.html`) - Informasi developer dan tim
5. **GTFS Raw Viewer** (`gtfs-raw-viewer.html`) - Viewer data GTFS mentah
6. **TJ Legacy** (`tj.html`) - Halaman legacy dengan fitur cari rute eksperimental

## 🗂️ Struktur Proyek

```
jakmove/
├── index.html              # Halaman utama peta interaktif
├── bus-notes.html          # Halaman catatan bus
├── transportasi-jakarta.html # Info transportasi Jakarta
├── tentang-pembuat.html    # About page
├── gtfs-raw-viewer.html    # GTFS data viewer
├── tj.html                 # Legacy TJ page
├── css/                    # Stylesheet files
│   ├── style.css          # Main stylesheet
│   ├── dark-mode.css      # Dark mode styles
│   └── bus-notes.css      # Bus notes specific styles
├── js/                     # JavaScript files
│   ├── bus-notes.js       # Bus notes functionality
│   ├── tjNumberSearch.js  # Bus number search logic
│   ├── map-manager.js     # Map management (legacy)
│   └── location-manager.js # Location services (legacy)
├── modules/                # Modern ES6 modules
│   ├── map-manager.js     # Main map management
│   ├── location-manager.js # Location & GPS services
│   ├── route-manager.js   # Route management
│   ├── journey-planner.js # Trip planning
│   ├── ui-manager.js      # UI components
│   ├── search-manager.js  # Search functionality
│   ├── stop-manager.js    # Stop/station management
│   └── gtfs-loader.js     # GTFS data loader
├── gtfs/                   # GTFS data files
│   ├── stops.txt          # Halte/station data
│   ├── routes.txt         # Route information
│   ├── trips.txt          # Trip data
│   └── stop_times.txt     # Schedule data
├── workers/                # Web Workers
│   └── gtfs-worker.js     # GTFS processing worker
└── image/                  # Assets and images
```

## 🚀 Instalasi & Penggunaan

### Akses Online
Aplikasi dapat diakses langsung melalui browser tanpa instalasi:
- **Website Utama**: [JakMove Web App](https://muhfhri.github.io/jakmove)

### Local Development
```bash
# Clone repository
git clone https://github.com/muhfhri/jakmove.git

# Masuk ke direktori
cd jakmove

# Buka dengan local server (contoh: Live Server di VS Code)
# Atau gunakan Python simple server:
python -m http.server 8000

# Akses di browser: http://localhost:8000
```

### Requirements
- Browser modern dengan dukungan ES6+ modules
- Koneksi internet untuk tile maps
- GPS/location services untuk fitur live location

## 📊 Data Source

- **GTFS Data**: Data resmi dari operator transportasi publik Jakarta
- **Map Tiles**: Esri, Google Maps, OpenStreetMap, CartoDB
- **Bus Information**: Database nomor dan tipe bus Transjakarta
- **Route Information**: Data rute resmi dari berbagai operator

## 🤝 Kontribusi

Kontribusi sangat diterima! Silakan:
1. Fork repository ini
2. Buat branch fitur baru (`git checkout -b feature/AmazingFeature`)
3. Commit perubahan (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## 📄 License

Proyek ini bersifat open source untuk tujuan edukasi dan non-komersial.

## ⚠️ Disclaimer

Website ini **TIDAK berafiliasi** dengan:
- PT Transportasi Jakarta (Transjakarta)
- PT MRT Jakarta  
- PT LRT Jakarta
- Pemerintah DKI Jakarta

Dibuat sebagai proyek independen untuk keperluan edukasi dan penggemar transportasi publik. Data yang ditampilkan mungkin tidak selalu real-time atau 100% akurat. Selalu verifikasi informasi dengan sumber resmi.

## 👨‍💻 Developer

Dikembangkan dengan ❤️ untuk komunitas pengguna transportasi publik Jakarta.

---

**JakMove** - Smart Transit Experience untuk Jakarta yang lebih terhubung.
