/**
 * RainMap AI - Hardware Connection & Sensor API Layer
 * 
 * This class decouples the hardware interface from the UI.
 * It supports three modes:
 *  - 'mock': Generates realistic sensor telemetry (ultrasonic water level, analog trend, WiFi signal, battery).
 *  - 'rest': Polls an ESP32 REST endpoint (`/api/sensors`).
 *  - 'websocket': Establish a live duplex WebSocket stream with the ESP32.
 */
class RainMapAPI {
  constructor() {
    this.config = {
      mode: 'mock', // 'mock' | 'rest' | 'websocket'
      host: 'http://192.168.4.1', // Default ESP32 AP address
      pollInterval: 3000 // Poll every 3 seconds for REST
    };

    // Current internal state representation (matching ESP32 telemetry)
    this.state = {
      waterLevel: 45.2,          // Ultrasonic water level percentage
      waterTrend: 'stable',      // Analog water trend: 'falling' | 'stable' | 'rising'
      rainfall: 'moderate',      // Analog precipitation: 'none' | 'light' | 'moderate' | 'heavy'
      floodRisk: 'low',          // Calculated: 'low' | 'warning' | 'critical'
      connection: 'online',      // 'online' | 'offline' | 'connecting'
      gsmBackup: false,          // Mobile backup status
      batteryVoltage: 3.82,      // Battery backup voltage (V)
      rssi: -68,                 // WiFi RSSI signal strength (dBm)
      timestamp: new Date()
    };

    // Callback registries
    this.listeners = {
      sensorUpdate: [],
      connectionChange: []
    };

    this.timer = null;
    this.simPhase = 0; // Wave timing generator for mock mode
  }

  /**
   * Subscribe to live sensor updates
   * @param {Function} callback 
   */
  onSensorUpdate(callback) {
    if (typeof callback === 'function') {
      this.listeners.sensorUpdate.push(callback);
      // Immediately send current state to newly registered listener
      callback({ ...this.state });
    }
  }

