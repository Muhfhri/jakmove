export const koridorData = {
    "BRT": {
        "1": {
            start: "Blok M",
            end: "Kota",
            operator: "Transjakarta (TJ), DAMRI (DMR), Bianglala Metropolitan (BMP),Mayasari Bakti (MB/MYS)",
            isAMARI: true,
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/1-20250102.jpg",
            directionalNotes: {
                "ASEAN": "Bus dari arah Blok M tidak berhenti di halte ini, lanjut langsung ke Halte Masjid Agung.",
                "Kejaksaan Agung": "Hanya melayani bus arah Blok M.",
                "Museum Sejarah Jakarta": "Hanya melayani bus arah Blok M.",
                "Kota": "Hanya melayani bus arah Blok M."
            },
            busType: [
                "Zhongtong Bus LCK6180GC",
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Hino RK1 JSNL amari",
                "Mercedes-Benz OH 1626",
                "Scania K320IA","Scania K310IB",
                "Skywell NJL6126BEV",
                "Hino RK8 R260",
                "Mercedes-Benz OC 500 RF 2542",
            ],
            haltes: ["Blok M", "ASEAN", "Kejaksaan Agung", "Masjid Agung", "Bundaran Senayan",
                "Senayan BANK DKI", "Polda Metro Jaya", "Bendungan Hilir", "Karet",
                "Dukuh Atas", "Tosari", "Bundaran HI ASTRA", "M.H Thamrin",
                "Kebon Sirih", "Monumen Nasional", "Harmoni", "Sawah Besar",
                "Mangga Besar", "Taman Sari", "Glodok","Kota", "Museum Sejarah Jakarta", "Kali Besar"]
        },
        "2": {
            start: "Pulo Gadung",
            end: "Monumen Nasional",
            operator: "Transjakarta (TJ),DAMRI (DMR), Bianglala Metropolitan (BMP) amari",
            directionalNotes: {
                "Kwitang": "Hanya melayani bus arah Monumen Nasional."
            },
            busType: [
                "Hino RK8 R260 amari",
                "Hino RK1 JSNL",
                "Hino RK1 JSNL",
                "Zhongtong Bus LCK6126EVGRA1", 
                "Skywell NJL6126BEV",
            ],
            isAMARI: true,
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/2-20250428.jpg",
            haltes: ["Pulo Gadung", "Bermis", "Pulo Mas", "Perintis Kemerdekaan", "Pedongkelan",
                "Cempaka Mas", "Sumur Batu", "Cempaka Baru", "Pasar Cempaka Putih",
                "Rawa Selatan", "Galur", "Senen TOYOTA Rangga", "Senen Raya", "RSPAD",
                "Pejambon", "Gambir", "Istiqlal", "Juanda", "Pecenongan",  "Monumen Nasional", "Balai Kota",
               "Gambir 2", "Kwitang"]
            },
        "2A": {
            start: "Pulo Gadung",
            end: "Rawa Buaya",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/2A-20250422.jpg",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            busType: [
                "Mercedes-Benz OH 1626",
                "Hino RK1 JSNL",
                "Mercedes-Benz OC 500 RF 2542",
                "Scania K320IA","Scania K310IB",
            ],
            operator: "Transjakarta(TJ),Pahala Kencana Transportation (PKT), Bianglala Metropolitan (BMP)",
            haltes: ["Pulo Gadung", "Bermis", "Pulo Mas", "Perintis Kemerdekaan", "Pedongkelan",
                "Cempaka Mas", "Sumur Batu", "Cempaka Baru", "Pasar Cempaka Putih",
                "Rawa Selatan", "Galur", "Senen TOYOTA Rangga", "Kwitang", "Gambir 2", "Balai Kota", "Petojo", "Roxy", "Grogol", "Jelambar", "Damai", "Taman Kota", "Jembatan Gantung", "Jembatan Baru", "Rawa Buaya"]
            },
            "3": {
                start: "Kalideres",
                end: "Monumen Nasional via Veteran",
                isAMARI: true,
                map: "https://smk.transjakarta.co.id/aset/berkas/rute/3-20250625.jpg",
                busType: [
                "Hino RK8 R260 amari",
                "Hino RK1 JSNL amari",
                "Mercedes-Benz OC 500 RF 2542",
                "Mercedes-Benz OH 1626",
                "Scania K320IA","Scania K310IB",
                "Volvo B11R"
            ],
                operator: "Transjakarta (TJ), Steady Safe (SAF), Bianglala Metropolitan (BMP) amari, Mayasari Bakti (MB/MYS)",
            haltes: ["Kalideres", "Pesakih", "Sumur Bor", "Rawa Buaya", "Jembatan Baru", "Pulo Nangka",
                "Jembatan Gantung", "Taman Kota", "Damai", "Jelambar", "Grogol", "Roxy", "Petojo", "Monumen Nasional"]},
            "3F": {
                start: "Kalideres",
                end: "Senayan BANK DKI",
                map: "https://smk.transjakarta.co.id/aset/berkas/rute/3F-20240709.jpg",
                directionalNotes: {
                    "Grogol Reformasi": "Hanya melayani bus arah Senayan BANK DKI."
                },
                operationalSchedule: {
                    weekday: {
                        days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                        hours: { start: 5, end: 22 }
                    },
                    },
                operator: "Transjakarta (TJ) , Mayasari Bakti (MB/MYS)",
            haltes: ["Kalideres", "Pesakih", "Sumur Bor", "Rawa Buaya", "Jembatan Baru", "Pulo Nangka",
                "Jembatan Gantung", "Taman Kota", "Damai", "Jelambar", "Grogol Reformasi", "Tanjung Duren", "Kota Bambu", "Kemanggisan", "Petamburan", "Gerbang Pemuda", "Senayan BANK DKI"]
        },
            "3H": {
                start: "Damai",
                end: "Kota",
                map: "https://smk.transjakarta.co.id/aset/berkas/rute/3F-20240709.jpg",
                directionalNotes: {
                    "Kali Besar": "Hanya melayani bus arah Kota.",
                    "Museum Sejarah Jakarta": "Hanya melayani bus arah Kota."
                },
                operationalSchedule: {
                    weekday: {
                        days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                        hours: { start: 5, end: 22 }
                    },
                    },
                    busType : ["Hino RK8 R260 amari",
                "Hino RK1 JSNL amari",
                "Mercedes-Benz OH 1626",
                "Volvo B11R"],
                operator: "Transjakarta (TJ) , Mayasari Bakti (MYS), Steady Safe (SAF)",
            haltes: ["Damai","Jelambar","Grogol","Roxy","Petojo","Harmoni","Sawah Besar","Mangga Besar","Taman Sari","Glodok","Kali Besar","Museum Sejarah Jakarta","Kota"]
        },
        "4": {
            start: "Pulo Gadung",
            end: "Galunggung",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/4-20250605.jpg",
            operator: "Transjakarta (TJ) , DAMRI (DMR), Bianglala Metropolitan (BMP) amari",
            directionalNotes: {
                "Matraman": "Hanya melayani bus arah Galunggung.",
                "Tegalan": "Hanya melayani bus arah Galunggung.",
                "Kesatrian": "Hanya melayani bus arah Galunggung.",
                "Flyover Pramuka": "Hanya melayani bus arah Pulo Gadung."
            },
            busType: [
                "Zhongtong Bus LCK6126EVGRA1",
                "Hino RK8 R260 amari",
                "Hino RK1 JSNL",
                "Mercedes-Benz OH 1526",
                "Skywell NJL6126BEV",
                "Zhongtong Bus LCK6126EVGRA2"
            ],
            isAMARI: true,
            haltes: ["Pulo Gadung", "Pemuda Merdeka", "Layur", "Pemuda Rawamangun", "Velodrome", "Kayu Jati", "Rawamangun", "Simpang Pramuka", "Pramuka Sari", "Utan Kayu", "Pasar Genjing", "Flyover Pramuka", "Matraman", "Tegalan", "Kesatrian", "Manggarai", "Pasar Rumput", "Halimun", "Galunggung"]
        },
        "4D": {
            start: "Pulo Gadung",
            end: "Patra Kuningan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/4D-20250605.jpg",
            directionalNotes: {
                "Matraman": "Hanya melayani bus arah Patra Kuningan.",
                "Tegalan": "Hanya melayani bus arah Patra Kuningan.",
                "Kesatrian": "Hanya melayani bus arah Patra Kuningan.",
                "Flyover Pramuka": "Hanya melayani bus arah Pulo Gadung."
            },
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            busType: [
                "Hino RK1 JSNL",
                "Mercedes-Benz OH 1526",
                "Volvo B11R",
            ],
            operator: "Transjakarta (TJ) , Steady Safe (SAF)",
            haltes: ["Pulo Gadung", "Pasar Pulo Gadung", "Pemuda Merdeka", "Layur", "Pemuda Rawamangun", "Velodrome", "Kayu Jati", "Rawamangun", "Simpang Pramuka", "Pramuka Sari", "Utan Kayu", "Pasar Genjing", "Flyover Pramuka", "Matraman", "Tegalan", "Kesatrian", "Manggarai", "Pasar Rumput", "Halimun", "Flyover Kuningan", "Setiabudi", "Kuningan Madya", "Karet Kuningan", "Rasuna Said", "Patra Kuningan"]
        },
        
        "5": {
            start: "Kampung Melayu",
            end: "Ancol",
            isAMARI: true,
            directionalNotes: {
                "Jatinegara": "Hanya melayani bus arah Kampung Melayu.",
                "Bali Mester": "Hanya melayani bus arah Kampung Melayu."
            },
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/5-20250102.jpg",
            busType: [
                "Zhongtong Bus LCK6126EVGRA2",
                "Volvo B11R","Scania K310IB",
                "Mercedes-Benz OH 1626",
                "Zhongtong Bus LCK6180GC",
                "Hino RK8 R260 amari",
                "Skywell NJL6126BEV amari"
            ],
            operator: "Transjakarta (TJ), DAMRI (DMR), Bianglala Metropolitan (BMP) amari , Steady Safe (SAF)",
            haltes: ["Ancol", "Pademangan", "Gunung Sahari", "Jembatan Merah", "Pasar Baru Timur", "Lapangan Banteng", "Senen Sentral", "Pal Putih", "Kramat Sentiong", "Salemba", "Paseban", "Matraman", "Tegalan", "Kesatrian", "Matraman Baru", "Bali Mester", "Jatinegara", "Kampung Melayu"]
        },
        "5C": {
            start: "Cililitan",
            end: "Juanda",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/5C-20250312.jpg",
            operator: "Transjakarta (TJ), Steady Safe (SAF) , DAMRI (DMR)",
            directionalNotes: {
                "Jatinegara": "Hanya melayani bus arah Cililitan.",
                "Bali Mester": "Hanya melayani bus arah Cililitan."
            },
             busType: [
                "Volvo B11R","Scania K310IB",
                "Mercedes-Benz OH 1626",
                "Zhongtong Bus LCK6180GC",
                "Zhongtong Bus LCK6126EVGRA2"
            ],
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Cililitan","Cawang Cililitan", "Cawang Sentral", "Cawang", "Cawang Baru", "Gelanggang Remaja", "Bidara Cina", "Kampung Melayu", "Jatinegara", "Bali Mester", "Matraman Baru", "Kesatrian", "Tegalan", "Matraman", "Paseban","Salemba","Kramat Sentiong","Pal Putih", "Kwitang", "Balai Kota", "Monumen Nasional", "Pecenongan", "Juanda", "Lapangan Banteng"]
        },
        "6": {
            start: "Ragunan",
            end: "Galunggung",
            isAMARI: true,
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/6-20250102.jpeg",
            operator: "DAMRI (DMR) , Bianglala Metropolitan (BMP), Mayasari Bakti (MYS)",
            directionalNotes: {
                "Flyover Kuningan": "Hanya melayani bus arah Galunggung.",
                "Halimun": "Hanya melayani bus arah Galunggung."
            },
            busType: [
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Skywell NJL6126BEV",
               "Zhongtong Bus LCK6126EVGRA1",
               "Zhongtong Bus LCK6126EVGRA2",
               "Hino RK8 R260 amari"
            ],
            haltes: ["Ragunan","Simpang Ragunan Ar-Raudhah","Jati Barat", "Jati Padang", "Pejaten", "Buncit Indah", "Warung Jati", "Warung Buncit", "Duren Tiga", "Mampang Prapatan", "Underpass Kuningan", "Patra Kuningan", "Kuningan", "Rasuna Said", "Karet Kuningan", "Kuningan Madya", "Setiabudi", "Flyover Kuningan", "Halimun", "Galunggung"]
        },
        "6A": {
            start: "Ragunan",
            end: "Balai Kota via Kuningan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/6A-20240909.jpg",
             busType: [
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Skywell NJL6126BEV",
               "Zhongtong Bus LCK6126EVGRA1",
               "Zhongtong Bus LCK6126EVGRA2",
            ],
            operator: "DAMRI (DMR) , Bianglala Metropolitan (BMP), Mayasari Bakti (MYS)",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Ragunan","Simpang Ragunan Ar-Raudhah","Jati Barat", "Jati Padang", "Pejaten", "Buncit Indah", "Warung Jati", "Warung Buncit", "Duren Tiga", "Mampang Prapatan", "Underpass Kuningan", "Patra Kuningan", "Kuningan", "Rasuna Said", "Karet Kuningan", "Kuningan Madya", "Setiabudi", "Bundaran HI ASTRA", "M.H Thamrin", "Kebon Sirih", "Balai Kota"]
        },
        "6B" : {
            start: "Ragunan",
            end: "Balai Kota via Semanggi",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/6B-20241218.jpg",
            directionalNotes: {
                "Semanggi": "Hanya melayani bus arah Balai Kota."
            },
            busType: [
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Skywell NJL6126BEV",
               "Zhongtong Bus LCK6126EVGRA1",
               "Zhongtong Bus LCK6126EVGRA2",
            ],
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "DAMRI (DMR) , Bianglala Metropolitan (BMP), Mayasari Bakti (MYS)",
            haltes: ["Ragunan","Simpang Ragunan Ar-Raudhah","Jati Barat", "Jati Padang", "Pejaten", "Buncit Indah", "Warung Jati", "Warung Buncit", "Duren Tiga", "Mampang Prapatan", "Denpasar", "Widya Chandra Telkomsel", "Semanggi", "Karet", "Dukuh Atas", "Tosari", "Bundaran HI ASTRA", "M.H Thamrin", "Kebon Sirih", "Balai Kota"]
        },
        "6V" : {
            start: "Ragunan",
            end: "Senayan BANK DKI",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/6V-20241007.jpg",
            directionalNotes: {
                "ASEAN": "Hanya melayani bus arah Ragunan."
            },
            busType: [
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Skywell NJL6126BEV",
               "Zhongtong Bus LCK6126EVGRA1",
            ],
            operator: "DAMRI (DMR) , Bianglala Metropolitan (BMP), Mayasari Bakti (MYS)",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Ragunan","Simpang Ragunan Ar-Raudhah","Jati Barat", "Jati Padang", "Pejaten", "Buncit Indah", "Warung Jati", "Warung Buncit", "Duren Tiga", "Mampang Prapatan", "Tegal Mampang", "Rawa Barat", "Pasar Santa", "ASEAN","Masjid Agung", "Bundaran Senayan", "Senayan BANK DKI"]
        },
        "7": {
            start: "Kampung Melayu",
            end: "Kampung Rambutan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/7-20250312.jpg",
            isAMARI: true,
            busType: [
                "Mercedes-Benz OH 1526",
                "Hino RK8 R260",
               "Mercedes-Benz OH 1626",
               "Zhongtong Bus LCK6126EVGRA1 amari",
               "Skywell NJL6126BEV amari",
            ],
            operator: "Mayasari Bakti (MYS), Steady Safe (SAF), DAMRI (DMR) amari, Bianglala Metropolitan (BMP) amari",
            haltes: ["Kampung Rambutan", "Tanah Merdeka", "Flyover Raya Bogor", "Trikora", "Pasar Induk", "Kramat Jati", "Cililitan", "Cawang Cililitan", "Cawang Sentral", "Cawang", "Cawang Baru", "Gelanggang Remaja", "Bidara Cina", "Kampung Melayu"]
        },
        "L7": {
            start: "Kampung Melayu",
            end: "Kampung Rambutan via TOL HEK",
            map: "https://pbs.twimg.com/media/DMq-CUEUIAcrWK-.jpg",
            busType: [
                "Mercedes-Benz OH 1526",
                "Skywell NJL6126BEV",
                "Hino RK8 R260",
               "Zhongtong Bus LCK6126EVGRA1",
               "Mercedes-Benz OH 1626"
            ],
            operator: "Mayasari Bakti (MYS), DAMRI (DMR), Bianglala Metropolitan (BMP)",
            haltes: ["Kampung Rambutan", "Cawang Sentral", "Cawang", "Cawang Baru", "Gelanggang Remaja", "Bidara Cina", "Kampung Melayu"]
        },
        "7F": {
            start: "Kampung Rambutan",
            end: "Juanda via Cempaka Putih",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/7F-20250422.jpg",
            directionalNotes: {
                "Pasar Induk": "Bus masuk TOL Jagorawi, hanya melayani arah Utan Kayu Rawamangun.",
                "Utan Kayu Rawamangun": "Bus masuk TOL Jagorawi, hanya melayani arah Pasar Induk.",
                "Juanda": "Hanya melayani bus arah Pasar Baru.",
                "Pecenongan": "Hanya melayani bus arah Juanda.",
                "Sumur Batu": "Hanya melayani bus arah Kampung Rambutan, lanjut via Pulomas Bypass.",
                "Cempaka Mas": "Hanya melayani bus arah Juanda.",
                "Cempaka Putih": "Hanya melayani bus arah Juanda.",
                "Pasar Baru": "Hanya melayani bus arah Kampung Rambutan, lanjut via Kwitang."
            },
            busType: [,
                "Hino RK8 R260",
               "Mercedes-Benz OH 1626",
               "Scania K310IB"
            ],
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6],
                    hours: [
                        { start: 5, end: 9 },    // Pagi: 05:00 - 09:00
                        { start: 15, end: 21 }   // Sore: 15:00 - 21:00
                    ]
                }
            },
            operator: "DAMRI (DMR), Mayasari Bakti (MYS)",
            haltes: ["Juanda",  "Pasar Baru","Pecenongan", "Monumen Nasional", "Balai Kota", "Kwitang", "Senen TOYOTA Rangga", "Galur", "Rawa Selatan", "Pasar Cempaka Putih", "Cempaka Baru", "Sumur Batu", "Cempaka Mas","Cempaka Putih", "Pulomas Bypass", "Kayu Putih Rawasari", "Pemuda Pramuka", "Utan Kayu Rawamangun", "Pasar Induk", "Trikora", "Flyover Raya Bogor", "Kampung Rambutan"]
        },
        "8": {
            start: "Lebak Bulus",
            end: "Pasar Baru",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/8-20250102.jpg",
            isAMARI: true,
            operator: "Bianglala Metropolitan (BMP),Transjakarta (TJ),DAMRI (DMR)",
            directionalNotes: {
                "Grogol Reformasi": "Hanya melayani bus arah Pasar Baru.",
                "Pondok Pinang": "Hanya melayani bus arah Pasar Baru."
            },
            busType: [
                "SAG Golden Dragon XML6125JEVJ0C3",
                "Mercedes-Benz OH 1626",
                "Zhongtong Bus LCK6126EVGRA2",
                "Hino RK8 R260 amari",
            ],
            haltes: ["Lebak Bulus", "Pondok Pinang", "Underpass Lebak Bulus", "Pondok Indah", "Tanah Kusir", "Bungur", "Kebayoran", "Simprug", "Permata Hijau", "Arteri", "Pos Pengumben", "Kelapa Dua Sasak", "Kebon Jeruk", "Duri Kepa", "Kedoya Panjang", "Kedoya", "Damai", "Jelembar", "Grogol Reformasi", "Tanjung Duren", "Tomang Raya", "Tarakan", "Petojo", "Pecenongan", "Juanda", "Pasar Baru"]
        },
        "9": {
            start: "Pinang Ranti",
            end: "Pluit",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/9-20250312.jpg",
            isAMARI: true,
            busType: [
                "Zhongtong Bus LCK6126EVGRA1",
                "Zhongtong Bus LCK6180GC",
                "Volvo B11R",
                "Mercedes-Benz OH 1626",
                "Mercedes-Benz OH 1526",
                "Hino RK8 R260 amari",
                "Mercedes-Benz OC 500 RF 2542",
                "Scania K320IA","Scania K310IB",
                "Skywell NJL6126BEV",
            ],
            operator: "DAMRI (DMR), Transjakarta (TJ) , Mayasari Bakti (MB/MYS), Bianglala Metropolitan (BMP) amari",
            haltes: ["Pinang Ranti", "Makasar", "Cawang Sentral", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "Pancoran", "Tegal Parang", "Simpang Kuningan", "Denpasar", "Widya Chandra Telkomsel", "Semanggi", "Gerbang Pemuda", "Petamburan","Kemanggisan","Kota Bambu", "Tanjung Duren", "Grogol Reformasi", "Kali Grogol", "Jembatan Besi", "Jembatan Dua", "Jembatan Tiga", "Penjaringan", "Pluit"]
        },
        "9A": {
            start: "Cililitan",
            end: "Grogol",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/9A-20241218.jpg",
            operator: "Transjakarta (TJ) , Mayasari Bakti (MB/MYS)",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Cililitan", "Cawang Cililitan", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "Pancoran", "Tegal Parang", "Simpang Kuningan", "Denpasar", "Widya Chandra Telkomsel", "Semanggi", "Gerbang Pemuda", "Petamburan","Kemanggisan","Kota Bambu", "Tanjung Duren", "Grogol Reformasi"]
        },
        "9C": {
            start: "Pinang Ranti",
            end: "Bundaran Senayan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/9C-20241218.jpg",
            operator: "Transjakarta (TJ) , Mayasari Bakti (MYS)",
            directionalNotes: {
                "Semanggi": "Hanya melayani bus arah Pinang Ranti."
            },
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Pinang Ranti", "Makasar", "Cawang Sentral", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "Pancoran", "Tegal Parang", "Simpang Kuningan", "Denpasar", "Widya Chandra Telkomsel", "Semanggi", "Senayan BANK DKI", "Bundaran Senayan"]
        },

        "9N": { 
            start: "Pinang Ranti",
            end: "Simpang Cawang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/9N-20250312.jpg",
            busType: [
                 "Mercedes-Benz OH 1626",
            ],
            operator: "Transjakarta (TJ) , Mayasari Bakti (MB/MYS)",operationalSchedule: {
                weekday: {
                    days: [6,0], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            haltes: ["Pinang Ranti", "Makasar", "Cawang Sentral", "Simpang Cawang"]
        },
        "10" : {
            start: "Tanjung Priok",
            end: "PGC",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/10-20250312.jpg",
            isAMARI: true,
            busType: [
                "Zhongtong Bus LCK6180GC",
                "Mercedes-Benz OH 1626",
                "Hino RK8 R260 amari",
                "Scania K310IB",
                "Scania K320IA","Zhongtong Bus LCK6126EVGRA2",
                "Skywell NJL6126BEV", "VKTR BYD D9 (EV)",
            ],
            operator: "Transjakarta (TJ), Mayasari Bakti (MB/MYS), DAMRI (DMR) , Sinar Jaya Megah (SJM), Bianglala Metropolitan (BMP) amari",
            haltes: ["Tanjung Priok", "Mambo", "Koja", "Walikota Jakarta Utara", "Plumpang", "Sunter Kelapa Gading", "Kodamar", "Simpang Cempaka", "Cempaka Putih", "Pulomas Bypass", "Kayu Putih Rawasari", "Pemuda Pramuka", "Utan Kayu Rawamangun", "Pisangan", "Flyover Jatinegara", "Pedati Perumpung", "Kebon Nanas", "Halim", "Simpang Cawang", "Cawang Sentral", "Cawang Cililitan", "PGC"]
        },
        "10D" : {
            start: "Tanjung Priok",
            end: "Kampung Rambutan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/10D-20240925.jpg",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6],
                    hours: [
                        { start: 5, end: 9 },    // Pagi: 05:00 - 09:00
                        { start: 15, end: 21 }   // Sore: 15:00 - 21:00
                    ]
                }
            },
            operator: "Mayasari Bakti (MB/MYS)",
              busType: [
                "Scania K310IB"
             ],
            haltes: ["Tanjung Priok", "Mambo", "Koja", "Walikota Jakarta Utara", "Plumpang", "Sunter Kelapa Gading", "Kodamar", "Simpang Cempaka", "Cempaka Putih", "Pulomas Bypass", "Kayu Putih Rawasari", "Pemuda Pramuka", "Utan Kayu Rawamangun", "Pasar Induk", "Trikora","Flyover Raya Bogor","Kampung Rambutan"]
        },
        "10H" : {
            start: "Tanjung Priok",
            end: "Bundaran Senayan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/10H-20240710.jpg",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "Steady Safe (SAF), Mayasari Bakti (MB/MYS), DAMRI (DMR)",
            haltes: ["Tanjung Priok", "Pademangan", "Gunung Sahari", "Jembatan Merah", "Pasar Baru Timur", "Juanda", "Pecenongan", "Petojo", "Tarakan", "Tomang Raya", "Kota Bambu", "Kemanggisan", "Petamburan", "Gerbang Pemuda", "Senayan BANK DKI", "Bundaran Senayan"]
        },
        "11": {
            start: "Kampung Melayu",
            end: "Pulo Gebang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/11-20250102.jpg",
            isAMARI: true,
            directionalNotes: {
                "Jatinegara": "Hanya melayani bus arah Kampung Melayu.",
                "Kampung Melayu": "Hanya melayani bus arah Stasiun Jatinegara."
            },
            busType: [
                "Volvo B11R",
                "Mercedes-Benz OH 1626 amari",
            ],
            operator: "Steady Safe (SAF) , Bianglala Metropolitan (BMP) amari",
            haltes: ["Pulo Gebang", "Walikota Jakarta Timur", "Penggilingan", "Flyover Pondok Kopi", "Simpang Buaran", "Buaran", "Kampung Sumur", "Klender", "Stasiun Klender", "Cipinang", "Flyover Cipinang", "Pasar Enjo", "Flyover Jatinegara", "Stasiun Jatinegara", "Jatinegara", "Kampung Melayu"]
        },
        "12": {
            start: "Tanjung Priok",
            end: "Pluit",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/12-20250102.jpg",
            isAMARI: true,
            operator: "Transjakarta (TJ) , DAMRI (DMR) amari",
            directionalNotes: {
                "Penjaringan": "Hanya melayani bus arah Pluit.",
                "Bandengan": "Hanya melayani bus arah Pluit.",
                "Kali Besar": "Hanya melayani bus arah Pluit.",
                "Pluit": "Hanya melayani bus arah Tanjung Priok.",
                "Pluit Selatan": "Hanya melayani bus arah Tanjung Priok.",
                "Pakin": "Hanya melayani bus arah Tanjung Priok.",
                "Gedong Panjang": "Hanya melayani bus arah Tanjung Priok.",
                "Museum Sejarah Jakarta": "Hanya melayani bus arah Tanjung Priok.",
                "Kota": "Hanya melayani bus arah Tanjung Priok."
            },
            busType: [
                "Skywell NJL6126BEV amari", "Zhongtong Bus LCK6126EVGRA1 amari",
                "Mercedes-Benz OH 1626",
                "Hino RK8 R260",
                "Hino RK1 JSNL",
            ],
            haltes: ["Pluit", "Pluit Selatan", "Pakin","Gedong Panjang","Museum Sejarah Jakarta","Kota", "Penjaringan","Bandengan","Kali Besar","Mangga Dua Raya","Mangga Dua","Gunung Sahari","Jembatan Merah","Landasan Pacu","Danau Agung","Danau Sunter","Sunter Utara","Sunter Karya","Sunter Boulevard Barat","Sunter Kelapa Gading","Plumpang","Walikota Jakarta Utara","Koja","Mambo","Tanjung Priok"],

        },
        "13": {
            start: "Ciledug",
            end: "Tegal Mampang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/13-20250614.jpg",
            isAMARI: true,
            operator: "Transjakarta (TJ), Mayasari Bakti (MYS)",
            directionalNotes: {
                "Puri Beta 1": "Hanya melayani bus arah Tegal Mampang."
            },
             busType: [
                "Mercedes-Benz OH 1626",
                "Mercedes-Benz OH 1526", "Scania K310IB"
            ],
            haltes: ["Tegal Mampang", "Rawa Barat", "Pasar Santa", "CSW", "Mayestik", "Velbak", "Kebayoran Lama", "Seskoal", "Cipulir", "Swadarma ParagonCorp", "JORR", "Petukangan D'MASIV", "Puri Beta 1", "Puri Beta 2", "CBD Ciledug"],
            halteDirectionRules: {
                "Puri Beta 1": [
                  { time: [5, 22], onlyAccessibleVia: "CBD Ciledug" },   // 05:00-22:00 harus lewat CBD Ciledug
                  { time: [22, 5], onlyAccessibleVia: "Puri Beta 2" }    // 22:00-05:00 harus lewat Puri Beta 2
                ]
              }
        },
        "13B": {
            start: "Puri Beta 2",
            end: "Pancoran",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/13B-20250303.jpg",
            directionalNotes: {
                "Pancoran": "Hanya melayani bus arah Puri Beta 2.",
                "Tegal Mampang": "Hanya melayani bus arah Puri Beta 2.",
                "Puri Beta 1": "Hanya melayani bus arah Pancoran."
            },
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "Transjakarta (TJ) , Mayasari Bakti (MYS)",
            haltes: ["Pancoran","Tegal Mampang", "Rawa Barat", "Pasar Santa", "CSW", "Mayestik", "Velbak", "Kebayoran Lama", "Seskoal", "Cipulir", "Swadarma ParagonCorp", "JORR", "Petukangan D'MASIV", "Puri Beta 1", "Puri Beta 2"]
        },
        "13E": {
            start: "Puri Beta 2",
            end: "Pancoran",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/13E-20250303.jpg",
            directionalNotes: {
                "Underpass Kuningan": "Hanya melayani bus arah Puri Beta 2.",
                "Tegal Mampang": "Hanya melayani bus arah Puri Beta 2.",
                "Simpang Kuningan": "Hanya melayani bus arah Flyover Kuningan.",
                "Puri Beta 1": "Hanya melayani bus arah Flyover Kuningan."
            },
            operationalSchedule: {
                weekday: {
                    days: [6, 0], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "Transjakarta (TJ) , Mayasari Bakti (MYS)",
            haltes: ["Flyover Kuningan","Setiabudi", "Kuningan Madya","Karet Kuningan","Rasuna Said","Kuningan","Patra Kuningan","Underpass Kuningan","Simpang Kuningan","Tegal Mampang", "Rawa Barat", "Pasar Santa", "CSW", "Mayestik", "Velbak", "Kebayoran Lama", "Seskoal", "Cipulir", "Swadarma ParagonCorp", "JORR", "Petukangan D'MASIV", "Puri Beta 1", "Puri Beta 2"]
        },
        "L13E": {
            start: "Puri Beta",
            end: "Flyover Kuningan (Express)",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/L13E-20250303.jpg",
            directionalNotes: {
                "Underpass Kuningan": "Hanya melayani bus arah Puri Beta 2.",
                "Tegal Mampang": "Hanya melayani bus arah Puri Beta 2.",
                "Simpang Kuningan": "Hanya melayani bus arah Flyover Kuningan.",
                "Puri Beta 1": "Hanya melayani bus arah Flyover Kuningan."
            },
            operationalSchedule: {
                weekday: {
                    days: [1, 2, 3, 4, 5], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "Transjakarta (TJ) , Mayasari Bakti (MYS)",
            haltes: ["Flyover Kuningan","Setiabudi", "Kuningan Madya","Karet Kuningan","Rasuna Said","Kuningan","Patra Kuningan","Underpass Kuningan","Simpang Kuningan","Tegal Mampang", "CSW", "Velbak", "Petukangan D'MASIV", "Puri Beta 1", "Puri Beta 2"]
        },
        "14": {
            start: "Jakarta International Stadium",
            end: "Senen",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/14-20250422.jpg",
            isAMARI: true,
            busType: [
                "Mercedes-Benz OH 1526",
                "Hino RK8 R260 amari",
                "Skywell NJL6126BEV amari","VKTR BYD D9 (EV)",
            ],
            operator: "Transjakarta (TJ), Sinar Jaya Megah (SJM) , DAMRI (DMR), Bianglala Metropolitan (BMP) amari",
            haltes: ["Senen TOYOTA Rangga", "Senen Raya", "Tanah Tinggi", "Kemayoran", "JIEXPO Kemayoran", "Landasan Pacu", "Danau Agung", "Danau Sunter", "Jembatan Item", "Jakarta International Stadium"]
        },
    },
    "Non-BRT": {
        "1A": {
            start: "Pantai Maju",
            end: "Balai Kota",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/1A-20250501.jpg",
            operator: "Mayasari Bakti (MYS), DAMRI (DMR)",
            busType: [
                "Mercedes-Benz OH 1626",
                "Hino RK8 R260",
                "Zhongtong Bus LCK6126EVGRA2"
            ],
             operationalSchedule: {
                weekday: {
                    days: [1, 2, 3, 4, 5,6,0],
                    hours: [
                        { start: 5, end: 23 } 
                    ]
                }
            },
            directions: {
                "Balai Kota": ["Pantai Maju","The Violin","Melody Golf 2","Seberang Food Street","The Piano","Fresh Market PIK","PIK Avenue","Ruko Cordoba 1","Waterboom Jakarta 1","RS PIK","Simpang Mandara Permai 1","Mandara Permai 6","Mandara Permai 5","Mediterania Boulevard","Margasatwa 1","Galeri Niaga Mediterania 2","Karang Asri","Muara Angke","Polisi Militer Pluit","Baywalk 1","Baywalk 2","SD Diakonia 1","Stella Maris 1","Waduk Pluit","SMKN 56","Pluit Sakti","Aston Pluit 1","Pluit Selatan","SDN Penjaringan 3","Masjid Luar Batang","Pakin","Gedong Panjang","BRI Jakarta Kota","Museum Sejarah Jakarta","Kota","Glodok","Taman Sari","Mangga Besar","Sawah Besar","Harmoni","Monumen Nasional","Balai Kota"],
                "Pantai Maju": ["Balai Kota 1","Balai Kota","Monumen Nasional","Harmoni","Sawah Besar","Mangga Besar","Taman Sari","Glodok","Kali Besar","Jln. Tiang Bendera III","Jembatan Tiga 2","Penjaringan","Jln. BB Utara","Sbr. Waduk Pluit","Stella Maris 2","SD Diakonia 2","PLTU Pluit","PLTU", "Pluit 1","SPBG Jakpro","Jln. Pluit Karang Indah XV","Muara Karang Raya","Ps. Muara Karang","SMAK Penabur Enam 2","Galeru Niaga Mediterania 1","Margasatwa 2","Jln. Lotus Indah","Centro Metro Broadway","Mayang Permai","Simpang Mandara Permai 2","Metric PIK","RS PIK 2","Waterboom Jakarta 2","Ruko Cordoba 2","Ruko Cordoba 3","Buddha Tzu Chi","Gold Coast","Food Street","Melody Golf","Pantai Maju"]
            },
            haltes: ["Balai Kota 1","Balai Kota","Monumen Nasional","Harmoni","Sawah Besar","Mangga Besar","Taman Sari","Glodok","Kali Besar","Jln. Tiang Bendera III","Jembatan Tiga 2","Penjaringan","Jln. BB Utara","Sbr. Waduk Pluit","Stella Maris 2","SD Diakonia 2","PLTU Pluit","PLTU", "Pluit 1","SPBG Jakpro","Jln. Pluit Karang Indah XV","Muara Karang Raya","Ps. Muara Karang","SMAK Penabur Enam 2","Galeru Niaga Mediterania 1","Margasatwa 2","Jln. Lotus Indah","Centro Metro Broadway","Mayang Permai","Simpang Mandara Permai 2","Metric PIK","RS PIK 2","Waterboom Jakarta 2","Ruko Cordoba 2","Ruko Cordoba 3","Buddha Tzu Chi","Gold Coast","Food Street","Melody Golf","Pantai Maju","The Violin","Melody Golf 2","Seberang Food Street","The Piano","Fresh Market PIK","PIK Avenue","Ruko Cordoba 1","Waterboom Jakarta 1","RS PIK","Simpang Mandara Permai 1","Mandara Permai 6","Mandara Permai 5","Mediterania Boulevard","Margasatwa 1","Galeri Niaga Mediterania 2","Karang Asri","Muara Angke","Polisi Militer Pluit","Baywalk 1","Baywalk 2","SD Diakonia 1","Stella Maris 1","Waduk Pluit","SMKN 56","Pluit Sakti","Aston Pluit 1","Pluit Selatan","SDN Penjaringan 3","Masjid Luar Batang","Pakin","Gedong Panjang","BRI Jakarta Kota","Museum Sejarah Jakarta","Kota","Glodok","Taman Sari","Mangga Besar","Sawah Besar","Harmoni","Monumen Nasional","Balai Kota"]
        },
        "1P": {
            start: "Senen",
            end: "Blok M",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/1P-20241108.jpg",
            operator: "Transjakarta (TJ)",
            busType: [
                "Mercedes-Benz O500U",
                "Scania K250UB"
            ],
            directions: {
                "Blok M": ["Terminal Senen", "Kel. Senen", "Bangau VI", "Simpang Gunung Sahari III", "Sekolah Penabur Gunung Sahari", "Gg. Buaya Senen", "Ps. Senen Jaya", "Simpang St. Senen", "Atrium 1", "RSPAD 1", "RSPAD 2", "Gunung Agung", "Telkom Grapari", "Balai Kota 1", "Perpustakaan Nasional", "Dana Reksa", "Sari Pan Pasific","MH Thamrin 1","Wisma Nusantara","Tosari 3","Bumiputera","Chase Plaza","Karet Sudirman 1","Flyover Karet 2","Plaza Sentral","Gelora Bung Karno 1","Summitmas","Bundaran Senayan 1","Taman Patimura","Sbr. Kementrian PUPR","Jln. Palatehan","M Bloc", "Blok M Jalur 2"],
                "Senen": ["Blok M Jalur 2","Kementrian PUPR","Taman Mataram","Bundaran Senayan 2","FX Sudirman", "Gelora Bung Karno 2", "GBK Pintu 7","Benhil 3","Karet Sudirman 2","Karet Sudirman 3","Grand Sahid","Menara Astra","Dukuh Atas 4","St. Sudirman 2","Tosari 2","Plaza Indonesia","Kedutaan Besar Jepang","MH Thamrin 2","Menara Thamrin","Bank Indonesia 2","Kementrian Pariwisata", "Museum Nasional","Monas 2","Monas 3","IRTI","Gambir 3","St. Gambir 2","Istiqlal 1","Pasar Baru Gedung Kesenian Jakarta","Kantor Pos Lapangan Banteng","Lapangan Banteng 1","Lapangan Banteng 2","OJK Wahidin","Wahidin 1","Sekolah Penabur Gunung Sahari", "Gg. Buaya Senen", "Terminal Senen"]
            },
            haltes : ["Terminal Senen", "Kel. Senen", "Bangau VI", "Simpang Gunung Sahari III", "Sekolah Penabur Gunung Sahari", "Gg. Buaya Senen", "Ps. Senen Jaya", "Simpang St. Senen", "Atrium 1", "RSPAD 1", "RSPAD 2", "Gunung Agung", "Telkom Grapari", "Balai Kota 1", "Perpustakaan Nasional", "Dana Reksa", "Sari Pan Pasific","MH Thamrin 1","Wisma Nusantara","Tosari 3","Bumiputera","Chase Plaza","Karet Sudirman 1","Flyover Karet 2","Plaza Sentral","Gelora Bung Karno 1","Summitmas","Bundaran Senayan 1","Taman Patimura","Sbr. Kementrian PUPR","Jln. Palatehan","M Bloc", "Blok M Jalur 2","Kementrian PUPR","Taman Mataram","Bundaran Senayan 2", "FX Sudirman","Gelora Bung Karno 2", "GBK Pintu 7","Benhil 3","Karet Sudirman 2","Karet Sudirman 3","Grand Sahid","Menara Astra","Dukuh Atas 4","St. Sudirman 2","Tosari 2","Plaza Indonesia","Kedutaan Besar Jepang","MH Thamrin 2","Menara Thamrin","Bank Indonesia 2","Kementrian Pariwisata", "Museum Nasional","Monas 2","Monas 3","IRTI","Gambir 3","St. Gambir 2","Istiqlal 1","Pasar Baru Gedung Kesenian Jakarta","Kantor Pos Lapangan Banteng","Lapangan Banteng 1","Lapangan Banteng 2","OJK Wahidin","Wahidin 1","Sekolah Penabur Gunung Sahari", "Gg. Buaya Senen", "Terminal Senen"]
        },
        "1R": {
            start: "Senen",
            end: "Tanah Abang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/1R-20240918.jpeg",
            operator: "Transjakarta (TJ)",
            busType: [
                "Mercedes-Benz O500U",
                "Scania K250UB"
            ],
            directions: {
                "Tanah Abang": ["Terminal Senen","Kel. Senen","Bangau VI","Simpang Gunung Sahari III","Sekolah Penabur Gunung Sahari","Gg. Buaya Senen","Ps. Senen Raya","Jln. Kramat Kwitang","Gunung Agung","Telkom Grapari","Balai Kota 1","Perpustakaan Nasional","Dana Reksa","Wisma Mandiri 2","Kementrian Agama","Sbr. Jembatan Serong","Jln. Taman Kb. Sirih","JPO Blok E","Pharmin","Explorer Tanah Abang","Blok F","Pospol Jati Bunder","JPO Blok G","Transjakarta Tanah Abang 2"],
                "Senen": ["Transjakarta Tanah Abang 2", "Jln. Taman Jatibaru Timur","Tanah Abang 2","SMKN 38","Jembatan Serong","Kementrian ESDM","Masjid Ar Rayyan Kementrian BUMN","Dewan Pers","DPRD DKI Jakarta","Sbr. MNC Center","Panti Perwira","Apartemen Capitol Kwitang","Atrium 1","RSPAD 1", "Wahidin 1","Sekolah Penabur Gunung Sahari","Gg. Buaya Senen","Terminal Senen"]
            },
            haltes : ["Transjakarta Tanah Abang 2", "Jln. Taman Jatibaru Timur","Tanah Abang 2","SMKN 38","Jembatan Serong","Kementrian ESDM","Masjid Ar Rayyan Kementrian BUMN","Dewan Pers","DPRD DKI Jakarta","Sbr. MNC Center","Panti Perwira","Apartemen Capitol Kwitang","Atrium 1","RSPAD 1", "Wahidin 1","Sekolah Penabur Gunung Sahari","Gg. Buaya Senen","Terminal Senen","Kel. Senen","Bangau VI","Simpang Gunung Sahari III","Sekolah Penabur Gunung Sahari","Gg. Buaya Senen","Ps. Senen Raya","Jln. Kramat Kwitang","Gunung Agung","Telkom Grapari","Balai Kota 1","Perpustakaan Nasional","Dana Reksa","Wisma Mandiri 2","Kementrian Agama","Sbr. Jembatan Serong","Jln. Taman Kb. Sirih","JPO Blok E","Pharmin","Explorer Tanah Abang","Blok F","Pospol Jati Bunder","JPO Blok G","Transjakarta Tanah Abang 2"]
        },
        "1F": {
            start: "Stasiun Palmerah",
            end: "Bundaran Senayan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/1F-20240709.jpg",
            operator: "Mayasari Bakti (MYS)",
            busType: [
                "Mercedes-Benz OH 1626"
            ],
            directions: {
                "Stasiun Palmerah": ["Bundaran Senayan","Senayan BANK DKI","Gerbang Pemuda","DPR MPR 1","DPR MPR 2","Manggala Wanabakti","Stasiun Palmerah"],
                "Bundaran Senayan": ["Stasiun Palmerah","Graha Kemenpora","Taman Ria","Gerbang Pemuda","Senayan BANK DKI","Bundaran Senayan"]
            },
            haltes : ["Stasiun Palmerah","Graha Kemenpora","Taman Ria","Gerbang Pemuda","Senayan BANK DKI","Bundaran Senayan","Senayan BANK DKI","Gerbang Pemuda","DPR MPR 1","DPR MPR 2","Manggala Wanabakti","Stasiun Palmerah"]
        },
        "4C": {
            start: "JIEP",
            end: "Bundaran Senayan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/4C-20250319.jpg",
            operator: "Transjakarta (TJ) , DAMRI (DMR)",
            busType: [
                "Skywell NJL6129BEV",
                "Mercedes-Benz O500U",
                "Scania K250UB"
            ],
            haltes: ["Komplek Pergudangan JIEP", "Bundaran JIEP 2", "Jln. Rawa Gelam I", "Sbr. Pasifik Logistik Berserikat", "Jln. Pulo Lentut", "Simpang Jln. Pulo Lentut", "Pintu Kawasan 1", "TU Gas 1", "Kantor Pos Jaktim", "Layur 1", "Jln. Sunan Drajad", "Arion Mall", "Velodrome 1", "Sunan Giri 2", "UNJ 2", "Pramuka BPKP 2", "Pramuka LIA 2", "Utan Kayu 2", "Jln. Pramuka 4", "Jln. Pramuka 2", "Simpang Matraman 2", "Tugu Proklamasi", "Tugu Proklamasi 2", "Jln. Penataran", "SMPN 8", "Gedung Wanita", "Museum Proklamasi", "KPU", "Graha Mandiri", "Tosari 3", "Bumiputera", "Chase Plaza", "Karet Sudirman 1", "Flyover Karet 2", "Plaza Sentral", "Gelora Bung Karno 1", "Summitmas", "Bundaran Senayan 1", "Bundaran Senayan 2", "FX Sudirman", "Gelora Bung Karno 2", "GBK Pintu 7", "Benhil 3", "Karet Sudirman 2", "Karet Sudirman 3", "Grand Sahid", "Menara Astra","Dukuh Atas 4","St. Sudirman 2","Tosari 2", "Imam Bonjol","Kartini","Taman Suropati","Surabaya","St. Cikini Selatan","Megaria","RSCM 1","RSCM 2","RS Carolus","Kemensos","Pasar Genjing 1","Jln. Pramuka 5","Pramuka BPKP 1","Ibnu Chaldun","UNJ 1","Sunan Giri 1","Velodrome 2","Jakarta International Velodrome","Pulo Asem","Layur 2","Sbr. Kantor Pos Jaktim","TU Gas 2", "Jln. Pulolio 2", "Jln. Rawa Terate III", "Sbr. Jln. Pulo Kambing I","Jln. Pulo Kambing Raya 1","Sbr. Jln. Pulosidik","Jln. Pulo Ayang 1","Jln. Pulo Ayang 2","Sbr. Jln. Rawa Sumur II","Sbr. Jln Pulobuaran IV", "Sbr. Komplek Pergudangan JIEP"],
            directions: {
                "Bundaran Senayan": [
        "Komplek Pergudangan JIEP", "Bundaran JIEP 2", "Jln. Rawa Gelam I", "Sbr. Pasifik Logistik Berserikat", "Jln. Pulo Lentut", "Simpang Jln. Pulo Lentut", "Pintu Kawasan 1",
        "TU Gas 1", "Kantor Pos Jaktim", "Layur 1", "Jln. Sunan Drajad", "Arion Mall", "Velodrome 1", "Sunan Giri 2", "UNJ 2", "Pramuka BPKP 2", "Pramuka LIA 2", "Utan Kayu 2",
        "Jln. Pramuka 4", "Jln. Pramuka 2", "Simpang Matraman 2", "Tugu Proklamasi", "Tugu Proklamasi 2", "Jln. Penataran", "SMPN 8", "Gedung Wanita", "Museum Proklamasi",
        "KPU", "Graha Mandiri", "Tosari 3", "Bumiputera", "Chase Plaza", "Karet Sudirman 1", "Flyover Karet 2", "Plaza Sentral", "Gelora Bung Karno 1", "Summitmas", "Bundaran Senayan 1"
    ],
    "JIEP": [
        "Bundaran Senayan 1", "Bundaran Senayan 2", "FX Sudirman", "Gelora Bung Karno 2", "GBK Pintu 7", "Benhil 3", "Karet Sudirman 2", "Karet Sudirman 3", "Grand Sahid", "Menara Astra",
        "Dukuh Atas 4", "St. Sudirman 2", "Tosari 2", "Imam Bonjol", "Kartini", "Taman Suropati", "Surabaya", "St. Cikini Selatan", "Megaria", "RSCM 1", "RSCM 2", "RS Carolus",
        "Kemensos", "Pasar Genjing 1", "Jln. Pramuka 5", "Pramuka BPKP 1", "Ibnu Chaldun", "UNJ 1", "Sunan Giri 1", "Velodrome 2", "Jakarta International Velodrome", "Pulo Asem",
        "Layur 2", "Sbr. Kantor Pos Jaktim", "TU Gas 2", "Jln. Pulolio 2", "Jln. Rawa Terate III", "Sbr. Jln. Pulo Kambing I", "Jln. Pulo Kambing Raya 1", "Sbr. Jln. Pulosidik",
        "Jln. Pulo Ayang 1", "Jln. Pulo Ayang 2", "Sbr. Jln. Rawa Sumur II", "Sbr. Jln Pulobuaran IV", "Sbr. Komplek Pergudangan JIEP"
    ]
            }
        },
        "4K": {
            start: "Pulo Gadung",
            end: "Kejaksaan Agung",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/4K-20250410.jpg",
            operator: "DAMRI (DMR)",
            busType: [
                "Zhongtong Bus LCK6126EVGRA2"
            ],
            directions: {
                "Kejaksaan Agung": ["Term. Pulo Gadung","Gg. Suzuki","Ananda Pulo Gadung","Ps. Pulo Gadung 1","Pintu Kawasan 1","TU Gas 1","Kantor Pos Jaktim","Layur 1","Jln. Sunan Drajad","Arion Mall","Velodrome 1","Sunan Giri 2","UNJ 2","Utan Kayu Rawamangun 2","SMP Pelita Tiga","Ahmad Yani Bea Cukai 1", "Flyover Jatinegara", "Pedati Prumpung", "Pedati 4","Samsat Jakarta Timur", "Cipinang Kb. Nanas 2", "SPBU Jln. DI Panjaitan 2","Penas Kalimalang 2","Halim PK", "Cawang Soetoyo 2", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "Pancoran", "Tegal Mampang", "Rawa Barat", "Pasar Santa", "Kejaksaan Agung"],
                "Pulo Gadung": ["Kejaksaan Agung","Pasar Santa", "Rawa Barat", "Tegal Mampang", "Pancoran", "Pancoran Tugu", "Tebet Eco Park", "Cikoko", "Ciliwung", "Cawang", "Cawang Soetoyo 1", "Yodya Tower","Penas Kalimalang 1","SPBU Jln. DI Panjaitan", "Cipinang Kb. Nanas 1","Pedati 1","Pedati Prumpung","Flyover Jatinegara", "Ahmad Yani Bea Cukai 2","Universitas Terbuka", "Utan Kayu Rawamangun 1", "UNJ 1","Sunan Giri 1", "Velodrome 2","Jakarta International Velodrome","Pemuda Rawamangun 1","Pulo Asem","Layur 2","Sbr. Kantor Pos Jaktim", "TU Gas 2","Pintu Kawasan 2", "Ps. Pulo Gadung 2","PKB Pulo Gadung","Pulo Gadung 4","Term. Pulo Gadung"]
            },
            haltes: ["Term. Pulo Gadung","Gg. Suzuki","Ananda Pulo Gadung","Ps. Pulo Gadung 1","Pintu Kawasan 1","TU Gas 1","Kantor Pos Jaktim","Layur 1","Jln. Sunan Drajad","Arion Mall","Velodrome 1","Sunan Giri 2","UNJ 2","Utan Kayu Rawamangun 2","SMP Pelita Tiga","Ahmad Yani Bea Cukai 1", "Flyover Jatinegara", "Pedati Prumpung", "Pedati 4","Samsat Jakarta Timur", "Cipinang Kb. Nanas 2", "SPBU Jln. DI Panjaitan 2","Penas Kalimalang 2","Halim PK", "Cawang Soetoyo 2", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "Pancoran", "Tegal Mampang", "Rawa Barat", "Pasar Santa", "Kejaksaan Agung","Pasar Santa", "Rawa Barat", "Tegal Mampang", "Pancoran", "Pancoran Tugu", "Tebet Eco Park", "Cikoko", "Ciliwung", "Cawang", "Cawang Soetoyo 1", "Yodya Tower","Penas Kalimalang 1","SPBU Jln. DI Panjaitan", "Cipinang Kb. Nanas 1","Pedati 1","Pedati Prumpung","Flyover Jatinegara", "Ahmad Yani Bea Cukai 2","Universitas Terbuka", "Utan Kayu Rawamangun 1", "UNJ 1","Sunan Giri 1", "Velodrome 2","Jakarta International Velodrome","Pemuda Rawamangun 1","Pulo Asem","Layur 2","Sbr. Kantor Pos Jaktim", "TU Gas 2","Pintu Kawasan 2", "Ps. Pulo Gadung 2","PKB Pulo Gadung","Pulo Gadung 4","Term. Pulo Gadung"]
        },
        "5B": {
            start: "St. Tebet",
            end: "Bidara Cina",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/5B-20241111.jpg",
            operator: "Transjakarta (TJ)",
            directions : {
                "St. Tebet" :[
                    "Bidara Cina", "Flyover Kampung Melayu", "Kampung Melayu Besar 2", "St. Tebet 1"
                ],
                "Bidara Cina" : [
                    "St. Tebet 1","Masjid Attahiriyah", "Kampung Melayu Kecil", "Rusun Jatinegara Barat", "RS Hermina", "Santa Maria", "Bukit Duri", "Bali Mester", "Jatinegara", "Kampung Melayu", "Bidara Cina", "Gelanggang Remaja"
                ]
            },
            busType: "Mercedes-Benz OH 1526",
            haltes: ["Bidara Cina", "Gelanggang Remaja", "Flyover Kampung Melayu", "Kampung Melayu Besar 2", "St. Tebet 1", "Masjid Attahiriyah", "Kampung Melayu Kecil", "Rusun Jatinegara Barat", "RS Hermina", "Santa Maria", "Bukit Duri", "Bali Mester", "Jatinegara", "Kampung Melayu"]
        },
        "5M": {
            start: "Kampung Melayu",
            end: "Tanah Abang via Cikini",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/5M-20240918.jpeg",
            operator: "Transjakarta (TJ), Mayasari Bakti (MYS)",
            busType: [
                "Mercedes-Benz O500U",
                "VKTR BYD B12 (EV)",
                "Scania K250UB"
            ],
            directions : {
                "Tanah Abang via Cikini" :[
                    "Term. Kampung Melayu 2", "Rusun Jatinegara Barat","RS Hermina","Santa Maria","Bukit Duri","Jln. Kb. Pala II","Slamet Riyadi 1","Kesatriaan","Tegalan 1","Matraman 3","Simpang Matraman","Masjid Jami Matraman","Tugu Proklamasi","Tugu Proklamasi 2","Jln. Penataran","SMPN 8","Teuku Cik Ditiro","RS Mata Menteng","RSIA Bunda 2","Konsil Kedokteran Indonesia","Simpang RP Soeroso","Farmasi RP Soeroso","Kanisius","Telkom Grapari","Balai Kota 1","Perpustakaan Nasional","Dana Reksa","Wisma Mandiri 2","Kementrian Agama","Sbr. Jembatan Serong","Jln. Taman Kb. Sirih","JPO Blok E","Pharmin","Explorer Tanah Abang","Blok F","Pospol Jati Bunder","JPO Blok G","Transjakarta Tanah Abang 2"
                ],
                "Kampung Melayu" : [
                    "Transjakarta Tanah Abang 2","Jln. Taman Jatibaru Timur","SMKN 38","Jembatan Serong","Kementrian ESDM","Masjid Ar Rayyan Kementrian BUMN","Dewan Pers","DPRD DKI Jakarta","Sbr. MNC Center","Tugu Tani 2","Graha Jasindo","Sbr. Kanisius","Kantor Pos Cikini","Taman Ismail Marzuki","ABA","PTUN Jakarta","Pegangsaan Timur","Megaria","RSCM 1","RSCM 2","RS Carolus","Kemensos","Matraman 4","Tegalan 2","Tegalan 3","Slamet Riyadi 2","Lapangan Urip Sumoharjo","SMPN 14","Dinas Olahraga dan Pemuda","Term. Kampung Melayu 2"
                ]
            },
            haltes: ["Transjakarta Tanah Abang 2","Jln. Taman Jatibaru Timur","SMKN 38","Jembatan Serong","Kementrian ESDM","Masjid Ar Rayyan Kementrian BUMN","Dewan Pers","DPRD DKI Jakarta","Sbr. MNC Center","Tugu Tani 2","Graha Jasindo","Sbr. Kanisius","Kantor Pos Cikini","Taman Ismail Marzuki","ABA","PTUN Jakarta","Pegangsaan Timur","Megaria","RSCM 1","RSCM 2","RS Carolus","Kemensos","Matraman 4","Tegalan 2","Tegalan 3","Slamet Riyadi 2","Lapangan Urip Sumoharjo","SMPN 14","Dinas Olahraga dan Pemuda","Term. Kampung Melayu 2", "Rusun Jatinegara Barat","RS Hermina","Santa Maria","Bukit Duri","Jln. Kb. Pala II","Slamet Riyadi 1","Kesatriaan","Tegalan 1","Matraman 3","Simpang Matraman","Masjid Jami Matraman","Tugu Proklamasi","Tugu Proklamasi 2","Jln. Penataran","SMPN 8","Teuku Cik Ditiro","RS Mata Menteng","RSIA Bunda 2","Konsil Kedokteran Indonesia","Simpang RP Soeroso","Farmasi RP Soeroso","Kanisius","Telkom Grapari","Balai Kota 1","Perpustakaan Nasional","Dana Reksa","Wisma Mandiri 2","Kementrian Agama","Sbr. Jembatan Serong","Jln. Taman Kb. Sirih","JPO Blok E","Pharmin","Explorer Tanah Abang","Blok F","Pospol Jati Bunder","JPO Blok G","Transjakarta Tanah Abang 2"]
        },
        "5N": {
            start: "Kampung Melayu",
            end: "Ragunan",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/5N-20250417.jpeg",
            operator: "Jewa Dian Mitra (JDM), Trans Swadaya (TSW)",
            busType: ["Hino GB 150", "Mitsubishi Colt FE 84G"],
            directions : {
                "Ragunan" :[
                    "Term. Kampung Melayu", "Bidara Cina","Gelanggang Remaja", "Gelanggang Remaja 1","Klinik Otista","Jln. Otista 1A","Flyover Kampung Melayu","Kampung Melayu Besar 2","Gebu Minang","SMPN 115","Simpang Tebet Utara Dalam Raya","Simpang Tebet Raya Timur","Simpang Tebet Raya Barat","Simpang Tebet Raya Barat 1","Transvision Jln. Tebet Raya","Kec. Tebet 1","Ps. Pedok","Univ. Sahid 1","Taman Rosita","Pemadam Pos Tebet","GPIB Bukit Moria","Pancoran","Tegal Mampang","Mandiri Griya Mampang","SMPN 43","Mampang Prapatan 1","Duren Tiga","Imigrasi 2","Simpang Duren Bangka Timur","SMPN 124","Simpang Kemang Utara Timur","Yamaha Music School Kemang","Jln. Kemang Timur XI","Jln. Kemang Timur XI","Jln. Kemang Timur XVII","Taman Kompleks IIAPCO","Gojek Kemang Timur","Simpang Pejanten Barat Ampera","Arsip Nasional RI 2","Pengadilan Negeri Jaksel 2","Komplek Polri Ragunan","RSIA Kemang","Ampera 4","Ampera 1","Univ. Tarumanegara Cilandak KKO","Sbr. SPBU Cilandak KKO","Gg. Cemara Cilandak KKO","Jln. Kampung Utan Cilandak KKO","Sbr. RS Marinir Cilandak","Sbr. SMK Al Hidayah 1","Simpang Cilandak KKO Margasatwa","Sbr. Pintu Ragunan Barat","Gg. Musholla Ragunan","Gg. Borobudur Ragunan","Gg. Tamansari Ragunan","Ragunan 2","Term. Ragunan"
                ],
                "Kampung Melayu" : [
                    "Term. Ragunan", "Jln. H. Khair","Masjid Nurul Falah Ragunan","PLN Corporate University 2","Badan Diklat Kejaksaan RI", "Ragunan 1","Sbr. Gg. Taman Sari Ragunan","Sbr. Gg. Borobudur Ragunan","Sbr. Gg. Musholla Ragunan","Pintu Barat Ragunan 1","Kav Polri Blok H Jagakarsa","Kav Polri Blok E Jagakarsa","Sekolah Citra Buana","Pemadam Jagakarsa","Gg. Harapan I Jagakarsa","Simpang Margasatwa Cilandak KKO","SMK Al Hidayah 1","SDN Cilandak Timur 01","Sbr. Jln. Kampung Utan","Sbr. Gg. Cemara Cilandak KKO", "SPBU Cilandak KKO","Sbr. Cilandak KKO","Ampera 3","Sekolah Sumbangasih","Ampera Garden","Jln. Kenanga", "STPDN","Pengadilan Negeri Jaksel 1","Arsip Nasional RI 1","Pertigaan Pejanten Barat","Woodlinx Indonesia","Sbr. Taman Kompleks IIAPCO","Sbr. Jln. Kemang Timur XVII","Sbr. Jln. Kemang Timur XI","Sbr. Yamaha Music School Kemang","Simpang Kemang Timur Utara","Simpang Kemang Utara IX","Ps. Warung Buncit","Gg. H. Abdul Wahab", "Duren Tiga","Mampang Prapatan", "Lintas Atas Kuningan Mampang","Pemadam Mampang Prapatan","Transvision","Pancoran","Menara Bidakara","Pancoran Soepomo","Tebet Barat Dalam","Univ. Sahid 2","Komplek Keuangan","Merpati","Kec. Tebet 2","SMKN 32","Simpang Tebet Barat Raya","Simpang Tebet Raya Utara","Sbr.Jln. Tebet Utara IV","Sbr. Jln. Tebet Utara III","Cernivo Village","Jln. Tebet Dalam If","Gg. H. Solihin 1 Tebet","Wisma Laena Tebet","Telkom Tebet","Sawo Kecik Raya","Kampung Melayu Kecil","Kampung Melayu","Term. Kampung Melayu"
                ]
            },
            haltes: ["Term. Kampung Melayu", "Bidara Cina","Gelanggang Remaja", "Gelanggang Remaja 1","Klinik Otista","Jln. Otista 1A","Flyover Kampung Melayu","Kampung Melayu Besar 2","Gebu Minang","SMPN 115","Simpang Tebet Utara Dalam Raya","Simpang Tebet Raya Timur","Simpang Tebet Raya Barat","Simpang Tebet Raya Barat 1","Transvision Jln. Tebet Raya","Kec. Tebet 1","Ps. Pedok","Univ. Sahid 1","Taman Rosita","Pemadam Pos Tebet","GPIB Bukit Moria","Pancoran","Tegal Mampang","Mandiri Griya Mampang","SMPN 43","Mampang Prapatan 1","Duren Tiga","Imigrasi 2","Simpang Duren Bangka Timur","SMPN 124","Simpang Kemang Utara Timur","Yamaha Music School Kemang","Jln. Kemang Timur XI","Jln. Kemang Timur XI","Jln. Kemang Timur XVII","Taman Kompleks IIAPCO","Gojek Kemang Timur","Simpang Pejanten Barat Ampera","Arsip Nasional RI 2","Pengadilan Negeri Jaksel 2","Komplek Polri Ragunan","RSIA Kemang","Ampera 4","Ampera 1","Univ. Tarumanegara Cilandak KKO","Sbr. SPBU Cilandak KKO","Gg. Cemara Cilandak KKO","Jln. Kampung Utan Cilandak KKO","Sbr. RS Marinir Cilandak","Sbr. SMK Al Hidayah 1","Simpang Cilandak KKO Margasatwa","Sbr. Pintu Ragunan Barat","Gg. Musholla Ragunan","Gg. Borobudur Ragunan","Gg. Tamansari Ragunan","Ragunan 2","Term. Ragunan", "Jln. H. Khair","Masjid Nurul Falah Ragunan","PLN Corporate University 2","Badan Diklat Kejaksaan RI", "Ragunan 1","Sbr. Gg. Taman Sari Ragunan","Sbr. Gg. Borobudur Ragunan","Sbr. Gg. Musholla Ragunan","Pintu Barat Ragunan 1","Kav Polri Blok H Jagakarsa","Kav Polri Blok E Jagakarsa","Sekolah Citra Buana","Pemadam Jagakarsa","Gg. Harapan I Jagakarsa","Simpang Margasatwa Cilandak KKO","SMK Al Hidayah 1","SDN Cilandak Timur 01","Sbr. Jln. Kampung Utan","Sbr. Gg. Cemara Cilandak KKO", "SPBU Cilandak KKO","Sbr. Cilandak KKO","Ampera 3","Sekolah Sumbangasih","Ampera Garden","Jln. Kenanga", "STPDN","Pengadilan Negeri Jaksel 1","Arsip Nasional RI 1","Pertigaan Pejanten Barat","Woodlinx Indonesia","Sbr. Taman Kompleks IIAPCO","Sbr. Jln. Kemang Timur XVII","Sbr. Jln. Kemang Timur XI","Sbr. Yamaha Music School Kemang","Simpang Kemang Timur Utara","Simpang Kemang Utara IX","Ps. Warung Buncit","Gg. H. Abdul Wahab", "Duren Tiga","Mampang Prapatan", "Lintas Atas Kuningan Mampang","Pemadam Mampang Prapatan","Transvision","Pancoran","Menara Bidakara","Pancoran Soepomo","Tebet Barat Dalam","Univ. Sahid 2","Komplek Keuangan","Merpati","Kec. Tebet 2","SMKN 32","Simpang Tebet Barat Raya","Simpang Tebet Raya Utara","Sbr.Jln. Tebet Utara IV","Sbr. Jln. Tebet Utara III","Cernivo Village","Jln. Tebet Dalam If","Gg. H. Solihin 1 Tebet","Wisma Laena Tebet","Telkom Tebet","Sawo Kecik Raya","Kampung Melayu Kecil","Kampung Melayu","Term. Kampung Melayu"]
        },
        "7D": {
            start: "TMII",
            end: "Pancoran",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/7D-20241205.jpg",
            operator: "Bayu Holong Persada (BHL), DAMRI (DMR)",
            busType: [
                "Hino RN8 285", "Hino RK8 R260"
             ],
            directions: {
                "Pancoran": ["TMII Pintu 3", "Museum Nasional Visible Storage", "Nizamia Andalusia", "Jln. Bambu Hubuny", "Gerbang Tol Bambu Apus 2", "Jln. Gempol Raya", "Gempol", "RS Adhiyaksa", "Jln. Rawa Segaran", "Jln. Nangka", "Simpang Mabes Hankam", "Jembatan Pintu Satu", "Sbr. Masjid At Tin", "Sbr. RS Moh Ridwan Meuraksa", "Tamini Square 1", "Pondok Gede Raya", "Dukuh 5", "Cawang Sentral", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu"],
                "TMII": ["Pancoran Tugu", "TIS Square", "Tebet Eco Park", "Cikoko", "Ciliwung", "Cawang", "Cawang Sentral", "Tamini Square 2", "RS Moh Ridwan Meuraksa", "Masjid At Tin", "Sbr. Jembatan Pintu Satu", "Green Terrace", "Green Terrace 2", "TMII Pintu 3"]
            },
            haltes: ["TMII Pintu 3", "Museum Nasional Visible Storage", "Nizamia Andalusia", "Jln. Bambu Hubuny", "Gerbang Tol Bambu Apus 2", "Jln. Gempol Raya", "Gempol", "RS Adhiyaksa", "Jln. Rawa Segaran", "Jln. Nangka", "Simpang Mabes Hankam", "Jembatan Pintu Satu", "Sbr. Masjid At Tin", "Sbr. RS Moh Ridwan Meuraksa", "Tamini Square 1", "Pondok Gede Raya", "Dukuh 5", "Cawang Sentral", "Cawang", "Ciliwung", "Cikoko", "Tebet Eco Park", "Pancoran Tugu", "TIS Square", "Tebet Eco Park", "Cikoko", "Ciliwung", "Cawang", "Cawang Sentral", "Tamini Square 2", "RS Moh Ridwan Meuraksa", "Masjid At Tin", "Sbr. Jembatan Pintu Satu", "Green Terrace", "Green Terrace 2", "TMII Pintu 3"]
        },
        "9D": {
            start: "Pasar Minggu",
            end: "Tanah Abang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/9D-20240725.jpg",
            operator: "Mayasari Bakti (MYS)",
              busType: [
                "Mercedes-Benz OH 1626"
             ],
            haltes: ["Term. Pasar Minggu", "Pancoran", "Simpang Kuningan", "Semanggi", "Bundaran HI ASTRA", "M.H Thamrin", "Transjakarta Tanah Abang 2"]
        },
        "11D": {
            start: "Pulo Gebang",
            end: "Pulo Gadung via PIK",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/11D-20250630.jpg",
            operator: "Trans Swadaya (TSW)",
            busType: [
               "Mitsubishi Colt FE 84G"
            ],
            directions: {
                "Pulo Gadung via PIK": ["Pulo Gebang", "SMPN 172","Walikota Jakarta Timur", "Penggilingan", "Simpang Tiga","At Thahirlah","Simpang Kampung Jembatan","SMK Ristek Kikin", "Pintu Masuk PIK", "Sbr. PGP", "Sbr. Pospol PIK Penggilingan", "Taman PIK Penggilingan", "Pajak , Retribusi Penggilingan", "SDN Penggilingan", "Lapangan PIK Penggilingan", "Romantis PIK Penggilingan", "Sbr. Cagar Budaya Batu Penggilingan", "Gapura Rusun Pulo Jahe", "Cagar Budaya Batu Penggilingan","Aneka PIK Penggilingan", "Kel. Penggilingan", "Pospol PIK Penggilingan", "PGP", "Gg. Sawo 1", "Gg. Aim 1", "Perum TPI 1", "Taman Elok 1", "Suzuki", "Al Wathoniyah 1", "Jagal 1", "Kampung Padaengan 1", "United Tractors 1", "Raya Penggilingan", "Cakung United Tractors 2", "Tipar Cakung", "IGI", "PTC Pulo Gadung 1", "Makam Wakaf", "Term. Pulo Gadung"],
                "Pulo Gebang": ["Term. Pulo Gadung", "Warung Jengkol","Jln. Kesadaran Pool Bus 1","Jln. Kesadaran Pool Bus 2","Sbr. PTC Pulo Gadung","Sbr. IGI","Jln. Gg. Swadaya IV","Tipar Cakung 1","Cakung United Tractors 2","United Tractors 2","Sbr. United Tractors Belakang", "Pool Taksi","Kampung Padaengan 2","Jagal 2","Al Wathoniyah 2","Taman Elok 2","Perum Tpi 2","Gg. Aim 2","Gg. Sawo 2","Sbr. PGP","Sbr. Pospol PIK Penggilingan","Taman PIK Penggilingan","Pajak Dan Retribusi Cakung","SDN Penggilingan","Lapangan PIK Penggilingan","Romantis PIK Penggilingan","Sbr. Cagar Budaya Batu Penggilingan","Gapura Rusun Pulo Jahe","Cagar Budaya Batu Penggilingan","Aneka PIK Penggilingan","Pospol PIK Penggilingan","PGP","Pintu Masuk PIK 2","Simpang Kampung Jembatan 2","At Thahiriah 2","Simpang Tiga 2","Walikota Jakarta Timur 2","Pulo Gebang"]
            },
            haltes: ["Pulo Gebang", "SMPN 172","Walikota Jakarta Timur", "Penggilingan", "Simpang Tiga","At Thahirlah","Simpang Kampung Jembatan","SMK Ristek Kikin", "Pintu Masuk PIK", "Sbr. PGP", "Sbr. Pospol PIK Penggilingan", "Taman PIK Penggilingan", "Pajak , Retribusi Penggilingan", "SDN Penggilingan", "Lapangan PIK Penggilingan", "Romantis PIK Penggilingan", "Sbr. Cagar Budaya Batu Penggilingan", "Gapura Rusun Pulo Jahe", "Cagar Budaya Batu Penggilingan","Aneka PIK Penggilingan", "Kel. Penggilingan", "Pospol PIK Penggilingan", "PGP", "Gg. Sawo 1", "Gg. Aim 1", "Perum TPI 1", "Taman Elok 1", "Suzuki", "Al Wathoniyah 1", "Jagal 1", "Kampung Padaengan 1", "United Tractors 1", "Raya Penggilingan", "Cakung United Tractors 2", "Tipar Cakung", "IGI", "PTC Pulo Gadung 1", "Makam Wakaf", "Term. Pulo Gadung", "Warung Jengkol","Jln. Kesadaran Pool Bus 1","Jln. Kesadaran Pool Bus 2","Sbr. PTC Pulo Gadung","Sbr. IGI","Jln. Gg. Swadaya IV","Tipar Cakung 1","Cakung United Tractors 2","United Tractors 2","Sbr. United Tractors Belakang", "Pool Taksi","Kampung Padaengan 2","Jagal 2","Al Wathoniyah 2","Taman Elok 2","Perum Tpi 2","Gg. Aim 2","Gg. Sawo 2","Sbr. PGP","Sbr. Pospol PIK Penggilingan","Taman PIK Penggilingan","Pajak Dan Retribusi Cakung","SDN Penggilingan","Lapangan PIK Penggilingan","Romantis PIK Penggilingan","Sbr. Cagar Budaya Batu Penggilingan","Gapura Rusun Pulo Jahe","Cagar Budaya Batu Penggilingan","Aneka PIK Penggilingan","Pospol PIK Penggilingan","PGP","Pintu Masuk PIK 2","Simpang Kampung Jembatan 2","At Thahiriah 2","Simpang Tiga 2","Walikota Jakarta Timur 2","Pulo Gebang"]
        },
        "11Q": {
            start: "Pulo Gebang",
            end: "Kampung Melayu via BKT",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/11Q-20240202.jpg",
            operator: "PT Transportasi Jakarta (TJ) , DAMRI (DMR)",
            busType: [
                "Skywell NJL6129BEV",
                "Mercedes-Benz O500U",
                "Scania K250UB"
            ],
            directions: {
                "Kampung Melayu via BKT": ["Pulo Gebang", "SMPN 172", "Walikota Jakarta Timur 2", "Penggilingan 2", "Perumnas Klender 1", "Rusun Klender", "Flyover Radin Inten 1", "SMKN 48", "Budhaya Santo Agustinus", "Gedung Senam", "Taman UT Aheme", "Masjid Jami Nurul Ain 2", "Sbr. Swadaya Raya", "Jln. Kelurahan Raya", "RS Duren Sawit", "Komplek Abadi 2", "Komplek Wijaya Kusuma 2", "Jln. Melati Bakti", "Masjid Jami At Taqwa 2", "Cipinang Indah", "Simpang Perintis 2", "SMAN 100", "Nusantara", "Sbr . Ps. Inpres Cipinang Besar", "Mall Basura 2", "Awab Dalam", "Sekolah Cahaya Sakti Otista", "Bidara Cina 1", "Bidara Cina 2", "Term. Kampung Melayu 4"],
                "Pulo Gebang": ["Term. Kampung Melayu 4", "Rusun Jatinegara Barat", "RS Hermina", "Santa Maria", "Bukit Duri", "SMPN 14", "Jatinegara RS Premier 1", "Masjid Jami Al Inayah", "Mall Basura 1", "Ps. Inpres Cipinang Besar", "Hero Basuki Rahmat", "Simpang Perintis 1", "Cipinang BKT", "Masjid Jami At Taqwa", "Jln. Masjid Abidin", "Komplek Wijaya Kusuma 1", "Komplek Abadi 1", "Baladewa Residence", "Masjid Jami Al Barkah 1", "Jln. Serdang", "Jln. Swadaya Raya", "Masjid Jami Nurul Ain 1", "Jln. H. Aman", "Wisma Atlet Radin Inten", "Dinas Kebersihan Duren Sawit", "Buaran Plaza", "Taman Buaran Indah", "Flyover Radin Inten 2", "Perumnas Klender 2", "Penggilingan 1", "Walikota Jakarta Timur 1", "Pulo Gebang"]
            },
            haltes: ["Pulo Gebang", "SMPN 172", "Walikota Jakarta Timur 2", "Penggilingan 2", "Perumnas Klender 1", "Rusun Klender", "Flyover Radin Inten 1", "SMKN 48", "Budhaya Santo Agustinus", "Gedung Senam", "Taman UT Aheme", "Masjid Jami Nurul Ain 2", "Sbr. Swadaya Raya", "Jln. Kelurahan Raya", "RS Duren Sawit", "Komplek Abadi 2", "Komplek Wijaya Kusuma 2", "Jln. Melati Bakti", "Masjid Jami At Taqwa 2", "Cipinang Indah", "Simpang Perintis 2", "SMAN 100", "Nusantara", "Sbr . Ps. Inpres Cipinang Besar", "Mall Basura 2", "Awab Dalam", "Sekolah Cahaya Sakti Otista", "Bidara Cina 1", "Bidara Cina 2", "Term. Kampung Melayu 4", "Rusun Jatinegara Barat", "RS Hermina", "Santa Maria", "Bukit Duri", "SMPN 14", "Jatinegara RS Premier 1", "Masjid Jami Al Inayah", "Mall Basura 1", "Ps. Inpres Cipinang Besar", "Hero Basuki Rahmat", "Simpang Perintis 1", "Cipinang BKT", "Masjid Jami At Taqwa", "Jln. Masjid Abidin", "Komplek Wijaya Kusuma 1", "Komplek Abadi 1", "Baladewa Residence", "Masjid Jami Al Barkah 1", "Jln. Serdang", "Jln. Swadaya Raya", "Masjid Jami Nurul Ain 1", "Jln. H. Aman", "Wisma Atlet Radin Inten", "Dinas Kebersihan Duren Sawit", "Buaran Plaza", "Taman Buaran Indah", "Flyover Radin Inten 2", "Perumnas Klender 2", "Penggilingan 1", "Walikota Jakarta Timur 1", "Pulo Gebang"]
        },
        
    },
    "TransJabodetabek": {
    "B11": {
            start: "Summarecon Bekasi",
            end: "Cawang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/B11-20250516.jpg",
            busType: ["Mercedes-Benz O500U",
                "Scania K250UB"],
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 21 }
                },
                },
            operator: "Transjakarta (TJ)",
            directions: {
                "Summarecon Bekasi": ["BNN 2","Jatibening 2","Kayuringin 2","RS Mitra Keluarga 2","Bandar Djakarta Bekasi", "Summarecon Bekasi"],
                "Cawang": ["Summarecon Bekasi", "RS Mitra Keluarga 1","Kayuringin 1","Mega Mall Bekasi","Tol Barat 2","Jatibening 1","Pool Taksi Cawang","BNN 2"]
},
            haltes: ["Summarecon Bekasi", "RS Mitra Keluarga 1","Kayuringin 1","Mega Mall Bekasi","Tol Barat 2","Jatibening 1","Pool Taksi Cawang","BNN 2","Jatibening 2","Kayuringin 2","RS Mitra Keluarga 2","Bandar Djakarta Bekasi", "Summarecon Bekasi"]
        },
    "B21": {
            start: "Bekasi Timur",
            end: "Cawang",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/B21-20250516.jpg",
            busType: ["Mercedes-Benz O500U",
                "Scania K250UB"],
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 21 }
                },
                },
            operator: "Transjakarta (TJ)",
            directions: {
                "Bekasi Timur": ["BNN 2","Jatibening 2","Tol Bekasi Timur 2","Gp Mall 2","BTC 2","Jln. Kunang Kunang 2", "Masjid Amar Maruf 2","Kemensos Bekasi Timur","Bulak Kapal 4","Superindo Bulak Kapal 2","Taman Margahayu 2","Groserindo","Terminal Bekasi", "Jln. Bakti","Taman Margahayu 1","Superindo Bulak Kapal 1", "Bulak Kapal 3"],
                "Cawang": ["Bulak Kapal 3","Pom Bensin Mulyadi","Masjid Amar Maruf 1","Jln. Kunang Kunang","BTC 1","Gp Mall 1","Grand Dhika City","Tol Bekasi Timur 1","Jatibening 1","Pool Taksi Cawang","BNN 2"]
},
            haltes: ["Bulak Kapal 3","Pom Bensin Mulyadi","Masjid Amar Maruf 1","Jln. Kunang Kunang","BTC 1","Gp Mall 1","Grand Dhika City","Tol Bekasi Timur 1","Jatibening 1","Pool Taksi Cawang","BNN 2","Jatibening 2","Tol Bekasi Timur 2","Gp Mall 2","BTC 2","Jln. Kunang Kunang 2", "Masjid Amar Maruf 2","Kemensos Bekasi Timur","Bulak Kapal 4","Superindo Bulak Kapal 2","Taman Margahayu 2","Groserindo","Terminal Bekasi", "Jln. Bakti","Taman Margahayu 1","Superindo Bulak Kapal 1", "Bulak Kapal 3"]
        },
        "B25": {
            start: "Bekasi",
            end: "Galunggung",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/B25-20250703.jpg",
            busType: ["Mercedes-Benz OH 1526",
                "Mercedes-Benz OH 1626"],
            operator: "Transjakarta (TJ), Mayasari Bakti (MYS)",
            directions: {
                "Bekasi": ["Galunggung", "Halimun","Pasar Rumput","Manggarai","Timur St. Manggarai","Matraman Baru","Stasiun Jatinegara","Flyover Jatinegara","Jln. MM Hasibuan Bekasi","Melati Cut Mutia","Sbr. GOR Betos Cut Mutia","Terminal Bekasi"],
                "Galunggung": ["Terminal Bekasi","GOR Betos Cut Mutia", "Rawa Baru Cut Mutia","Unisma","Sbr. Unisma","Chairil Anwar 1","Sbr. Jln. MM Hasibuan Bekasi","Pedati Prumpung","Stasiun Jatinegara","Jatinegara","Kampung Melayu","Matraman Baru","Plaza St. Manggarai","Manggarai","Pasar Rumput","Halimun","Galunggung"]
},
            haltes: ["Terminal Bekasi","GOR Betos Cut Mutia", "Rawa Baru Cut Mutia","Unisma","Sbr. Unisma","Chairil Anwar 1","Sbr. Jln. MM Hasibuan Bekasi","Pedati Prumpung","Stasiun Jatinegara","Jatinegara","Kampung Melayu","Matraman Baru","Plaza St. Manggarai","Manggarai","Pasar Rumput","Halimun","Galunggung", "Halimun","Pasar Rumput","Manggarai","Timur St. Manggarai","Matraman Baru","Stasiun Jatinegara","Flyover Jatinegara","Jln. MM Hasibuan Bekasi","Melati Cut Mutia","Sbr. GOR Betos Cut Mutia","Terminal Bekasi"]
        },
    "B41": {
            start: "Vida Bekasi",
            end: "Cawang Sentral via Jatiasih",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/B41-20250515.jpg",
            busType: "Mercedes-Benz OH 1626",
            operationalSchedule: {
                weekday: {
                    days: [0,1, 2, 3, 4, 5,6], // Senin-Jumat
                    hours: { start: 5, end: 22 }
                },
                },
            operator: "Mayasari Bakti (MYS)",
            haltes: ["Marketing Office Vida (Penaikan)", "Simpang Cipendawa 1", "Komsen", "Jatibening 1", "Pool Taksi Cawang", "Cawang Sentral", "Jatibening 2", "Komsen", "Simpang Cipendawa 2", "Marketing Office Vida (Penurunan)"]
        },
         "P11": {
            start: "Blok M",
            end: "Bogor",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/P11-20250630.jpg",
             busType: ["Mercedes-Benz OH 1626","Mercedes-Benz OH 1526"],
            operator: "PT Transportasi Jakarta (TJ) , Mayasari Bakti (MYS)",
            directions: {
                "Bogor": ["Blok M","Pasar Santa","Rawa Barat","Pancoran","Pancoran Tugu","Buperta Cibubur","Pintu Tol Citeureup 2", "Monumen Pancakarsa","Mall Bellanova Sentul", "Botani Square"],
                "Blok M": ["Botani Square", "Mall Bellanova Sentul","Sentul","Simpang Sentul","Pintu Tol Citeureup 2", "Cibubur Junction", "Pancoran","Tegal Mampang","Rawa Barat","Pasar Santa","Kejaksaan Agung","Blok M"]
},
            haltes: ["Blok M", "Kejaksaan Agung","Pasar Santa","Rawa Barat","Tegal Mampang","Pancoran","Pancoran Tugu","Buperta Cibubur","Pintu Tol Citeureup 2", "Monumen Pancakarsa","Mall Bellanova Sentul", "Botani Square", "Mall Bellanova Sentul","Sentul","Simpang Sentul","Pintu Tol Citeureup 2", "Cibubur Junction"]
        },
    "T31": {
            start: "PIK 2",
            end: "Blok M",
            map: "https://smk.transjakarta.co.id/aset/berkas/rute/T31-20250624.jpg",
            busType: "Mercedes-Benz OH 1626",
            operator: "PT Transportasi Jakarta (TJ) , Mayasari Bakti (MYS)",
            directions: {
                "Blok M": ["PIK 2", "Mega Kuningan PIK 2","NICE", "San Antonio","Sedayu Watertown","Menara Syariah","Aloha","Pantai Pasir Putih 1","Marketing Gallery","Pantai Maju","PIK Avenue","Kemanggisan","Petamburan","Gerbang Pemuda","Senayan BANK DKI","Masjid Agung","Kejaksaan Agung","Blok M"],
                "PIK 2": ["Blok M","ASEAN", "Masjid Agung", "Senayan BANK DKI","Gerbang Pemuda", "Petamburan","Buddha Tzu Chi", "Pantai Pasir Putih","Thamrin CBD","Spring Ville","Tokyo Riverside Selatan","PIK 2"]
            },
            haltes: ["PIK 2", "Mega Kuningan PIK 2","NICE", "San Antonio","Sedayu Watertown","Menara Syariah","Aloha","Pantai Pasir Putih 1","Marketing Gallery","Pantai Maju","PIK Avenue","Kemanggisan","Petamburan","Gerbang Pemuda","Senayan BANK DKI","Masjid Agung","Kejaksaan Agung","Blok M","ASEAN", "Masjid Agung", "Senayan BANK DKI","Gerbang Pemuda", "Petamburan","Buddha Tzu Chi", "Pantai Pasir Putih","Thamrin CBD","Spring Ville","Tokyo Riverside Selatan","PIK 2"]
        },
}
        
};

