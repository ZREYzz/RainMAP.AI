/**
 * RainMap AI - Sensor Analytics & Forecasting Module
 * 
 * Manages Chart.js rendering for historical water level and rainfall,
 * binds dynamic telemetry data streams, displays area hazard registers,
 * and maintains a terminal simulating live AI prediction telemetry.
 */
class RainMapAnalytics {
  constructor() {
    this.chart = null;
    this.maxDataPoints = 12; // Maximum historical ticks displayed
    
    // Initial simulated history datasets (12 time divisions of 10m intervals)
    this.historicalData = {
      labels: ['10:40', '10:50', '11:00', '11:10', '11:20', '11:30', '11:40', '11:50', '12:00', '12:10', '12:20', '12:30'],
      waterLevel: [32.1, 33.4, 34.8, 38.2, 40.5, 41.2, 42.8, 43.1, 44.5, 45.0, 45.2, 45.2],
      rainfall: [5, 10, 15, 25, 30, 20, 15, 20, 25, 20, 18, 18] // mm/hr equivalent
    };

    // Scrolling AI terminal messages
    this.aiLogs = [
      "📡 Model Init: DeepRain-v3 forecasting core online...",
      "🧠 Analysing local ultrasonic sensor slope coefficient...",
      "⚠️ Pre-alert: Padil water levels growing at +1.4% per 10min.",
      "🛰️ Radar Feed: High reflectivity clouds moving East-South-East.",
      "🔥 Prediction: 84.2% probability of waterlogging under Padil Bridge by 13:45.",
      "🟢 Surathkal catchment area verified as SAFE. High natural drainage rate.",
      "⚡ System Suggestion: Dispatch flood logs to Municipal emergency teams.",
      "💧 Analog Trend Sensor: Saturated soil conditions detected in Jeppu."
    ];
    this.currentLogIndex = 0;
  }