  /**
   * Subscribe to connection status modifications
   * @param {Function} callback 
   */
  onConnectionChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.connectionChange.push(callback);
      callback(this.state.connection);
    }
  }

  /**
   * Initialize communication
   */
  connect() {
    console.log(`[RainMapAPI] Connecting in [${this.config.mode}] mode...`);
    
    if (this.timer) {
      clearInterval(this.timer);
    }

    if (this.config.mode === 'mock') {
      this.setConnection('connecting');
      setTimeout(() => {
        this.setConnection('online');
        this.startMocking();
      }, 1000);
    } else if (this.config.mode === 'rest') {
      this.setConnection('connecting');
      this.pollREST();
      this.timer = setInterval(() => this.pollREST(), this.config.pollInterval);
    } else if (this.config.mode === 'websocket') {
      this.initWebSocket();
    }
  }

  /**
   * Terminate active listeners or polling intervals
   */
  disconnect() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setConnection('offline');
  }

  /**
   * Force set the connection status and notify subscribers
   * @param {string} status 
   */
  setConnection(status) {
    if (this.state.connection !== status) {
      this.state.connection = status;
      console.log(`[RainMapAPI] Connection Status: ${status.toUpperCase()}`);
      this.listeners.connectionChange.forEach(cb => cb(status));
      this.broadcastUpdate();
    }
  }

  /**
   * Broadcast telemetry change to all subscribers
   */
  broadcastUpdate() {
    this.state.timestamp = new Date();
    this.listeners.sensorUpdate.forEach(cb => cb({ ...this.state }));
  }

  /**
   * Configuration updater
   * @param {Object} newConfig 
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.connect(); // Reconnect using new setup
  }

  /* ========================================================
     REST INGESTION LAYER
     ======================================================== */
  async pollREST() {
    try {
      // Mocking fetch endpoint - in production, this queries the ESP32 IP
      console.log(`[RainMapAPI] Fetching REST telemetry from ${this.config.host}/api/sensors`);
      
      const response = await fetch(`${this.config.host}/api/sensors`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });

      if (!response.ok) throw new Error(`HTTP Error Status: ${response.status}`);
      
      const data = await response.json();
      
      // Expected JSON format from ESP32:
      // { "waterLevel": 58.4, "trend": "rising", "rainfall": "heavy", "gsm": false, "battery": 3.91, "rssi": -62 }
      
      this.state.waterLevel = Number(data.waterLevel);
      this.state.waterTrend = data.trend;
      this.state.rainfall = data.rainfall;
      this.state.gsmBackup = !!data.gsm;
      this.state.batteryVoltage = Number(data.battery);
      this.state.rssi = Number(data.rssi);
      
      this.calculateRisk();
      this.setConnection('online');
      this.broadcastUpdate();

    } catch (error) {
      console.warn(`[RainMapAPI] REST request failed. Retrying...`, error.message);
      this.setConnection('offline');
    }
  }

  /* ========================================================
     WEBSOCKET INGESTION LAYER
     ======================================================== */
  initWebSocket() {
    const wsUrl = this.config.host.replace(/^http/, 'ws') + '/ws';
    console.log(`[RainMapAPI] Opening WebSocket at ${wsUrl}`);
    
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.setConnection('online');
        console.log('[RainMapAPI] WebSocket connected successfully.');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.state.waterLevel = Number(data.waterLevel);
          this.state.waterTrend = data.trend;
          this.state.rainfall = data.rainfall;
          this.state.gsmBackup = !!data.gsm;
          this.state.batteryVoltage = Number(data.battery);
          this.state.rssi = Number(data.rssi);
          
          this.calculateRisk();
          this.broadcastUpdate();
        } catch (e) {
          console.error('[RainMapAPI] Error decoding WS packet:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[RainMapAPI] WS Error:', err);
        this.setConnection('offline');
      };

      this.ws.onclose = () => {
        console.warn('[RainMapAPI] WS Closed. Retrying in 5 seconds...');
        this.setConnection('offline');
        setTimeout(() => {
          if (this.config.mode === 'websocket') this.initWebSocket();
        }, 5000);
      };

    } catch (e) {
      console.error('[RainMapAPI] WS Setup error:', e);
      this.setConnection('offline');
    }
  }

  /* ========================================================
     MOCK DATA SIMULATOR ENGINE
     ======================================================== */
  startMocking() {
    console.log("[RainMapAPI] Simulation engine started.");
    this.timer = setInterval(() => {
      // Natural sensor jitter
      const noise = (Math.random() - 0.5) * 0.4;
      
      // Generate water levels following a sinusoidal rain flood cycle
      this.simPhase += 0.05;
      // Ranges between 30% and 65% in a nice wavy movement
      const wave = Math.sin(this.simPhase) * 17.5 + 47.5;
      
      this.state.waterLevel = Math.max(0, Math.min(100, Number((wave + noise).toFixed(1))));
      
      // Determine simulated trends based on slope of wave
      const slope = Math.cos(this.simPhase);
      if (slope > 0.15) {
        this.state.waterTrend = 'rising';
      } else if (slope < -0.15) {
        this.state.waterTrend = 'falling';
      } else {
        this.state.waterTrend = 'stable';
      }

      // Simulate rainfall adjustments matching the water wave phase
      if (wave > 55) {
        this.state.rainfall = 'heavy';
      } else if (wave > 45) {
        this.state.rainfall = 'moderate';
      } else if (wave > 35) {
        this.state.rainfall = 'light';
      } else {
        this.state.rainfall = 'none';
      }

      // Jitter battery and RSSI values
      this.state.batteryVoltage = Number((3.82 + (Math.random() - 0.5) * 0.04).toFixed(2));
      this.state.rssi = Math.round(-65 + (Math.random() - 0.5) * 6);
      this.state.gsmBackup = Math.random() > 0.85; // Intermittent GSM check

      this.calculateRisk();
      this.broadcastUpdate();
    }, 3000);
  }

  /**
   * Helper algorithm to compute localized risk states based on sensor inputs
   */
  calculateRisk() {
    const level = this.state.waterLevel;
    const trend = this.state.waterTrend;

    if (level >= 80 || (level >= 70 && trend === 'rising')) {
      this.state.floodRisk = 'critical';
    } else if (level >= 50 || (level >= 40 && trend === 'rising')) {
      this.state.floodRisk = 'warning';
    } else {
      this.state.floodRisk = 'low';
    }
  }

  /* ========================================================
     DEVELOPER OVERRIDE API (For high-fidelity demonstration)
     ======================================================== */
  
  /**
   * Trigger explicit values manually from the developer control panel
   * @param {string} parameter 
   * @param {any} value 
   */
  overrideSensor(parameter, value) {
    if (this.config.mode !== 'mock') {
      console.warn(`[RainMapAPI] Override ignored. Active mode is [${this.config.mode}], not [mock].`);
      return;
    }

    // Stop active natural sine wave ticker so override stays locked
    if (this.timer && parameter === 'waterLevel') {
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        // Run simulator, but preserve the user overrides!
        this.state.batteryVoltage = Number((3.82 + (Math.random() - 0.5) * 0.02).toFixed(2));
        this.state.rssi = Math.round(-65 + (Math.random() - 0.5) * 4);
        this.calculateRisk();
        this.broadcastUpdate();
      }, 3000);
    }

    switch (parameter) {
      case 'waterLevel':
        this.state.waterLevel = Number(value);
        break;
      case 'waterTrend':
        this.state.waterTrend = value;
        break;
      case 'rainfall':
        this.state.rainfall = value;
        break;
      case 'connection':
        this.setConnection(value);
        return; // setConnection already handles broadcasts
      case 'gsmBackup':
        this.state.gsmBackup = value === 'true' || value === true;
        break;
    }

    this.calculateRisk();
    this.broadcastUpdate();
  }

  /**
   * Trigger a simulated extreme flash flood event instantly
   */
  triggerFlashFlood() {
    console.log("[RainMapAPI] Developer triggered FLASH FLOOD simulation!");
    
    if (this.timer) clearInterval(this.timer);

    this.state.connection = 'online';
    this.state.waterLevel = 94.8;
    this.state.waterTrend = 'rising';
    this.state.rainfall = 'heavy';
    this.state.gsmBackup = true; // Simulating active cellular notification fallback
    this.state.rssi = -82; // Rain attenuation degrades WiFi signal strength
    this.state.batteryVoltage = 3.65; // High drain under continuous alert transmission
    
    this.calculateRisk();
    this.broadcastUpdate();

    // Restart simulator in high alert state
    this.timer = setInterval(() => {
      // Natural slight fluctuations in the critical zone
      this.state.waterLevel = Math.max(90, Math.min(100, Number((this.state.waterLevel + (Math.random() - 0.4) * 0.3).toFixed(1))));
      this.state.batteryVoltage = Number((3.65 + (Math.random() - 0.5) * 0.01).toFixed(2));
      this.state.rssi = Math.round(-80 + (Math.random() - 0.5) * 4);
      this.calculateRisk();
      this.broadcastUpdate();
    }, 3000);
  }
}

// Expose default API instance globally
window.api = new RainMapAPI();
