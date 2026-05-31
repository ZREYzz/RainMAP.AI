/**
 * RainMap AI - Interactive Leaflet Map Layer
 * 
 * Handles mapping coordinates, custom SVG pulse markers,
 * flood risk circle overlays, safe evacuation zones,
 * and simulated emergency routing that avoids flooded areas.
 */
class RainMapMap {
  constructor() {
    this.map = null;
    this.userMarker = null;
    this.routePolyline = null;
    
    // Core map coordinates (Mangaluru Suburbs)
    this.coords = {
      center: [12.8960, 74.8450],      // Central View Coordinates
      user: [12.8930, 74.8430],        // Simulated Current User Location (Kankannady area)
      
      // Flood Hazard Zones
      padil: [12.8645, 74.8760],       // Suburb: High Risk
      pumpwell: [12.8620, 74.8640],    // Suburb: High Risk
      jeppu: [12.8520, 74.8460],       // Suburb: Moderate Risk
      
      // Safe Shelters & Assembly points
      surathkal: [13.0080, 74.8020],   // Suburb: Safe Evacuation Point (North)
      townhall: [12.8700, 74.8430],    // Suburb: Central Assembly Safe Shelter
      kadri: [12.8870, 74.8580]        // Suburb: Safe Elevated Grounds
    };

    this.markers = {
      floodZones: {},
      safeZones: {}
    };

    // Safe Route coordinates bypassing the Pumpwell / Padil flooding hotspots
    // Connects Simulated User -> Kadri elevated safe grounds -> Townhall Shelter
    this.safeRouteCoords = [
      [12.8930, 74.8430], // User Location
      [12.8940, 74.8490], // Heading North-East away from pumpwell
      [12.8870, 74.8580], // Kadri Safe Zone Point
      [12.8790, 74.8520], // Downwards safe high-ground road
      [12.8700, 74.8430]  // Ending at Central Town Hall Safe Shelter
    ];
  }

  /**
   * Initialize Leaflet Map
   * @param {string} containerId 
   */
  init(containerId) {
    console.log(`[RainMapMap] Initializing Leaflet map inside #${containerId}`);
    
    try {
      // Create Leaflet map container
      this.map = L.map(containerId, {
        zoomControl: false, // Customized placement or styling later
        attributionControl: false
      }).setView(this.coords.center, 13);

      // Load OSM OpenStreetMap standard tiles
      // Note: Dark mode is styled in CSS using a tile-container filter overlay
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        minZoom: 10
      }).addTo(this.map);

      // Add zoom control at bottom-right out of the way of overlays
      L.control.zoom({
        position: 'bottomright'
      }).addTo(this.map);

      // Inject custom user location marker
      this.addUserLocation();

      // Render flood warning and safe assembly marker layers
      this.renderStaticMarkers();

