/**
 * RainMap AI — Main Application Coordinator
 * Rewritten to work with new clean HTML structure.
 */

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  mapManager.init('map');
  analyticsManager.initChart('sensor-chart');
  analyticsManager.startPredictionTerminal('ai-terminal-body');

  api.connect();

  initRouter();
  bindSensorData();
  initMapRouting();

  // Live weather from Open-Meteo
  fetchLiveWeather();
  setInterval(fetchLiveWeather, 15 * 60 * 1000);

  // Timestamp updater
  startTimestampUpdater();
});

// ============================================================
// ROUTER
// ============================================================
function initRouter() {
  const tabs = {
    weather: document.getElementById('tab-weather'),
    map:     document.getElementById('tab-map'),
    analytics: document.getElementById('tab-analytics')
  };
  const views = {
    weather: document.getElementById('view-weather'),
    map:     document.getElementById('view-map'),
    analytics: document.getElementById('view-analytics')
  };

  Object.keys(tabs).forEach(key => {
    if (!tabs[key]) return;
    tabs[key].addEventListener('click', () => {
      Object.values(tabs).forEach(t => t.classList.remove('active'));
      Object.values(views).forEach(v => v.classList.remove('active'));
      tabs[key].classList.add('active');
      views[key].classList.add('active');
      if (key === 'map') mapManager.invalidate();
    });
  });
}

// ============================================================
// SENSOR DATA BINDING
// ============================================================
function bindSensorData() {
  api.onSensorUpdate((data) => {
    updateWaterGauge(data.waterLevel, data.floodRisk);
    updateRiskCard(data.floodRisk);
    updateRainCard(data.rainfall);
    updateTrendCard(data.waterTrend);
    mapManager.updateMapFromSensors(data);
    analyticsManager.updateAreaRiskCards(data);
    analyticsManager.addDataPoint(data.waterLevel, data.rainfall);
  });
}

// ============================================================
// WATER GAUGE
// ============================================================
function updateWaterGauge(level, risk) {
  const valueLabel = document.getElementById('gauge-level-value');
  const fillRing   = document.getElementById('water-gauge-fill');

  if (valueLabel) valueLabel.innerText = `${level}%`;

  if (fillRing) {
    const total  = 439.6;
    const offset = total - (level / 100) * total;
    fillRing.style.strokeDashoffset = offset;

    if (risk === 'critical') {
      fillRing.style.stroke = 'var(--color-red)';
      fillRing.style.filter = 'drop-shadow(0 0 8px var(--color-red-glow))';
    } else if (risk === 'warning') {
      fillRing.style.stroke = 'var(--color-orange)';
      fillRing.style.filter = 'drop-shadow(0 0 8px var(--color-orange-glow))';
    } else {
      fillRing.style.stroke = 'var(--color-cyan)';
      fillRing.style.filter = 'drop-shadow(0 0 8px var(--color-cyan-glow))';
    }
  }
}

// ============================================================
// RISK CARD
// ============================================================
function updateRiskCard(risk) {
  const card = document.getElementById('card-flood-risk');
  const val  = document.getElementById('val-flood-risk');
  const desc = document.getElementById('desc-flood-risk');

  if (!card || !val || !desc) return;

  card.className = 'glass-card metric-card alert-card';

  if (risk === 'critical') {
    card.classList.add('critical-red');
    val.innerText  = 'CRITICAL';
    val.style.color = 'var(--color-red)';
    desc.innerHTML = `<span class="status-dot-sm" style="background:var(--color-red)"></span> Evacuate Now`;
    desc.style.color = 'var(--color-red)';
  } else if (risk === 'warning') {
    card.classList.add('warning-amber');
    val.innerText  = 'WARNING';
    val.style.color = 'var(--color-orange)';
    desc.innerHTML = `<span class="status-dot-sm" style="background:var(--color-orange)"></span> High Alert`;
    desc.style.color = 'var(--color-orange)';
  } else {
    val.innerText  = 'LOW';
    val.style.color = '#fff';
    desc.innerHTML = `<span class="status-dot-sm" style="background:var(--color-green)"></span> Secure`;
    desc.style.color = 'var(--color-green)';
  }
}

// ============================================================
// PRECIPITATION CARD
// ============================================================
function updateRainCard(rainState) {
  const val  = document.getElementById('val-rain-status');
  const desc = document.getElementById('desc-rain-status');
  if (!val || !desc) return;

  val.innerText = rainState.toUpperCase();
  switch (rainState) {
    case 'heavy':
      val.style.color  = 'var(--color-red)';
      desc.innerText   = 'Storm | High inflow';
      break;
    case 'moderate':
      val.style.color  = 'var(--color-cyan)';
      desc.innerText   = 'Moderate rain';
      break;
    case 'light':
      val.style.color  = 'var(--color-blue)';
      desc.innerText   = 'Drizzle | Soil damp';
      break;
    default:
      val.style.color  = '#fff';
      desc.innerText   = 'Dry conditions';
  }
}

