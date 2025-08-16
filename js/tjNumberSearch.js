// Mapping logo/gambar karoseri, operator, chasis
const logoKaroseri = {
  "Laksana": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpn7XVnx7AM_AGSwg1jw5VF6-VfEprDXKDOA&s",
  "Nusantara Gemilang": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQP11eiXIcGub2JAaovfFTaD03hdYqmTAVEbw&s", // placeholder
  "Zhongtong": "https://upload.wikimedia.org/wikipedia/commons/2/2a/Zhongtong_logo_placeholder.png", // placeholder
  "Rahayu Sentosa": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTCLGI0la88DadG0Wd8RNxBYethXJLxaMB69Q&s",
  "Tentrem": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQxYpv4FydL2AGy2rSplzmWVMO92LhcUVzInQ&s",
  "Restu Ibu": "https://karoseribusrestuibu.wordpress.com/wp-content/uploads/2013/03/logo-1-copy_1.png",
};

const logoOperator = {
  "DAMRI": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS3W_7so1RHIYKRUmu4d-u_znAJ_iy-aTnCyA&s", // placeholder
  "Mayasari Bakti": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQMgJIInaKA-3ZEH-4EHVN5HCcEDONluWsBEg&s", // placeholder
  "Sinar Jaya": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTYRJ-Q-FsRKcr_h3T0kg9Mq6gncMktniU3-Q&s", // Sinar Jaya
  "Steady Safe": "https://steadysafetbk.co.id/wp-content/uploads/2022/08/LOGO-PT.-STEADY-SAFE-Tbk-Color-1.png", // Steady Safe
  "Bianglala Metropolitan": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPIPrMJa-hFy3Bgn4-iuybIpOneKEspkGiGw&s", // BMP
  "Pahala Kencana Transportation": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTbu5QUTsaredjAkDMv8QN54ZJaZwMMR91F6w&s", // PKT
  "PT Transportasi Jakarta": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/TransJakarta_Logo.svg/2560px-TransJakarta_Logo.svg.png",
  "Swakelola Transjakarta": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/TransJakarta_Logo.svg/2560px-TransJakarta_Logo.svg.png",
  "Bayu Holong Persada": "https://images.glints.com/unsafe/glints-dashboard.oss-ap-southeast-1.aliyuncs.com/company-logo/07d80154d16da4f9e516883fe6d9c328.png",
  "Jewa Dian Mitra": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS95OI_9C-MbKXkrtS8dOdYHWUx-M8fu6buqw&s",
  "Koperasi Wahana Kalpika": "https://absen.e-kwk.com/assets/img/logokwk.png",
  "Komilet Jaya": "https://images.msha.ke/00f33e2a-f5b6-4735-b503-6b1f3bd78542?auto=format%2Ccompress&cs=tinysrgb&q=30&w=828",
};

// Mapping logo chasis (brand)
const logoChasis = {
  "Skywell": "https://i.namu.wiki/i/kVKeJelXva9NOvjlNXfOCAA674UhYmjn4j1LwSgvlJwAKU_8DQIrYPpKP9s_WjEXTsJHNgEVo4p3whuk6lghlA.webp",
  "Zhongtong": "https://www.carlogos.org/car-logos/zhongtong-logo-1400x1100.png",
  "Scania": "https://logos-world.net/wp-content/uploads/2022/12/Scania-Logo.png", // Scania
  "Mercedes-Benz": "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh0KKy7H6VeaJ7qYw8kcq_C-Vgmb6o9dqov5uLkUZIKCX-URZTroCSPrv2Rdtv35VMeUmcGRrWc9p4xzh71_p5r7zm8GH9m1rcrGmYrwF_33nMrCLKTIhqOf7iMvl4SEXxbH0fJlv1xHX6Ti7tY4oopw-esuO8XAPmQDRoNZttmfuFBsSSr8NALxA/w320-h247/Mercedes-Benz-(Koleksilogo.com).png",
  "Hino": "https://upload.wikimedia.org/wikipedia/id/5/5d/Logo_Hino.png",
  "MAN": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Logo_MAN.png/1200px-Logo_MAN.png",
  "VKTR": "https://e-ipo.co.id/en/pipeline/get-logo?id=237", // VKTR
  "Volvo": "https://images.seeklogo.com/logo-png/15/2/volvo-logo-png_seeklogo-150600.png", // Volvo
  "Golden Dragon": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Golden_Dragon_logo_2.png/1200px-Golden_Dragon_logo_2.png", // Golden Dragon
  "Mitsubishi": "https://upload.wikimedia.org/wikipedia/commons/9/9a/Mitsubishi_motors_new_logo.svg",

};

// Contoh cara pakai di render:
// <img src="${logoKaroseri[bus.karoseri] || logoKaroseri['CBU']}" alt="${bus.karoseri}" ... />
// <img src="${logoOperator[bus.operator] || 'default.png'}" alt="${bus.operator}" ... />
// <img src="${gambarChasis[bus.tipe] || 'default_chasis.png'}" alt="${bus.tipe}" ... />

