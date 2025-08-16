// Weather API Configuration
const WEATHER_API_KEY = '962322a87800402e0b9d7052cb5e8f16';
const JAKARTA_CITY_ID = '1642911'; // Jakarta, Indonesia
const WEATHER_API_URL = `https://api.openweathermap.org/data/2.5/weather?id=${JAKARTA_CITY_ID}&appid=${WEATHER_API_KEY}&units=metric&lang=id`;

// Weather icons mapping for OpenWeather API
const weatherIcons = {
    '01d': '☀️', '01n': '🌙',
    '02d': '⛅', '02n': '☁️',
    '03d': '☁️', '03n': '☁️',
    '04d': '☁️', '04n': '☁️',
    '09d': '🌧️', '09n': '🌧️',
    '10d': '🌦️', '10n': '🌧️',
    '11d': '⛈️', '11n': '⛈️',
    '13d': '🌨️', '13n': '🌨️',
    '50d': '🌫️', '50n': '🌫️'
};

// (Optional) English -> Indonesian descriptions (fallback only)
const weatherDescriptions = {
    'clear sky': 'Cerah',
    'few clouds': 'Berawan Sebagian',
    'scattered clouds': 'Awan Tersebar',
    'broken clouds': 'Berawan Tebal',
    'shower rain': 'Hujan Ringan',
    'rain': 'Hujan',
    'thunderstorm': 'Badai Petir',
    'snow': 'Salju',
    'mist': 'Berkabut',
    'fog': 'Berkabut',
    'haze': 'Berkabut',
    'smoke': 'Berkabut Asap',
    'dust': 'Berkabut Debu',
    'sand': 'Berkabut Pasir',
    'ash': 'Berkabut Abu',
    'squall': 'Angin Kencang',
    'tornado': 'Angin Puting Beliung'
};

// Function to capitalize first letter of each word
function capitalizeWords(str) {
    if (!str || typeof str !== 'string') return '';
    return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Function to get real weather data from OpenWeather API
async function getWeatherData() {
    try {
        const response = await fetch(WEATHER_API_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Weather API request failed: ${response.status}`);
        }
        const data = await response.json();
        updateWeatherDisplay(data);
        localStorage.setItem('weatherData', JSON.stringify({ data, timestamp: Date.now() }));
    } catch (error) {
        console.error('Error fetching weather data:', error);
        const cachedData = localStorage.getItem('weatherData');
        if (cachedData) {
            const cached = JSON.parse(cachedData);
            const cacheAge = Date.now() - cached.timestamp;
            if (cacheAge < 30 * 60 * 1000) { // < 30 minutes
                updateWeatherDisplay(cached.data);
                return;
            }
        }
        // Fallback
        updateWeatherDisplay({
            weather: [{ icon: '01d', description: 'cerah' }],
            main: { temp: 28, humidity: 75 },
            wind: { speed: 5 }
        });
    }
}

// Function to update weather display
function updateWeatherDisplay(weatherData) {
    const weatherLabel = document.getElementById('weather-label');
    const weatherInfo = document.getElementById('weather-info');
    if (!weatherLabel || !weatherInfo) return;

    try {
        const weather = weatherData.weather[0];
        const temp = Math.round(weatherData.main.temp);
        const humidity = weatherData.main.humidity;
        const windSpeed = weatherData.wind.speed;

        // Update weather icon
        const icon = weatherIcons[weather.icon] || '🌤️';
        weatherLabel.textContent = icon;

        // For lang=id, API already returns Indonesian description
        const descRaw = weather.description || '';
        const descKey = (descRaw || '').toLowerCase();
        const description = weatherDescriptions[descKey] || capitalizeWords(descRaw);

        weatherInfo.textContent = `${description} ${temp}°C`;
        weatherInfo.title = `Kelembaban: ${humidity}% | Angin: ${windSpeed} m/s`;
    } catch (error) {
        console.error('Error updating weather display:', error);
        weatherLabel.textContent = '🌤️';
        weatherInfo.textContent = 'Memuat cuaca...';
    }
}

// Initialize weather
function initWeather() {
    try {
        getWeatherData();
        // Update every 30 minutes
        setInterval(() => {
            getWeatherData();
        }, 30 * 60 * 1000);
    } catch (e) {
        console.warn('initWeather failed:', e);
    }
}

// Start weather updates when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeather);
} else {
    initWeather();
}

// Export functions for potential use in other scripts
window.WeatherAPI = { getWeatherData, updateWeatherDisplay, initWeather }; 