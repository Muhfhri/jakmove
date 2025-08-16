import { koridorData, integrasiBadge, halteIntegrasi, integrasiTransportasi } from './dataKoridor.js';
const halteSponsorLogo = {
    'Blok M': {
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Blok_M_Hub_logo.png/1200px-Blok_M_Hub_logo.png',
      alt: 'ASEAN',
    },
    'ASEAN': {
      img: 'https://upload.wikimedia.org/wikipedia/id/thumb/4/49/Seal_of_ASEAN.svg/1200px-Seal_of_ASEAN.svg.png',
      alt: 'ASEAN',
    },
    'Bundaran HI ASTRA': {
      img: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/Logo_of_PT_Astra_International_Tbk_terbaru_2025.png',
      alt: 'Astra',
    },
    'Senayan BANK DKI': {
      img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Bank_DKI.svg/2560px-Bank_DKI.svg.png',
      alt: 'Bank DKI',
    },
    'Polda Metro Jaya': {
      img: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Lambang_Polda_Metro_Jaya.png',
      alt: 'Polda',
    },
    'Monumen Nasional': {
      img: 'https://png.pngtree.com/png-vector/20220719/ourmid/pngtree-monas-jakarta-icon-illustation-png-image_6007527.png',
      alt: 'Monas',
    },
    'Widya Chandra Telkomsel': {
      img: 'https://maxsi.id/images/logo/telkomsel-baru-2021.png',
      alt: 'Telkomsel',
    },
    "Petukangan D'MASIV": {
      img: 'https://dmasivband.com/assets/images/logo-dmasiv.png',
      alt: 'D\'Masiv',
    },
    'Swadarma ParagonCorp': {
      img: 'https://www.paragon-innovation.com/static/media/paragon-corp.98d5977b.png',
      alt: 'Paragon Corp',
    },
    'Senen TOYOTA Rangga': {
      img: 'https://images.seeklogo.com/logo-png/14/2/toyota-logo-png_seeklogo-141406.png',
      alt: 'Paragon Corp',
    },
    'Simpang Ragunan Ar-Raudhah': {
      img: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTiEP_PKi9SXH44Hl5G39PCg40vGsqqAWjNTw&s',
      alt: 'Paragon Corp',
    },
  };
  
// === Tambahkan di sini, sebelum fungsi apapun ===
const busTypeToImage = {
    "Volvo B11R": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Transjakarta%2C_Volvo_B11R_%28SAF-025%29.jpg/1280px-Transjakarta%2C_Volvo_B11R_%28SAF-025%29.jpg",
    "Mercedes-Benz OH 1626": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg/1280px-Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg",
    "Mercedes-Benz OH 1526": "https://pbs.twimg.com/media/EhuPuokU4AAniIJ.jpg",
    "Mercedes-Benz O500U": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/TJ_0791_at_Senayan.jpg/1280px-TJ_0791_at_Senayan.jpg",
    "Mercedes-Benz OC 500 RF 2542": "https://live.staticflickr.com/1825/42375369745_d59b0db737_b.jpg",
    "Scania K320IA": "https://mobilkomersial.com/wp-content/uploads/2023/04/Bus-TJ-Gandeng.jpg",
    "Scania K310IB": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Transjakarta_MYS_18116_at_Gambir.jpg/1100px-Transjakarta_MYS_18116_at_Gambir.jpg",
    "Scania K250UB": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Transjakarta_-_TJ632_Scania_K250UB.jpg/1280px-Transjakarta_-_TJ632_Scania_K250UB.jpg",
    "Hino RK1 JSNL": "https://live.staticflickr.com/4624/39561244554_fc5cf21761_b.jpg",
    "Hino RK8 R260": "https://live.staticflickr.com/1937/45752656441_bf9489a0bb_b.jpg",
    "Zhongtong Bus LCK6180GC": "https://redigest.web.id/wp-content/uploads/2019/10/IMG_20191011_104316_HDR.jpg",
    "Zhongtong Bus LCK6126EVGRA1": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Transjakarta_-_DMR-240127_01.jpg/1280px-Transjakarta_-_DMR-240127_01.jpg",
    "Zhongtong Bus LCK6126EVGRA2": "https://img.okezone.com/content/2025/06/20/1/3148864/bus_listrik_damri-peyD_large.jpg",
    "SAG Golden Dragon XML6125JEVJ0C3": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Transjakarta_-_BMP-240327.jpg/1100px-Transjakarta_-_BMP-240327.jpg",
    "Skywell NJL6126BEV": "https://www.transgo.co.id/wp-content/uploads/2024/11/002.png",
    "Skywell NJL6129BEV": "https://mobilkomersial.com/wp-content/uploads/2024/11/Snapinsta.app_466929837_870028668268355_8248708680309915930_n_1080.jpg",
    "VKTR BYD D9 (EV)": "https://asset.kompas.com/crops/G33-Spk3Y_p-AZPaLFIgdLT1bd0=/13x164:1080x875/1200x800/data/photo/2024/12/03/674e9cfae21a3.jpg",
    "Hino GB 150": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg/1280px-Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg",
    "VKTR BYD B12 (EV)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Transjakarta_SJM-240012.jpg/1280px-Transjakarta_SJM-240012.jpg",
    "Mitsubishi Colt FE 84G": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/MiniTrans.jpg/1100px-MiniTrans.jpg",
    "Hino RN8 285" : "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg/1100px-BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg"
};

const busTypeToOperators = {
    "Volvo B11R": {
        operators: ["Steady Safe (SAF)"],
        type: "BRT Maxi"
    },
    "Mercedes-Benz OH 1626": {
        operators: ["PT Transportasi Jakarta", "Mayasari Bakti", "Bianglala Metropolitan", "Pahala Kencana Transportation"],
        type: "BRT Biasa"
    },
    "Mercedes-Benz OH 1626 amari": {
        operators: ["Bianglala Metropolitan"],
        type: "Layanan AMARI Transjakarta"
    },
    "Mercedes-Benz OH 1526": {
        operators: ["PT Transportasi Jakarta"],
        type: "BRT Biasa"
    },
    "Mercedes-Benz O500U": {
        operators: ["PT Transportasi Jakarta"],
        type: "Low Deck Non-BRT Swakelola"
    },
    "Mercedes-Benz OC 500 RF 2542": {
        operators: ["PT Transportasi Jakarta"],
        type: "BRT Maxi"
    },
    "Scania K320IA": {
        operators: ["Mayasari Bakti"],
        type: "Bus Gandeng"
    },
    "Scania K310IB": {
        operators: ["Mayasari Bakti"],
        type: "BRT Maxi"
    },
    "Scania K250UB": {
        operators: ["PT Transportasi Jakarta"],
        type: "Low Deck Non-BRT Swakelola"
    },
    "Hino RK1 JSNL": {
        operators: ["PT Transportasi Jakarta"],
        type: "BRT Biasa"
    },
    "Hino RK8 R260": {
        operators: ["Perum DAMRI", "Bianglala Metropolitan"],
        type: "BRT Biasa"
    },
    "Hino RK1 JSNL amari": {
        operators: ["Bianglala Metropolitan"],
        type: "Layanan AMARI  Transjakarta"
    },
    "Hino RK8 R260 amari": {
        operators: ["Bianglala Metropolitan"],
        type: "Layanan AMARI Transjakarta"
    },
    "Hino GB 150": {
        operators: ["Jewa Dian Mitra"],
        type: "Bus Medium Non BRT"
    },
    "Hino RN8 285": {
        operators: ["Bayu Holong Persada"],
        type: "BRT Biasa"
    },
    "Mitsubishi Colt FE 84G": {
        operators: ["Trans Swadaya (Unit Bisnis Transjakarta)"],
        type: "Bus Medium Non BRT"
    },
    "Zhongtong Bus LCK6180GC": {
        operators: ["Perum DAMRI"],
        type: "Bus Gandeng"
    },
    "Zhongtong Bus LCK6126EVGRA1": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik BRT"
    },
    "Zhongtong Bus LCK6126EVGRA1 amari": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik BRT - Layanan AMARI"
    },
    "Zhongtong Bus LCK6126EVGRA2": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik BRT Zhongtong Batch 2"
    },
    "SAG Golden Dragon XML6125JEVJ0C3": {
        operators: ["Bianglala Metropolitan"],
        type: "Bus Listrik BRT"
    },
    "Skywell NJL6126BEV": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik BRT"
    },
    "Skywell NJL6126BEV amari": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik BRT - Layanan AMARI"
    },
    "Skywell NJL6129BEV": {
        operators: ["Perum DAMRI"],
        type: "Bus Listrik Low Deck"
    },
    "VKTR BYD D9 (EV)": {
        operators: ["Sinar Jaya Megah Langgeng"],
        type: "Bus Listrik BRT E-Cityline 3 Laksana"
    },
    "VKTR BYD B12 (EV)":{
        operators: ["Mayasari Bakti"],
        type: "Bus Listrik Low Deck"
    }
};

// Tambahkan di awal file (atau sebelum fungsi getJurusan)
(function() {
    const style = document.createElement('style');
    style.innerHTML = `.popover { max-width:220px !important; word-break:break-word; overflow-wrap:break-word; } .popover .bus-popover-img { max-width:100%; max-height:120px; object-fit:contain; background:#f8f9fa; border-radius:8px; padding:2px; display:block; margin:auto; }`;
    document.head.appendChild(style);
})();