// --- DATA RANGE BUS UTAMA UNTUK SEARCH & SUGGESTION (SATU SUMBER DATA) ---
const busRangeData = [
  // Contoh entry, copy/ubah dari logic lama
  // KODE BUS DAN OPERATOR
  // BIANGLALA METROPOLITAN
  { 
    prefix: 'BMP', start: 240322, end: 240411, operator: 'Bianglala Metropolitan', tipe: 'SAG Golden Dragon Pivot E12', warna: 'Putih Biru Tua', bahanBakar: 'Listrik', karoseri: 'CBU', catatan: 'BRT', isBMPGoldenDragon: true, isSingle: true 
  },
  { 
    prefix: 'BMP', start: 230300, end: 230321, operator: 'Bianglala Metropolitan', tipe: 'SAG Golden Dragon Pivot E12', warna: 'Putih Orange', bahanBakar: 'Listrik', karoseri: 'CBU', catatan: 'Non BRT', isBMPGoldenDragon: true, isSingle: true 
  },
  { prefix: 'BMP', start: 220252, end: 220299, operator: 'Bianglala Metropolitan', tipe: 'Mercedes Benz OH 1626 A/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Tri Sakti', isBMP: true, isSingle: true },
  { prefix: 'BMP', start: 242, end: 251, operator: 'Bianglala Metropolitan', tipe: 'Mercedes Benz OH 1626 A/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Tri Sakti', isBMP: true, isSingle: true },
{ prefix: 'BMP', start: 1, end: 241, operator: 'Bianglala Metropolitan', tipe: 'Hino RK8 R260', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: ['Rahayu Sentosa', 'Restu Ibu Pusaka', 'Laksana'], isBMP: true, isSingle: true },
{ prefix: 'BMP', start: 252, end: 400, operator: 'Bianglala Metropolitan', tipe: 'Hino RK8 R260', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: ['Rahayu Sentosa', 'Restu Ibu Pusaka', 'Laksana'], isBMP: true, isSingle: true },

  // MAYASARI BAKTI
  {
    prefix: 'MB', start: 1601, end: 1656, operator: 'Mayasari Bakti', tipe: 'Scania K320IA', warna: 'Putih-Biru Muda', bahanBakar: 'BBG', karoseri: 'Laksana', catatan: 'Bus Gandeng',  isGandeng: true
  },
  { 
    prefix: 'MYS', start: 19203, end: 19233, operator: 'Mayasari Bakti', tipe: 'Mercedes-Benz OH 1626', warna: 'Putih-Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', isSingle: true 
  },
  { 
    prefix: 'MYS', start: 21224, end: 21333, operator: 'Mayasari Bakti', tipe: 'Mercedes-Benz OH 1626', warna: 'Putih-Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', catatan:'Bus Generasi 2 1626', isSingle: true 
  },
  //scania k310ib MYS
  { 
    prefix: 'MYS', start: 17001, end: 17110, operator: 'Mayasari Bakti', tipe: 'Scania K310IB', warna: '', bahanBakar: 'Diesel', karoseri: 'Laksana', isMaxi: true 
  },
  { 
    prefix: 'MYS', start: 18111, end: 18150, operator: 'Mayasari Bakti', tipe: 'Scania K310IB', warna: '', bahanBakar: 'Diesel', karoseri: 'Laksana', isMaxi: true 
  },
  //byd b12 mys
  {
    prefix: 'MYS', start: 22334, end: 22363, operator: 'Mayasari Bakti', tipe: 'VKTR BYD B12', warna: 'Tosca', bahanBakar: 'Listrik', karoseri: 'CBU', catatan: 'Non BRT', isLowdeck: true 
  },
  {
    prefix: 'MYS', start: 23364, end: 23385, operator: 'Mayasari Bakti', tipe: 'VKTR BYD B12', warna: 'Putih Orange', bahanBakar: 'Listrik', karoseri: 'CBU', catatan: 'Non BRT', isLowdeck: true 
  },

  // STEADY SAFE (SAF)
  {
    prefix: 'SAF', start: 1, end: 119, operator: 'Steady Safe', tipe: 'Volvo B11R', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', isMaxi: true
  },

  // PAHALA KENCANA TRANSPORTATION
  {
    prefix: 'PKT', start: 101, end: 115, operator: 'Pahala Kencana Transportation', tipe: 'Mercedes-Benz OH 1626 M/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', depo: 'Pegangsaan Dua', isSingle: true // bus single
  },

  // DAMRI
  // ZHONGTONG
  {
    prefix: 'DMR', start: 704, end: 763, operator: 'DAMRI', tipe: 'Zhongtong Bus LCK6180GC', warna: 'Putih-Biru Tua', bahanBakar: 'BBG', karoseri: 'CBU', pool: 'Klender', catatan: 'Bus Gandeng', isGandeng: true // bus gandeng
  },
  { 
    prefix: 'DMR', start: 240125, end: 240154, operator: 'DAMRI', tipe: 'Zhongtong Bus LCK6126EVGRA1', warna: 'Putih-Biru Tua', bahanBakar: 'Listrik', karoseri: 'CBU', pool: 'Klender', catatan: 'BRT', isZhongtong: true, isSingle: true 
  },
  { 
    prefix: 'DMR', start: 250155, end: 250224, operator: 'DAMRI', tipe: 'Zhongtong Bus LCK6126EVGRA2', warna: 'Putih-Biru Tua', bahanBakar: 'Listrik', karoseri: 'CBU', pool: 'Klender', catatan: 'BRT', isZhongtong: true, isSingle: true 
  },
  // SKYWELL
  { 
    prefix: 'DMR', start: 240155, end: 240214, operator: 'DAMRI', tipe: 'Skywell NJL6126BEV', warna: 'Putih-Biru Tua', bahanBakar: 'Listrik', karoseri: 'CBU', pool: 'Cakung', catatan: 'BRT', isSkywell: true, isLowdeck: true 
  },
  { 
    prefix: 'DMR', start: 230099, end: 230124, operator: 'DAMRI', tipe: 'Skywell NJL6129BEV', warna: 'Putih Orange', bahanBakar: 'Listrik', karoseri: 'CBU', catatan: 'Non BRT', isSkywellNonBRT: true, isLowdeck: true 
  },
  // HINO RK8 R260
  { 
    prefix: 'DMR', start: 104, end: 153, operator: 'DAMRI', tipe: 'Hino RK8 R260', warna: 'Biru', bahanBakar: 'Diesel', karoseri: 'Restu Ibu Pusaka', isSingle: true 
  },
  { prefix: 'DMR', start: 154, end: 353, operator: 'DAMRI', tipe: 'Hino RK8 R260', warna: 'Biru', bahanBakar: 'Diesel', karoseri: 'Rahayu Sentosa', isSingle: true 

  },
  { 
    prefix: 'DMR', start: 354, end: 503, operator: 'DAMRI', tipe: 'Hino RK8 R260', warna: 'Biru', bahanBakar: 'Diesel', karoseri: 'Laksana', isDMRHino: true 
  },
  { 
    prefix: 'DMR', start: 604, end: 703, operator: 'DAMRI', tipe: 'Hino RK8 R260', warna: 'Biru', bahanBakar: 'Diesel', karoseri: 'Laksana', isDMRHino: true 
  },

  // PT TRANSPORTASI JAKARTA - BUS WISATA & BUS TINGKAT
  {
    prefix: 'TJ', start: 188, end: 238, operator: 'PT Transportasi Jakarta', tipe: 'Scania K320IA', warna: 'Putih Biru Muda', bahanBakar: 'BBG', karoseri: 'Laksana', pool: 'Pulo Gadung', isGandeng: true,// bus gandeng
  },
  { 
    prefix: 'TJ', start: 187, end: 187, operator: 'PT Transportasi Jakarta', tipe: 'Scania K340IA', warna: 'Putih Biru Muda', bahanBakar: 'BBG', karoseri: 'Gemilang Coachworks', pool: 'Pulo Gadung', isTJ: true, isGandeng: true 
  },

  { prefix: 'TJ', start: 347, end: 354, operator: 'PT Transportasi Jakarta', tipe: 'MAN R37', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Nusantara Gemilang', pool: 'Cawang', catatan: 'Bus Wisata', isTingkat: true },
  { prefix: 'TJ', start: 351, end: 351, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OC 500 RF 2542', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Nusantara Gemilang', pool: 'Cawang', catatan: 'Bus Wisata', isTingkat: true },
  { prefix: 'TJ', start: 381, end: 387, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OC 500 RF 2542', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'New Armada', pool: 'Cawang', catatan: 'Bus Wisata', isTingkat: true },
  { prefix: 'TJ', start: 884, end: 884, operator: 'PT Transportasi Jakarta', tipe: 'SCANIA K310UB', warna: 'Merah Putih', bahanBakar: 'Diesel', karoseri: 'Adi Putro', pool: 'Cawang', catatan: 'Bus Wisata', isTingkat: true },

  { prefix: 'TJ', start: 247, end: 346, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OH 1526 M/T', warna: 'Putih Biru Muda', bahanBakar: 'BBG', karoseri: ['Laksana', 'Rahayu Sentosa', 'Tri Sakti', 'Tentrem'], pool: 'Cawang', catatan: 'Bus BRT', isSingle: true },
{ prefix: 'TJ', start: 355, end: 380, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OC 500 RF 2542', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Nusantara Gemilang', pool: 'Cawang', catatan: 'Bus BRT Maxi', isMaxi: true },
{ prefix: 'TJ', start: 388, end: 408, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OH 1626 A/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: 'Cawang', catatan: 'Bus BRT', isSingle: true },
{ prefix: 'TJ', start: 469, end: 482, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OH 1626 A/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Restu Ibu Pusaka', pool: 'Cawang', catatan: 'Bus BRT', isSingle: true },
{ prefix: 'TJ', start: 872, end: 881, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OH 1626 M/T', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: 'Cawang', catatan: 'Bus BRT', isSingle: true },
{ prefix: 'TJ', start: 409, end: 468, operator: 'PT Transportasi Jakarta', tipe: 'HINO RK1 JSNL', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'New Armada', pool: 'Kedaung Kali Angke', catatan: 'Bus BRT', isSingle: true },

{ prefix: 'TJ', start: 483, end: 531, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz O 500U 1726', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: ['Kedaung Kali Angke', 'Kampung Rambutan'], catatan: 'Bus-Non BRT', isLowdeck: true },

{ prefix: 'TJ', start: 782, end: 871, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz O 500U 1726', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'Nusantara Gemilang', pool: ['Kedaung Kali Angke', 'Kampung Rambutan'], catatan: 'Bus Non-BRT', isLowdeck: true },

{ prefix: 'TJ', start: 632, end: 781, operator: 'PT Transportasi Jakarta', tipe: 'SCANIA K250UB', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: ['Kedaung Kali Angke', 'Pinang Ranti'], catatan: 'Bus Non-BRT', isLowdeck: true },

{ prefix: 'TJ', start: 532, end: 631, operator: 'PT Transportasi Jakarta', tipe: 'Mercedes Benz OF 917', warna: 'Putih Ungu', bahanBakar: 'Diesel', karoseri: ['Tentrem', 'New Armada'], pool: ['Kedaung Kali Angke', 'Kampung Rambutan'], catatan: 'Bus Royaltrans', isLowdeck: true },

// TRANS SWADAYA
{ prefix: 'TSW', start: 1, end: 1, operator: 'Swakelola Transjakarta', tipe: 'Mitsubishi Colt FE 84G', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'New Armada', pool: 'Pulo Gadung', catatan: 'Non BRT', isSingle: true },
{ prefix: 'TSW', start: 2, end: 100, operator: 'Swakelola Transjakarta', tipe: 'Mitsubishi Colt FE 84G', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'New Armada', pool: 'Kedaung Kali Angke', catatan: 'Non BRT', isSingle: true },


  // SINAR JAYA MEGAH LANGGENG
  { prefix: 'SJM', start: 240001, end: 240020, operator: 'Sinar Jaya', tipe: 'VKTR BYD D9', warna: 'Putih-Biru Tua', bahanBakar: 'Listrik', karoseri: 'Laksana',pool: 'Cakung', isSingle: true },

  // BAYU HOLONG PERSADA
  { prefix: 'BHL', start: 220508, end: 220515, operator: 'Bayu Holong Persada', tipe: 'Hino RN8 285', warna: 'Putih Biru Tua', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: 'Cipayung', isSingle: true },
  { prefix: 'MBT', start: 240601, end: 240675, operator: 'Bayu Holong Persada', tipe: 'Hino GB 150L', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: 'Cipayung', isSingle: true },

  // JEWA DIAN MITRA
  { prefix: 'JDM', start: 230001, end: 230073, operator: 'Jewa Dian Mitra', tipe: 'Hino GB 150', warna: 'Putih Orange', bahanBakar: 'Diesel', karoseri: 'Laksana', pool: 'Pamulang', isSingle: true }

  // ... Tambahkan properti isMaxi, isGandeng, isSingle, isLowdeck sesuai kebutuhan pada entry lain
];

// --- FUNGSI SEARCH BUS BY NUMBER (PAKAI DATA DI ATAS) ---
function searchBusByNumber(input) {
  let norm = input.trim().toUpperCase().replace(/[_\s-]+/g, '');
  // Cek pola kode bus: PREFIX + angka
  const match = norm.match(/^([A-Z]+)(\d{1,6})$/);
  if (match) {
    const code = match[1];
    let numStr = match[2].replace(/^0+/, '');
    const num = parseInt(numStr, 10);
    // Cari di busRangeData
    for (const r of busRangeData) {
      if (r.prefix === code && num >= r.start && num <= r.end) {
        return [{
          operatorCode: code,
          number: numStr,
          operator: r.operator,
          busNumber: num,
          tipe: r.tipe,
          warna: r.warna,
          bahanBakar: r.bahanBakar,
          karoseri: r.karoseri,
          catatan: r.catatan,
          pool: r.pool,
          depo: r.depo,
          isMaxi: r.isMaxi,
          isGandeng: r.isGandeng,
          isSingle: r.isSingle,
          isLowdeck: r.isLowdeck,
          isSkywellNonBRT: r.isSkywellNonBRT // Assuming isSkywellNonBRT is part of busRangeData
        }];
      }
    }
  }
  return [];
}

function detectLogoByTipe(tipe) {
  if (!tipe) return null;
  const lower = tipe.toLowerCase();
  if (lower.includes('golden dragon')) return logoKaroseri['Golden Dragon'];
  if (lower.includes('zhongtong')) return logoKaroseri['Zhongtong'];
  if (lower.includes('skywell')) return logoKaroseri['Skywell'];
  if (lower.includes('scania')) return logoKaroseri['Scania'];
  if (lower.includes('mercedes')) return logoKaroseri['Mercedes-Benz'];
  if (lower.includes('man')) return logoKaroseri['MAN'];
  if (lower.includes('nusantara')) return logoKaroseri['Nusantara Gemilang'];
  if (lower.includes('laksana')) return logoKaroseri['Laksana'];
  if (lower.includes('rahayu sentosa')) return logoKaroseri['Rahayu Sentosa'];
  if (lower.includes('tentrem')) return logoKaroseri['Tentrem'];
  if (lower.includes('restu ibu')) return logoKaroseri['Restu Ibu'];
  if (lower.includes('mitsubishi')) return logoKaroseri['Mitsubishi'];
  return null;
}

function detectLogoChasis(tipe) {
  if (!tipe) return null;
  const lower = tipe.toLowerCase();
  if (lower.includes('golden dragon')) return logoChasis['Golden Dragon'];
  if (lower.includes('skywell')) return logoChasis['Skywell'];
  if (lower.includes('zhongtong')) return logoChasis['Zhongtong'];
  if (lower.includes('scania')) return logoChasis['Scania'];
  if (lower.includes('mercedes')) return logoChasis['Mercedes-Benz'];
  if (lower.includes('hino')) return logoChasis['Hino'];
  if (lower.includes('man')) return logoChasis['MAN'];
  if (lower.includes('vktr')) return logoChasis['VKTR'];
  if (lower.includes('volvo')) return logoChasis['Volvo'];
  if (lower.includes('mitsubishi')) return logoChasis['Mitsubishi'];
  return null;
}

function renderBusSearchResults(results) {
    if (!results.length) return '<div class="alert alert-warning">Belum ada data bus.</div>';
    const bus = results[0];
    // Logo
    // Render logo operator di baris sendiri
    const logoOp = logoOperator[bus.operator] || '';
    // Render semua logo karoseri di baris terpisah setelah operator
    let logoKar = '';
    if (Array.isArray(bus.karoseri)) {
      logoKar = bus.karoseri.map(k => logoKaroseri[k.trim()] ? `<img src="${logoKaroseri[k.trim()]}" alt="Karoseri" style="max-height:40px;max-width:100%;object-fit:contain;" class="rounded-2 me-1" />` : '').join('');
    } else if (bus.karoseri && bus.karoseri !== 'CBU') {
      logoKar = bus.karoseri.split(/[\/|,]/).map(k => logoKaroseri[k.trim()] ? `<img src="${logoKaroseri[k.trim()]}" alt="Karoseri" style="max-height:40px;max-width:100%;object-fit:contain;" class="rounded-2 me-1" />` : '').join('');
    }
    const logoSasis = detectLogoChasis(bus.tipe) || '';
    // Nomor bus
    let nomorBus = bus.number;
    // Hilangkan 0 di depan nomor bus TJ (paksa hilangkan semua leading zero)
    if (bus.operator === 'PT Transportasi Jakarta') {
      nomorBus = nomorBus.replace(/^0+/, '');
    }
    // Pastikan badge tetap format TJ-xxx
    // Cari digit maksimal untuk prefix ini dari busRangeData
    let digitCount = 3;
    // Khusus Mayasari Bakti (MB/MYS), digitCount sesuai range (bisa 4/5/6 digit)
    if ((bus.operatorCode === 'MB' || bus.operatorCode === 'MYS') && typeof busRangeData !== 'undefined' && Array.isArray(busRangeData)) {
      const ranges = busRangeData.filter(r => r.prefix === (bus.operatorCode || ''));
      if (ranges.length) {
        digitCount = Math.max(...ranges.map(r => r.end.toString().length));
      }
    }
    // Untuk BMP Hino RK8 dan DMR/SAF, tetap 3 digit
    if ((bus.operatorCode === 'BMP' && /hino/i.test(bus.tipe)) || bus.operatorCode === 'DMR' || bus.operatorCode === 'SAF') {
      digitCount = 3;
    }
    const badgeNomor = `${bus.operatorCode || ''}-${nomorBus.padStart(digitCount, '0')}`;
    // Info ringkas
    let infoRingkas = '';
    // Hitung total bus dan urutan bus keberapa dari seluruh bus dengan prefix yang sama (tanpa mengulang per range)
    let totalBus = 0;
    let urutan = 0;
    if (typeof busRangeData !== 'undefined' && Array.isArray(busRangeData)) {
      const ranges = busRangeData.filter(r => r.prefix === (bus.operatorCode || ''));
      totalBus = ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
      let offset = 0;
      for (const r of ranges) {
        if (bus.busNumber >= r.start && bus.busNumber <= r.end) {
          urutan = offset + (bus.busNumber - r.start + 1);
          break;
        }
        offset += (r.end - r.start + 1);
      }
    }
    // Cek jika nomor bus (tanpa leading zero) diawali 2 digit (misal 17, 18, dst) → tahun bus, hanya untuk 5/6 digit
    const nomorTanpaZero = nomorBus.replace(/^0+/, '');
    let tahunDuaDigit = null;
    if (/^\d{5,6}$/.test(nomorTanpaZero)) {
      const duaDigit = nomorTanpaZero.slice(0, 2);
      if (/^(1[7-9]|2[0-6])$/.test(duaDigit)) {
        tahunDuaDigit = '20' + duaDigit;
      }
    }
    if (tahunDuaDigit) {
      infoRingkas = `Bus ke ${urutan} ${bus.operator} tahun ${tahunDuaDigit}`;
    } else if (digitCount === 5 || digitCount === 6) {
      // Tahun dari 2 digit pertama nomor bus
      const tahun = '20' + badgeNomor.replace(/^[A-Z]+-?0*/, '').slice(0, 2);
      infoRingkas = `Bus ke ${urutan} ${bus.operator} tahun ${tahun}`;
    } else if (digitCount === 4 || digitCount === 3) {
      infoRingkas = `Bus ke ${urutan} ${bus.operator} dari total ${totalBus} bus`;
    }
    // Perbaiki deteksi Bus Maxi agar lebih fleksibel
    const busMaxiTypes = [
      'SCANIAK310IB',
      'VOLVOB11R',
      'MERCEDESBENZOC500RF2542',
      'MERCEDESBENZOC500RF2542',
      'MERCEDESBENZOC500RF2542',
      'MERCEDESBENZOC500RF2542'
    ];
    const tipeNormalized = (bus.tipe || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const isBusMaxi = busMaxiTypes.some(t => tipeNormalized.includes(t));

    // Gambar bus jika ada
    // Pencocokan key mapping gambar lebih fleksibel (case-insensitive, tanpa spasi)
    function findBusImageKey(tipe) {
      if (!tipe) return undefined;
      const norm = tipe.replace(/\s+/g, ' ').trim().toUpperCase();
      for (const key in busImages) {
        if (key.replace(/\s+/g, ' ').trim().toUpperCase() === norm) return key;
      }
      return undefined;
    }
    let busImg = undefined;
    const imgKey = findBusImageKey(bus.tipe);
    if (imgKey) busImg = busImages[imgKey];
    // Fallback: jika tipe mengandung 'Mercedes' dan 'OH 1626', pakai gambar Mercedes-Benz OH 1626
    if (!busImg && /mercedes.*oh 1626/i.test(bus.tipe)) {
      // Cek varian M/T atau A/T
      if (/m\/t/i.test(bus.tipe)) {
        busImg = busImages['Mercedes Benz OH 1626 M/T'] || busImg;
      } else if (/a\/t/i.test(bus.tipe)) {
        busImg = busImages['Mercedes Benz OH 1626 A/T'] || busImg;
      } else {
        busImg = busImages['Mercedes Benz 1626 TJ'] || busImages['Mercedes-Benz OH 1626'] || busImages['Mercedes Benz OH 1626'] || busImages['Mercedes-Benz OH 1626 M/T'] || busImages['Mercedes-Benz OH 1626 A/T'] || busImg;
      }
    }
    // Khusus gambar TJ by tipe & range (standarisasi key mapping)
    if (bus.operator === 'PT Transportasi Jakarta') {
      const tipeKey = (bus.tipe || '').replace(/\s+/g, ' ').trim().toUpperCase();
      if (tipeKey === 'SCANIA K340IA') {
        busImg = busImages['SCANIA K340IA'] || busImg;
      } else if (tipeKey === 'SCANIA K320IA') {
        busImg = busImages['SCANIA K320IA'] || busImg;
      } else if (tipeKey === 'MAN R37') {
        busImg = busImages['MAN R37'] || busImg;
      } else if (tipeKey === 'MERCEDES BENZ OC 500 RF 2542') {
        if (bus.number === '351') {
          busImg = busImages['Mercedes Benz OC 500 RF 2542'] || busImg;
        } else if (parseInt(bus.number, 10) >= 381 && parseInt(bus.number, 10) <= 387) {
          busImg = busImages['Mercedes Benz OC 500 RF 2542 0381-0387'] || busImg;
        } else {
          busImg = busImages['Mercedes Benz OC 500 RF 2542 LAIN'] || busImg;
        }
      } else if (tipeKey === 'SCANIA K310UB') {
        busImg = busImages['SCANIA K310UB'] || busImg;
      } else if (tipeKey === 'MERCEDES BENZ OH 1526 M/T') {
        busImg = busImages['Mercedes Benz OH 1526 M/T'] || busImg;
      } else if (tipeKey === 'MERCEDES BENZ 1626 TJ') {
        busImg = busImages['Mercedes Benz 1626 TJ'] || busImg;
      } else if (tipeKey === 'HINO RK1 JSNL') {
        busImg = busImages['Hino RK1 JSNL'] || busImg;
      } else if (tipeKey === 'MERCEDES BENZ O 500U 1726') {
        // Cek karoseri
        if ((bus.karoseri || '').toLowerCase().includes('laksana')) {
          busImg = busImages['Mercedes Benz O 500U 1726 Laksana'] || busImg;
        } else if ((bus.karoseri || '').toLowerCase().includes('nusantara gemilang')) {
          busImg = busImages['Mercedes Benz O 500U 1726 Nusantara Gemilang'] || busImg;
        }
      } else if (tipeKey === 'MERCEDES BENZ OF 917') {
        busImg = busImages['Mercedes Benz OF 917'] || busImg;
      } else if (tipeKey === 'SCANIA K250UB') {
        busImg = busImages['SCANIA K250UB'] || busImg;
      }
    }
    // Khusus Bianglala Metropolitan Golden Dragon Non BRT (23xxxx)
    if (
      bus.operator === 'Bianglala Metropolitan' &&
      bus.tipe === 'SAG Golden Dragon Pivot E12' &&
      /^23/.test(bus.number)
    ) {
      busImg = busImages['SAG Golden Dragon Pivot E12 Non BRT'] || busImg;
    }
    // Khusus Mayasari Bakti Mercedes-Benz OH 1626 21xxx
    if (
      bus.operator === 'Mayasari Bakti' &&
      /mercedes.*oh 1626/i.test(bus.tipe) &&
      /^21/.test(bus.number)
    ) {
      busImg = busImages['Mercedes-Benz OH 1626 21xxx'] || busImg;
    }
    // Khusus BMP Mercedes Benz OH 1626
    if (
      bus.operator === 'Bianglala Metropolitan' &&
      /mercedes.*oh 1626/i.test(bus.tipe)
    ) {
      busImg = busImages['BMP Mercedes Benz OH 1626'] || busImg;
    }
    // Khusus Mayasari Bakti VKTR BYD B12
    if (
      bus.operator === 'Mayasari Bakti' &&
      bus.tipe === 'VKTR BYD B12'
    ) {
      if ((bus.warna || '').toLowerCase().includes('tosca')) {
        busImg = busImages['Mayasari VKTR BYD B12 Tosca'] || busImg;
      } else if ((bus.warna || '').toLowerCase().includes('putih orange')) {
        busImg = busImages['Mayasari VKTR BYD B12 Putih Orange'] || busImg;
      }
    }
    // Khusus Swakelola Transjakarta (TSW)
    if (
      bus.operator === 'Swakelola Transjakarta' &&
      bus.tipe && bus.tipe.toLowerCase().includes('mitsubishi')
    ) {
      if ((bus.warna || '').toLowerCase().includes('biru')) {
        busImg = busImages['TSW Biru'] || busImg;
      } else if ((bus.warna || '').toLowerCase().includes('putih orange')) {
        busImg = busImages['TSW Putih Orange'] || busImg;
      }
    }
    // Khusus PKT Mercedes Benz OH 1626 M/T
    if (
      bus.operator === 'Pahala Kencana Transportation' &&
      /mercedes.*oh 1626/i.test(bus.tipe)
    ) {
      busImg = busImages['PKT Mercedes Benz OH 1626 M/T'] || busImg;
    }
    // Khusus DAMRI Hino RK8 R260 karoseri
    if (
      bus.operator === 'DAMRI' &&
      /hino.*rk8.*r260/i.test(bus.tipe)
    ) {
      if ((bus.karoseri || '').toLowerCase().includes('restu ibu')) {
        busImg = busImages['DAMRI Hino RK8 R260 Restu Ibu Pusaka'] || busImg;
      } else if ((bus.karoseri || '').toLowerCase().includes('rahayu sentosa')) {
        busImg = busImages['DAMRI Hino RK8 R260 Rahayu Sentosa'] || busImg;
      } else if ((bus.karoseri || '').toLowerCase().includes('laksana')) {
        busImg = busImages['DAMRI Hino RK8 R260 Laksana'] || busImg;
      }
    }

    if (bus.operator === 'PT Transportasi Jakarta' && bus.tipe === 'Scania K340IA') {
        const urut = parseInt(bus.number, 10) - 187 + 1;
        infoRingkas = `Bus ke ${urut} PT Transportasi Jakarta`;
    } else if (bus.operator === 'PT Transportasi Jakarta' && bus.tipe === 'Scania K320IA') {
        const urut = parseInt(bus.number, 10) - 187;
        infoRingkas = `Bus ke ${urut} PT Transportasi Jakarta`;
    } else if (bus.operator === 'Mayasari Bakti') {
        const tahun = '20' + nomorBus.slice(0, 2);
        const urut = parseInt(nomorBus.slice(-3), 10);
        infoRingkas = `Bus ke ${urut} Mayasari Bakti tahun ${tahun}`;
    } else if (bus.operator === 'DAMRI') {
        // Jika nomor bus 4 digit (misal 0703, 0530, dst), tampilkan ringkas sederhana
        if (/^\d{4}$/.test(nomorBus)) {
            infoRingkas = `Bus DAMRI No. ${nomorBus}`;
        } else {
            const tahun = '20' + nomorBus.slice(0, 2);
            const urut = parseInt(nomorBus.slice(-3), 10);
            const ke = urut - 98;
            infoRingkas = `Bus nomor ${urut} / bus ke ${ke} Tahun ${tahun} Milik DAMRI`;
        }
    } else if (bus.operator === 'Steady Safe') {
        const urut = parseInt(nomorBus, 10);
        infoRingkas = `Bus ke ${urut} Steady Safe`;
    } else if (bus.operator === 'Pahala Kencana Transportation') {
        const urut = parseInt(nomorBus, 10) - 100;
        infoRingkas = `Bus ke ${urut} Pahala Kencana Transportation`;
    } else if (bus.operator === 'Bianglala Metropolitan' && nomorBus.length === 6) {
        // Khusus BMP 6 digit (SAG Golden Dragon Pivot E12)
        const tahun = '20' + nomorBus.slice(0, 2);
        let urut = null;
        if (nomorBus.startsWith('24') && parseInt(nomorBus, 10) >= 240322 && parseInt(nomorBus, 10) <= 240411) {
            urut = parseInt(nomorBus, 10) - 240321; // urutan mulai dari 1 di 240322
        } else if (nomorBus.startsWith('23') && parseInt(nomorBus, 10) >= 230300 && parseInt(nomorBus, 10) <= 230321) {
            urut = parseInt(nomorBus, 10) - 230299; // urutan mulai dari 1 di 230300
        }
        if (urut !== null) {
            infoRingkas = `Bus ke ${urut} bianglala metropolitan tahun ${tahun}`;
        }
    }
    if (bus.operator === 'PT Transportasi Jakarta' && (bus.catatan && bus.catatan.toLowerCase().includes('wisata'))) {
        const urut = parseInt(bus.number, 10);
        infoRingkas = `Bus ke ${urut} PT Transportasi Jakarta, Bus Wisata`;
    }
    if (bus.operator === 'Swakelola Transjakarta') {
        const urut = parseInt(bus.number, 10);
        infoRingkas = `Bus ke ${urut} Swakelola Transjakarta`;
    }
    if (isBusMaxi) {
        infoRingkas += (infoRingkas ? ', ' : '') + 'Bus Maxi';
    }
    // Deteksi tahun bus
    let tahunBus = null;
    if (bus.operator === 'Mayasari Bakti' || bus.operator === 'DAMRI') {
        tahunBus = parseInt('20' + nomorBus.slice(0, 2), 10);
    } else if (bus.operator === 'Sinar Jaya') {
        tahunBus = parseInt('20' + nomorBus.slice(0, 2), 10);
    }
    // Mapping warna bodi ke warna background card
    function getCardBgColor(warna) {
        if (!warna) return 'rgba(133, 151, 255, 0.7)';
        const w = warna.toLowerCase();
        if (w.includes('tosca')) return 'rgba(0, 200, 180, 0.18)';
        if (w.includes('putih') && w.includes('biru tua')) return 'rgba(79, 168, 222, 0.18)'; // biru tua
        if (w.includes('putih') && w.includes('biru muda')) return 'rgba(133, 151, 255, 0.18)'; // biru muda
        if (w.includes('putih') && w.includes('orange')) return 'rgba(255, 183, 77, 0.18)'; // orange
        if (w.includes('putih') && w.includes('biru')) return 'rgba(79, 168, 222, 0.13)'; // biru umum
        if (w.includes('biru tua')) return 'rgba(79, 168, 222, 0.18)';
        if (w.includes('biru muda')) return 'rgba(133, 151, 255, 0.18)';
        if (w.includes('biru')) return 'rgba(79, 168, 222, 0.13)';
        if (w.includes('orange')) return 'rgba(255, 183, 77, 0.18)';
        if (w.includes('kuning')) return 'rgba(255, 235, 59, 0.18)';
        if (w.includes('hijau')) return 'rgba(76, 175, 80, 0.13)';
        if (w.includes('merah')) return 'rgba(244, 67, 54, 0.13)';
        if (w.includes('abu')) return 'rgba(120, 144, 156, 0.13)';
        if (w.includes('hitam')) return 'rgba(33, 33, 33, 0.13)';
        return 'rgba(133, 151, 255, 0.13)'; // fallback biru muda
    }
    return `
    <div class="bus-result-card mt-2 p-3 mb-3 border rounded shadow-sm text-center position-relative" style="background:${getCardBgColor(bus.warna)};backdrop-filter:blur(12px);border-radius:1.2em;box-shadow:0 2px 8px 0 #0001;overflow:hidden;">
      ${busImg ? `<img src="${busImg}" alt="${bus.tipe}" style="max-width:100%;max-height:120px;object-fit:cover;border-radius:0.7em;margin-bottom:8px;" class="bus-photo mb-2" />` : ''}
      ${logoSasis ? `<img src="${logoSasis}" alt="Sasis Watermark" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70%;max-width:320px;opacity:0.10;z-index:1;pointer-events:none;user-select:none;" />` : ''}
      <div class="d-flex justify-content-center align-items-center mb-2 gap-2" style="padding:0 8px;position:relative;z-index:2;">
        ${logoOp ? `<img src="${logoOp}" alt="Operator" style="max-height:40px;max-width:100%;object-fit:contain;" class="rounded-2" />` : ''}
      </div>
      ${logoKar ? `<div class="d-flex justify-content-center align-items-center mb-2 gap-2">${logoKar}</div>` : ''}
      <div class="mb-2">
        <span class="badge rounded-5 bg-primary fs-3 px-4 py-2"
          style="${
            (bus.operator === 'Mayasari Bakti' && tahunBus && tahunBus >= 2021)
              ? "font-family:'PT Sans Narrow',sans-serif;"
              : (bus.operatorCode === 'SAF' || bus.operatorCode === 'BMP' || (tahunBus && tahunBus < 2021 && bus.operatorCode !== 'MB' && bus.operatorCode !== 'MYS' && bus.operatorCode !== 'DMR'))
                ? (
                    bus.operator === 'Bianglala Metropolitan' && nomorBus.length === 6 && (nomorBus.startsWith('23') || nomorBus.startsWith('24'))
                      ? "font-family:'PT Sans Narrow',sans-serif;"
                      : "font-family:'Rubik','New Rubik',sans-serif;"
                  )
                : ((bus.operatorCode === 'MB' || bus.operatorCode === 'MYS' || (bus.operatorCode === 'DMR' && nomorBus.length === 3))
                  ? "font-family:'Roboto',sans-serif;"
                  : (bus.operatorCode === 'PKT' ? "font-family:'New Rubik','Rubik',sans-serif;" : "")
                )
          }"
        >${badgeNomor}</span>
        ${bus.operator === 'Sinar Jaya' ? '<div class="fw-bold mt-1">Sinar Jaya</div>' : ''}
      </div>
      <div class="mb-2 fw-bold" style="${bus.operator === 'Bianglala Metropolitan' && nomorBus.length === 6 && (nomorBus.startsWith('23') || nomorBus.startsWith('24')) ? "font-family:'PT Sans Narrow',sans-serif;" : ''}">${infoRingkas}</div>
      <div class="mb-2">
        <div>${bus.tipe}</div>
        <div>${bus.warna}</div>
        <div class="fw-bold">
          ${bus.bahanBakar === 'Listrik' ? '<span style="font-family:\'PT Sans Narrow\',sans-serif;">Bus Listrik <iconify-icon inline icon="streamline:electric-cord-3-remix"></iconify-icon></span>' : ''}
          ${bus.bahanBakar === 'BBG' ? 'Bus BBG / Gas Alam Terkompresi <iconify-icon inline icon="icon-park-outline:gas"></iconify-icon>' : ''}
          ${bus.bahanBakar === 'Diesel' ? 'Diesel <iconify-icon inline icon="bi:fuel-pump-diesel"></iconify-icon>' : ''}
        </div>
        ${bus.depo ? `<div>Depo: ${bus.depo}</div>` : (bus.pool ? `<div>Depo: ${bus.pool}</div>` : '')}
        ${bus.karoseri && bus.karoseri !== 'CBU' ? `<div>${bus.karoseri}</div>` : ''}
        ${bus.catatan ? `<div>${bus.catatan}</div>` : ''}
      </div>
      <div class="d-flex flex-wrap gap-2 justify-content-center">
        ${bus.bahanBakar === 'Listrik' ? '<span class="badge bg-warning text-dark">Listrik</span>' : ''}
        ${bus.bahanBakar === 'Diesel' ? '<span class="badge bg-secondary">Diesel</span>' : ''}
        ${bus.bahanBakar === 'BBG' ? '<span class="badge bg-info text-dark">BBG</span>' : ''}
        ${
          (bus.catatan && bus.catatan.toLowerCase().includes('non brt')) || bus.isSkywellNonBRT
            ? '<span class="badge bg-success">Non BRT</span>'
            : ''
        }
        ${bus.catatan && bus.catatan.toLowerCase().includes('gandeng') ? '<span class="badge bg-primary">Bus Gandeng</span>' : ''}
        ${bus.isMaxi ? '<span class="badge bg-dark">Maxi</span>' : ''}
        ${bus.isGandeng ? '<span class="badge bg-primary">Gandeng</span>' : ''}
        ${bus.isSingle ? '<span class="badge bg-secondary">Single</span>' : ''}
        ${bus.isLowdeck ? '<span class="badge bg-info text-dark">Lowdeck</span>' : ''}
        ${bus.isTingkat ? '<span class="badge bg-danger">Tingkat</span>' : ''}
      </div>
    </div>
    `;
}

// Mapping gambar bus per tipe utama
const busImages = {
  'VKTR BYD D9': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/Transjakarta_SJM-240012.jpg/1280px-Transjakarta_SJM-240012.jpg',
  'Volvo B11R': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Transjakarta_Steady_Safe_Cityline_2_Laksana.jpg/1280px-Transjakarta_Steady_Safe_Cityline_2_Laksana.jpg',
  'Mercedes-Benz OH 1626 A/T': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Transjakarta_Mercedes_Benz_OH_1626_Ng_MYS-19220_at_Cibubur_junction.jpg/1280px-Transjakarta_Mercedes_Benz_OH_1626_Ng_MYS-19220_at_Cibubur_junction.jpg',
  'Mercedes Benz OH 1626 M/T': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Transjakarta_Mercedes_Benz_OH_1626_Ng_MYS-19220_at_Cibubur_junction.jpg/1280px-Transjakarta_Mercedes_Benz_OH_1626_Ng_MYS-19220_at_Cibubur_junction.jpg',
  'Scania K320IA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Transjakarta_-_MB-1601_Scania_K320IA.jpg/1280px-Transjakarta_-_MB-1601_Scania_K320IA.jpg',
  'Scania K310IB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Transjakarta_Scania_K310IB_%2851211368992%29.jpg/1280px-Transjakarta_Scania_K310IB_%2851211368992%29.jpg',
  'SAG Golden Dragon Pivot E12': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Transjakarta_BMP-240388.jpg/1280px-Transjakarta_BMP-240388.jpg',
  'Hino RK8 R260': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Transjakarta_14_and_14A_Buses_at_JIS.jpg/1280px-Transjakarta_14_and_14A_Buses_at_JIS.jpg',
  'Zhongtong Bus LCK6180GC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Monas_Zhongtong_Transjakarta.jpg/1280px-Monas_Zhongtong_Transjakarta.jpg',
  'Zhongtong Bus LCK6126EVGRA1': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Transjakarta_Perum_DAMRI_Zhongtong_Bus.jpg/1280px-Transjakarta_Perum_DAMRI_Zhongtong_Bus.jpg',
  'Zhongtong Bus LCK6126EVGRA2': 'https://img.okezone.com/content/2025/06/20/1/3148864/bus_listrik_damri-peyD_large.jpg',
  'Skywell NJL6126BEV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/48/Transjakarta_-_DMR-240156.jpg/1280px-Transjakarta_-_DMR-240156.jpg',
  'Skywell NJL6129BEV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Transjakarta_Metrotrans_Skywell_Electric_Bus.jpg/1280px-Transjakarta_Metrotrans_Skywell_Electric_Bus.jpg',
  'SAG Golden Dragon Pivot E12 Non BRT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Bus_Metrotrans_di_rute_4B.jpg/1280px-Bus_Metrotrans_di_rute_4B.jpg',
  'Mercedes-Benz OH 1626 21xxx': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg/1280px-Transjakarta_-_MYS-21263_Daimler_OH_1626.jpg',
  'BMP Mercedes Benz OH 1626': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Bianglala_TJ_6H_4-7-2022_Gondangdia.jpg/1280px-Bianglala_TJ_6H_4-7-2022_Gondangdia.jpg',
  'Mayasari VKTR BYD B12 Tosca': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Transjakarta_-_MYS-22345_BYD_B12.jpg/1280px-Transjakarta_-_MYS-22345_BYD_B12.jpg',
  'Mayasari VKTR BYD B12 Putih Orange': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Mayasari_TJ_EV_2022-07-07.jpg/1280px-Mayasari_TJ_EV_2022-07-07.jpg',
  'TSW Biru': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTHqWx5PtUeP3W28ZCr5zNokG47IXWku43HqQ&s',
  'TSW Putih Orange': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/MiniTrans.jpg/1280px-MiniTrans.jpg',
  'PKT Mercedes Benz OH 1626 M/T': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Transjakarta_PKT_106_at_Gambir.jpg/1280px-Transjakarta_PKT_106_at_Gambir.jpg',
  'DAMRI Hino RK8 R260 Restu Ibu Pusaka': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Transjakarta_Hino_RK8_R260_Restu_Ibu_Integra_%2851378826230%29.jpg/1280px-Transjakarta_Hino_RK8_R260_Restu_Ibu_Integra_%2851378826230%29.jpg',
  'DAMRI Hino RK8 R260 Rahayu Sentosa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Transjakarta_14_and_14A_Buses_at_JIS.jpg/1280px-Transjakarta_14_and_14A_Buses_at_JIS.jpg',
  'DAMRI Hino RK8 R260 Laksana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Transjakarta_Perum_DAMRI_Discovery_Laksana.jpg/1280px-Transjakarta_Perum_DAMRI_Discovery_Laksana.jpg',
  'SCANIA K340IA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/TransJakarta_Scania_K340IA_Euro_6.jpg/1280px-TransJakarta_Scania_K340IA_Euro_6.jpg',
  'SCANIA K320IA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Transjakarta_Scania_K320iA.jpg/1280px-Transjakarta_Scania_K320iA.jpg',
  'MAN R37': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Transjakarta_Wisata_-_MAN_RR4.jpg/1280px-Transjakarta_Wisata_-_MAN_RR4.jpg',
  'Mercedes Benz OC 500 RF 2542': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Transjakarta_Wisata_-_TJ_0351_MB_OC500RF_2542.jpg/1280px-Transjakarta_Wisata_-_TJ_0351_MB_OC500RF_2542.jpg',
  'Mercedes Benz OC 500 RF 2542 0381-0387': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Transjakarta_Wisata_-_TJ384_Daimler_OC500RF_2542.jpg/1280px-Transjakarta_Wisata_-_TJ384_Daimler_OC500RF_2542.jpg',
  'SCANIA K310UB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/Transjakarta_Wisata_-_TJ884_Scania_K310UB.jpg/1280px-Transjakarta_Wisata_-_TJ884_Scania_K310UB.jpg',
  'Mercedes Benz OH 1526 M/T': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Transjakarta1526.jpg/1280px-Transjakarta1526.jpg',
  'Mercedes Benz OC 500 RF 2542 LAIN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Transjakarta_2542.jpg/1280px-Transjakarta_2542.jpg',
  'Mercedes Benz 1626 TJ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/TJ_1626.jpg/1280px-TJ_1626.jpg',
  'Hino RK1 JSNL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/TJ_RK_CNG.jpg/1280px-TJ_RK_CNG.jpg',
  'Mercedes Benz O 500U 1726 Laksana': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/TJ_LD_Menwa_UI_20220924.jpg/1280px-TJ_LD_Menwa_UI_20220924.jpg',
  'Mercedes Benz O 500U 1726 Nusantara Gemilang': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/TJ_0791_at_Senayan.jpg/1280px-TJ_0791_at_Senayan.jpg',
  'Mercedes Benz OF 917': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Royal_Trans_TJ_536.jpg/1280px-Royal_Trans_TJ_536.jpg',
  'SCANIA K250UB': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Transjakarta_-_TJ632_Scania_K250UB.jpg/1280px-Transjakarta_-_TJ632_Scania_K250UB.jpg',
  'Hino RN8 285': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg/1280px-BHL_TJ_Kampung_Rambutan_bus_terminal_20220715.jpg',
  'Hino GB 150L': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Transjakarta_Minitrans_Hino_GB150_L_bus_%28MBT-240624%29.jpg/1280px-Transjakarta_Minitrans_Hino_GB150_L_bus_%28MBT-240624%29.jpg',
  'Hino GB 150': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg/1280px-Bus_Minitrans_melayani_penumpang_di_rute_6W.jpg',
};
busImages['Mercedes Benz OH 1626 M/T'] = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/TJ_1626.jpg/1280px-TJ_1626.jpg';
busImages['Mercedes Benz OH 1626 A/T'] = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/37/TJ_1626.jpg/1280px-TJ_1626.jpg';

// --- RENDER BUS LIST PER OPERATOR (dengan rentang nomor bus & gambar) ---
function renderBusListByOperator(operator) {
  const buses = filterBusesByOperator(operator);
  if (!buses.length) return '<div class="alert alert-warning">Tidak ada data bus untuk operator ini.</div>';
  // Kelompokkan berdasarkan tipe bus
  const typeMap = {};
  buses.forEach(bus => {
    if (!typeMap[bus.tipe]) typeMap[bus.tipe] = [];
    typeMap[bus.tipe].push(bus);
  });
  let html = `<h5 class="fw-bold mb-2">${operator} <span class="badge bg-primary">${buses.length} bus</span></h5>`;
  html += '<ul class="list-group mb-3">';
  Object.keys(typeMap).forEach(tipe => {
    const tipeBuses = typeMap[tipe];
    // Ambil rentang nomor bus
    const numbers = tipeBuses.map(b => b.number).sort((a, b) => a - b);
    const minNum = numbers[0];
    const maxNum = numbers[numbers.length - 1];
    // Gambar bus jika ada
    const img = busImages[tipe] ? `<img src="${busImages[tipe]}" alt="${tipe}" style="max-height:48px;max-width:80px;object-fit:cover;border-radius:0.5em;margin-right:10px;" class="me-2" />` : '';
    html += `<li class="list-group-item d-flex justify-content-between align-items-center flex-wrap">
      <span class="d-flex align-items-center">${img}<span>${tipe}<br><small class="text-muted">No. ${minNum} - ${maxNum}</small></span></span>
      <span class="badge bg-info">${tipeBuses.length} bus</span>
    </li>`;
  });
  html += '</ul>';
  return html;
}

// --- FUNGSI SUGGESTION (PAKAI DATA YANG SAMA) ---
function getBusSuggestions(input) {
  let norm = input.trim().toUpperCase().replace(/[_\s-]+/g, '');
  if (!norm) return '';
  // Cek jika hanya kode operator
  const operatorCodes = {
    'MB': 'Mayasari Bakti',
    'MYS': 'Mayasari Bakti',
    'DMR': 'DAMRI',
    'SAF': 'Steady Safe',
    'SJM': 'Sinar Jaya',
    'BMP': 'Bianglala Metropolitan',
    'PKT': 'Pahala Kencana Transportation',
    'TSW': 'Swakelola Transjakarta',
    'TJ': 'PT Transportasi Jakarta',
    'BHL': 'Bayu Holong Persada',
    'MBT': 'Bayu Holong Persada',
    'JDM': 'Jewa Dian Mitra',
    'KBM': 'Koantas Bima',
    'PSU': 'Bluebird',
    'KWK': 'Koperasi Wahana Kalpika',
    'LSG': 'Lestari Surya Gemapersada',
    'BDL': 'Budi Luhur',
    'KPM': 'Kopamilet Jaya',
    'KMJ': 'Komilet Jaya',
    'PRM': 'Purimas Jaya',
    'KMK': 'Komika Jaya',
    'PUS': 'Puskopau (Trans Halim)',
    'KST': 'Kencana Sakti Transpor',
    'KLM': 'Kolamas Jaya',
  };
  for (const code in operatorCodes) {
    if (norm === code) {
      const op = operatorCodes[code];
      const logo = logoOperator[op] ? `<img src="${logoOperator[op]}" alt="${op}" style="max-height:32px;max-width:60px;object-fit:contain;vertical-align:middle;" class="shadow-sm rounded-2 me-2" />` : '';
      return `<div class='alert alert-info d-flex align-items-center'><span>${logo}<b>${op}</b></span></div>`;
    }
  }
  // Saran dari busRangeData
  // Gunakan satu deklarasi match saja
  const match = norm.match(/^([A-Z]+)(\d{0,4})$/); // allow empty numPart
  if (match) {
    const code = match[1];
    const numPart = match[2];
    // Tampilkan semua range yang prefix-nya sama dan (numPart kosong ATAU start/end range mengandung numPart di awal)
    const suggestions = busRangeData.filter(r => {
      if (r.prefix !== code) return false;
      if (!numPart) return true;
      // Cek apakah start atau end mengandung numPart di awal
      return r.start.toString().startsWith(numPart) || r.end.toString().startsWith(numPart);
    });
    if (suggestions.length) {
      let html = '<div class="list-group">';
      suggestions.forEach(s => {
        // Logo operator
        const logoOp = logoOperator[s.operator] ? `<img src="${logoOperator[s.operator]}" alt="${s.operator}" style="height:32px;width:auto;object-fit:contain;vertical-align:middle;" class="me-2 rounded-2" />` : '';
        // Logo chasis
        const logoChas = detectLogoChasis(s.tipe) ? `<img src="${detectLogoChasis(s.tipe)}" alt="Chasis" style="height:32px;width:auto;object-fit:contain;vertical-align:middle;" class="ms-2 me-2" />` : '';
        // Format nomor badge (pakai leading zero sesuai digit start/end)
        const digitCount = Math.max(s.start.toString().length, s.end.toString().length);
        const pad = n => n.toString().padStart(digitCount, '0');
        let badgeRange = '';
        if (s.start === s.end) {
          badgeRange = `${s.prefix}-${pad(s.start)}`;
        } else {
          badgeRange = `${s.prefix}-${pad(s.start)} s/d ${s.prefix}-${pad(s.end)}`;
        }
        // Badge jenis bus
        let jenisBadge = '';
        if (s.isMaxi) jenisBadge += '<span class="badge bg-dark me-1">Maxi</span>';
        if (s.isGandeng) jenisBadge += '<span class="badge bg-primary me-1">Gandeng</span>';
        if (s.isSingle) jenisBadge += '<span class="badge bg-secondary me-1">Single</span>';
        if (s.isLowdeck) jenisBadge += '<span class="badge bg-info text-dark me-1">Lowdeck</span>';
        if (s.isTingkat) jenisBadge += '<span class="badge bg-danger me-1">Tingkat</span>';
        // Badge warna bus
        let warnaBadge = '';
        if (s.warna) {
          let bg = 'rgba(133, 151, 255, 0.13)';
          if (typeof getCardBgColor === 'function') bg = getCardBgColor(s.warna);
          warnaBadge = `<span class='badge' style='background:${bg};color:#222;border:1px solid #bbb;'>${s.warna}</span>`;
        }
        html += `<div class='list-group-item'>
          <div class='mb-1 text-center'><span class='badge bg-primary fs-6'>${badgeRange}</span></div>
          <div class='mb-1 d-flex justify-content-center align-items-center gap-2'>${logoOp}${logoChas}</div>
          <div class='mb-1 text-center'><span class='fw-bold'>${s.operator}</span> <span class='ms-2'>${s.tipe}</span></div>
          <div class='mb-1 text-center'>${warnaBadge}</div>
          <div class='mb-1 text-center'>${jenisBadge}</div>
        </div>`;
      });
      html += '</div>';
      return html;
    }
  }
  return '';
}
window.getBusSuggestions = getBusSuggestions;