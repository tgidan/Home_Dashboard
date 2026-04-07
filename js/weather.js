"use strict";

/* ═══════════════════════════════════════════════════════════════
   WEATHER — fetches and renders current conditions
   Depends on: config.js (CONFIG), utils.js ($, cache)
   ═══════════════════════════════════════════════════════════════ */

/* ─── WMO weather code → [description, emoji] ───────────────── */
const WMO = {
  0:  ['Clear Sky',           '☀️'],
  1:  ['Mainly Clear',        '🌤️'],
  2:  ['Partly Cloudy',       '⛅'],
  3:  ['Overcast',            '☁️'],
  45: ['Foggy',               '🌫️'],
  48: ['Icy Fog',             '🌫️'],
  51: ['Light Drizzle',       '🌦️'],
  53: ['Drizzle',             '🌧️'],
  55: ['Heavy Drizzle',       '🌧️'],
  61: ['Light Rain',          '🌧️'],
  63: ['Rain',                '🌧️'],
  65: ['Heavy Rain',          '🌧️'],
  71: ['Light Snow',          '🌨️'],
  73: ['Snow',                '❄️'],
  75: ['Heavy Snow',          '❄️'],
  77: ['Snow Grains',         '🌨️'],
  80: ['Rain Showers',        '🌦️'],
  81: ['Rain Showers',        '🌦️'],
  82: ['Heavy Showers',       '⛈️'],
  85: ['Snow Showers',        '🌨️'],
  86: ['Heavy Snow Showers',  '❄️'],
  95: ['Thunderstorm',        '⛈️'],
  96: ['Thunderstorm + Hail', '⛈️'],
  99: ['Thunderstorm + Hail', '⛈️'],
};

function wmo(code) {
  return WMO[code] || ['Unknown', '🌡️'];
}

/* ─── Render ─────────────────────────────────────────────────── */
function renderWeather(data, cityName) {
  const c          = data.current;
  const [desc, icon] = wmo(c.weather_code);
  const isCelsius  = CONFIG.location.units === 'celsius';
  const suffix     = isCelsius ? '°C' : '°F';
  const toDisplay  = t => isCelsius ? Math.round(t) : Math.round(t * 9 / 5 + 32);

  $('weather-body').innerHTML = `
    <div class="weather-main">
      <div class="weather-icon">${icon}</div>
      <div class="weather-temp-block">
        <div class="weather-temp">${toDisplay(c.temperature_2m)}${suffix}</div>
        <div class="weather-desc">${desc}</div>
        <div class="weather-location">${escapeHtml(cityName)}</div>
      </div>
    </div>
    <div class="weather-stats">
      <div class="stat">
        <div class="stat-label">Feels Like</div>
        <div class="stat-value">${toDisplay(c.apparent_temperature)}${suffix}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Humidity</div>
        <div class="stat-value">${c.relative_humidity_2m}%</div>
      </div>
      <div class="stat">
        <div class="stat-label">Wind</div>
        <div class="stat-value">${Math.round(c.wind_speed_10m)} km/h</div>
      </div>
      <div class="stat">
        <div class="stat-label">Precip</div>
        <div class="stat-value">${c.precipitation ?? 0} mm</div>
      </div>
    </div>
  `;
}

/* ─── Fetch ──────────────────────────────────────────────────── */
async function fetchWeather(lat, lon, city) {
  // Skip if cached data is still within the refresh window
  const fetchedAt = cache('weather_fetchedAt');
  if (fetchedAt) {
    const ageMs = Date.now() - new Date(fetchedAt).getTime();
    if (ageMs < CONFIG.refresh.weatherMins * 60 * 1000) return;
  }

  const url = [
    'https://api.open-meteo.com/v1/forecast',
    `?latitude=${lat}&longitude=${lon}`,
    '&current=temperature_2m,apparent_temperature,weather_code',
    ',wind_speed_10m,wind_direction_10m,relative_humidity_2m,precipitation',
    '&wind_speed_unit=kmh&timezone=auto',
  ].join('');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
  const data = await res.json();
  cache('weather_data', data);
  cache('weather_city', city);
  cache('weather_fetchedAt', new Date().toISOString());
  renderWeather(data, city);
}

/* ─── Load (module-level so refreshWeather can call it) ─────── */
async function _weatherLoad() {
  let lat  = CONFIG.location.latitude;
  let lon  = CONFIG.location.longitude;
  let city = `${CONFIG.location.city}, ${CONFIG.location.country}`;

  if (CONFIG.location.useGeolocation && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;

      // Reverse-geocode to get a human-readable city name
      try {
        const geoRes  = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        const geoData = await geoRes.json();
        city = geoData.address?.city
            || geoData.address?.town
            || geoData.address?.village
            || geoData.address?.county
            || city;
        if (geoData.address?.country_code)
          city += `, ${geoData.address.country_code.toUpperCase()}`;
      } catch {}
    } catch {}
  }

  await fetchWeather(lat, lon, city);
}

/* ─── Manual refresh (bypasses cache TTL) ───────────────────── */
async function refreshWeather() {
  const btn = $('weather-refresh-btn');
  if (btn) { btn.disabled = true; btn.classList.add('spinning'); }
  cache('weather_fetchedAt', null); // invalidate so fetchWeather skips the TTL guard
  try {
    await _weatherLoad();
  } catch (e) {
    console.warn('Weather refresh failed:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('spinning'); }
  }
}

/* ─── Init ───────────────────────────────────────────────────── */
async function initWeather() {
  // Show cached data immediately so the panel isn't blank on load
  const cached = cache('weather_data');
  if (cached) renderWeather(cached, cache('weather_city') || CONFIG.location.city);

  $('weather-refresh-btn').addEventListener('click', refreshWeather);

  try {
    await _weatherLoad();
  } catch (e) {
    if (!cached)
      $('weather-body').innerHTML = `<div class="state-msg">⚠️ Weather unavailable</div>`;
    console.warn('Weather fetch failed:', e);
  }

  setInterval(async () => {
    try { await _weatherLoad(); } catch {}
  }, CONFIG.refresh.weatherMins * 60 * 1000);
}