// Tambahkan style global untuk efek hover/klik badge koridor interaktif
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
    .badge-koridor-interaktif {
        transition: box-shadow 0.18s, transform 0.18s, filter 0.18s;
    }
    .badge-koridor-interaktif:hover {
        box-shadow: 0 0 0 2px #26469744;
        transform: scale(1.12);
        filter: brightness(1.13);
        cursor: pointer;
        z-index: 2;
    }
    .badge-koridor-interaktif:active {
        transform: scale(0.96);
        filter: brightness(0.95);
    }
    `;
    document.head.appendChild(style);
})();

// Tambahkan di awal file (setelah import dan IIFE style)
const mapImageCache = {};

function getKoridorBadgeColor(koridor) {
    const colorMap = {
        "1": "#D02027",    
        "1A": "#93C3A4",    
        "1F": "#ff7465",    
        "1P": "#FF0040",    
        "1R": "#FC8DA9",    
        "2": "#264697",   
        "2A": "#4FA8DE",   
        "3": "#FCC81B",    
        "3H": "#98692C",    
        "3F": "#b39233",    
        "4": "#562A62",    
        "4C": "#E7A7CA",    
        "4D": "#E58BBA",    
        "4K": "#9626b5",    
        "5": "#BC5827",   
        "5B": "#905B3A",   
        "5C": "#9CD2C6",    
        "5M": "#ff5400",    
        "5N": "#ff4000",
        "6": "#2FA449",   
        "6A": "#76C18A",
        "6B": "#99C175",
        "6V": "#3C9F68",
        "7": "#E2275B",   
        "L7": "#E2275B",   
        "7D": "#53bbb9",   
        "7F": "#ff326b", 
        "8": "#CC2990", 
        "9": "#3F9593",    
        "9A": "#8D9F3D",    
        "9C": "#3C9F68",    
        "9D": "#4DB748",    
        "9N": "#783D3F",    
        "10": "#8F1A1E",   
        "10D": "#9b3337",   
        "10H": "#9c050a",   
        "11": "#2F4FA2",   
        "11D": "#A7BAE0",
        "11Q": "#10C0FF",
        "12": "#62BD73",   
        "13": "#5C359D",   
        "13B": "#972489",   
        "13E": "#761C86",   
        "L13E": "#761C86",   
        "14": "#FF7F00",
        "B11": "#D07C28",
        "B21": "#3BB59C",
        "B25": "#A9C498",
        "B41": "#A9C498",
        "P11": "#A9C498",
        "T31": "#A9C498",
        "PRJ1": "#00a54f",
        "PRJ2": "#00c65c",
        "2C": "#DB5E27",
        // Tambah Warna TJ Koridor lain
    };
    return colorMap[koridor] || "#adb5bd"; // Default abu-abu jika tidak ada warna
}

// Update daftar koridor berdasarkan layanan
function updateKoridorOptions() {
    const koridorSelect = document.getElementById('koridorSelect');
    const serviceSelect = document.getElementById('serviceSelect');
    const selectedService = serviceSelect.value;
    
    koridorSelect.innerHTML = '<option value="" selected>Pilih Koridor...</option>';
    koridorSelect.disabled = false;

    // Add routes for selected service only, format: '1 BLOK M - KOTA'
    for (const koridor in koridorData[selectedService]) {
        const koridorEntry = koridorData[selectedService][koridor];
        const label = `${koridor} ${koridorEntry.start.toUpperCase()} - ${koridorEntry.end.toUpperCase()}`;
        const option = document.createElement('option');
        option.value = koridor;
        option.textContent = label;
        koridorSelect.appendChild(option);
    }

    // Info start/end halte di bawah dropdown (optional, bisa dihapus jika tidak perlu)
    let infoDiv = document.getElementById('koridorStartEndInfo');
    if (!infoDiv) {
        infoDiv = document.createElement('div');
        infoDiv.id = 'koridorStartEndInfo';
        infoDiv.className = 'alert alert-info mt-2 d-none';
        koridorSelect.parentNode.appendChild(infoDiv);
    } else {
        infoDiv.classList.add('d-none');
        infoDiv.innerHTML = '';
    }

    koridorSelect.addEventListener('change', function() {
        const koridor = this.value;
        if (!koridor) {
            infoDiv.classList.add('d-none');
            infoDiv.innerHTML = '';
            return;
        }
        const entry = koridorData[selectedService][koridor];
        infoDiv.classList.remove('d-none');
        infoDiv.innerHTML = `<b>Start:</b> ${entry.start}<br><b>End:</b> ${entry.end}`;
    });

    // Render custom dropdown setiap kali update
    renderCustomKoridorDropdown();
}

// Mendapatkan daftar layanan dan koridor berdasarkan nama halte
function getServicesAndKoridorsByHalte(halteName) {
    const results = [];
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, koridorInfo] of Object.entries(koridors)) {
            if (koridorInfo.haltes.includes(halteName)) {
                results.push({ service, koridor });
            }
        }
    }
    return results;
}

// Fungsi untuk mendapatkan status operasi berdasarkan hari dan jam
function getOperationalStatus(koridorNumber, service) {
    const koridor = koridorData[service]?.[koridorNumber];
    if (!koridor) return null;

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin, dst
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute/60;

    // Default jam operasi untuk semua koridor
    const defaultHours = {
        start: 5,
        end: 22
    };

    // Special handling for PRJ1 and PRJ2
    if ((koridorNumber === 'PRJ1' || koridorNumber === 'PRJ2' || koridorNumber === '2C') && koridor.operationalSchedule) {
        const schedule = koridor.operationalSchedule;
        let isOperational = false;
        let timeInfo = '';
        let hours = null;
        let dayRange = '';
        let isWeekend = false;
        // Gunakan properti 'type' untuk label hari
        if (schedule.weekend && schedule.weekend.days.includes(currentDay)) {
            hours = schedule.weekend.hours;
            dayRange = schedule.weekend.type === 'weekend' ? 'Sabtu - Minggu' : '';
            isWeekend = true;
        } else if (schedule.weekday && schedule.weekday.days.includes(currentDay)) {
            hours = schedule.weekday.hours;
            dayRange = schedule.weekday.type === 'weekday' ? 'Senin - Jumat' : '';
        }
        // Format jam operasi
        let timeSlots = Array.isArray(hours) ? hours : [hours];
        isOperational = timeSlots.some(slot => currentTime >= slot.start && currentTime < slot.end);
        // Hitung waktu tersisa atau waktu mulai
        if (isOperational) {
            const nextEnd = timeSlots.find(slot => currentTime >= slot.start && currentTime < slot.end)?.end;
            if (nextEnd) {
                const remainingHours = Math.floor(nextEnd - currentTime);
                const remainingMinutes = Math.round((nextEnd - currentTime - remainingHours) * 60);
                timeInfo = `${remainingHours} jam ${remainingMinutes} menit lagi`;
            }
        } else {
            // Cari slot operasi berikutnya
            const nextSlot = timeSlots.find(slot => slot.start > currentTime);
            if (nextSlot) {
                let diff = (nextSlot.start - currentTime + 24) % 24;
                let hoursUntilStart = Math.floor(diff);
                let minutesUntilStart = Math.round((diff - hoursUntilStart) * 60);
                timeInfo = ` (${hoursUntilStart} jam ${minutesUntilStart} menit lagi)`;
            } else {
                // Jika tidak ada slot lagi hari ini, hitung sampai besok
                const firstSlot = timeSlots[0];
                let diff = (24 - currentTime + firstSlot.start) % 24;
                let hoursUntilStart = Math.floor(diff);
                let minutesUntilStart = Math.round((diff - hoursUntilStart) * 60);
                timeInfo = ` (${hoursUntilStart} jam ${minutesUntilStart} menit lagi)`;
            }
        }
        // Format jam operasi string
        let jamOperasiStr = timeSlots.map(slot => `${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00`).join(' | ');
        return {
            isOperational,
            message: isOperational ? 'Sedang beroperasi' : 'Di luar jam operasi',
            timeInfo,
            schedule: {
                weekday: {
                    hours: timeSlots,
                    dayRange: dayRange,
                    jamOperasiStr: jamOperasiStr
                }
            }
        };
    }

    // Jika koridor memiliki jadwal khusus
    if (koridor.operationalSchedule) {
        const schedule = koridor.operationalSchedule;
        const hours = schedule.weekday?.hours || defaultHours;
        const days = schedule.weekday?.days || [];
        
        // Format hari operasi
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let startDay = dayNames[Math.min(...days)];
        let endDay = dayNames[Math.max(...days)];
        let dayRange = days.length === 7 ? "Setiap hari" : `${startDay} - ${endDay}`;
        // Special case: if days is [6,0] or [0,6], force 'Sabtu - Minggu'
        if (days.length === 2 && days.includes(0) && days.includes(6)) {
            dayRange = 'Sabtu - Minggu';
        }
        
        // Cek apakah hari ini adalah hari operasi
        const isOperationalDay = days.includes(currentDay);
        
        if (!isOperationalDay) {
            // Hitung hari sampai operasi berikutnya
            const nextOperationalDay = days.find(day => day > currentDay) || days[0];
            const daysUntilNext = nextOperationalDay > currentDay ? 
                nextOperationalDay - currentDay : 
                7 - currentDay + nextOperationalDay;
            
            return {
                isOperational: false,
                message: "Tidak beroperasi pada hari ini",
                timeInfo: `${daysUntilNext} hari lagi`,
                schedule: {
                    weekday: { 
                        hours: hours,
                        dayRange: dayRange
                    }
                }
            };
        }

        // Cek apakah dalam jam operasi
        let isOperational = false;
        let timeSlots = [];

        // Jika hours adalah array (multiple time slots)
        if (Array.isArray(hours)) {
            timeSlots = hours.map(slot => ({
                start: slot.start,
                end: slot.end,
                period: slot.start < 12 ? "Pagi" : "Sore"
            }));
            
            isOperational = hours.some(slot => 
                currentTime >= slot.start && currentTime < slot.end
            );
        } else {
            // Single time slot
            timeSlots = [{
                start: hours.start,
                end: hours.end,
                period: ""
            }];
            isOperational = currentTime >= hours.start && currentTime < hours.end;
        }

        // Hitung waktu tersisa atau waktu mulai
        let timeInfo = "";
        if (isOperational) {
            const nextEnd = timeSlots.find(slot => currentTime >= slot.start && currentTime < slot.end)?.end;
            if (nextEnd) {
                const remainingHours = Math.floor(nextEnd - currentTime);
                const remainingMinutes = Math.round((nextEnd - currentTime - remainingHours) * 60);
                timeInfo = ` (${remainingHours} jam ${remainingMinutes} menit lagi)`;
            }
        } else {
            // Cari slot operasi berikutnya
            const nextSlot = timeSlots.find(slot => slot.start > currentTime);
            if (nextSlot) {
                let diff = (nextSlot.start - currentTime + 24) % 24;
                let hoursUntilStart = Math.floor(diff);
                let minutesUntilStart = Math.round((diff - hoursUntilStart) * 60);
                timeInfo = ` (${hoursUntilStart} jam ${minutesUntilStart} menit lagi)`;
            } else {
                // Jika tidak ada slot lagi hari ini, hitung sampai besok
                const firstSlot = timeSlots[0];
                let diff = (24 - currentTime + firstSlot.start) % 24;
                let hoursUntilStart = Math.floor(diff);
                let minutesUntilStart = Math.round((diff - hoursUntilStart) * 60);
                timeInfo = ` (${hoursUntilStart} jam ${minutesUntilStart} menit lagi)`;
            }
        }

        if (isOperational) {
            return {
                isOperational: true,
                message: "Sedang beroperasi",
                timeInfo: timeInfo.replace(/[()]/g, ''),
                schedule: {
                    weekday: { 
                        hours: timeSlots,
                        dayRange: dayRange
                    }
                }
            };
        } else {
            return {
                isOperational: false,
                message: "Di luar jam operasi",
                timeInfo: timeInfo.replace(/[()]/g, ''),
                schedule: {
                    weekday: { 
                        hours: timeSlots,
                        dayRange: dayRange
                    }
                }
            };
        }
    }

    // Gunakan default schedule jika tidak ada jadwal khusus
    if (currentTime >= defaultHours.start && currentTime < defaultHours.end) {
        const remainingHours = Math.floor(defaultHours.end - currentTime);
        const remainingMinutes = Math.round((defaultHours.end - currentTime - remainingHours) * 60);
        return {
            isOperational: true,
            message: "Sedang beroperasi",
            timeInfo: `${remainingHours} jam ${remainingMinutes} menit lagi`,
            schedule: {
                weekday: { 
                    hours: [{
                        start: defaultHours.start,
                        end: defaultHours.end,
                        period: ""
                    }],
                    dayRange: "Setiap hari"
                }
            }
        };
    } else {
        // Hitung waktu sampai operasi besok
        let diff = (24 - currentTime + defaultHours.start) % 24;
        let hoursUntilStart = Math.floor(diff);
        let minutesUntilStart = Math.round((diff - hoursUntilStart) * 60);
        return {
            isOperational: false,
            message: "Di luar jam operasi",
            timeInfo: `${hoursUntilStart} jam ${minutesUntilStart} menit lagi`,
            schedule: {
                weekday: { 
                    hours: [{
                        start: defaultHours.start,
                        end: defaultHours.end,
                        period: ""
                    }],
                    dayRange: "Setiap hari"
                }
            }
        };
    }
}

// Fungsi untuk mendapatkan daftar hari tidak beroperasi
function getNonOperationalDays(schedule) {
    const allDays = [0, 1, 2, 3, 4, 5, 6]; // 0 = Minggu, 1 = Senin, dst
    const operationalDays = new Set([
        ...(schedule.weekday?.days || []),
        ...(schedule.weekend?.days || [])
    ]);
    
    return allDays.filter(day => !operationalDays.has(day));
}

// Fungsi untuk mengecek apakah koridor adalah AMARI
function isAMARIKoridor(koridorNumber, service) {
    const koridor = koridorData[service]?.[koridorNumber];
    return koridor?.isAMARI || false;
}

// Fungsi untuk mendapatkan tarif berdasarkan jam
function getTarif() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute/60;
    // --- TARIF KHUSUS TANGGAL TERTENTU ---
    // Contoh: 1 Juli (bulan 6, karena bulan di JS dimulai dari 0)
    if ((now.getDate() === 1 && now.getMonth() === 6)) {
        return {
            amount: 1,
            period: "Tarif Spesial",
            description: "Tarif Spesial Hari Bhayangkara",
            timeInfo: "Tarif hanya berlaku hari ini"
        };
    }
    // Tarif 2000 untuk jam 05:00 - 07:00
    if (currentTime >= 5 && currentTime < 7) {
        const remainingMinutes = Math.round((7 - currentTime) * 60);
        return {
            amount: 2000,
            period: "05:00 - 06:59",
            description: "Tarif Awal",
            timeInfo: `Berlaku ${remainingMinutes} menit lagi`
        };
    }
    
    // Tarif 3500 untuk jam 07:00 - 04:59
    let hoursUntilNext, minutesUntilNext;
    if (currentTime < 5) {
        // Hitung mundur ke jam 5 pagi hari ini
        const nowDate = new Date();
        const next5 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 5, 0, 0, 0);
        const diffMs = next5 - nowDate;
        hoursUntilNext = Math.floor(diffMs / (1000 * 60 * 60));
        minutesUntilNext = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    } else {
        // Hitung mundur ke jam 5 pagi besok
        const nowDate = new Date();
        const next5 = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + 1, 5, 0, 0, 0);
        const diffMs = next5 - nowDate;
        hoursUntilNext = Math.floor(diffMs / (1000 * 60 * 60));
        minutesUntilNext = Math.round((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    }
    return {
        amount: 3500,
        period: "07:00 - 04:59",
        description: "Tarif Normal",
        timeInfo: `Berlaku ${hoursUntilNext} jam ${minutesUntilNext} menit lagi`
    };
}

// Function to create night service badge
function createNightServiceBadge() {
    return '<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-info" style="font-size:0.5em;"><iconify-icon icon="mdi:moon-waning-crescent"></iconify-icon></span>';
}

// Function to check if string contains AMARI
function isAMARIService(str) {
    return str.toLowerCase().includes('amari');
}

// Function to remove AMARI text from string
function removeAMARIText(str) {
    return str.replace(/\s*amari\s*/i, '').trim();
}

// Update fungsi getJurusan untuk menampilkan status operasi dan tarif real-time
function getJurusan(koridorNumber, service) {
    const koridor = koridorData[service]?.[koridorNumber];
    const outputElement = document.getElementById("jurusan");

    if (!koridor) {
        outputElement.innerHTML = `Koridor ${koridorNumber} tidak ditemukan.`;
        return;
    }

    const halteAwal = koridor.start;
    const halteAkhir = koridor.end;
    const operator = koridor.operator || "Operator tidak tersedia";
    const busTypes = Array.isArray(koridor.busType) ? koridor.busType : (koridor.busType ? [koridor.busType] : []);
    const isAMARI = isAMARIKoridor(koridorNumber, service);
    const tarif = getTarif();
    const operationalStatus = getOperationalStatus(koridorNumber, service);

    // Format jam operasi
    function formatHours(hours) {
        if (Array.isArray(hours)) {
            return hours.map(slot => 
                slot.period ? `${slot.period}: ${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00` : `${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00`
            ).join(" | ");
        }
        return `${String(hours.start).padStart(2,'0')}:00 - ${String(hours.end).padStart(2,'0')}:00`;
    }

    let busTypeHtml = '';
    if (busTypes.length > 0) {
        // Mapping gambar bus (bisa ditambah sesuai kebutuhan)
        const busTypeToImage = {
            "Volvo B11R": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/Transjakarta%2C_Volvo_B11R_%28SAF-025%29.jpg/1280px-Transjakarta%2C_Volvo_B11R_%28SAF-025%29.jpg",
            "Mercedes-Benz OH 1626": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg/1280px-Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg",
            "Mercedes-Benz OH 1526": "https://pbs.twimg.com/media/EhuPuokU4AAniIJ.jpg",
            "Mercedes-Benz O500U": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/TJ_0791_at_Senayan.jpg/1280px-TJ_0791_at_Senayan.jpg",
            "Mercedes-Benz OC 500 RF 2542": "https://live.staticflickr.com/1825/42375369745_d59b0db737_b.jpg",
            "Scania K320IA": "https://mobilkomersial.com/wp-content/uploads/2023/04/Bus-TJ-Gandeng.jpg",
            "Scania K310IB": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Transjakarta_MYS_18116_at_Gambir.jpg/1100px-Transjakarta_MYS_18116_at_Gambir.jpg",
            "Scania K250UB": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Transjakarta_-_TJ632_Scania_K250UB.jpg/1280px-Transjakarta_-_TJ632_Scania_K250UB.jpg",
            "Hino RK1 JSNL": "https://live.staticflickr.com/4624/39561244554_fc5cf21761_b.jpg",
            "Hino RK8 R260": "https://live.staticflickr.com/1937/45752656441_bf9489a0bb_b.jpg",
            "Zhongtong Bus LCK6180GC": "https://redigest.web.id/wp-content/uploads/2019/10/IMG_20191011_104316_HDR.jpg",
            "Zhongtong Bus LCK6126EVGRA1": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Transjakarta_-_DMR-240127_01.jpg/1280px-Transjakarta_-_DMR-240127_01.jpg",
            "Zhongtong Bus LCK6126EVGRA2": "https://img.okezone.com/content/2025/06/20/1/3148864/bus_listrik_damri-peyD_large.jpg",
            "SAG Golden Dragon XML6125JEVJ0C3": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Transjakarta_-_BMP-240327.jpg/1100px-Transjakarta_-_BMP-240327.jpg",
            "Skywell NJL6126BEV": "https://www.transgo.co.id/wp-content/uploads/2024/11/002.png",
            "Skywell NJL6129BEV": "https://mobilkomersial.com/wp-content/uploads/2024/11/Snapinsta.app_466929837_870028668268355_8248708680309915930_n_1080.jpg",
            "VKTR BYD D9 (EV)": "https://asset.kompas.com/crops/G33-Spk3Y_p-AZPaLFIgdLT1bd0=/13x164:1080x875/1200x800/data/photo/2024/12/03/674e9cfae21a3.jpg",
            "Hino GB 150": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg/1280px-Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg",
            "VKTR BYD B12 (EV)": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Transjakarta_SJM-240012.jpg/1280px-Transjakarta_SJM-240012.jpg",
            "Mitsubishi Colt FE 84G": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/MiniTrans.jpg/1100px-MiniTrans.jpg",
            "Hino RN8 285" : "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg/1100px-BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg"
        };
        // Create a mapping of bus types to their specific operators and type
        const busTypeToOperators = {
            // Volvo Buses
            "Volvo B11R": {
                operators: ["Steady Safe (SAF)"],
                type: "BRT Maxi"
            },
            
            // Mercedes-Benz Buses
            "Mercedes-Benz OH 1626": {
                operators: ["PT Transportasi Jakarta", "Mayasari Bakti", "Bianglala Metropolitan", "Pahala Kencana Transportation"],
                type: "BRT Biasa"
            },
            "Mercedes-Benz OH 1626 amari": {
                operators: ["Bianglala Metropolitan"],
                type: "Layanan AMARI Transjakarta"
            },
            "Mercedes-Benz OH 1526": {
                operators: ["PT Transportasi Jakarta"],
                type: "BRT Biasa"
            },
            "Mercedes-Benz O500U": {
                operators: ["PT Transportasi Jakarta"],
                type: "Low Deck Non-BRT Swakelola"
            },
            "Mercedes-Benz OC 500 RF 2542": {
                operators: ["PT Transportasi Jakarta"],
                type: "BRT Maxi"
            },
            
            // Scania Buses
            "Scania K320IA": {
                operators: ["Mayasari Bakti"],
                type: "Bus Gandeng"
            },
            "Scania K310IB": {
                operators: ["Mayasari Bakti"],
                type: "BRT Maxi"
            },
            "Scania K250UB": {
                operators: ["PT Transportasi Jakarta"],
                type: "Low Deck Non-BRT Swakelola"
            },
            
            // Hino Buses
            "Hino RK1 JSNL": {
                operators: ["PT Transportasi Jakarta"],
                type: "BRT Biasa"
            },
            "Hino RK8 R260": {
                operators: ["Perum DAMRI", "Bianglala Metropolitan"],
                type: "BRT Biasa"
            },
            "Hino RK1 JSNL amari": {
                operators: ["Bianglala Metropolitan"],
                type: "Layanan AMARI  Transjakarta"
            },
            "Hino RK8 R260 amari": {
                operators: ["Bianglala Metropolitan"],
                type: "Layanan AMARI Transjakarta"
            },
            "Hino GB 150": {
                operators: ["Jewa Dian Mitra"],
                type: "Bus Medium Non BRT"
            },
            "Hino RN8 285": {
                operators: ["Bayu Holong Persada"],
                type: "BRT Biasa"
            },
            // Mitsubishi
            "Mitsubishi Colt FE 84G": {
                operators: ["Trans Swadaya (Unit Bisnis Transjakarta)"],
                type: "Bus Medium Non BRT"
            },

            // Zhongtong Buses
            "Zhongtong Bus LCK6180GC": {
                operators: ["Perum DAMRI"],
                type: "Bus Gandeng"
            },
            "Zhongtong Bus LCK6126EVGRA1": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik BRT"
            },
            "Zhongtong Bus LCK6126EVGRA1 amari": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik BRT - Layanan AMARI"
            },
            "Zhongtong Bus LCK6126EVGRA2": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik BRT Zhongtong Batch 2"
            },
            
            // Electric Buses
            "SAG Golden Dragon XML6125JEVJ0C3": {
                operators: ["Bianglala Metropolitan"],
                type: "Bus Listrik BRT"
            },
            "Skywell NJL6126BEV": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik BRT"
            },
            "Skywell NJL6126BEV amari": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik BRT - Layanan AMARI"
            },
            "Skywell NJL6129BEV": {
                operators: ["Perum DAMRI"],
                type: "Bus Listrik Low Deck"
            },
            "VKTR BYD D9 (EV)": {
                operators: ["Sinar Jaya Megah Langgeng"],
                type: "Bus Listrik BRT E-Cityline 3 Laksana"
            },
            "VKTR BYD B12 (EV)":{
                operators: ["Mayasari Bakti"],
                type: "Bus Listrik Low Deck"
            }
        };

        busTypeHtml = `
        <span class="text-muted fw-bold small">Jenis Bus :</span>
        <div class="pt-sans-narrow-bold mt-2">
            ${busTypes.map(busType => {
                const isElectric = busType.toLowerCase().includes('ev') || busType.toLowerCase().includes('listrik');
                const isAMARIBus = isAMARIService(busType);
                const busInfo = busTypeToOperators[busType] || { operators: [], type: 'Tidak ada data' };
                const operatorList = busInfo.operators.join(', ');
                const displayBusType = removeAMARIText(busType);
                const imgSrc = busTypeToImage[removeAMARIText(busType)] || 'https://via.placeholder.com/120x40?text=No+Image';
                return `
                    <button 
                        class="btn btn-sm mb-1 me-1 rounded-5 position-relative" 
                        style="background:${getKoridorBadgeColor(koridorNumber)}; color:white; border:none;"
                        data-bs-toggle="popover"
                        data-bs-trigger="hover"
                        data-bs-placement="auto"
                        data-bs-html="true"
                        data-bs-content="<div style='width:140px;display:flex;justify-content:center;align-items:center;'><a href='${imgSrc}' target='_blank' tabindex='-1'><img src='${imgSrc}' alt='${displayBusType}' class='bus-popover-img'></a></div><b>Operator:</b><br>${operatorList || 'Tidak ada data operator'}<br><br><b>Tipe:</b><br>${busInfo.type}"
                    >
                        ${displayBusType}
                        ${isElectric ? '<span class=\"position-absolute top-0 start-100 translate-middle badge rounded-pill bg-warning\" style=\"font-size:0.5em;\"><iconify-icon icon=\"mdi:lightning-bolt\"></iconify-icon></span>' : ''}
                        ${isAMARIBus ? createNightServiceBadge() : ''}
                    </button>
                `;
            }).join('')}
        </div>
        <hr>
        `;
    }

    // Process operator string to handle AMARI indicators
    const operatorHtml = (Array.isArray(operator) ? operator : operator.split(',')).map(op => {
        const isAMARIOperator = isAMARIService(op);
        const displayOperator = removeAMARIText(op);
        
        return `
            <span class="badge me-1 shadow-lg rounded-5 position-relative" style="background:${getKoridorBadgeColor(koridorNumber)};">
                ${displayOperator}
                ${isAMARIOperator ? createNightServiceBadge() : ''}
            </span>
        `;
    }).join('');

    // Pilih warna label layanan
    let serviceLabelClass = 'bg-secondary';
    if (service === 'BRT') serviceLabelClass = 'bg-primary';
    else if (service === 'Non-BRT') serviceLabelClass = 'bg-warning text-dark';
    else if (service === 'TransJabodetabek') serviceLabelClass = 'bg-success';

    // Tombol lihat map
    const mapBtnId = `lihatMapBtn_${koridorNumber}_${service}`;
    // Tombol lihat daftar halte
    const daftarHalteBtnId = `lihatHalteBtn_${koridorNumber}_${service}`;
    // Tombol lihat modal bus/operator
    const busOpBtnId = `lihatBusOpBtn_${koridorNumber}_${service}`;
    // Refactor header info koridor agar lebih modern dan rapi
    outputElement.innerHTML = `
      <div class="card shadow-sm p-3 mb-4" style="border-radius:1.5em; background:${hexToRgba(getKoridorBadgeColor(koridorNumber),0.13)};">
        <div class="d-flex flex-column align-items-center justify-content-center gap-2 mb-2">
          <span class="badge" style="background:${getKoridorBadgeColor(koridorNumber)}; color:#fff; font-size:1.5em; border-radius:50%; width:64px; height:64px; display:flex; align-items:center; justify-content:center; font-weight:bold;">
            ${koridorNumber}
          </span>
        </div>
        <div class="fw-bold fs-5 mb-2 text-center">${halteAwal} <iconify-icon inline icon="ei:arrow-right"></iconify-icon> ${halteAkhir}</div>
        <div class="d-flex flex-wrap align-items-center justify-content-center gap-2 mb-3">
          ${isAMARI ? '<span class="badge bg-info rounded-pill px-3 py-2 fs-6">AMARI</span>' : ''}
          <span class="badge ${serviceLabelClass} rounded-pill px-3 py-2 fs-6">${service}</span>
          <button id="${mapBtnId}" class="btn btn-outline-primary btn-sm rounded-pill d-flex align-items-center gap-1" style="width:max-content;"><iconify-icon icon="mdi:map"></iconify-icon> Lihat Map</button>
        </div>
        <div class="d-flex flex-column align-items-center gap-2 mb-3">
          <button id="${busOpBtnId}" class="btn btn-outline-secondary btn-sm rounded-pill w-100 d-flex align-items-center justify-content-center gap-1"><iconify-icon icon="mdi:bus"></iconify-icon> Lihat Jenis Bus & Operator</button>
          <button id="${daftarHalteBtnId}" class="btn btn-outline-success btn-sm rounded-pill w-100 d-flex align-items-center justify-content-center gap-1"><iconify-icon icon="mdi:format-list-bulleted"></iconify-icon> Lihat Daftar Halte</button>
        </div>
        <div class="row g-2 justify-content-center text-center mb-2">
          <div class="col-12 col-md-6 mb-2">
            <div class="alert ${tarif.amount === 2000 ? 'alert-info' : 'alert-warning'} py-1 px-2 mb-0 w-100">
              <iconify-icon icon="mdi:cash-multiple"></iconify-icon>
              <b>Rp ${tarif.amount.toLocaleString('id-ID')}</b> <br>
              <small>${tarif.description}</small>
            </div>
          </div>
          <div class="col-12 col-md-6 mb-2">
            <div class="alert ${operationalStatus.isOperational ? 'alert-success' : 'alert-danger'} py-1 px-2 mb-0 w-100">
              <iconify-icon icon="mdi:bus-clock"></iconify-icon>
              <b>${isAMARI ? 'Beroperasi 24 jam' : operationalStatus.message}</b>
              <br>
              ${isAMARI ? '' : `<small>${operationalStatus.timeInfo}</small>`}
            </div>
          </div>
        </div>
        <div class="small mt-2 text-center">
          ${operationalStatus.schedule.weekday && !isAMARI ? `
          <div class="mb-1">
              <b>${operationalStatus.schedule.weekday.dayRange} <br> ${operationalStatus.schedule.weekday.jamOperasiStr || formatHours(operationalStatus.schedule.weekday.hours)}
          </div>
          ` : ''}
        </div>
      </div>
    `;
    // Modal HTML (hanya satu di DOM)
    let modal = document.getElementById('modalBusOp');
    if (modal) modal.remove();
    const modalHtml = `
    <div class="modal fade" id="modalBusOp" tabindex="-1" aria-labelledby="modalBusOpLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="background:${hexToRgba(getKoridorBadgeColor(koridorNumber),0.13)} !important;border-radius:1.5em;box-shadow:0 8px 32px 0 #0002;backdrop-filter:blur(8px);">
          <div class="modal-header" style="background:transparent !important; border-bottom:0;">
            <h5 class="modal-title" id="modalBusOpLabel">Jenis Bus & Operator</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Tutup"></button>
        </div>
          <div class="modal-body" id="modalBusOpBody" style="background:transparent !important;">
            <!-- Konten dinamis diisi JS -->
    </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      const busOpBtn = document.getElementById(busOpBtnId);
      if (busOpBtn) {
        busOpBtn.onclick = function(e) {
          e.preventDefault();
          // Isi konten modal
          const modalBody = document.getElementById('modalBusOpBody');
          let html = '';
          if (busTypes.length > 0) {
            html += '<div class="row g-3">';
            busTypes.forEach(busType => {
              const isElectric = busType.toLowerCase().includes('ev') || busType.toLowerCase().includes('listrik');
              const isAMARIBus = isAMARIService(busType);
              // GUNAKAN VARIABEL GLOBAL
              const busInfo = busTypeToOperators[busType] || { operators: [], type: 'Tidak ada data' };
              const operatorList = busInfo.operators;
              const displayBusType = removeAMARIText(busType);
              const imgSrc = busTypeToImage[removeAMARIText(busType)] || 'https://via.placeholder.com/120x40?text=No+Image';
              html += `<div class='col-12'>
                <div class='card shadow-sm h-100' style='border-radius:1em; background:${hexToRgba(getKoridorBadgeColor(koridorNumber),0.13)};'>
                  <div class='card-body d-flex flex-column align-items-center justify-content-center p-3'>
                    <img src='${imgSrc}' alt='${displayBusType}' style='max-width:180px;max-height:90px;object-fit:contain;background:#f8f9fa;border-radius:8px;padding:2px;display:block;margin-bottom:8px;'>
                    <div class='fw-bold mb-2 text-center' style='font-size:1.1em;'>${displayBusType} ${isElectric ? '<iconify-icon icon="mdi:lightning-bolt"></iconify-icon>' : ''} ${isAMARIBus ? createNightServiceBadge() : ''}</div>
                    <div class='w-100 text-center mb-1'>
                      <b>Operator:</b><br>
                      ${operatorList && operatorList.length ? operatorList.map(op => `${op.trim()}`).join('<br>') : '<span class="text-muted">Tidak ada data operator</span>'}
                    </div>
                    <div class='w-100 text-center mb-1'>
                      <b>Tipe:</b><br>
                      <span class='small text-muted'>${busInfo.type}</span>
                    </div>
                  </div>
                </div>
              </div>`;
            });
            html += '</div>';
          } else {
            html = '<div class="text-muted">Tidak ada data jenis bus untuk koridor ini.</div>';
          }
          modalBody.innerHTML = html;
          const modal = new bootstrap.Modal(document.getElementById('modalBusOp'));
          modal.show();
        };
      }
    }, 10);

    // Tambahkan event listener untuk tombol lihat map
    setTimeout(() => {
      const mapBtn = document.getElementById(mapBtnId);
      if (mapBtn) {
        mapBtn.onclick = function(e) {
          e.stopPropagation();
          if (koridorData[service]?.[koridorNumber] && koridorData[service][koridorNumber].map) {
            showMapKoridorModal(service, koridorNumber);
          } else {
            alert('Peta koridor belum tersedia untuk koridor ini.');
          }
        };
      }
      // Tombol lihat daftar halte
      const halteBtn = document.getElementById(daftarHalteBtnId);
      if (halteBtn) {
        halteBtn.onclick = function(e) {
          e.preventDefault();
          // Scroll ke daftar halte
          let target = document.getElementById('koridorResults') || document.getElementById(`haltesList-${koridorNumber}`);
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };
      }
      // Bootstrap tooltip
      const tooltipTriggerList = [].slice.call(document.querySelectorAll('.operator-badge'));
      tooltipTriggerList.forEach(function (tooltipTriggerEl) {
        new bootstrap.Tooltip(tooltipTriggerEl);
      });
    }, 10);

    // Initialize Bootstrap popovers
    const popoverTriggerList = outputElement.querySelectorAll('[data-bs-toggle="popover"]');
    [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));

    // Add event listeners after the HTML is inserted
    if (service === "Non-BRT" || service === "TransJabodetabek") {
        const buttons = outputElement.querySelectorAll('.direction-btn');
        buttons.forEach(button => {
            button.addEventListener('click', function() {
                // Remove active class from all buttons
                buttons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.style.background = 'transparent';
                    btn.style.color = getKoridorBadgeColor(koridorNumber);
                    btn.style.border = `2px solid ${getKoridorBadgeColor(koridorNumber)}`;
                });
                
                // Add active class to clicked button
                this.classList.add('active');
                this.style.background = getKoridorBadgeColor(koridorNumber);
                this.style.color = 'white';
                this.style.border = 'none';
                const direction = this.getAttribute('data-direction');
                // Simpan state arah ke localStorage per koridor
                localStorage.setItem('lastDirection_' + koridorNumber, direction);
                const halteAwal = koridor.start;
                const halteAkhir = koridor.end;
                
                // Khusus untuk Koridor 11Q, selalu gunakan directions
                if (koridorNumber === "11Q") {
                    if (direction === 'forward') {
                        showHaltes(
                            koridorNumber,
                            halteAwal,
                            halteAkhir,
                            koridor.directions[halteAwal],
                            window._highlightHalte || null
                        );
                    } else {
                        showHaltes(
                            koridorNumber,
                            halteAkhir,
                            halteAwal,
                            koridor.directions[halteAkhir],
                            window._highlightHalte || null
                        );
                    }
                } else {
                    // Untuk koridor lain, cek apakah ada data directions
                    const hasDirections = koridor.directions && 
                        koridor.directions[halteAwal] && 
                        koridor.directions[halteAkhir] &&
                        koridor.directions[halteAwal].length > 0 &&
                        koridor.directions[halteAkhir].length > 0;

                    if (hasDirections) {
                        // Gunakan data directions jika ada
                        if (direction === 'forward') {
                            showHaltes(
                                koridorNumber,
                                halteAwal,
                                halteAkhir,
                                koridor.directions[halteAwal],
                                window._highlightHalte || null
                            );
                        } else {
                            showHaltes(
                                koridorNumber,
                                halteAkhir,
                                halteAwal,
                                koridor.directions[halteAkhir],
                                window._highlightHalte || null
                            );
                        }
                    } else {
                        // Fallback ke data haltes jika directions tidak ada
                        if (direction === 'forward') {
                            showHaltes(
                                koridorNumber,
                                halteAwal,
                                halteAkhir,
                                koridor.haltes.slice(0, Math.floor(koridor.haltes.length/2)),
                                window._highlightHalte || null
                            );
                        } else {
                            showHaltes(
                                koridorNumber,
                                halteAkhir,
                                halteAwal,
                                koridor.haltes.slice(Math.floor(koridor.haltes.length/2)).reverse(),
                                window._highlightHalte || null
                            );
                        }
                    }
                }
            });
        });
        // Restore state arah dari localStorage jika ada
        const lastDirection = localStorage.getItem('lastDirection_' + koridorNumber);
        if (lastDirection) {
            const btn = outputElement.querySelector(`[data-direction="${lastDirection}"]`);
            if (btn) btn.click();
        } else {
        const forwardButton = outputElement.querySelector('[data-direction="forward"]');
            if (forwardButton) forwardButton.click();
        }
    }

    // Setelah render, tambahkan event listener pada badge koridor untuk modal peta
    const badge = outputElement.querySelector('#koridorMapBadge');
    if (badge) {
        badge.onclick = function(e) {
            e.stopPropagation();
            const koridorEntry = koridorData[service]?.[koridorNumber];
            if (koridorEntry && koridorEntry.map) {
                // Pastikan modal sudah ada
                let modal = null;
                // Hapus modal lama jika ada
                const oldModal = document.getElementById('modalMapKoridor');
                if (oldModal) oldModal.remove();
                if (!document.getElementById('modalMapKoridor')) {
                    const modalHtml = `
                    <div class=\"modal fade\" id=\"modalMapKoridor\" tabindex=\"-1\" aria-labelledby=\"modalMapKoridorLabel\" aria-hidden=\"true\">\n                      <div class=\"modal-dialog modal-dialog-centered modal-lg\">\n                        <div class=\"modal-content\">\n                          <div class=\"modal-header\">\n                           <button id=\"modalMapPrevBtn\" class=\"btn btn-outline-dark btn-sm rounded-circle me-2\"><b>&lt;</b></button>\n                            <h5 class=\"modal-title fw-bold plus-jakarta-sans d-flex align-items-center gap-2\" id=\"modalMapKoridorLabel\">Peta Koridor <span id=\"modalKoridorBadge\"></span></h5>\n                            <button id=\"modalMapNextBtn\" class=\"btn btn-outline-dark btn-sm rounded-circle ms-2\"><b>&gt;</b></button>\n                            <button type=\"button\" class=\"btn btn-outline-dark\" data-bs-dismiss=\"modal\" aria-label=\"Tutup\"><iconify-icon inline  icon=\"line-md:close\"></iconify-icon></button>\n                          </div>\n                          <div class=\"modal-body text-center\">\n                            <div id=\"modalKoridorJurusan\" class=\"fw-bold fs-5 mb-2\"></div>\n                            <img id=\"imgMapKoridor\" src=\"\" alt=\"Peta Koridor\" class=\"img-fluid rounded shadow\">\n                          </div>\n                        </div>\n                      </div>\n                    </div>`;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                }
                modal = new bootstrap.Modal(document.getElementById('modalMapKoridor'));
                modal.show();
                // Tambahkan event handler next/back agar navigasi berfungsi
                const koridorList = getKoridorListForService(service);
                let idx = koridorList.indexOf(koridorNumber);
                // Preload semua gambar peta koridor untuk layanan ini
                koridorList.forEach(kor => {
                    const mapUrl = koridorData[service][kor]?.map;
                    if (mapUrl && !mapImageCache[mapUrl]) {
                        const img = new window.Image();
                        img.src = mapUrl;
                        mapImageCache[mapUrl] = img;
                    }
                });
                function updateModalKoridor(idxBaru) {
                    const koridorBaru = koridorList[idxBaru];
                    const koridorEntryBaru = koridorData[service][koridorBaru];
                    const badgeSpan = document.getElementById('modalKoridorBadge');
                    if (badgeSpan) {
                        badgeSpan.innerHTML = `
                          <span class=\"pt-sans\" style=\"
                            display:inline-flex;
                            align-items:center;
                            justify-content:center;
                            width:32px;
                            height:32px;
                            border-radius:50%;
                            background:${getKoridorBadgeColor(koridorBaru)};
                            color:#fff;
                            font-weight:bold;
                            font-size:1em;
                            margin-left:4px;\">
                            ${koridorBaru}
                          </span>
                        `;
                    }
                    // Update jurusan di modal
                    const jurusanDiv = document.getElementById('modalKoridorJurusan');
                    if (jurusanDiv) {
                        let jurusanText = `${koridorEntryBaru.start} - ${koridorEntryBaru.end}`;
                        // Jika ada VIA, pisahkan dan beri text-muted
                        const viaMatch = jurusanText.match(/(.*?)( VIA .*)/i);
                        if (viaMatch) {
                            jurusanDiv.innerHTML = `${viaMatch[1]}<span class='text-muted'>${viaMatch[2]}</span>`;
                        } else {
                            jurusanDiv.textContent = jurusanText;
                        }
                    }
                    const img = document.getElementById('imgMapKoridor');
                    img.src = koridorEntryBaru.map;
                    img.alt = `Peta Koridor ${koridorBaru}`;
                    const label = document.getElementById('modalMapKoridorLabel');
                    if (label) label.childNodes[0].textContent = `Peta Koridor `;
                    // Update tombol
                    document.getElementById('modalMapPrevBtn').disabled = idxBaru <= 0;
                    document.getElementById('modalMapNextBtn').disabled = idxBaru >= koridorList.length - 1;
                    idx = idxBaru;
                    // Sinkronkan koridor utama di UI
                    if (window.selectKoridor) {
                        window.selectKoridor(service, koridorBaru);
                    }
                }
                // Setelah modal ditutup, update tampilan halte/jurusan sesuai koridor terakhir di modal
                const modalEl = document.getElementById('modalMapKoridor');
                modalEl.addEventListener('hidden.bs.modal', function() {
                    // Ambil koridor terakhir dari idx
                    const koridorTerakhir = koridorList[idx];
                    saveKoridorState(service, koridorTerakhir);
                    displayKoridorResults(service, koridorTerakhir);
                });
                // Setelah modal muncul, langsung update jurusan dan gambar pertama kali
                setTimeout(() => {
                    updateModalKoridor(idx);
                    document.getElementById('modalMapPrevBtn').onclick = function() {
                        if (idx > 0) updateModalKoridor(idx - 1);
                    };
                    document.getElementById('modalMapNextBtn').onclick = function() {
                        if (idx < koridorList.length - 1) updateModalKoridor(idx + 1);
                    };
                }, 10);
            } else {
                alert('Peta koridor belum tersedia untuk koridor ini.');
            }
        };
    }
}