      console.log('[RainMapMap] Map loaded successfully.');
    } catch (error) {
      console.error('[RainMapMap] Error loading Leaflet library:', error);
    }
  }

  /**
   * Add a custom pulsing SVG marker indicating current user location
   */
  addUserLocation() {
    const userPulseIcon = L.divIcon({
      className: 'custom-user-marker',
      html: '<div class="user-pulse-marker"></div>',
      iconSize: [15, 15],
      iconAnchor: [7, 7]
    });

    this.userMarker = L.marker(this.coords.user, { icon: userPulseIcon })
      .addTo(this.map)
      .bindPopup(`
        <div class="map-popup-card">
          <div class="map-popup-header" style="color: var(--color-cyan)">
             <i data-lucide="navigation" style="width:14px;height:14px"></i> Current Location
          </div>
          <div class="map-popup-desc">You are currently in Kankannady. Weather is rainy. Elevation: 22m.</div>
        </div>
      `);
  }

  /**
   * Inject hazard areas and shelter zones onto the Leaflet canvas
   */
  renderStaticMarkers() {
    // 1. HIGH RISK FLOOD ZONES (Pulsing/Solid Red circles representing danger areas)
    this.markers.floodZones.padil = L.circle(this.coords.padil, {
      color: '#ff1744',
      fillColor: '#ff1744',
      fillOpacity: 0.25,
      radius: 400,
      weight: 2
    }).addTo(this.map).bindPopup(`
      <div class="map-popup-card">
        <div class="map-popup-header red">
          ⚠️ Hazard: Padil Suburb
        </div>
        <div class="map-popup-desc">
          <strong>Risk Level:</strong> HIGH<br>
          <strong>Status:</strong> Active flooding reported near underpass. Avoid roads.
        </div>
      </div>
    `);

    this.markers.floodZones.pumpwell = L.circle(this.coords.pumpwell, {
      color: '#ff9100',
      fillColor: '#ff9100',
      fillOpacity: 0.25,
      radius: 350,
      weight: 2
    }).addTo(this.map).bindPopup(`
      <div class="map-popup-card">
        <div class="map-popup-header" style="color: var(--color-orange)">
          ⚠️ Hazard: Pumpwell Circle
        </div>
        <div class="map-popup-desc">
          <strong>Risk Level:</strong> MODERATE-HIGH<br>
          <strong>Status:</strong> Water clogging on highways. Low-lying bypass lanes closed.
        </div>
      </div>
    `);

    this.markers.floodZones.jeppu = L.circle(this.coords.jeppu, {
      color: '#ff9100',
      fillColor: '#ff9100',
      fillOpacity: 0.15,
      radius: 250,
      weight: 1.5
    }).addTo(this.map).bindPopup(`
      <div class="map-popup-card">
        <div class="map-popup-header" style="color: var(--color-orange)">
          ⚠️ Hazard: Jeppu Lowlands
        </div>
        <div class="map-popup-desc">
          <strong>Risk Level:</strong> MODERATE<br>
          <strong>Status:</strong> Water logging near river banks. Standard flow warning.
        </div>
      </div>
    `);

    // 2. SAFE ZONE EVACUATION CENTERS (Green assembly points)
    // Custom green shield icon markup
    const safeIcon = L.divIcon({
      className: 'custom-safe-marker',
      html: `
        <div style="background-color: var(--color-green); width: 14px; height: 14px; border: 2px solid #fff; border-radius: 4px; transform: rotate(45deg); box-shadow: 0 0 10px var(--color-green-glow)"></div>
      `,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    this.markers.safeZones.townhall = L.marker(this.coords.townhall, { icon: safeIcon })
      .addTo(this.map)
      .bindPopup(`
        <div class="map-popup-card">
          <div class="map-popup-header green">
            🛡️ Town Hall Assembly Shelter
          </div>
          <div class="map-popup-desc">
            <strong>Capacity:</strong> 250 occupants (45% filled)<br>
            <strong>Facilities:</strong> Medical staff, fresh water, backup power.
          </div>
        </div>
      `);

    this.markers.safeZones.kadri = L.marker(this.coords.kadri, { icon: safeIcon })
      .addTo(this.map)
      .bindPopup(`
        <div class="map-popup-card">
          <div class="map-popup-header green">
            🛡️ Kadri Assembly Shelter
          </div>
          <div class="map-popup-desc">
            <strong>Capacity:</strong> 150 occupants (10% filled)<br>
            <strong>Facilities:</strong> Dry rations, first aid, elevated location.
          </div>
        </div>
      `);

    this.markers.safeZones.surathkal = L.marker(this.coords.surathkal, { icon: safeIcon })
      .addTo(this.map)
      .bindPopup(`
        <div class="map-popup-card">
          <div class="map-popup-header green">
            🛡️ NITK Surathkal Safe Shelter
          </div>
          <div class="map-popup-desc">
            <strong>Capacity:</strong> 500 occupants (5% filled)<br>
            <strong>Facilities:</strong> Dynamic safe shelter, backup generator online.
          </div>
        </div>
      `);
  }

  /**
   * Display or remove the highlighted safe path bypassing active hazards
   * @param {boolean} active 
   */
  toggleSafeRoute(active) {
    if (active) {
      if (this.routePolyline) {
        this.map.removeLayer(this.routePolyline);
      }

      // Draw standard glowing routing line on map
      this.routePolyline = L.polyline(this.safeRouteCoords, {
        color: '#00f0ff',
        weight: 5,
        opacity: 0.8,
        dashArray: '10, 10',
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(this.map);

      // Fit map bounds to show route path clearly
      const bounds = L.latLngBounds(this.safeRouteCoords);
      this.map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      if (this.routePolyline) {
        this.map.removeLayer(this.routePolyline);
        this.routePolyline = null;
      }
      // Reset view to central coordinate boundaries
      this.map.setView(this.coords.center, 13);
    }
  }

  /**
   * Dynamically adjust map visuals according to incoming sensor levels
   * @param {Object} sensorState 
   */
  updateMapFromSensors(sensorState) {
    if (!this.map) return;

    const level = sensorState.waterLevel;
    
    // Scale the Padil flood warning marker radius dynamically reflecting water level percent
    // Simulates dynamic risk growth mapping
    const baseRadius = 250;
    const dynamicRadius = baseRadius + (level * 3);
    
    if (this.markers.floodZones.padil) {
      this.markers.floodZones.padil.setRadius(dynamicRadius);
      
      // Update color based on computed risk
      if (sensorState.floodRisk === 'critical') {
        this.markers.floodZones.padil.setStyle({
          color: '#ff1744',
          fillColor: '#ff1744',
          fillOpacity: 0.35
        });
      } else if (sensorState.floodRisk === 'warning') {
        this.markers.floodZones.padil.setStyle({
          color: '#ff9100',
          fillColor: '#ff9100',
          fillOpacity: 0.22
        });
      } else {
        this.markers.floodZones.padil.setStyle({
          color: '#00e676',
          fillColor: '#00e676',
          fillOpacity: 0.12
        });
      }
    }
  }

  /**
   * Trigger redrawing leaflet layer (handy when tab becomes active/visible)
   */
  invalidate() {
    if (this.map) {
      setTimeout(() => {
        this.map.invalidateSize();
      }, 200);
    }
  }
}

// Expose default Map Manager instance globally
window.mapManager = new RainMapMap();