export const integrasiBadge = {
    "Velbak": ["8"],
    "Kebayoran": ["13"],
    "Semanggi": ["1"],
    "Bendungan Hilir": ["9"],
    "Senen TOYOTA Rangga": ["5"],
    "Senen Sentral": ["2"],
    "CSW": ["1", "4K"],
    "ASEAN": ["13", "13B","13E", "4K"],
    "Kejaksaan Agung": ["13", "13B","13E" ],
    "Cempaka Mas": ["10"],
    "Simpang Cempaka": ["2"],
    "Dukuh Atas": ["4"],
    "Galunggung": ["1"],
    "Term. Kampung Melayu 4": ["5", "11"],
};

export const halteIntegrasi = [
    // [halte1, halte2, keterangan]
    ["Velbak", "Kebayoran", "JPO Integrasi"],
    ["Simpang Cempaka", "Cempaka Mas", "JPO Integrasi 300m"],
    ["CSW", "ASEAN", "JPO Integrasi"],
    ["Kejaksaan Agung", "CSW", "JPO Integrasi"],
    ["Kejaksaan Agung", "ASEAN", "JPO Integrasi"],
    ["Galunggung", "Dukuh Atas", "JPO Integrasi"],
    ["Bendungan Hilir", "Semanggi", "Jalan kaki ±300m"],
    ["Senen Sentral", "Senen TOYOTA Rangga", "JPO Integrasi jalan kaki ±90m"],
];