// Menampilkan daftar halte dalam koridor yang dipilih
function displayKoridorResults(service, koridor, highlightHalte = null) {
    const resultsContainer = document.getElementById('koridorResults');
    // Pastikan container dibersihkan sebelum render baru
    resultsContainer.innerHTML = '';

    const koridorState = loadKoridorState();
    if (koridorState && koridorState.service && koridorState.koridor) {
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn btn-sm btn-outline-secondary mb-2 rounded-5 px-3';
        resetBtn.textContent = 'Tutup';
        resetBtn.onclick = function() {
            clearKoridorState();
            document.getElementById('serviceSelect').value = '';
            updateKoridorOptions();
            document.getElementById('').value = '';
            resultsContainer.innerHTML = '';
            document.getElementById('jurusan').innerHTML = '';
        };
        resultsContainer.appendChild(resetBtn);
    }

    const koridorDataEntry = koridorData[service]?.[koridor];
    if (!koridor || !koridorDataEntry) return;

    if (service === "BRT") {
        const halteIndexes = {};
        koridorDataEntry.haltes.forEach((halte, idx) => {
            if (!halteIndexes[halte]) halteIndexes[halte] = [];
            halteIndexes[halte].push(idx);
        });

        let nomorOverride = {};
        if (koridor === "1") {
            const idxAsean = koridorDataEntry.haltes.indexOf("ASEAN");
            const idxKejagung = koridorDataEntry.haltes.indexOf("Kejaksaan Agung");
            const idxMasjid = koridorDataEntry.haltes.indexOf("Masjid Agung");
            if (idxAsean !== -1 && idxKejagung !== -1 && idxMasjid !== -1) {
                nomorOverride[idxAsean] = 2;
                nomorOverride[idxKejagung] = 2;
                nomorOverride[idxMasjid] = 3;
            }
        }
        if (koridor === "12") {
            const halteMap = {
                "Penjaringan": 25, "Bandengan": 24, "Kali Besar": 23,
                "Mangga Dua Raya": 7, "Mangga Dua": 8, "Gunung Sahari": 9,
                "Jembatan Merah": 10, "Landasan Pacu": 11, "Danau Agung": 12,
                "Danau Sunter": 13, "Sunter Utara": 14, "Sunter Karya": 15,
                "Sunter Boulevard Barat": 16, "Sunter Kelapa Gading": 17,
                "Plumpang": 18, "Walikota Jakarta Utara": 19, "Koja": 20,
                "Mambo": 21, "Tanjung Priok": 22
            };
            for (const [halte, nomor] of Object.entries(halteMap)) {
                const idx = koridorDataEntry.haltes.indexOf(halte);
                if (idx !== -1) nomorOverride[idx] = nomor;
            }
        }
        if (koridor === "2") {
            const halteMap = { "Kwitang": 24, "Gambir 2": 23, "Balai Kota": 22, "Monumen Nasional": 21 };
            for (const [halte, nomor] of Object.entries(halteMap)) {
                const idx = koridorDataEntry.haltes.indexOf(halte);
                if (idx !== -1) nomorOverride[idx] = nomor;
            }
        }

        koridorDataEntry.haltes.forEach((halte, idx) => {
            let nomorUrut;
            if (nomorOverride[idx]) {
                nomorUrut = nomorOverride[idx];
            } else {
                nomorUrut = Math.min(...halteIndexes[halte]) + 1;
                if (koridor === "1" && idx > koridorDataEntry.haltes.indexOf("Masjid Agung")) {
                        nomorUrut = idx;
                }
            }

            const isStart = idx === 0;
            const isEnd = idx === koridorDataEntry.haltes.length - 1;
            const integrasi = integrasiTransportasi[halte];

            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex bg-light align-items-center justify-content-between halte-modern-item';
            listItem.style.cssText = "flex-wrap: wrap; gap: 8px; border-radius: 1em; margin-bottom: 8px; box-shadow: 0 2px 8px 0 #0001; transition: background 0.18s, box-shadow 0.18s;";
            
            listItem.onmouseenter = () => {
              listItem.style.background = '#f0f6ff';
              listItem.style.boxShadow = '0 4px 16px 0 #0002';
            };
            listItem.onmouseleave = () => {
              listItem.style.background = '';
              listItem.style.boxShadow = '0 2px 8px 0 #0001';
            };

            if (highlightHalte && halte === highlightHalte) {
                listItem.style.background = '#ffe066';
                listItem.style.boxShadow = '0 0 0 2px #ffd700';
            }

            const left = document.createElement('div');
            left.className = "d-flex flex-column align-items-start";
            left.style.cssText = "flex: 1; min-width: 200px;";

            const halteInfoContainer = document.createElement('div');
            halteInfoContainer.className = 'd-flex align-items-center';

            const ringBadgeContainer = document.createElement('div');
            ringBadgeContainer.style.cssText = "display: flex; align-items: center; justify-content: center; border-radius: 50%; margin-right: 10px; flex-shrink: 0; padding: 2px;";
            ringBadgeContainer.style.backgroundColor = getKoridorBadgeColor(koridor);

            const nomorBadge = document.createElement('div');
            // Hapus class text-dark jika ada
            nomorBadge.classList.remove('text-dark');
            // Set style dengan color putih pakai !important
            nomorBadge.style.cssText = "width: 40px; height: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 50%; line-height: 1; color:#fff !important;";
            
            if(isStart || isEnd) {
                nomorBadge.style.backgroundColor = isStart ? '#43a047' : '#d32f2f';
                nomorBadge.style.color = '#fff'; // Selalu putih
                nomorBadge.style.setProperty('color', '#fff', 'important');
                nomorBadge.classList.add('rounded-5');
            }

            const koridorNumSpan = document.createElement('span');
            koridorNumSpan.textContent = koridor;
            koridorNumSpan.style.cssText = "font-weight: bold; font-size: 0.9em;";
            
            const halteNumSpan = document.createElement('span');
            halteNumSpan.textContent = String(nomorUrut).padStart(2, '0');
            halteNumSpan.style.cssText = "font-size: 0.7em; opacity: 0.9;";
            
            nomorBadge.appendChild(koridorNumSpan);
            nomorBadge.appendChild(halteNumSpan);
            ringBadgeContainer.appendChild(nomorBadge);

            let badgeStartEnd = '';
            if (isStart) badgeStartEnd = '<span class="badge bg-success ms-2">Start</span>';
            if (isEnd) badgeStartEnd = '<span class="badge bg-danger ms-2">End</span>';
            
            const halteLink = document.createElement('a');
            halteLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Halte Transjakarta ' + halte)}`;
            halteLink.target = '_blank';
            halteLink.className = 'text-decoration-none text-dark fw-bold d-flex align-items-center';
            halteLink.style.position = 'relative';
            
            let iconsHtml = '';
            if (integrasi) {
                const iconMap = {
                    'KRL': '<iconify-icon inline icon="jam:train" class="ms-1" style="color:#1976d2;font-size:1.2em;"></iconify-icon>',
                    'MRT': '<iconify-icon inline icon="pepicons-pop:train-circle" class="ms-1" style="color:#43a047;font-size:1.2em;"></iconify-icon>',
                    'LRT': '<iconify-icon inline icon="icon-park-solid:train" class="ms-1" style="color:#f57c00;font-size:1.2em;"></iconify-icon>'
                };
                integrasi.forEach(item => {
                    if(iconMap[item.tipe]) iconsHtml += iconMap[item.tipe];
                });
            }
            // Setelah nama halte, tambahkan label Halte awal/akhir jika perlu
            let halteLabel = '';
            if (isStart) halteLabel = '<span class="badge bg-success rounded-pill ms-2">Halte awal</span>';
            if (isEnd) halteLabel = '<span class="badge bg-danger rounded-pill ms-2">Halte akhir</span>';
            halteLink.innerHTML = `<span class='d-flex align-items-center flex-wrap gap-1'>${halte} ${iconsHtml} ${halteLabel}</span>`;

            halteInfoContainer.appendChild(ringBadgeContainer);
            halteInfoContainer.appendChild(halteLink);

            const infoDiv = document.createElement('div');
            if (halte === 'Senayan BANK DKI') {
                infoDiv.innerHTML += `<div class="d-flex align-items-center mt-1"><iconify-icon inline icon="mdi:stadium" class="mx-1" style="margin-left:0.25rem;margin-right:0.25rem;font-size:1.2em;"></iconify-icon> SUGBK</div>`;
            }
            if (halte === 'Jakarta International Stadium') {
                infoDiv.innerHTML += `<div class="d-flex align-items-center mt-1"><iconify-icon inline icon="mdi:stadium" class="mx-1" style="margin-left:0.25rem;margin-right:0.25rem;font-size:1.2em;"></iconify-icon> Jakarta International Stadium</div>`;
            }
            infoDiv.className = 'text-muted small mt-1';
            
            if (koridorDataEntry.directionalNotes && koridorDataEntry.directionalNotes[halte]) {
                infoDiv.innerHTML += `<div class="d-flex align-items-center"><iconify-icon inline icon="mdi:information-outline" class="me-1"></iconify-icon> ${koridorDataEntry.directionalNotes[halte]}</div>`;
            }

            if(integrasi){
                integrasi.forEach(item => {
                    let icon = '';
                    if (item.tipe === 'KRL') icon = '<iconify-icon inline icon="jam:train" class="ms-1" style="color:#1976d2;font-size:1.2em;"></iconify-icon>';
                    if (item.tipe === 'MRT') icon = '<iconify-icon inline icon="pepicons-pop:train-circle" class="ms-1" style="color:#43a047;font-size:1.2em;"></iconify-icon>';
                    if (item.tipe === 'LRT') icon = '<iconify-icon inline icon="icon-park-solid:train" class="ms-1" style="color:#f57c00;font-size:1.2em;"></iconify-icon>';
                    infoDiv.innerHTML += `<div class="d-flex align-items-center">${icon} ${item.nama}</div>`;
                });
            }

            left.appendChild(halteInfoContainer);
            if(infoDiv.innerHTML) {
                left.appendChild(infoDiv);
            }
            
            const badges = document.createElement('div');
            badges.className = "d-flex flex-wrap gap-1";
            badges.style.cssText = "flex-shrink: 0; max-width: 100%; justify-content: flex-end;";

            const servicesAndKoridors = getServicesAndKoridorsByHalte(halte);
            servicesAndKoridors.forEach(({ service: svc, koridor: kor }) => {
                if (kor !== koridor) {
                    const badge = createKoridorBadge(svc, kor);
                    badges.appendChild(badge);
                }
            });
            
            if (integrasiBadge[halte]) {
                integrasiBadge[halte].forEach(kor => {
                    if (kor !== koridor) {
                        const badge = createKoridorBadge("BRT", kor);
                        badges.appendChild(badge);
                    }
                });
            }

            listItem.appendChild(left);
            listItem.appendChild(badges);
            
            // Style default logo sponsor
            const DEFAULT_SPONSOR_LOGO_STYLE = 'height: 60px; width: auto; max-width: 90px; position: absolute; top: 50%; right: 12px; transform: translateY(-50%); z-index: 0; opacity: 0.3; pointer-events: none; filter: drop-shadow(0 1px 4px #0002); object-fit: contain;';
            if (typeof halteSponsorLogo !== 'undefined' && halteSponsorLogo[halte] && halteSponsorLogo[halte].img) {
                const sponsorImg = document.createElement('img');
                sponsorImg.src = halteSponsorLogo[halte].img;
                sponsorImg.alt = halteSponsorLogo[halte].alt || '';
                sponsorImg.title = halteSponsorLogo[halte].alt || '';
                sponsorImg.style = (halteSponsorLogo[halte].style || DEFAULT_SPONSOR_LOGO_STYLE) + ';position:absolute;top:50%;right:12px;transform:translateY(-50%);z-index:0;';
                sponsorImg.className = 'halte-sponsor-logo';
                listItem.style.position = 'relative';
                listItem.insertBefore(sponsorImg, listItem.firstChild);
            }
            
            resultsContainer.appendChild(listItem);
        });
    } // ... existing code ...
 else if (service === "Non-BRT" || service === "TransJabodetabek") {
    // --- CLEANUP: Remove ALL previous direction buttons and halte list ---
    resultsContainer.querySelectorAll('.nonbrt-arah-div').forEach(el => el.remove());
    resultsContainer.querySelectorAll('.nonbrt-haltes-list').forEach(el => el.remove());

    // --- Render direction buttons ---
        const arahDiv = document.createElement('div');
    arahDiv.className = 'd-flex flex-wrap gap-2 justify-content-center mb-2 nonbrt-arah-div';
        const forwardBtn = document.createElement('button');
        forwardBtn.className = 'btn btn-sm rounded-5 direction-btn active';
        forwardBtn.setAttribute('data-direction', 'forward');
        forwardBtn.style.background = getKoridorBadgeColor(koridor);
        forwardBtn.style.color = 'white';
        forwardBtn.style.border = 'none';
        forwardBtn.style.minWidth = '150px';
        forwardBtn.style.padding = '8px 16px';
        forwardBtn.innerHTML = `${koridorDataEntry.start} <iconify-icon inline icon="ei:arrow-left"></iconify-icon>`;
        const backwardBtn = document.createElement('button');
        backwardBtn.className = 'btn btn-sm rounded-5 direction-btn';
        backwardBtn.setAttribute('data-direction', 'backward');
        backwardBtn.style.background = 'transparent';
        backwardBtn.style.color = getKoridorBadgeColor(koridor);
        backwardBtn.style.border = `2px solid ${getKoridorBadgeColor(koridor)}`;
        backwardBtn.style.minWidth = '150px';
        backwardBtn.style.padding = '8px 16px';
        backwardBtn.innerHTML = `<iconify-icon inline icon="ei:arrow-right"></iconify-icon> ${koridorDataEntry.end}`;
        arahDiv.appendChild(forwardBtn);
        arahDiv.appendChild(backwardBtn);
        resultsContainer.appendChild(arahDiv);

    // --- Render halte list container ---
    let haltesListDiv = document.createElement('div');
        haltesListDiv.id = `haltesList-${koridor}`;
    haltesListDiv.className = 'mt-3 nonbrt-haltes-list';
        resultsContainer.appendChild(haltesListDiv);

    // --- Direction logic ---
    const getDirectionHaltes = (direction) => {
        if (koridorDataEntry.directions) {
            if (direction === 'forward') {
                if (Array.isArray(koridorDataEntry.directions[koridorDataEntry.start])) {
                    return koridorDataEntry.directions[koridorDataEntry.start];
                } else {
                    return koridorDataEntry.haltes;
                }
            } else {
                if (Array.isArray(koridorDataEntry.directions[koridorDataEntry.end])) {
                    return koridorDataEntry.directions[koridorDataEntry.end];
                } else {
                    return [...koridorDataEntry.haltes].reverse();
                }
            }
        } else {
            return direction === 'forward' ? koridorDataEntry.haltes : [...koridorDataEntry.haltes].reverse();
        }
    };

    // --- Inline showHaltes ---
    const showHaltesInline = (start, end, haltes, highlightHalte = null) => {
        const container = document.getElementById(`haltesList-${koridor}`);
        if (!container) return;
        const halteList = haltes.map((halte, index) => {
            const isKRL = typeof halteKRL !== 'undefined' && halteKRL.includes(halte);
            const isMRT = typeof halteMRT !== 'undefined' && halteMRT.includes(halte);
            const halteLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Halte Transjakarta ' + halte)}`;
            const servicesAndKoridors = typeof getServicesAndKoridorsByHalte !== 'undefined' ? getServicesAndKoridorsByHalte(halte) : [];
            const highlightStyle = (highlightHalte && halte === highlightHalte) ? 'background:#ffe066;box-shadow:0 0 0 2px #ffd700;' : '';
            return `
                <tr style="background: transparent; border-left: none; border-right: none;${highlightStyle}">
                    <td class="align-middle" style="width: 50px; background: transparent; border-left: none; border-right: none;">
                        <span class="badge rounded-circle" style="background:${getKoridorBadgeColor(koridor)}; color:white; width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.9rem; border-radius:50%;">
                            ${String(index + 1).padStart(2, '0')}
                        </span>
                    </td>
                    <td class="align-middle" style="width: 100%; background: transparent; border-left: none; border-right: none;">
                        <a href="${halteLink}" target="_blank" class="text-decoration-none text-dark d-block text-start" style="font-size: 0.875rem;">
                            ${halte}
                            ${isKRL ? ' <iconify-icon inline icon=\"jam:train\"></iconify-icon>' : ''}
                            ${isMRT ? ' <iconify-icon inline icon=\"pepicons-pop:train-circle\"></iconify-icon>' : ''}
                        </a>
                    </td>
                    <td class="align-middle" style="width: 120px; text-align: right; background: transparent; border-left: none; border-right: none;">
                        <div class="d-flex flex-wrap gap-1 justify-content-end" style="min-width: 120px;">
                            ${servicesAndKoridors.map(({ service, koridor: kor }) => {
                                if (kor !== koridor) {
                                    return `<span class=\"badge rounded-circle badge-koridor-interaktif\" style=\"background:${getKoridorBadgeColor(kor)}; color:white; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; font-weight:bold; font-size:0.7rem; border-radius:50%; cursor:pointer;\" onclick=\"window.selectKoridor('${service}', '${kor}')\">${kor}</span>`;
                                }
                                return '';
                            }).join('')}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        container.innerHTML = `
            <div class=\"text-center mb-3\">
                <div class=\"fw-bold mb-2\">Arah: ${start}</div>
            </div>
            <div class=\"table-responsive\">
                <table class=\"table table-bordered mb-0\" style=\"width: 100%; background: transparent; border-left: none; border-right: none;\">
                    <tbody style=\"border-left: none; border-right: none;\">
                        ${halteList}
                    </tbody>
                </table>
            </div>
        `;
    };

    // --- Event handler tombol arah ---
        const showDirection = (direction) => {
        // Simpan arah terakhir ke localStorage
        localStorage.setItem('lastDirection_' + koridor, direction);
            forwardBtn.classList.remove('active');
            backwardBtn.classList.remove('active');
            forwardBtn.style.background = 'transparent';
            forwardBtn.style.color = getKoridorBadgeColor(koridor);
            forwardBtn.style.border = `2px solid ${getKoridorBadgeColor(koridor)}`;
            backwardBtn.style.background = 'transparent';
            backwardBtn.style.color = getKoridorBadgeColor(koridor);
            backwardBtn.style.border = `2px solid ${getKoridorBadgeColor(koridor)}`;
        let start, end;
            if (direction === 'forward') {
                forwardBtn.classList.add('active');
                forwardBtn.style.background = getKoridorBadgeColor(koridor);
                forwardBtn.style.color = 'white';
                forwardBtn.style.border = 'none';
            start = koridorDataEntry.start;
            end = koridorDataEntry.end;
            } else {
                backwardBtn.classList.add('active');
                backwardBtn.style.background = getKoridorBadgeColor(koridor);
                backwardBtn.style.color = 'white';
                backwardBtn.style.border = 'none';
            start = koridorDataEntry.end;
            end = koridorDataEntry.start;
            }
        const haltesArr = getDirectionHaltes(direction);
        showHaltesInline(start, end, haltesArr, highlightHalte || null);
        };
        forwardBtn.onclick = () => showDirection('forward');
        backwardBtn.onclick = () => showDirection('backward');
    // Restore arah terakhir jika ada
    const lastDirection = localStorage.getItem('lastDirection_' + koridor);
    if (lastDirection === 'backward') {
        setTimeout(() => showDirection('backward'), 0);
    } else {
        setTimeout(() => showDirection('forward'), 0);
    }
}
// ... existing code ...
    getJurusan(koridor, service);
}

