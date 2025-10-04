var darkSwitch = document.getElementById("darkSwitch");

// Fungsi untuk menerapkan tema secepat mungkin sebelum tampilan muncul
(function() {
    var darkThemeSelected = localStorage.getItem("darkSwitch") === "dark";
    document.documentElement.setAttribute("data-theme", darkThemeSelected ? "dark" : "light");
})();

// Fungsi untuk memperbarui tema dan menyimpan preferensi
function resetTheme() {
    var currentTheme = document.documentElement.getAttribute("data-theme");
    var newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.style.transition = "background-color 0.3s ease, color 0.3s ease";
    document.documentElement.setAttribute("data-theme", newTheme);
    
    localStorage.setItem("darkSwitch", newTheme);
    localStorage.setItem("theme", newTheme);
}

// Jalankan inisialisasi setelah halaman selesai dimuat
window.addEventListener("DOMContentLoaded", function() {
    if (darkSwitch) {
        // Modern navbar toggle is a button, not a checkbox
        darkSwitch.addEventListener("click", resetTheme);
    }
    
    // Mobile dark mode toggle
    var darkSwitchMobile = document.getElementById("darkSwitchMobile");
    if (darkSwitchMobile) {
        darkSwitchMobile.addEventListener("click", resetTheme);
    }
});