  /**
   * Initialize Chart.js canvas elements
   * @param {string} canvasId 
   */
  initChart(canvasId) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) {
      console.warn(`[RainMapAnalytics] Canvas #${canvasId} not found.`);
      return;
    }

    console.log(`[RainMapAnalytics] Initializing Chart.js on #${canvasId}`);

    // Create gradient fills
    const waterGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
    waterGradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
    waterGradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    const rainGradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
    rainGradient.addColorStop(0, 'rgba(0, 114, 255, 0.2)');
    rainGradient.addColorStop(1, 'rgba(0, 114, 255, 0.0)');

    // Custom configuration parameters
    const chartConfig = {
      type: 'line',
      data: {
        labels: [...this.historicalData.labels],
        datasets: [
          {
            label: 'Water Level (%)',
            data: [...this.historicalData.waterLevel],
            borderColor: '#00f0ff',
            borderWidth: 2,
            pointBackgroundColor: '#00f0ff',
            pointBorderColor: 'rgba(255,255,255,0.8)',
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true,
            backgroundColor: waterGradient,
            tension: 0.35,
            yAxisID: 'yWater'
          },
          {
            label: 'Rainfall (mm/h)',
            data: [...this.historicalData.rainfall],
            borderColor: '#0072ff',
            borderWidth: 1.5,
            borderDash: [4, 4],
            pointBackgroundColor: '#0072ff',
            pointRadius: 2,
            fill: true,
            backgroundColor: rainGradient,
            tension: 0.3,
            yAxisID: 'yRain'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              boxWidth: 12,
              color: '#9ca3af',
              font: {
                family: 'Inter',
                size: 9,
                weight: '500'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(14, 16, 27, 0.95)',
            titleColor: '#00f0ff',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleFont: { family: 'Outfit', size: 10, weight: 'bold' },
            bodyFont: { family: 'Inter', size: 10 },
            padding: 8,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.02)'
            },
            ticks: {
              color: '#6b7280',
              font: { family: 'Inter', size: 8 }
            }
          },
          yWater: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: 100,
            grid: {
              color: 'rgba(255, 255, 255, 0.04)'
            },
            ticks: {
              color: '#00f0ff',
              font: { family: 'Outfit', size: 8 },
              callback: (val) => val + '%'
            }
          },
          yRain: {
            type: 'linear',
            position: 'right',
            min: 0,
            max: 50,
            grid: {
              drawOnChartArea: false // Avoid overlapping grids
            },
            ticks: {
              color: '#3b82f6',
              font: { family: 'Outfit', size: 8 },
              callback: (val) => val + 'mm'
            }
          }
        }
      }
    };

    this.chart = new Chart(ctx, chartConfig);
  }

  /**
   * Append a live reading point dynamically from the active sensor api stream
   * @param {number} waterLevel 
   * @param {string} rainState 
   */
  addDataPoint(waterLevel, rainState) {
    if (!this.chart) return;

    // Convert categorical rain state into simulated intensity numbers (mm/hour)
    let rainIntensityValue = 0;
    switch (rainState) {
      case 'heavy': rainIntensityValue = 35 + Math.random() * 8; break;
      case 'moderate': rainIntensityValue = 18 + Math.random() * 5; break;
      case 'light': rainIntensityValue = 6 + Math.random() * 3; break;
      case 'none': rainIntensityValue = 0; break;
    }

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // Add elements to datasets
    this.chart.data.labels.push(timeStr);
    this.chart.data.datasets[0].data.push(waterLevel);
    this.chart.data.datasets[1].data.push(Number(rainIntensityValue.toFixed(1)));

    // Shift window constraints
    if (this.chart.data.labels.length > this.maxDataPoints) {
      this.chart.data.labels.shift();
      this.chart.data.datasets[0].data.shift();
      this.chart.data.datasets[1].data.shift();
    }

    // Refresh display canvas
    this.chart.update('quiet');
  }

  /**
   * Setup cycling updates on the simulated AI forecast console
   * @param {string} consoleBodyId 
   */
  startPredictionTerminal(consoleBodyId) {
    const el = document.getElementById(consoleBodyId);
    if (!el) return;

    // Set first logs
    el.innerHTML = `<div>${this.aiLogs[0]}</div><div>${this.aiLogs[1]}</div>`;
    this.currentLogIndex = 2;

    // Rotate new prediction reports every 6 seconds
    setInterval(() => {
      const logLine = this.aiLogs[this.currentLogIndex];
      
      // Append line
      el.innerHTML += `<div style="margin-top: 4px; border-left: 2px solid var(--color-cyan); padding-left: 6px; animation: pulse-blink 0.3s">${logLine}</div>`;
      
      // Auto scroll console wrapper
      el.scrollTop = el.scrollHeight;

      // Restrict rows to prevent HTML overflow inside container
      const rows = el.getElementsByTagName('div');
      if (rows.length > 5) {
        el.removeChild(rows[0]);
      }

      this.currentLogIndex = (this.currentLogIndex + 1) % this.aiLogs.length;
    }, 6000);
  }

  /**
   * Redraw risk cards on Analytics based on state
   * @param {Object} sensorState 
   */
  updateAreaRiskCards(sensorState) {
    const padilPill = document.getElementById('risk-padil-pill');
    const padilLabel = document.getElementById('risk-padil-label');

    if (padilPill && padilLabel) {
      // Padil is our live linked sub-area representing the hardware ESP32 deployment
      const risk = sensorState.floodRisk;
      const level = sensorState.waterLevel;
      
      padilLabel.innerText = `Ultrasonic Level: ${level}% | Rain: ${sensorState.rainfall.toUpperCase()}`;
      
      // Reset classes
      padilPill.className = 'area-status';
      if (risk === 'critical') {
        padilPill.classList.add('high');
        padilPill.innerText = 'CRITICAL';
      } else if (risk === 'warning') {
        padilPill.classList.add('moderate');
        padilPill.innerText = 'WARNING';
      } else {
        padilPill.classList.add('safe');
        padilPill.innerText = 'SAFE';
      }
    }
  }
}

// Expose default Analytics Manager instance globally
window.analyticsManager = new RainMapAnalytics();