// ============================================================
// TREND CARD
// ============================================================
function updateTrendCard(trend) {
  const val  = document.getElementById('val-trend-status');
  const desc = document.getElementById('desc-trend');
  const icon = document.getElementById('icon-trend');
  if (!val) return;

  val.innerText = trend.toUpperCase();

  if (trend === 'rising') {
    val.style.color = 'var(--color-red)';
    if (icon) { icon.style.transform = 'rotate(-45deg)'; icon.style.color = 'var(--color-red)'; }
    if (desc) desc.innerText = '↗ Level rising';
  } else if (trend === 'falling') {
    val.style.color = 'var(--color-green)';
    if (icon) { icon.style.transform = 'rotate(45deg)'; icon.style.color = 'var(--color-green)'; }
    if (desc) desc.innerText = '↘ Level dropping';
  } else {
    val.style.color = '#fff';
    if (icon) { icon.style.transform = 'rotate(0deg)'; icon.style.color = 'var(--color-cyan)'; }
    if (desc) desc.innerText = 'No change';
  }
}

// ============================================================
// LIVE WEATHER — Open-Meteo
// ============================================================
async function fetchLiveWeather() {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=12.9141&longitude=74.8560' +
      '&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m' +
      '&timezone=auto';

    const res  = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const json = await res.json();
    const cur  = json.current;

    const tempEl = document.getElementById('live-temp');
    const descEl = document.getElementById('live-desc');
    const humEl  = document.getElementById('live-humidity');
    const windEl = document.getElementById('live-wind');
    const iconEl = document.getElementById('weather-hero-icon');

    if (tempEl) {
      tempEl.innerText = `${Math.round(cur.temperature_2m)}°C`;
      tempEl.classList.add('value-flash');
      setTimeout(() => tempEl.classList.remove('value-flash'), 800);
    }
    if (humEl)  humEl.innerText  = `${cur.relative_humidity_2m}%`;
    if (windEl) windEl.innerText = `${cur.wind_speed_10m} km/h`;

    // WMO weather code → description & icon
    const code = cur.weather_code;
    let desc = 'Clear Sky', iconName = 'sun', iconColor = '#f6d860';

    if      (code === 0)                   { desc = 'Clear Sky';      iconName = 'sun';            iconColor = '#f6d860'; }
    else if (code >= 1  && code <= 3)      { desc = 'Partly Cloudy';  iconName = 'cloud';          iconColor = '#9ca3af'; }
    else if (code >= 45 && code <= 48)     { desc = 'Foggy';          iconName = 'cloud-fog';      iconColor = '#9ca3af'; }
    else if (code >= 51 && code <= 55)     { desc = 'Drizzle';        iconName = 'cloud-drizzle';  iconColor = '#63d9ff'; }
    else if (code >= 61 && code <= 67)     { desc = 'Rainy';          iconName = 'cloud-rain';     iconColor = '#60a5fa'; }
    else if (code >= 71 && code <= 77)     { desc = 'Snow';           iconName = 'snowflake';      iconColor = '#bfdbfe'; }
    else if (code >= 80 && code <= 82)     { desc = 'Heavy Showers';  iconName = 'cloud-rain';     iconColor = '#3b82f6'; }
    else if (code >= 95)                   { desc = 'Thunderstorm';   iconName = 'cloud-lightning'; iconColor = '#f59e0b'; }

    if (descEl) descEl.innerText = desc;

    if (iconEl) {
      const ni = document.createElement('i');
      ni.setAttribute('data-lucide', iconName);
      ni.id = 'weather-hero-icon';
      ni.className = 'hero-icon';
      ni.style.color  = iconColor;
      ni.style.filter = `drop-shadow(0 0 10px ${iconColor}80)`;
      iconEl.parentNode.replaceChild(ni, iconEl);
      lucide.createIcons();
    }

    console.log('[RainMapApp] 🌦️ Weather updated:', desc, `${Math.round(cur.temperature_2m)}°C`);

  } catch (err) {
    console.warn('[RainMapApp] Weather fetch failed:', err.message);
  }
}

// ============================================================
// TIMESTAMP UPDATER
// ============================================================
let _lastWeatherFetch = Date.now();

function startTimestampUpdater() {
  _lastWeatherFetch = Date.now();
  setInterval(() => {
    const el = document.getElementById('last-updated-text');
    if (!el) return;
    const diff = Math.floor((Date.now() - _lastWeatherFetch) / 1000);
    if (diff < 5)        el.innerText = 'Updated just now';
    else if (diff < 60)  el.innerText = `Updated ${diff} sec ago`;
    else                 el.innerText = `Updated ${Math.floor(diff/60)} min ago`;
  }, 5000);
}

// ============================================================
// MAP ROUTING
// ============================================================
function initMapRouting() {
  const btn = document.getElementById('btn-route');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('active');
    if (btn.classList.contains('active')) {
      btn.innerHTML = `<i data-lucide="shield-check"></i> Safe Route Plotted`;
      mapManager.toggleSafeRoute(true);
    } else {
      btn.innerHTML = `<i data-lucide="shield-alert"></i> Calculate Safe Evacuation Route`;
      mapManager.toggleSafeRoute(false);
    }
    lucide.createIcons();
  });
}