// Fungsi untuk memilih koridor ketika badge diklik
window.selectKoridor = function(service, koridor) {
    // Update service select to match the selected service
    const serviceSelect = document.getElementById('serviceSelect');
    serviceSelect.value = service;
    
    // Update koridor options based on selected service
    updateKoridorOptions();
    
    // Set the koridor select value and display results
    setTimeout(() => {
        const koridorSelect = document.getElementById('koridorSelect');
        koridorSelect.value = koridor;
        saveKoridorState(service, koridor);
        displayKoridorResults(service, koridor);
        // Scroll ke elemen jurusan (bukan koridorResults)
        const jurusanSection = document.getElementById('jurusan');
        if (jurusanSection) {
            const offset = 0;
            const elementPosition = jurusanSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }, 100);
}

// Fungsi untuk mencari layanan dan koridor


// Fungsi untuk menampilkan hasil pencarian


// Helper: Normalisasi nama halte (case-insensitive, hilangkan spasi ekstra)
function normalizeHalteName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Helper: Cari nama halte asli dari input user (case-insensitive)
function findRealHalteName(input) {
    const normInput = normalizeHalteName(input);
    for (const halte of getAllHalteNames()) {
        if (normalizeHalteName(halte) === normInput) return halte;
    }
    return input; // fallback, biar error handling tetap jalan
}

function findRoutePanduan(halteAsal, halteTujuan) {
    halteAsal = findRealHalteName(halteAsal);
    halteTujuan = findRealHalteName(halteTujuan);
    // 0. Cek apakah halteAsal dan halteTujuan terhubung langsung via integrasi
    const isLangsungIntegrasi = halteIntegrasi.some(([h1, h2]) =>
        (h1 === halteAsal && h2 === halteTujuan) || (h1 === halteTujuan && h2 === halteAsal)
    );
    if (isLangsungIntegrasi) {
        return `Jalan kaki dari ${halteAsal} ke ${halteTujuan}.`;
    }

    // 1. Cari koridor yang langsung menghubungkan kedua halte
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, data] of Object.entries(koridors)) {
            if (data.haltes.includes(halteAsal) && data.haltes.includes(halteTujuan)) {
                return `Naik ${service} Koridor ${koridor} langsung dari ${halteAsal} ke ${halteTujuan}.`;
            }
        }
    }

    // 2. Jika tidak ada koridor langsung, cari transit
    // Buat daftar: halteAsal ada di koridor mana saja, halteTujuan ada di koridor mana saja
    const asalKoridorList = [];
    const tujuanKoridorList = [];
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, data] of Object.entries(koridors)) {
            if (data.haltes.includes(halteAsal)) asalKoridorList.push({ service, koridor, haltes: data.haltes });
            if (data.haltes.includes(halteTujuan)) tujuanKoridorList.push({ service, koridor, haltes: data.haltes });
        }
    }

    // 3. Cari halte transit yang sama di dua koridor berbeda
    for (const asal of asalKoridorList) {
        for (const tujuan of tujuanKoridorList) {
            if (asal.service === tujuan.service && asal.koridor === tujuan.koridor) continue; // Sudah dicek di atas
            // Cari halte transit yang sama
            const halteTransit = asal.haltes.find(h => tujuan.haltes.includes(h));
            if (halteTransit) {
                return `Naik ${asal.service} Koridor ${asal.koridor} dari ${halteAsal} ke ${halteTransit}, lalu transit ke ${tujuan.service} Koridor ${tujuan.koridor} menuju ${halteTujuan}.`;
            }
        }
    }

    return "Rute tidak ditemukan atau transit lebih dari satu kali diperlukan.";
}

