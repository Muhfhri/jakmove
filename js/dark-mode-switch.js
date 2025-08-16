var darkSwitch = document.getElementById("darkSwitch");

// Fungsi untuk menerapkan tema secepat mungkin sebelum tampilan muncul
(function() {
    var darkThemeSelected = localStorage.getItem("darkSwitch") === "dark";
    document.documentElement.setAttribute("data-theme", darkThemeSelected ? "dark" : "light");
})();

// Fungsi untuk memperbarui tema dan menyimpan preferensi
function resetTheme() {
    var isDarkMode = darkSwitch.checked;
    
    document.documentElement.style.transition = "background-color 0.3s ease, color 0.3s ease";
    document.documentElement.setAttribute("data-theme", isDarkMode ? "dark" : "light");
    
    localStorage.setItem("darkSwitch", isDarkMode ? "dark" : "light");
}

// Jalankan inisialisasi setelah halaman selesai dimuat
window.addEventListener("DOMContentLoaded", function() {
    if (darkSwitch) {
        var darkThemeSelected = localStorage.getItem("darkSwitch") === "dark";
        darkSwitch.checked = darkThemeSelected;
        darkSwitch.addEventListener("change", resetTheme);
    }
});