export const integrasiTransportasi = {
    // KRL Commuter Line
    "Kota": [{ tipe: "KRL", nama: "Stasiun Jakarta Kota" }],
    "Stasiun Jatinegara": [{ tipe: "KRL", nama: "Stasiun Jatinegara" }],
    "Juanda": [{ tipe: "KRL", nama: "Stasiun Juanda" }],
    "Cikoko": [{ tipe: "KRL", nama: "Stasiun Cawang" }, { tipe: "LRT", nama: "Stasiun LRT Cikoko" }],
    "Dukuh Atas": [{ tipe: "KRL", nama: "Stasiun Sudirman" }, { tipe: "MRT", nama: "Stasiun MRT Dukuh Atas BNI" }, { tipe: "LRT", nama: "Stasiun LRT Dukuh Atas" }],
    "Galunggung": [{ tipe: "KRL", nama: "Stasiun Sudirman" }, { tipe: "MRT", nama: "Stasiun MRT Dukuh Atas BNI" }, { tipe: "LRT", nama: "Stasiun LRT Dukuh Atas" }],
    "Tanah Abang": [{ tipe: "KRL", nama: "Stasiun Tanah Abang" }],
    "Manggarai": [{ tipe: "KRL", nama: "Stasiun Manggarai" }],
    "Kampung Bandan": [{ tipe: "KRL", nama: "Stasiun Kampung Bandan" }],
    "Grogol": [{ tipe: "KRL", nama: "Stasiun Grogol" }],
    "Stasiun Klender": [{ tipe: "KRL", nama: "Stasiun Klender" }],
    "Tanjung Priok": [{ tipe: "KRL", nama: "Stasiun Tanjung Priok" }],

    // MRT Jakarta
    "Bundaran HI ASTRA": [{ tipe: "MRT", nama: "Stasiun MRT Bundaran HI" }],
    "Lebak Bulus": [{ tipe: "MRT", nama: "Stasiun MRT Lebak Bulus" }],
    "Tosari": [{ tipe: "MRT", nama: "Stasiun MRT Tosari" }],
    "Setiabudi": [{ tipe: "MRT", nama: "Stasiun MRT Setiabudi Astra" }],
    "Bendungan Hilir": [{ tipe: "MRT", nama: "Stasiun MRT Bendungan Hilir" }],
    "Senayan BANK DKI": [{ tipe: "MRT", nama: "Stasiun MRT Senayan" }],
    "ASEAN": [{ tipe: "MRT", nama: "Stasiun MRT ASEAN" }],
    "CSW": [{ tipe: "MRT", nama: "Stasiun MRT ASEAN" }],
    "Blok M": [{ tipe: "MRT", nama: "Stasiun MRT Blok M" }],
    "Polda Metro Jaya": [{ tipe: "MRT", nama: "Stasiun MRT Istora" }],
    "Karet": [{ tipe: "MRT", nama: "Stasiun MRT Bendungan Hilir" }],
    
    // LRT Jabodebek
    "Cawang": [{ tipe: "LRT", nama: "Stasiun LRT Cawang" }],
    "Kampung Rambutan": [{ tipe: "LRT", nama: "Stasiun LRT Kampung Rambutan" }],
    "Setiabudi": [{ tipe: "LRT", nama: "Stasiun LRT Setiabudi" }],
    "Rasuna Said": [{ tipe: "LRT", nama: "Stasiun LRT Rasuna Said" }],
    "Kuningan": [{ tipe: "LRT", nama: "Stasiun LRT Kuningan" }],
    "Pancoran": [{ tipe: "LRT", nama: "Pancoran BANK BJB" }],
    "Cikoko": [{ tipe: "LRT", nama: "Stasiun LRT Cikoko" }],
    "Ciliwung": [{ tipe: "LRT", nama: "Stasiun LRT Ciliwung" }],
    "Makasar": [{ tipe: "LRT", nama: "Stasiun LRT Taman Mini" }],

    // Integrasi lainnya
    "Simpang Buaran": [{ tipe: "KRL", nama: "Stasiun Buaran (via JPO)" }],
    "Flyover Radin Inten 1": [{ tipe: "KRL", nama: "Stasiun Klender Baru (via JPO)" }],
    "Senen TOYOTA Rangga": [{ tipe: "KRL", nama: "Stasiun Pasar Senen" }],
    "Matraman Baru": [{ tipe: "KRL", nama: "Stasiun Matraman" }],
    "Gambir 2": [{ tipe: "KRL", nama: "Stasiun Gambir" }],
};