// Fungsi BFS multi-transit: return array langkah detail
function findRoutePanduanMultiTransit(halteAsal, halteTujuan) {
    halteAsal = findRealHalteName(halteAsal);
    halteTujuan = findRealHalteName(halteTujuan);
    // Cek integrasi langsung
    const isLangsungIntegrasi = halteIntegrasi.some(([h1, h2]) =>
        (h1 === halteAsal && h2 === halteTujuan) || (h1 === halteTujuan && h2 === halteAsal)
    );
    if (isLangsungIntegrasi) {
        return [{
            type: 'walk',
            from: halteAsal,
            to: halteTujuan,
            info: 'integrasi halte'
        }];
    }
    // Build halte graph
    const halteGraph = {};
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, data] of Object.entries(koridors)) {
            for (let i = 0; i < data.haltes.length; i++) {
                const halte = data.haltes[i];
                if (!halteGraph[halte]) halteGraph[halte] = [];
                if (i > 0) {
                    halteGraph[halte].push({ halteTujuan: data.haltes[i - 1], service, koridor });
                }
                if (i < data.haltes.length - 1) {
                    halteGraph[halte].push({ halteTujuan: data.haltes[i + 1], service, koridor });
                }
            }
        }
    }
    // Integrasi jalan kaki
    halteIntegrasi.forEach(([h1, h2, keterangan]) => {
        if (!halteGraph[h1]) halteGraph[h1] = [];
        if (!halteGraph[h2]) halteGraph[h2] = [];
        halteGraph[h1].push({ halteTujuan: h2, service: "Integrasi", koridor: keterangan || "Integrasi" });
        halteGraph[h2].push({ halteTujuan: h1, service: "Integrasi", koridor: keterangan || "Integrasi" });
    });
    // BFS dengan prioritas transit paling sedikit
    const queue = [{
        halte: halteAsal,
        path: [{ halte: halteAsal, service: null, koridor: null }],
        service: null,
        koridor: null,
        transitCount: 0
    }];
    // Visited key: halte|service|koridor|transitCount
    const visited = new Set([`${halteAsal}|null|null|0`]);
    while (queue.length > 0) {
        // Ambil node dengan transit paling sedikit (sort queue)
        queue.sort((a, b) => a.transitCount - b.transitCount);
        const { halte, path, service: currService, koridor: currKoridor, transitCount } = queue.shift();
        if (halte === halteTujuan) {
            // Build steps array, transit selalu muncul di halte transit
            let steps = [];
            for (let i = 1; i < path.length; i++) {
                const prev = path[i - 1];
                const curr = path[i];
                // Jalan kaki (integrasi)
                if (curr.service === "Integrasi") {
                    steps.push({
                        type: 'walk',
                        from: prev.halte,
                        to: curr.halte,
                        info: curr.koridor && curr.koridor !== 'Integrasi' ? curr.koridor : null
                    });
                } else {
                    // Jika pertama kali naik, atau ganti service/koridor
                    if (!prev.service || prev.service !== curr.service || prev.koridor !== curr.koridor) {
                        // Jika bukan langkah pertama, tambahkan transit di halte prev.halte
                        if (steps.length > 0 && steps[steps.length - 1].type === 'ride') {
                            steps.push({
                                type: 'transit',
                                at: prev.halte,
                                fromService: prev.service,
                                fromKoridor: prev.koridor,
                                toService: curr.service,
                                toKoridor: curr.koridor
                            });
                        }
                        // Mulai naik baru
                        steps.push({
                        type: 'ride',
                        service: curr.service,
                        koridor: curr.koridor,
                        from: prev.halte,
                        to: curr.halte
                        });
                } else {
                        // Lanjut di koridor yang sama, update tujuan
                        if (steps.length > 0 && steps[steps.length - 1].type === 'ride') {
                            steps[steps.length - 1].to = curr.halte;
                        }
                    }
                }
            }
            return steps;
        }
        // Prioritas: lanjut di koridor sama, lalu integrasi
        const neighbors = halteGraph[halte] || [];
        const sortedNeighbors = neighbors.sort((a, b) => {
            if (currService === a.service && currKoridor === a.koridor) return -1;
            if (currService === b.service && currKoridor === b.koridor) return 1;
            if (a.service === "Integrasi") return -1;
            if (b.service === "Integrasi") return 1;
            return 0;
        });
        for (const next of sortedNeighbors) {
            // Cek agar tidak loop: halte tujuan tidak boleh sudah ada di path
            if (path.some(p => p.halte === next.halteTujuan)) continue;
            // PATCH: Cek aturan halteDirectionRules jika ada
            const koridorEntry = koridorData[next.service]?.[next.koridor];
            if (koridorEntry && koridorEntry.halteDirectionRules && koridorEntry.halteDirectionRules[next.halteTujuan]) {
                const now = new Date();
                const jam = now.getHours();
                const rules = koridorEntry.halteDirectionRules[next.halteTujuan];
                let allowed = false;
                for (const rule of rules) {
                    if (rule.time[0] < rule.time[1]) {
                        // Pagi/siang
                        if (jam >= rule.time[0] && jam < rule.time[1]) {
                            if (path[path.length-1].halte === rule.onlyAccessibleVia) allowed = true;
                        }
                    } else {
                        // Malam (misal 22-5)
                        if (jam >= rule.time[0] || jam < rule.time[1]) {
                            if (path[path.length-1].halte === rule.onlyAccessibleVia) allowed = true;
                        }
                    }
                }
                if (!allowed) continue;
            }
            // Hitung transit baru jika pindah service/koridor
            let nextTransitCount = transitCount;
            if (currService && (next.service !== currService || next.koridor !== currKoridor) && next.service !== "Integrasi") {
                nextTransitCount++;
            }
            // Visited key: halte|service|koridor|transitCount
            let nextKey = `${next.halteTujuan}|${next.service}|${next.koridor}|${nextTransitCount}`;
            if (!visited.has(nextKey)) {
                queue.push({
                    halte: next.halteTujuan,
                    path: [...path, { halte: next.halteTujuan, service: next.service, koridor: next.koridor }],
                    service: next.service,
                    koridor: next.koridor,
                    transitCount: nextTransitCount
                });
                visited.add(nextKey);
            }
        }
    }
    return null;
}

