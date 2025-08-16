// Weather API Configuration
const WEATHER_API_KEY = '962322a87800402e0b9d7052cb5e8f16';
const JAKARTA_CITY_ID = '1642911'; // Jakarta, Indonesia
const WEATHER_API_URL = `https://api.openweathermap.org/data/2.5/weather?id=${JAKARTA_CITY_ID}&appid=${WEATHER_API_KEY}&units=metric&lang=id`;

// Weather icons mapping for OpenWeather API
const weatherIcons = {
    '01d': '☀️', // Clear sky day
    '01n': '🌙', // Clear sky night
    '02d': '⛅', // Few clouds day
    '02n': '☁️', // Few clouds night
    '03d': '☁️', // Scattered clouds
    '03n': '☁️', // Scattered clouds
    '04d': '☁️', // Broken clouds
    '04n': '☁️', // Broken clouds
    '09d': '🌧️', // Shower rain
    '09n': '🌧️', // Shower rain
    '10d': '🌦️', // Rain day
    '10n': '🌧️', // Rain night
    '11d': '⛈️', // Thunderstorm
    '11n': '⛈️', // Thunderstorm
    '13d': '🌨️', // Snow
    '13n': '🌨️', // Snow
    '50d': '🌫️', // Mist
    '50n': '🌫️'  // Mist
};

// Weather descriptions in Indonesian
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
    return str.replace(/\b\w/g, function(char) {
        return char.toUpperCase();
    });
}

// Function to get real weather data from OpenWeather API
async function getWeatherData() {
    try {
        const response = await fetch(WEATHER_API_URL);
        if (!response.ok) {
            throw new Error(`Weather API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Weather API Response:', data);
        
        updateWeatherDisplay(data);
        
        // Store weather data in localStorage for caching
        localStorage.setItem('weatherData', JSON.stringify({
            data: data,
            timestamp: Date.now()
        }));
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        
        // Try to load cached data
        const cachedData = localStorage.getItem('weatherData');
        if (cachedData) {
            const cached = JSON.parse(cachedData);
            const cacheAge = Date.now() - cached.timestamp;
            
            // Use cached data if less than 30 minutes old
            if (cacheAge < 30 * 60 * 1000) {
                console.log('Using cached weather data');
                updateWeatherDisplay(cached.data);
                return;
            }
        }
        
        // Fallback to mock data if API fails
        console.log('Using fallback weather data');
        updateWeatherDisplay({
            weather: [{ icon: '01d', description: 'clear sky' }],
            main: { temp: 28, humidity: 75 },
            wind: { speed: 5 }
        });
    }
}

// Function to update weather display
function updateWeatherDisplay(weatherData) {
    const weatherLabel = document.getElementById('weather-label');
    const weatherInfo = document.getElementById('weather-info');
    
    if (!weatherLabel || !weatherInfo) {
        console.error('Weather elements not found');
        return;
    }
    
    try {
        const weather = weatherData.weather[0];
        const temp = Math.round(weatherData.main.temp);
        const humidity = weatherData.main.humidity;
        const windSpeed = weatherData.wind.speed;
        
        // Update weather icon
        const icon = weatherIcons[weather.icon] || '🌤️';
        weatherLabel.textContent = icon;
        
        // Get weather description in Indonesian
        const description = weatherDescriptions[weather.description.toLowerCase()] || capitalizeWords(weather.description);
        
        // Update weather info
        weatherInfo.textContent = `${description} ${temp}°C`;
        
        // Add tooltip with more details
        weatherInfo.title = `Kelembaban: ${humidity}% | Angin: ${windSpeed} m/s`;
        
        console.log(`Weather updated: ${description} ${temp}°C (${weather.icon})`);
        
    } catch (error) {
        console.error('Error updating weather display:', error);
        // Fallback display
        weatherLabel.textContent = '🌤️';
        weatherInfo.textContent = 'Memuat cuaca...';
    }
}

// Initialize weather
function initWeather() {
    console.log('Initializing weather with real API...');
    
    // Get real weather data immediately
    getWeatherData();
    
    // Update weather every 30 minutes
    setInterval(() => {
        console.log('Updating weather data...');
        getWeatherData();
    }, 30 * 60 * 1000);
}

// Start weather updates when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeather);
} else {
    initWeather();
}

// Export functions for potential use in other scripts
window.WeatherAPI = {
    getWeatherData,
    updateWeatherDisplay,
    initWeather
}; 