/**
 * RainMap AI - Firebase Realtime Bridge
 * Updated to target new clean HTML structure.
 *
 * Reads /RainGauge from Firebase and updates:
 *   #flood-level-mm   → rainfallMM value
 *   #flood-risk-level  → risk text + color
 *   #flood-status-badge → SAFE / WARNING / FLOOD
 *   #risk-dot          → pulse dot color
 */

import { db, ref, onValue } from './firebase.js';

// State
let isFirebaseConnected = false;
let lastFirebaseData    = null;
let reconnectAttempts   = 0;
let lastUpdateTime      = null;
let timeTrackerInterval = null;

// ============================================================
// INITIALIZE LISTENER
// ============================================================
function initFirebaseListener() {
  console.log('[FirebaseBridge] 🚀 Initializing /RainGauge listener...');

  const rainGaugeRef = ref(db, 'RainGauge');

  onValue(rainGaugeRef, (snapshot) => {
    const data = snapshot.val();

    if (!data) {
      console.warn('[FirebaseBridge] ⚠️ No data at /RainGauge. Waiting...');
      return;
    }

    isFirebaseConnected = true;
    reconnectAttempts   = 0;
    lastFirebaseData    = data;
    lastUpdateTime      = Date.now();

    console.log('[FirebaseBridge] 📡 LIVE DATA:', JSON.stringify(data));

    // Update the new DOM elements
    updateFloodAnalyticsDOM(data);

    // Feed data into the existing RainMapAPI pipeline for gauge, map, analytics
    feedIntoAPIPipeline(data);

    // Timestamp & animation
    startTimestampTracker();
    triggerCardPulse();

  }, (error) => {
    console.error('[FirebaseBridge] ❌ Error:', error.message);
    isFirebaseConnected = false;
    reconnectAttempts++;
    const delay = Math.min(5000 * reconnectAttempts, 30000);
    console.log(`[FirebaseBridge] 🔄 Retry in ${delay / 1000}s`);
    setTimeout(initFirebaseListener, delay);
  });

  // Monitor connection state
  onValue(ref(db, '.info/connected'), (snap) => {
    isFirebaseConnected = snap.val() === true;
    console.log(`[FirebaseBridge] ${isFirebaseConnected ? '✅ Connected' : '🔌 Disconnected'}`);
  });
}

// ============================================================
// UPDATE FLOOD ANALYTICS DOM
// ============================================================
function updateFloodAnalyticsDOM(data) {
  const status = (data.status || 'SAFE').toUpperCase();

  // --- Flood Level in mm (#flood-level-mm) ---
  const levelEl = document.getElementById('flood-level-mm');
  if (levelEl) {
    const newVal = `${data.rainfallMM ?? 0} mm`;
    if (levelEl.textContent !== newVal) {
      levelEl.textContent = newVal;
      flash(levelEl);
    }
  }

  // --- Flood Risk Level (#flood-risk-level) ---
  const riskEl  = document.getElementById('flood-risk-level');
  const riskDot = document.getElementById('risk-dot');
  if (riskEl) {
    let riskText  = 'LOW';
    let riskColor = 'var(--color-cyan)';
    let riskClass = 'risk-low';

    if (status === 'FLOOD') {
      riskText = 'CRITICAL'; riskColor = 'var(--color-red)'; riskClass = 'risk-critical';
    } else if (status === 'WARNING') {
      riskText = 'MODERATE'; riskColor = 'var(--color-orange)'; riskClass = 'risk-moderate';
    }

    riskEl.className = `analytics-value ${riskClass}`;
    riskEl.innerHTML = `<span class="pulse-dot" style="background:${riskColor};" id="risk-dot"></span> ${riskText}`;
  }

  // --- Status Badge (#flood-status-badge) ---
  const statusEl = document.getElementById('flood-status-badge');
  if (statusEl && statusEl.textContent !== status) {
    statusEl.textContent = status;
    statusEl.className = 'status-badge';
    if (status === 'FLOOD')        statusEl.classList.add('status-flood');
    else if (status === 'WARNING') statusEl.classList.add('status-warning');
    else                           statusEl.classList.add('status-safe');
    flash(statusEl);
  }

  console.log(`[FirebaseBridge] 🎯 Updated → ${data.rainfallMM}mm | ${status}`);
}

// ============================================================
// FEED INTO API PIPELINE
// ============================================================
function feedIntoAPIPipeline(data) {
  if (!window.api) return;

  const statusMap = { 'SAFE': 'low', 'WARNING': 'warning', 'FLOOD': 'critical' };
  const status    = (data.status || 'SAFE').toUpperCase();

  const pct = data.rainfallPercent ?? 0;
  let rainfallCategory = 'none';
  if      (pct >= 75) rainfallCategory = 'heavy';
  else if (pct >= 40) rainfallCategory = 'moderate';
  else if (pct >= 15) rainfallCategory = 'light';

  const waterLevelPct = Math.min(100, ((data.waterHeight ?? 0) / 10) * 100);
  const analog = data.analogValue ?? 0;
  const waterTrend = analog > 800 ? 'rising' : analog < 400 ? 'falling' : 'stable';

  window.api.state.waterLevel = Number(waterLevelPct.toFixed(1));
  window.api.state.waterTrend = waterTrend;
  window.api.state.rainfall   = rainfallCategory;
  window.api.state.floodRisk  = statusMap[status] || 'low';
  window.api.state.connection = 'online';
  window.api.state.timestamp  = new Date();

  window.api.broadcastUpdate();
}

// ============================================================
// HELPERS
// ============================================================
function flash(el) {
  el.classList.add('value-flash');
  setTimeout(() => el.classList.remove('value-flash'), 800);
}

function startTimestampTracker() {
  if (timeTrackerInterval) clearInterval(timeTrackerInterval);
  timeTrackerInterval = setInterval(() => {
    const el = document.getElementById('last-updated-text');
    if (!el || !lastUpdateTime) return;
    const diff = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if      (diff < 5)  el.innerText = 'Updated just now';
    else if (diff < 60) el.innerText = `Updated ${diff} sec ago`;
    else                el.innerText = `Updated ${Math.floor(diff / 60)} min ago`;
  }, 1000);
}

function triggerCardPulse() {
  const card = document.getElementById('flood-analytics-card');
  if (!card) return;
  card.style.boxShadow = '0 0 20px rgba(0,255,255,0.15)';
  setTimeout(() => { card.style.boxShadow = ''; }, 600);
}

// ============================================================
// BOOT
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initFirebaseListener, 500));
} else {
  setTimeout(initFirebaseListener, 500);
}

window.firebaseBridge = {
  isConnected: () => isFirebaseConnected,
  lastData:    () => lastFirebaseData,
  reconnect:   initFirebaseListener
};

console.log('[FirebaseBridge] 🔥 Module loaded.');