// Fungsi render array langkah ke HTML step-by-step
function renderRouteStepsToHTML(steps) {
    if (!steps || !Array.isArray(steps) || steps.length === 0) return '<div class="text-danger">Rute tidak ditemukan.</div>';
    let html = '<ol>';
    steps.forEach(step => {
        if (step.type === 'ride') {
            html += `<li>Naik <b>${step.service} Koridor <span class="badge badge-koridor-interaktif" style="background:${getKoridorBadgeColor(step.koridor)};color:#fff;cursor:pointer;" onclick="window.selectKoridor('${step.service}','${step.koridor}')">${step.koridor}</span></b> dari <b>${step.from}</b> ke <b>${step.to}</b></li>`;
        } else if (step.type === 'walk') {
            html += `<li>Jalan kaki dari <b>${step.from}</b> ke <b>${step.to}</b>${step.info ? ` <span class='text-muted'>(${step.info})</span>` : ''}</li>`;
        } else if (step.type === 'transit') {
            html += `<li>Transit di <b>${step.at}</b> dari <b>${step.fromService} Koridor <span class=\"badge badge-koridor-interaktif\" style=\"background:${getKoridorBadgeColor(step.fromKoridor)};color:#fff;cursor:pointer;\" onclick=\"window.selectKoridor('${step.fromService}','${step.fromKoridor}')\">${step.fromKoridor}</span></b> ke <b>${step.toService} Koridor <span class=\"badge badge-koridor-interaktif\" style=\"background:${getKoridorBadgeColor(step.toKoridor)};color:#fff;cursor:pointer;\" onclick=\"window.selectKoridor('${step.toService}','${step.toKoridor}')\">${step.toKoridor}</span></b></li>`;
        }
    });
    html += '</ol>';
    return html;
}

function findRouteKoridorUtama(halteAsal, halteTujuan) {
    // Buat graph hanya dari koridor utama (tanpa huruf)
    const halteGraph = {};
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, data] of Object.entries(koridors)) {
            if (!/^[0-9]+$/.test(koridor)) continue; // Hanya angka saja
            for (let i = 0; i < data.haltes.length; i++) {
                const halte = data.haltes[i];
                if (!halteGraph[halte]) halteGraph[halte] = [];
                if (i > 0) {
                    halteGraph[halte].push({ halteTujuan: data.haltes[i - 1], service, koridor });
                }
                if (i < data.haltes.length - 1) {
                    halteGraph[halte].push({ halteTujuan: data.haltes[i + 1], service, koridor });
                }
            }
        }
    }
    // BFS
    const queue = [{
        halte: halteAsal,
        path: [{ halte: halteAsal, service: null, koridor: null }],
        service: null,
        koridor: null
    }];
    const visited = new Set([`${halteAsal}|`]);
    while (queue.length > 0) {
        const { halte, path, service: currService, koridor: currKoridor } = queue.shift();
        if (halte === halteTujuan) {
            // Format hasil rute
            let result = "";
            for (let i = 1; i < path.length; i++) {
                const prev = path[i - 1];
                const curr = path[i];
                if (
                    !prev.service ||
                    prev.service !== curr.service ||
                    prev.koridor !== curr.koridor
                ) {
                    if (result) {
                        result += ", lanjut naik ";
                    } else {
                        result += "Naik ";
                    }
                    result += `${curr.service} Koridor ${curr.koridor} dari ${prev.halte} ke `;
                }
                if (
                    i === path.length - 1 ||
                    curr.service !== path[i + 1]?.service ||
                    curr.koridor !== path[i + 1]?.koridor
                ) {
                    result += `${curr.halte}`;
                }
            }
            result += ".";
            return result;
        }
        for (const next of halteGraph[halte] || []) {
            let nextKey = `${next.halteTujuan}|${next.service}|${next.koridor}`;
            if (!visited.has(nextKey)) {
                if (next.service === "Integrasi") {
                    queue.unshift({
                        halte: next.halteTujuan,
                        path: [...path, { halte: next.halteTujuan, service: next.service, koridor: next.koridor }],
                        service: next.service,
                        koridor: next.koridor
                    });
                } else if (currService === next.service && currKoridor === next.koridor) {
                    queue.unshift({
                        halte: next.halteTujuan,
                        path: [...path, { halte: next.halteTujuan, service: next.service, koridor: next.koridor }],
                        service: next.service,
                        koridor: next.koridor
                    });
                } else {
                    queue.push({
                        halte: next.halteTujuan,
                        path: [...path, { halte: next.halteTujuan, service: next.service, koridor: next.koridor }],
                        service: next.service,
                        koridor: next.koridor
                    });
                }
                visited.add(nextKey);
            }
        }
    }
    return "Rute utama (tanpa huruf) tidak ditemukan.";
}

function getAllHalteNames() {
    const halteSet = new Set();
    for (const koridors of Object.values(koridorData)) {
        for (const koridorInfo of Object.values(koridors)) {
            koridorInfo.haltes.forEach(halte => halteSet.add(halte));
        }
    }
    return Array.from(halteSet);
}

function populateHalteDatalist() {
    const halteList = document.getElementById('halteList');
    halteList.innerHTML = '';
    getAllHalteNames().forEach(halte => {
        const option = document.createElement('option');
        option.value = halte;
        halteList.appendChild(option);
    });
}

// Panggil fungsi ini sekali saat halaman dimuat
populateHalteDatalist();

// Event listeners
document.getElementById('serviceSelect').addEventListener('change', function() {
    updateKoridorOptions();
    const koridor = document.getElementById('koridorSelect').value;
    if (koridor) {
        displayKoridorResults(this.value, koridor);
    }
});

document.getElementById('koridorSelect').addEventListener('change', function() {
    const service = document.getElementById('serviceSelect').value;
    window.selectKoridor(service, this.value);
});

document.getElementById('searchInput').addEventListener('input', function () {
    displaySearchResults(this.value);
});



document.getElementById('cariRuteBtn').addEventListener('click', function () {
    const asal = document.getElementById('halteAsalInput').value.trim();
    const tujuan = document.getElementById('halteTujuanInput').value.trim();
    const hasilDiv = document.getElementById('hasilRute');
    hasilDiv.innerHTML = ""; // Kosongkan dulu

    if (!asal || !tujuan) {
        hasilDiv.textContent = "Silakan isi kedua nama halte.";
        return;
    }
    if (asal.toLowerCase() === tujuan.toLowerCase()) {
        hasilDiv.textContent = "Rute tidak boleh sama!";
        return;
    }

    // Selalu gunakan BFS multi-transit agar hasil konsisten langkah-langkah
    let steps = findRoutePanduanMultiTransit(asal, tujuan);

    // Jika tidak ada rute multi-transit, cek rute khusus (misal AMARI)
    if (!steps || !Array.isArray(steps) || steps.length === 0) {
        const khusus = findRouteKhusus(asal, tujuan);
        if (khusus) {
            // Konversi string ke satu langkah ride
            steps = [{
                type: 'ride',
                service: 'BRT',
                koridor: 'AMARI',
                from: asal,
                to: tujuan,
                info: khusus
            }];
        }
    }

    if (steps && Array.isArray(steps) && steps.length > 0) {
                hasilDiv.innerHTML = renderRouteStepsToHTML(steps);
            } else {
                hasilDiv.innerHTML = '<div class="text-danger">Rute tidak ditemukan.</div>';
            }

            // Tambahkan peringatan jika ada koridor huruf di luar jam operasional
            const warning = peringatanKoridorHurufPadaRute(hasilDiv.innerHTML, asal, tujuan);
            if (warning) {
                hasilDiv.insertAdjacentHTML('beforeend', warning);
    }
});

// Fungsi untuk menentukan warna badge berdasarkan nomor koridor


function createKoridorBadge(service, koridor, showMapOnClick = false) {
    const badge = document.createElement('span');
    badge.textContent = koridor;
    badge.title = `Lihat daftar halte Koridor ${koridor}`;
    badge.style.backgroundColor = getKoridorBadgeColor(koridor);
    badge.style.color = "#fff";
    badge.style.width = "24px";
    badge.style.height = "24px";
    badge.style.display = "inline-flex";
    badge.style.alignItems = "center";
    badge.style.justifyContent = "center";
    badge.style.borderRadius = "50%";
    badge.style.fontWeight = "bold";
    badge.style.fontSize = "0.7rem";
    badge.style.cursor = "pointer";
    badge.style.margin = "0 4px";
    badge.classList.add('badge-koridor-interaktif');
    if (showMapOnClick) {
        badge.onclick = (e) => {
            e.stopPropagation();
            if (koridorData[service]?.[koridor] && koridorData[service][koridor].map) {
                showMapKoridorModal(service, koridor);
            } else {
                alert('Peta koridor belum tersedia untuk koridor ini.');
            }
        };
    } else {
        badge.onclick = () => selectKoridor(service, koridor);
    }
    return badge;
}

//jam
function updateLiveClock() {
    const clock = document.getElementById('liveClock');
    if (!clock) return;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    clock.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

// Panggil updateKoridorOptions saat halaman dimuat
document.addEventListener('DOMContentLoaded', function() {
    updateKoridorOptions();
    const koridorState = loadKoridorState();
    if (koridorState && koridorState.service && koridorState.koridor) {
        // Jangan panggil displayKoridorResults dua kali
        window.selectKoridor(koridorState.service, koridorState.koridor);
    }
});

function isKoridorHuruf(koridor) {
    // Cek apakah koridor mengandung angka lalu huruf (misal: 2A, 4K, 10D)
    return /^[0-9]+[A-Z]$/i.test(koridor);
}

function isWaktuDiluarOperasional() {
    const now = new Date();
    const jam = now.getHours() + now.getMinutes()/60;
    return (jam < 5 || jam >= 22);
}

// Fungsi untuk mengecek dan memberi peringatan jika ada koridor huruf di luar jam operasional
function peringatanKoridorHurufPadaRute(teksRute, asal, tujuan) {
    const koridorRegex = /Koridor\s+([0-9]+[A-Z])/gi;
    let match, adaKoridorHuruf = false;
    while ((match = koridorRegex.exec(teksRute)) !== null) {
        adaKoridorHuruf = true;
        break;
    }
    if (adaKoridorHuruf && isWaktuDiluarOperasional()) {
        // Tombol custom style
        return `<div class="alert alert-danger mt-2 py-2 small">
            ⚠️ <b>Perhatian:</b> Koridor dengan kode huruf di belakang angka (misal 2A, 4K, 5C, 10D, dst) hanya beroperasi pukul <b>05.00–22.00</b>. Pastikan waktu perjalanan Anda!
        </div>
        <button id="btnGrandAmari" class="btn btn-outline-warning btn-sm rounded-5 mb-2 px-4 py-2 fw-bold">Gunakan Grand AMARI (Lebih Jauh)</button>
        <div id="grandAmariResult"></div>`;
    }
    return "";
}

function formatRute(path) {
    let result = "";
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        if (
            !prev.service ||
            prev.service !== curr.service ||
            prev.koridor !== curr.koridor
        ) {
            if (curr.service === "Integrasi") {
                result += (result ? ", lalu " : "") + `Jalan kaki dari ${prev.halte} ke `;
            } else {
                if (result) {
                    result += ", lanjut naik ";
                } else {
                    result += "Naik ";
                }
                result += `${curr.service} Koridor ${curr.koridor} dari ${prev.halte} ke `;
            }
        }
        if (
            i === path.length - 1 ||
            curr.service !== path[i + 1]?.service ||
            curr.koridor !== path[i + 1]?.koridor
        ) {
            result += `${curr.halte}`;
        }
    }
    result += ".";
    return result;
}

