/**
 * RainMap AI - Main Application Coordinator
 * 
 * Coordinates page views, registers event listeners for routing and developer panels,
 * loads SVG iconography, and binds incoming hardware telemetry to interface widgets
 * (circular water gauges, connection indicators, and Leaflet circles).
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[RainMapApp] Starting application lifecycle...');

  // Initialize Lucide SVG Icons globally
  lucide.createIcons();

  // Initialize UI Views
  mapManager.init('map');
  analyticsManager.initChart('sensor-chart');
  analyticsManager.startPredictionTerminal('ai-terminal-body');

  // Initiate default API connection
  api.connect();

  // 1. Single Page View Router setup
  initRouter();

  // 2. Hardware Ingestion to DOM Data Binding
  bindSensorData();

  // 3. Developer Simulation Panel Control drawer
  initDeveloperConsole();

  // 4. Map Routing interaction
  initMapRouting();
});

/**
 * Bottom Navigation Drawer View Switcher
 */
function initRouter() {
  const tabs = {
    weather: document.getElementById('tab-weather'),
    map: document.getElementById('tab-map'),
    analytics: document.getElementById('tab-analytics')
  };

  const views = {
    weather: document.getElementById('view-weather'),
    map: document.getElementById('view-map'),
    analytics: document.getElementById('view-analytics')
  };

  Object.keys(tabs).forEach(key => {
    if (!tabs[key]) return;
    
    tabs[key].addEventListener('click', () => {
      // Clear active states
      Object.values(tabs).forEach(t => t.classList.remove('active'));
      Object.values(views).forEach(v => v.classList.remove('active'));

      // Enable target state
      tabs[key].classList.add('active');
      views[key].classList.add('active');

      console.log(`[RainMapApp] Navigation: Switched to [${key.toUpperCase()}] page.`);

      // CRITICAL FIX: Leaflet requires recalculating canvas ratios when showing from hidden state
      if (key === 'map') {
        mapManager.invalidate();
      }
    });
  });
}

/**
 * Bind live sensor updates directly to Dashboard, Gauge, and Map widgets
 */
function bindSensorData() {
  // A. Listen to telemetry updates
  api.onSensorUpdate((data) => {
    // 1. Update circular SVG water percentage gauge
    updateWaterGauge(data.waterLevel, data.floodRisk);

    // 2. Update Risk Metric Card
    updateRiskCard(data.floodRisk);

    // 3. Update Rainfall Card
    updateRainCard(data.rainfall);

    // 4. Update Level Trend & WiFi rssi Card
    updateTrendCard(data.waterTrend, data.rssi);

    // 5. Update Battery & GSM backup status
    updateBatteryCard(data.batteryVoltage, data.gsmBackup);

    // 6. Push real-time coordinate changes to Leaflet layer
    mapManager.updateMapFromSensors(data);

    // 7. Dynamic risk pill status inside Suburb list on Analytics
    analyticsManager.updateAreaRiskCards(data);

    // 8. Stream point telemetry directly on Analytics Line Graph
    analyticsManager.addDataPoint(data.waterLevel, data.rainfall);
  });

  // B. Listen to hardware connectivity status shifts
  api.onConnectionChange((status) => {
    const dot = document.getElementById('hardware-status-dot');
    const text = document.getElementById('hardware-status-text');
    
    if (!dot || !text) return;

    // Reset styles
    dot.className = 'status-dot';
    
    if (status === 'online') {
      dot.classList.add('online');
      text.innerText = 'WiFi';
    } else if (status === 'connecting') {
      dot.classList.add('connecting');
      text.innerText = 'Syncing...';
    } else {
      dot.classList.add('offline');
      text.innerText = 'Offline';
    }
  });
}

/**
 * Update the responsive circular water level progress graphic
 * @param {number} level 
 * @param {string} risk 
 */