function findRouteKhusus(halteAsal, halteTujuan) {
    halteAsal = findRealHalteName(halteAsal);
    halteTujuan = findRealHalteName(halteTujuan);
    // Cek apakah kedua halte ada di koridor AMARI
    const amariKoridors = [];
    for (const [service, koridors] of Object.entries(koridorData)) {
        for (const [koridor, data] of Object.entries(koridors)) {
            if (data.isAMARI && data.haltes.includes(halteAsal) && data.haltes.includes(halteTujuan)) {
                amariKoridors.push({ service, koridor });
            }
        }
    }

    if (amariKoridors.length > 0) {
        const { service, koridor } = amariKoridors[0];
        return `Naik ${service} Koridor ${koridor} (AMARI) langsung dari ${halteAsal} ke ${halteTujuan}.`;
    }

    // Daftar rute khusus dengan patokan halte integrasi
    const ruteKhusus = {
        "Blok M-Pulo Gebang": {
            asal: "Blok M",
            tujuan: "Pulo Gebang",
            patokanIntegrasi: [
                { 
                    halte: "ASEAN",
                    integrasi: "Kejaksaan Agung",
                    koridor: "4K",
                    keterangan: "JPO Integrasi",
                    tujuan: "Flyover Jatinegara"
                },
                {
                    halte: "Flyover Jatinegara",
                    koridor: "11"
                }
            ]
        },
        "Pulo Gebang-Blok M": {
            asal: "Pulo Gebang",
            tujuan: "Blok M",
            patokanIntegrasi: [
                {
                    halte: "Flyover Jatinegara",
                    koridor: "11"
                },
                {
                    halte: "Kejaksaan Agung",
                    integrasi: "ASEAN",
                    koridor: "4K",
                    keterangan: "JPO Integrasi",
                }
            ]
        }
    };

    // Cek apakah ada rute khusus untuk pasangan halte ini
    for (const [key, data] of Object.entries(ruteKhusus)) {
        // Cek apakah halte asal sesuai
        if (data.asal === halteAsal) {
            // Cek apakah halte tujuan ada di koridor terakhir
            const koridorTerakhir = data.patokanIntegrasi[data.patokanIntegrasi.length - 1].koridor;
            const koridorDataTerakhir = koridorData["BRT"][koridorTerakhir] || koridorData["Non-BRT"][koridorTerakhir];
            
            if (koridorDataTerakhir && koridorDataTerakhir.haltes.includes(halteTujuan)) {
                let result = "";
                let currentHalte = halteAsal;

                // Proses setiap patokan integrasi
                for (const patokan of data.patokanIntegrasi) {
                    if (patokan.integrasi) {
                        // Ada integrasi jalan kaki
                        result += `Naik BRT Koridor 1 dari ${currentHalte} ke ${patokan.halte}, `;
                        result += `lalu jalan kaki ke ${patokan.integrasi} (${patokan.keterangan}), `;
                        currentHalte = patokan.integrasi;
                        // Tambahkan naik koridor setelah integrasi
                        result += `lanjut naik Non-BRT Koridor ${patokan.koridor} ke ${patokan.tujuan}, `;
                    } else {
                        // Lanjut ke koridor berikutnya
                        result += `lanjut naik BRT Koridor ${patokan.koridor} ke ${halteTujuan}`;
                    }
                }
                return result + ".";
            }
        }
    }

    return null;
}

// Fungsi untuk menyimpan dan mengambil state koridor terakhir
function saveKoridorState(service, koridor) {
    localStorage.setItem('koridorState', JSON.stringify({ service, koridor }));
}
function loadKoridorState() {
    try {
        return JSON.parse(localStorage.getItem('koridorState'));
    } catch {
        return null;
    }
}
function clearKoridorState() {
    localStorage.removeItem('koridorState');
}

// Saat halaman dimuat, cek state koridor terakhir dan tampilkan jika ada
window.addEventListener('DOMContentLoaded', function() {
    updateKoridorOptions();
    const koridorState = loadKoridorState();
    if (koridorState && koridorState.service && koridorState.koridor) {
        // Jangan panggil displayKoridorResults dua kali
        window.selectKoridor(koridorState.service, koridorState.koridor);
    }
});

// Custom dropdown koridor dengan badge dan jurusan
function renderCustomKoridorDropdown() {
    const koridorSelect = document.getElementById('koridorSelect');
    const serviceSelect = document.getElementById('serviceSelect');
    if (!koridorSelect || !serviceSelect) return;

    // Sembunyikan <select> asli
    koridorSelect.style.display = 'none';

    // Hapus dropdown custom lama jika ada
    let old = document.getElementById('customKoridorDropdown');
    if (old) old.remove();

    // Buat container
    const container = document.createElement('div');
    container.className = 'dropdown w-100';
    container.id = 'customKoridorDropdown';

    // Tombol utama
    const btn = document.createElement('button');
    btn.className = 'btn btn-outline-m3 rounded-4 dropdown-toggle w-100';
    btn.type = 'button';
    btn.setAttribute('data-bs-toggle', 'dropdown');
    btn.style.textAlign = 'left';
    btn.style.whiteSpace = 'normal';
    btn.style.wordBreak = 'break-word';
    btn.style.maxWidth = '400px';
    // Default text
    btn.innerHTML = '<span class="text-truncate">Pilih Koridor...</span>';
    container.appendChild(btn);

    // List koridor
    const ul = document.createElement('ul');
    ul.className = 'dropdown-menu w-100';
    ul.style.maxHeight = '350px';
    ul.style.overflowY = 'auto';
    ul.style.wordBreak = 'break-word';
    ul.style.whiteSpace = 'normal';
    ul.style.minWidth = '250px';
    ul.style.maxWidth = '400px';

    const selectedService = serviceSelect.value;
    for (const koridor in koridorData[selectedService]) {
        const entry = koridorData[selectedService][koridor];
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'dropdown-item d-flex align-items-start';
        a.href = '#';
        a.style.wordBreak = 'break-word';
        a.style.whiteSpace = 'normal';
        a.style.alignItems = 'flex-start';
        a.style.fontWeight = 'bold';
        // Compose dropdown item (NO operator codes, NO jam operasi)
        a.innerHTML = `<span class=\"badge me-2 flex-shrink-0\" style=\"background:${getKoridorBadgeColor(koridor)};width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.9rem;border-radius:50%;\">${koridor}</span> <span style='display:block;white-space:normal;word-break:break-word;max-width:320px;font-weight:bold;'>${entry.start.toUpperCase()} - ${entry.end.toUpperCase()}</span>`;
        a.onclick = function(e) {
            e.preventDefault();
            // Extract operator codes in parentheses (allow slashes)
            let operatorStr = entry.operator || '';
            let operatorCodes = [];
            if (Array.isArray(operatorStr)) {
                operatorStr = operatorStr.join(', ');
            }
            const regex = /\(([A-Z0-9 /]+)\)/g;
            let match;
            while ((match = regex.exec(operatorStr)) !== null) {
                operatorCodes.push(match[1]);
            }
            // Get operational time
            let jamOperasi = '05:00 - 22:00';
            if (entry.isAMARI) {
                jamOperasi = '24 Jam';
            } else if (entry.operationalSchedule && entry.operationalSchedule.weekday && entry.operationalSchedule.weekday.hours) {
                const h = entry.operationalSchedule.weekday.hours;
                if (Array.isArray(h)) {
                    jamOperasi = h.map(slot => `${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00`).join(' | ');
                } else {
                    jamOperasi = `${String(h.start).padStart(2,'0')}:00 - ${String(h.end).padStart(2,'0')}:00`;
                }
            }
            // Set button text with operator codes BELOW jurusan, only after selection
            btn.innerHTML = `
                <span class=\"badge me-2 flex-shrink-0\" style=\"background:${getKoridorBadgeColor(koridor)};width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.9rem;border-radius:50%;\">${koridor}</span>
                <span style='display:block;white-space:normal;word-break:break-word;max-width:320px;font-weight:bold;'>${entry.start.toUpperCase()} - ${entry.end.toUpperCase()}</span>
                <span class='d-block fw-bold text-muted mt-1' style='font-size:1em;margin-top:2px;'>${operatorCodes.map(code => `(${code})`).join(' ')}${operatorCodes.length ? ' - ' : ''}${jamOperasi}</span>
            `;
            koridorSelect.value = koridor;
            saveKoridorState(selectedService, koridor);
            displayKoridorResults(selectedService, koridor);
            // Scroll ke daftar halte
            setTimeout(() => {
                const koridorTitle = document.getElementById('jurusan');
                if (koridorTitle) {
                    koridorTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
            btn.click();
        };
        li.appendChild(a);
        ul.appendChild(li);
    }
    container.appendChild(ul);

    // Sisipkan setelah <select>
    koridorSelect.parentNode.insertBefore(container, koridorSelect.nextSibling);

    // Restore pilihan terakhir jika ada
    const koridorState = loadKoridorState();
    if (koridorState && koridorState.service === selectedService && koridorState.koridor && koridorData[selectedService][koridorState.koridor]) {
        const entry = koridorData[selectedService][koridorState.koridor];
        // Extract operator codes in parentheses (allow slashes)
        let operatorStr = entry.operator || '';
        let operatorCodes = [];
        if (Array.isArray(operatorStr)) {
            operatorStr = operatorStr.join(', ');
        }
        const regex = /\(([A-Z0-9 /]+)\)/g;
        let match;
        while ((match = regex.exec(operatorStr)) !== null) {
            operatorCodes.push(match[1]);
        }
        // Get operational time
        let jamOperasi = '05:00 - 22:00';
        if (entry.isAMARI) {
            jamOperasi = '24 Jam';
        } else if (entry.operationalSchedule && entry.operationalSchedule.weekday && entry.operationalSchedule.weekday.hours) {
            const h = entry.operationalSchedule.weekday.hours;
            if (Array.isArray(h)) {
                jamOperasi = h.map(slot => `${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00`).join(' | ');
            } else {
                jamOperasi = `${String(h.start).padStart(2,'0')}:00 - ${String(h.end).padStart(2,'0')}:00`;
            }
        }
        btn.innerHTML = `
            <span class=\"badge me-2 flex-shrink-0\" style=\"background:${getKoridorBadgeColor(koridorState.koridor)};width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.9rem;border-radius:50%;\">${koridorState.koridor}</span>
            <span style='display:block;white-space:normal;word-break:break-word;max-width:320px;font-weight:bold;'>${entry.start.toUpperCase()} - ${entry.end.toUpperCase()}</span>
            <span class='d-block fw-bold text-muted mt-1' style='font-size:1em;margin-top:2px;'>${operatorCodes.map(code => `(${code})`).join(' ')}${operatorCodes.length ? ' - ' : ''}${jamOperasi}</span>
        `;
        koridorSelect.value = koridorState.koridor;
        displayKoridorResults(selectedService, koridorState.koridor);
        setTimeout(() => {
    const koridorResults = document.getElementById('koridorResults');
    if (koridorResults) {
        // Cari data koridor
        const entry = koridorData[selectedService][koridor];
        // Ambil operator bus (dalam kurung saja)
        let operatorStr = entry.operator || '';
        let operatorCodes = [];
        if (Array.isArray(operatorStr)) {
            operatorStr = operatorStr.join(', ');
        }
        const regex = /\(([A-Z0-9 /]+)\)/g;
        let match;
        while ((match = regex.exec(operatorStr)) !== null) {
            operatorCodes.push(match[1]);
        }
        // Info AMARI
        let jamOperasi = '';
        if (entry.isAMARI) {
            jamOperasi = '<span class="badge bg-info ms-2">24 Jam (AMARI)</span>';
        } else {
            jamOperasi = '<span class="badge bg-secondary ms-2">05.00 - 22.00</span>';
            if (entry.operationalSchedule && entry.operationalSchedule.weekday && entry.operationalSchedule.weekday.hours) {
                const h = entry.operationalSchedule.weekday.hours;
                if (Array.isArray(h)) {
                    jamOperasi = h.map(slot => `<span class='badge bg-secondary ms-2'>${String(slot.start).padStart(2,'0')}:00 - ${String(slot.end).padStart(2,'0')}:00</span>`).join('');
                } else {
                    jamOperasi = `<span class='badge bg-secondary ms-2'>${String(h.start).padStart(2,'0')}:00 - ${String(h.end).padStart(2,'0')}:00</span>`;
                }
            }
        }
        // Sisipkan info di atas daftar halte
        let infoDiv = document.getElementById('koridorOperatorInfo');
        if (!infoDiv) {
            infoDiv = document.createElement('div');
            infoDiv.id = 'koridorOperatorInfo';
            infoDiv.className = 'mb-2';
            koridorResults.parentNode.insertBefore(infoDiv, koridorResults);
        }
        infoDiv.innerHTML =
            (operatorCodes.length ? `<span class='badge bg-warning text-dark me-2'>${operatorCodes.join(', ')}</span>` : '') +
            jamOperasi;
    }
    // Scroll ke judul koridor
    const koridorTitle = document.getElementById('jurusan');
    if (koridorTitle) {
        koridorTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}, 100);
    }

    // Hapus info start/end jika ada
    let infoDiv = document.getElementById('koridorStartEndInfo');
    if (infoDiv) infoDiv.remove();
    let halteListDiv = document.getElementById('customKoridorHalteList');
    if (halteListDiv) halteListDiv.remove();
}

// Panggil custom dropdown saat halaman dimuat
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateKoridorOptions);
} else {
    updateKoridorOptions();
}

// Fungsi untuk menampilkan modal peta koridor dengan navigasi next/prev
function showMapKoridorModal(service, koridor) {
    let modal = null;
    if (!document.getElementById('modalMapKoridor')) {
        const modalHtml = `
        <div class=\"modal fade\" id=\"modalMapKoridor\" tabindex=\"-1\" aria-labelledby=\"modalMapKoridorLabel\" aria-hidden=\"true\">\n                      <div class=\"modal-dialog modal-dialog-centered modal-lg\">\n                        <div class=\"modal-content\">\n                          <div class=\"modal-header\">\n                           <button id=\"modalMapPrevBtn\" class=\"btn btn-outline-dark btn-sm rounded-circle me-2\"><b>&lt;</b></button>\n                            <h5 class=\"modal-title fw-bold plus-jakarta-sans d-flex align-items-center gap-2\" id=\"modalMapKoridorLabel\">Peta Koridor <span id=\"modalKoridorBadge\"></span></h5>\n                            <button id=\"modalMapNextBtn\" class=\"btn btn-outline-dark btn-sm rounded-circle ms-2\"><b>&gt;</b></button>\n                            <button type=\"button\" class=\"btn btn-outline-dark\" data-bs-dismiss=\"modal\" aria-label=\"Tutup\"><iconify-icon inline  icon=\"line-md:close\"></iconify-icon></button>\n                          </div>\n                          <div class=\"modal-body text-center\">\n                            <div id=\"modalKoridorJurusan\" class=\"fw-bold fs-5 mb-2\"></div>\n                            <img id=\"imgMapKoridor\" src=\"\" alt=\"Peta Koridor\" class=\"img-fluid rounded shadow\">\n                          </div>\n                        </div>\n                      </div>\n                    </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    modal = new bootstrap.Modal(document.getElementById('modalMapKoridor'));
    modal.show();
    // Tambahkan event handler next/back agar navigasi berfungsi
    const koridorList = getKoridorListForService(service);
    let idx = koridorList.indexOf(koridor);
    function updateModalKoridor(idxBaru) {
        const koridorBaru = koridorList[idxBaru];
        const koridorEntryBaru = koridorData[service][koridorBaru];
        const badgeSpan = document.getElementById('modalKoridorBadge');
        if (badgeSpan) {
            badgeSpan.innerHTML = `
              <span class=\"pt-sans\" style=\"
                display:inline-flex;
                align-items:center;
                justify-content:center;
                width:32px;
                height:32px;
                border-radius:50%;
                background:${getKoridorBadgeColor(koridorBaru)};
                color:#fff;
                font-weight:bold;
                font-size:1em;
                margin-left:4px;\">
                ${koridorBaru}
              </span>
            `;
        }
        // Update jurusan di modal
        const jurusanDiv = document.getElementById('modalKoridorJurusan');
        if (jurusanDiv) {
            let jurusanText = `${koridorEntryBaru.start} - ${koridorEntryBaru.end}`;
            // Jika ada VIA, pisahkan dan beri text-muted
            const viaMatch = jurusanText.match(/(.*?)( VIA .*)/i);
            if (viaMatch) {
                jurusanDiv.innerHTML = `${viaMatch[1]}<span class='text-muted'>${viaMatch[2]}</span>`;
            } else {
                jurusanDiv.textContent = jurusanText;
            }
        }
        const img = document.getElementById('imgMapKoridor');
        img.src = koridorEntryBaru.map;
        img.alt = `Peta Koridor ${koridorBaru}`;
        const label = document.getElementById('modalMapKoridorLabel');
        if (label) label.childNodes[0].textContent = `Peta Koridor `;
        // Update tombol
        document.getElementById('modalMapPrevBtn').disabled = idxBaru <= 0;
        document.getElementById('modalMapNextBtn').disabled = idxBaru >= koridorList.length - 1;
        idx = idxBaru;
        // Sinkronkan koridor utama di UI
        if (window.selectKoridor) {
            window.selectKoridor(service, koridorBaru);
        }
    }
    setTimeout(() => {
        updateModalKoridor(idx);
        document.getElementById('modalMapPrevBtn').onclick = function() {
            if (idx > 0) updateModalKoridor(idx - 1);
        };
        document.getElementById('modalMapNextBtn').onclick = function() {
            if (idx < koridorList.length - 1) updateModalKoridor(idx + 1);
        };
    }, 10);
}

// Saat badge diklik dan modal akan tampil:
const badgeSpan = document.getElementById('modalKoridorBadge');
if (badgeSpan) {
  badgeSpan.innerHTML = `
    <span style="
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:32px;
      height:32px;
      border-radius:50%;
      background:${getKoridorBadgeColor(koridorNumber)};
      color:#fff;
      font-weight:bold;
      font-size:1em;
      margin-left:4px;">
      ${koridorNumber}
    </span>
  `;
}

// Helper untuk mendapatkan urutan koridor pada layanan tertentu
function getKoridorListForService(service) {
    return Object.keys(koridorData[service] || {});
}

// Helper untuk mendapatkan index koridor saat ini pada layanan tertentu
function getKoridorIndex(service, koridor) {
    const list = getKoridorListForService(service);
    return list.indexOf(koridor);
}

// === UNIFIED SEARCH HANDLER ===
document.addEventListener('DOMContentLoaded', function() {
  const input = document.getElementById('unifiedSearchInput');
  const results = document.getElementById('unifiedSearchResults');
  if (!input || !results) return;

  // Tambahkan style untuk layout badge koridor di bawah nama halte jika overflow (khusus unified search)
  if (!document.getElementById('unified-search-badge-style')) {
    const style = document.createElement('style');
    style.id = 'unified-search-badge-style';
    style.innerHTML = `
      .unified-search-halte-row { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
      .unified-search-halte-main { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; width: 100%; }
      .unified-search-halte-badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
      .unified-search-halte-highlight { background: #ffe066; color: #222; border-radius: 4px; padding: 0 2px; }
      .unified-search-halte-label { font-size: 0.95em; font-weight: 600; margin-left: 4px; }
      #unifiedSearchResults > li { background: rgba(255,255,255,0.7) !important; backdrop-filter: blur(8px); border-radius: 1em; margin-bottom: 6px; box-shadow: 0 2px 8px 0 #0001; transition: background 0.2s; }
      #unifiedSearchResults > li:hover { background: rgba(255,255,255,0.95) !important; }
      .badge-unified-brt { background: #264697; color: #fff; font-weight: 700; font-size: 0.95em; margin-left: 4px; }
      .badge-unified-nonbrt { background: #ff7f00; color: #fff; font-weight: 700; font-size: 0.95em; margin-left: 4px; }
      .badge-unified-tj { background: #4FA8DE; color: #fff; font-weight: 700; font-size: 0.95em; margin-left: 4px; }
    `;
    document.head.appendChild(style);
  }

  input.addEventListener('input', function() {
    const query = input.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!query) return;

    // Cari halte
    const halteMatches = getAllHalteNames().filter(h => h.toLowerCase().includes(query));
    // Cari koridor
    const koridorMatches = [];
    for (const service in koridorData) {
      for (const koridor in koridorData[service]) {
        if (koridor.toLowerCase().includes(query) || koridorData[service][koridor].start.toLowerCase().includes(query) || koridorData[service][koridor].end.toLowerCase().includes(query)) {
          koridorMatches.push({ service, koridor, jurusan: `${koridorData[service][koridor].start} - ${koridorData[service][koridor].end}` });
        }
      }
    }
    // Cari layanan
    const layananMatches = Object.keys(koridorData).filter(l => l.toLowerCase().includes(query));

    // Render hasil
    if (halteMatches.length) {
      const halteHeader = document.createElement('li');
      halteHeader.className = 'list-group-item fw-bold bg-light text-primary';
      halteHeader.textContent = 'Halte';
      results.appendChild(halteHeader);
      halteMatches.slice(0,10).forEach(halte => {
        // Ambil semua koridor yang melewati halte ini
        const koridors = getServicesAndKoridorsByHalte(halte);
        koridors.forEach(({service, koridor}) => {
          const koridorEntry = koridorData[service][koridor];
          const idx = koridorEntry.haltes.indexOf(halte);

          const li = document.createElement('li');
          li.className = 'list-group-item list-group-item-action position-relative';
          // Set background blur sesuai layanan, pakai !important agar tidak di-overwrite
          if (service === 'BRT') {
            li.style.setProperty('background', 'rgba(38, 70, 151, 0.7)', 'important');
          } else if (service === 'Non-BRT') {
            li.style.setProperty('background', 'rgba(255, 127, 0, 0.7)', 'important');
          } else if (service === 'TransJabodetabek') {
            li.style.setProperty('background', 'rgba(47, 164, 73, 0.7)', 'important');
          } else {
            li.style.setProperty('background', 'rgba(255,255,255,0.7)', 'important');
          }
          li.style.setProperty('backdrop-filter', 'blur(8px)', 'important');
          li.style.setProperty('border-radius', '1em', 'important');
          li.style.setProperty('margin-bottom', '6px', 'important');
          li.style.setProperty('box-shadow', '0 2px 8px 0 #0001', 'important');
          li.style.setProperty('transition', 'background 0.2s', 'important');
          li.onmouseenter = function() {
            if (service === 'BRT') {
              li.style.setProperty('background', 'rgba(38, 70, 151, 0.92)', 'important');
            } else if (service === 'Non-BRT') {
              li.style.setProperty('background', 'rgba(255, 127, 0, 0.92)', 'important');
            } else if (service === 'TransJabodetabek') {
              li.style.setProperty('background', 'rgba(47, 164, 73, 0.92)', 'important');
            } else {
              li.style.setProperty('background', 'rgba(255,255,255,0.95)', 'important');
            }
          };
          li.onmouseleave = function() {
            if (service === 'BRT') {
              li.style.setProperty('background', 'rgba(38, 70, 151, 0.7)', 'important');
            } else if (service === 'Non-BRT') {
              li.style.setProperty('background', 'rgba(255, 127, 0, 0.7)', 'important');
            } else if (service === 'TransJabodetabek') {
              li.style.setProperty('background', 'rgba(47, 164, 73, 0.7)', 'important');
            } else {
              li.style.setProperty('background', 'rgba(255,255,255,0.7)', 'important');
            }
          };

          // Badge koridor besar (watermark)
          const koridorWatermark = document.createElement('span');
          koridorWatermark.textContent = koridor;
          koridorWatermark.style.position = 'absolute';
          koridorWatermark.style.right = '18px';
          koridorWatermark.style.top = '50%';
          koridorWatermark.style.transform = 'translateY(-50%)';
          koridorWatermark.style.fontSize = '3.2em';
          koridorWatermark.style.fontWeight = '900';
          koridorWatermark.style.letterSpacing = '0.05em';
          koridorWatermark.style.opacity = '0.52';
          koridorWatermark.style.pointerEvents = 'none';
          koridorWatermark.style.userSelect = 'none';
          koridorWatermark.style.zIndex = '1';
          koridorWatermark.style.color = getKoridorBadgeColor(koridor);
          koridorWatermark.style.textShadow = '0 0 8px #fff, 0 0 2px #fff, 0 1px 0 #fff, 0 -1px 0 #fff, 1px 0 0 #fff, -1px 0 0 #fff';
          li.appendChild(koridorWatermark);

          // Wrapper row
          const row = document.createElement('div');
          row.className = 'unified-search-halte-row w-100';
          row.style.position = 'relative';
          row.style.zIndex = '2';

          // Main info (nomor, label, nama halte)
          const main = document.createElement('div');
          main.className = 'unified-search-halte-main';

          // Badge nomor urut halte
          const nomorBadge = document.createElement('span');
          nomorBadge.textContent = String(idx + 1).padStart(2, '0');
          nomorBadge.style.backgroundColor = getKoridorBadgeColor(koridor);
          nomorBadge.style.color = "#fff";
          nomorBadge.style.width = "28px";
          nomorBadge.style.height = "28px";
          nomorBadge.style.display = "inline-flex";
          nomorBadge.style.alignItems = "center";
          nomorBadge.style.justifyContent = "center";
          nomorBadge.style.borderRadius = "50%";
          nomorBadge.style.fontWeight = "bold";
          nomorBadge.style.fontSize = "1em";
          nomorBadge.style.marginRight = "6px";

          // Label layanan sebagai badge
          const labelSpan = document.createElement('span');
          labelSpan.className = 'unified-search-halte-label';
          if (service === 'BRT') {
            labelSpan.innerHTML = '<span class="badge badge-unified-brt">BRT</span>';
          } else if (service === 'Non-BRT') {
            labelSpan.innerHTML = '<span class="badge badge-unified-nonbrt">Non-BRT</span>';
          } else if (service === 'TransJabodetabek') {
            labelSpan.innerHTML = '<span class="badge badge-unified-tj">TransJabodetabek</span>';
          } else {
            labelSpan.innerHTML = `<span class="badge bg-secondary">${service}</span>`;
          }

          // Nama halte (dengan highlight)
          const halteSpan = document.createElement('span');
          halteSpan.className = 'text-dark fw-bold';
          // Highlight query
          const halteLower = halte.toLowerCase();
          let lastIdx = 0;
          let html = '';
          let idxMatch = halteLower.indexOf(query);
          while (idxMatch !== -1) {
            html += halte.substring(lastIdx, idxMatch);
            html += `<span class='unified-search-halte-highlight'>${halte.substring(idxMatch, idxMatch + query.length)}</span>`;
            lastIdx = idxMatch + query.length;
            idxMatch = halteLower.indexOf(query, lastIdx);
          }
          html += halte.substring(lastIdx);
          // Icon integrasi
          const integrasi = integrasiTransportasi[halte];
          if (integrasi) {
              const iconMap = {
                  'KRL': '<iconify-icon inline icon="jam:train"></iconify-icon>',
                  'MRT': '<iconify-icon inline icon="pepicons-pop:train-circle"></iconify-icon>',
                  'LRT': '<iconify-icon inline icon="icon-park-solid:train"></iconify-icon>'
              };
              integrasi.forEach(item => {
                  if(iconMap[item.tipe]) html += ` ${iconMap[item.tipe]}`;
              });
          }
          halteSpan.innerHTML = html;

          // Jurusan
          const jurusanSpan = document.createElement('span');
          jurusanSpan.className = 'ms-2 text-muted';
          jurusanSpan.style.fontSize = '0.95em';
          jurusanSpan.textContent = `${koridorEntry.start} - ${koridorEntry.end}`;

          main.appendChild(nomorBadge);
          main.appendChild(labelSpan);
          main.appendChild(halteSpan);
          main.appendChild(jurusanSpan);

          // Badge koridor (di bawah)
          const badges = document.createElement('div');
          badges.className = 'unified-search-halte-badges';
          const koridorBadges = getServicesAndKoridorsByHalte(halte).filter(({koridor: k}) => k !== koridor);
          koridorBadges.forEach(({ service: svc, koridor: kor }) => {
            const badge = createKoridorBadge(svc, kor);
            badges.appendChild(badge);
          });
          // Integrasi badge manual
          if (integrasiBadge[halte]) {
            integrasiBadge[halte].forEach(kor => {
              if (kor !== koridor) {
                const badge = createKoridorBadge("BRT", kor);
                badges.appendChild(badge);
              }
            });
          }

          row.appendChild(main);
          if (badges.childNodes.length > 0) row.appendChild(badges);
          li.appendChild(row);

          // Klik: langsung arahkan ke koridor dan highlight halte
          li.onclick = () => {
            selectKoridor(service, koridor);
            setTimeout(() => {
              displayKoridorResults(service, koridor, halte);
            }, 150);
            input.value = halte;
            results.innerHTML = '';
          };
          results.appendChild(li);
        });
      });
    }
    if (koridorMatches.length) {
      const koridorHeader = document.createElement('li');
      koridorHeader.className = 'list-group-item fw-bold bg-light text-success';
      koridorHeader.textContent = 'Koridor';
      results.appendChild(koridorHeader);
      koridorMatches.slice(0,10).forEach(({service, koridor, jurusan}) => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action';
        li.innerHTML = `<span class='badge me-2' style='background:${getKoridorBadgeColor(koridor)};color:#fff;'>${koridor}</span> <span class='fw-bold'>${jurusan}</span> <span class='badge bg-secondary ms-2'>${service}</span>`;
        li.onclick = () => {
          selectKoridor(service, koridor);
          input.value = koridor;
          results.innerHTML = '';
        };
        results.appendChild(li);
      });
    }
    if (layananMatches.length) {
      const layananHeader = document.createElement('li');
      layananHeader.className = 'list-group-item fw-bold bg-light text-warning';
      layananHeader.textContent = 'Layanan';
      results.appendChild(layananHeader);
      layananMatches.forEach(layanan => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-action';
        li.innerHTML = `<span class='fw-bold'>${layanan}</span>`;
        li.onclick = () => {
          // Tampilkan semua koridor di layanan tsb
          document.getElementById('serviceSelect').value = layanan;
          updateKoridorOptions();
          results.innerHTML = '';
          input.value = layanan;
        };
        results.appendChild(li);
      });
    }
    if (!halteMatches.length && !koridorMatches.length && !layananMatches.length) {
      const li = document.createElement('li');
      li.className = 'list-group-item text-center text-muted';
      li.textContent = 'Tidak ada hasil.';
      results.appendChild(li);
    }
  });
});

// --- PATCH: Enable koridorSelect by default and default to BRT ---
document.addEventListener('DOMContentLoaded', function() {
    // Set default layanan ke BRT jika belum ada
    const serviceSelect = document.getElementById('serviceSelect');
    if (serviceSelect && !serviceSelect.value) {
        serviceSelect.value = 'BRT';
    }
    // Enable koridorSelect and populate with BRT koridors by default
    const koridorSelect = document.getElementById('koridorSelect');
    if (koridorSelect) {
        koridorSelect.disabled = false;
        // Populate with BRT koridors if not already populated
        if (serviceSelect) {
            serviceSelect.value = serviceSelect.value || 'BRT';
            updateKoridorOptions();
        }
    }
});

// Helper function untuk konversi hex ke rgba
function hexToRgba(hex, alpha) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(x => x + x).join('');
    }
    const r = parseInt(hex.substring(0,2), 16);
    const g = parseInt(hex.substring(2,4), 16);
    const b = parseInt(hex.substring(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

(function() {
  const style = document.createElement('style');
  style.innerHTML = `
    .halte-sponsor-logo {
      background: none !important;
      border: none !important;
      object-fit: contain !important;
      border-radius: 8px !important;
      filter: brightness(1.1) drop-shadow(0 1px 4px #0002) !important;
      transition: top 0.2s, right 0.2s, transform 0.2s;
    }
  `;
  document.head.appendChild(style);
})();