function updateWaterGauge(level, risk) {
  const valueLabel = document.getElementById('gauge-level-value');
  const fillRing = document.getElementById('water-gauge-fill');

  if (valueLabel) valueLabel.innerText = `${level}%`;

  if (fillRing) {
    // Total circumference of circle radius (r=70) is 2 * PI * r = 439.6
    const totalCircumference = 439.6;
    const offset = totalCircumference - (level / 100) * totalCircumference;
    fillRing.style.strokeDashoffset = offset;

    // Adjust stroke theme color according to risk severity thresholds
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

/**
 * Style and content updates for the Flood Risk widget
 * @param {string} risk 
 */
function updateRiskCard(risk) {
  const card = document.getElementById('card-flood-risk');
  const val = document.getElementById('val-flood-risk');
  const desc = document.getElementById('desc-flood-risk');

  if (!card || !val || !desc) return;

  // Reset classes
  card.className = 'glass-card metric-card alert-card';

  if (risk === 'critical') {
    card.classList.add('critical-red');
    val.innerText = 'CRITICAL';
    val.style.color = 'var(--color-red)';
    desc.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:var(--color-red)"></span> Evacuate Lowlands`;
    desc.style.color = 'var(--color-red)';
  } else if (risk === 'warning') {
    card.classList.add('warning-amber');
    val.innerText = 'WARNING';
    val.style.color = 'var(--color-orange)';
    desc.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:var(--color-orange)"></span> High Water Alert`;
    desc.style.color = 'var(--color-orange)';
  } else {
    val.innerText = 'LOW';
    val.style.color = '#fff';
    desc.innerHTML = `<span style="width:6px;height:6px;border-radius:50%;background:var(--color-green)"></span> Secure Region`;
    desc.style.color = 'var(--color-green)';
  }
}

/**
 * Content updates for the Precipitation Status widget
 * @param {string} rainState 
 */
function updateRainCard(rainState) {
  const val = document.getElementById('val-rain-status');
  const desc = document.getElementById('desc-rain-status');

  if (!val || !desc) return;

  val.innerText = rainState.toUpperCase();

  switch (rainState) {
    case 'heavy':
      val.style.color = 'var(--color-red)';
      desc.innerText = 'Storming | High Inflow';
      break;
    case 'moderate':
      val.style.color = 'var(--color-cyan)';
      desc.innerText = 'Moderate precipitation';
      break;
    case 'light':
      val.style.color = 'var(--color-blue)';
      desc.innerText = 'Drizzle | Soil damp';
      break;
    case 'none':
    default:
      val.style.color = '#fff';
      desc.innerText = 'Dry | Zero precipitation';
      break;
  }
}

/**
 * Trend arrow adjustments reflecting active rate coefficients
 * @param {string} trend 
 * @param {number} rssi 
 */
function updateTrendCard(trend, rssi) {
  const val = document.getElementById('val-trend-status');
  const rssiLabel = document.getElementById('desc-wifi-rssi');
  const icon = document.getElementById('icon-trend');

  if (val) {
    val.innerText = trend.toUpperCase();
    if (trend === 'rising') {
      val.style.color = 'var(--color-red)';
      if (icon) {
        icon.style.transform = 'rotate(-45deg)';
        icon.style.color = 'var(--color-red)';
      }
    } else if (trend === 'falling') {
      val.style.color = 'var(--color-green)';
      if (icon) {
        icon.style.transform = 'rotate(45deg)';
        icon.style.color = 'var(--color-green)';
      }
    } else {
      val.style.color = '#fff';
      if (icon) {
        icon.style.transform = 'rotate(0deg)';
        icon.style.color = 'var(--color-cyan)';
      }
    }
  }

  if (rssiLabel) {
    rssiLabel.innerText = `WiFi RSSI: ${rssi} dBm`;
  }
}

/**
 * Update Battery backup voltage metrics and fallback networks
 * @param {number} volts 
 * @param {boolean} gsmActive 
 */
function updateBatteryCard(volts, gsmActive) {
  const gsmLabel = document.getElementById('val-gsm-status');
  const batteryLabel = document.getElementById('desc-battery-volt');

  if (gsmLabel) {
    if (gsmActive) {
      gsmLabel.innerText = 'ACTIVE';
      gsmLabel.style.color = 'var(--color-green)';
    } else {
      gsmLabel.innerText = 'STANDBY';
      gsmLabel.style.color = 'var(--text-secondary)';
    }
  }

  if (batteryLabel) {
    batteryLabel.innerText = `Batt Voltage: ${volts}V`;
  }
}

/**
 * Configure and register Developer drawer options and slider triggers
 */
function initDeveloperConsole() {
  const panel = document.getElementById('developer-console');
  const toggle = document.getElementById('dev-toggle');

  if (toggle && panel) {
    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      
      // Toggle rotation indicator
      const icon = toggle.querySelector('i');
      if (icon) {
        if (panel.classList.contains('open')) {
          icon.style.transform = 'rotate(90deg)';
          icon.style.color = 'var(--color-cyan)';
        } else {
          icon.style.transform = 'rotate(0deg)';
          icon.style.color = '';
        }
      }
    });
  }

  // Bind Mode select box
  const modeSelect = document.getElementById('dev-mode');
  if (modeSelect) {
    modeSelect.addEventListener('change', (e) => {
      api.updateConfig({ mode: e.target.value });
    });
  }

  // Bind WiFi Status select box
  const connSelect = document.getElementById('dev-connection');
  if (connSelect) {
    connSelect.addEventListener('change', (e) => {
      api.overrideSensor('connection', e.target.value);
    });
  }

  // Bind Water Level range slider
  const levelSlider = document.getElementById('dev-level');
  const levelSliderLabel = document.getElementById('level-slider-label');
  if (levelSlider && levelSliderLabel) {
    levelSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      levelSliderLabel.innerText = `Ultrasonic Level: ${val}%`;
      api.overrideSensor('waterLevel', val);
    });
  }

  // Bind Rainfall select box
  const rainSelect = document.getElementById('dev-rainfall');
  if (rainSelect) {
    rainSelect.addEventListener('change', (e) => {
      api.overrideSensor('rainfall', e.target.value);
    });
  }

  // Bind Trend select box
  const trendSelect = document.getElementById('dev-trend');
  if (trendSelect) {
    trendSelect.addEventListener('change', (e) => {
      api.overrideSensor('waterTrend', e.target.value);
    });
  }

  // Bind Emergency simulation button
  const floodBtn = document.getElementById('dev-trigger-flood');
  if (floodBtn) {
    floodBtn.addEventListener('click', () => {
      api.triggerFlashFlood();
      
      // Update developer drawer controls to reflect emergency settings visually
      if (levelSlider) {
        levelSlider.value = 94.8;
        levelSliderLabel.innerText = `Ultrasonic Level: 94.8%`;
      }
      if (rainSelect) rainSelect.value = 'heavy';
      if (trendSelect) trendSelect.value = 'rising';
      if (connSelect) connSelect.value = 'online';

      // Keep it open briefly, then collapse so user can see immediate UI changes
      setTimeout(() => {
        panel.classList.remove('open');
        const icon = toggle.querySelector('i');
        if (icon) {
          icon.style.transform = 'rotate(0deg)';
          icon.style.color = '';
        }
      }, 800);
    });
  }
}

/**
 * Initialize Map page Route overlays
 */
function initMapRouting() {
  const btn = document.getElementById('btn-route');
  if (!btn) return;

  btn.addEventListener('click', () => {
    btn.classList.toggle('active');

    if (btn.classList.contains('active')) {
      btn.innerHTML = `<i data-lucide="shield-check"></i> Safe Route Plotted (Bypassing Flood)`;
      mapManager.toggleSafeRoute(true);
    } else {
      btn.innerHTML = `<i data-lucide="shield-alert"></i> Calculate Safe Evacuation Route`;
      mapManager.toggleSafeRoute(false);
    }

    // Refresh icons inside buttons
    lucide.createIcons();
  });
}
