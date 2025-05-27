// Map Manager Class
class MapManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.map = null;
        this.markers = new Map();
        this.routes = [];
        
        // Default options
        this.options = {
            center: [30.3165, 78.0322], // Dehradun coordinates
            zoom: 13,
            ...options
        };
        
        this.init();
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Map container with ID "${this.containerId}" not found`);
            return;
        }

        // Initialize Leaflet map
        this.map = L.map(this.containerId).setView(this.options.center, this.options.zoom);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Custom marker icons
        this.createCustomIcons();
    }

    createCustomIcons() {
        // Drone icon (blue)
        this.droneIcon = L.divIcon({
            html: `<div style="background: #007bff; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      <i data-feather="navigation" style="width: 16px; height: 16px;"></i>
                   </div>`,
            className: 'drone-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Warehouse icon (green)
        this.warehouseIcon = L.divIcon({
            html: `<div style="background: #28a745; color: white; border-radius: 8px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      <i data-feather="package" style="width: 16px; height: 16px;"></i>
                   </div>`,
            className: 'warehouse-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        // Delivery location icon (red)
        this.deliveryIcon = L.divIcon({
            html: `<div style="background: #dc3545; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      <i data-feather="map-pin" style="width: 14px; height: 14px;"></i>
                   </div>`,
            className: 'delivery-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        // User location icon (purple)
        this.userIcon = L.divIcon({
            html: `<div style="background: #6f42c1; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
                      <i data-feather="user" style="width: 12px; height: 12px;"></i>
                   </div>`,
            className: 'user-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    addDroneMarker(id, lat, lng, info = {}) {
        const marker = L.marker([lat, lng], { icon: this.droneIcon })
            .addTo(this.map);

        const popupContent = `
            <div class="drone-popup">
                <h6><strong>${info.name || `Drone ${id}`}</strong></h6>
                <p class="mb-1">Status: <span class="badge bg-${this.getDroneStatusColor(info.status)}">${info.status || 'Unknown'}</span></p>
                <p class="mb-1">Battery: <strong>${info.battery_level || 0}%</strong></p>
                <div class="progress mt-2" style="height: 6px;">
                    <div class="progress-bar bg-${this.getBatteryColor(info.battery_level)}" 
                         style="width: ${info.battery_level || 0}%"></div>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        this.markers.set(`drone-${id}`, marker);
        
        // Re-render feather icons in popup when opened
        marker.on('popupopen', () => {
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        });

        return marker;
    }

    addWarehouseMarker(id, lat, lng, info = {}) {
        const marker = L.marker([lat, lng], { icon: this.warehouseIcon })
            .addTo(this.map);

        const popupContent = `
            <div class="warehouse-popup">
                <h6><strong>${info.name || `Warehouse ${id}`}</strong></h6>
                <p class="mb-1">${info.location || 'Location not specified'}</p>
                ${info.products ? `<p class="mb-0"><small>Products: ${info.products}</small></p>` : ''}
            </div>
        `;

        marker.bindPopup(popupContent);
        this.markers.set(`warehouse-${id}`, marker);
        return marker;
    }

    addDeliveryMarker(lat, lng, info = {}) {
        const marker = L.marker([lat, lng], { icon: this.deliveryIcon })
            .addTo(this.map);

        const popupContent = `
            <div class="delivery-popup">
                <h6><strong>Delivery Location</strong></h6>
                <p class="mb-0">${info.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`}</p>
            </div>
        `;

        marker.bindPopup(popupContent);
        this.markers.set('delivery', marker);
        return marker;
    }

    addUserLocationMarker(lat, lng) {
        const marker = L.marker([lat, lng], { icon: this.userIcon })
            .addTo(this.map);

        marker.bindPopup('<strong>Your Location</strong>');
        this.markers.set('user', marker);
        return marker;
    }

    updateDronePosition(id, lat, lng, info = {}) {
        const marker = this.markers.get(`drone-${id}`);
        if (marker) {
            // Animate marker movement
            marker.setLatLng([lat, lng]);
            
            // Update popup content if info provided
            if (Object.keys(info).length > 0) {
                const popupContent = `
                    <div class="drone-popup">
                        <h6><strong>${info.name || `Drone ${id}`}</strong></h6>
                        <p class="mb-1">Status: <span class="badge bg-${this.getDroneStatusColor(info.status)}">${info.status || 'Unknown'}</span></p>
                        <p class="mb-1">Battery: <strong>${info.battery_level || 0}%</strong></p>
                        <div class="progress mt-2" style="height: 6px;">
                            <div class="progress-bar bg-${this.getBatteryColor(info.battery_level)}" 
                                 style="width: ${info.battery_level || 0}%"></div>
                        </div>
                    </div>
                `;
                marker.setPopupContent(popupContent);
            }
        } else {
            // Create new marker if it doesn't exist
            this.addDroneMarker(id, lat, lng, info);
        }
    }

    drawRoute(coordinates, options = {}) {
        const defaultOptions = {
            color: '#007bff',
            weight: 4,
            opacity: 0.8,
            dashArray: options.dashed ? '10, 10' : null
        };

        const routeOptions = { ...defaultOptions, ...options };
        const route = L.polyline(coordinates, routeOptions).addTo(this.map);
        
        this.routes.push(route);
        return route;
    }

    clearRoutes() {
        this.routes.forEach(route => {
            this.map.removeLayer(route);
        });
        this.routes = [];
    }

    removeMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.map.removeLayer(marker);
            this.markers.delete(id);
        }
    }

    centerOnMarker(id) {
        const marker = this.markers.get(id);
        if (marker) {
            this.map.setView(marker.getLatLng(), this.map.getZoom());
        }
    }

    fitBounds(padding = 0.02) {
        if (this.markers.size > 0) {
            const group = new L.featureGroup(Array.from(this.markers.values()));
            this.map.fitBounds(group.getBounds().pad(padding));
        }
    }

    getDroneStatusColor(status) {
        switch (status) {
            case 'available': return 'success';
            case 'busy': return 'warning';
            case 'maintenance': return 'danger';
            default: return 'secondary';
        }
    }

    getBatteryColor(level) {
        if (level >= 60) return 'success';
        if (level >= 30) return 'warning';
        return 'danger';
    }

    animateDroneMovement(droneId, fromCoords, toCoords, duration = 2000) {
        const marker = this.markers.get(`drone-${droneId}`);
        if (!marker) return;

        const startTime = Date.now();
        const [startLat, startLng] = fromCoords;
        const [endLat, endLng] = toCoords;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            const currentLat = startLat + (endLat - startLat) * easedProgress;
            const currentLng = startLng + (endLng - startLng) * easedProgress;

            marker.setLatLng([currentLat, currentLng]);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }
}

// Dashboard Map Manager
class DashboardMapManager extends MapManager {
    constructor(containerId) {
        super(containerId, {
            center: [30.3165, 78.0322],
            zoom: 12
        });
        
        this.loadInitialData();
    }

    async loadInitialData() {
        try {
            // Load warehouses
            await this.loadWarehouses();
            
            // Load drones
            await this.loadDrones();
            
            // Fit map to show all markers
            this.fitBounds();
        } catch (error) {
            console.error('Error loading map data:', error);
        }
    }

    async loadWarehouses() {
        // Sample warehouse data (in a real app, this would come from API)
        const warehouses = [
            { id: 1, name: "Electronics Hub", lat: 30.3165, lng: 78.0322, location: "Dehradun Central", products: "Laptops, Smartphones, Tablets" },
            { id: 2, name: "Medical Center", lat: 30.3255, lng: 78.0367, location: "ISBT Dehradun", products: "Medicines, First Aid, Health Supplements" },
            { id: 3, name: "Food Court", lat: 30.3204, lng: 78.0301, location: "Paltan Bazaar", products: "Snacks, Beverages, Fast Food" },
            { id: 4, name: "Books & Stationery", lat: 30.3596, lng: 78.0815, location: "Rajpur Road", products: "Books, Notebooks, Pens" },
            { id: 5, name: "Grocery Store", lat: 30.3177, lng: 78.0339, location: "Clock Tower", products: "Groceries, Vegetables, Fruits" }
        ];

        warehouses.forEach(warehouse => {
            this.addWarehouseMarker(warehouse.id, warehouse.lat, warehouse.lng, warehouse);
        });
    }

    async loadDrones() {
        try {
            const response = await fetch('/api/drones');
            if (response.ok) {
                const drones = await response.json();
                drones.forEach(drone => {
                    this.addDroneMarker(drone.id, drone.current_lat, drone.current_lng, drone);
                });
            }
        } catch (error) {
            console.error('Error loading drones:', error);
            // Fallback to sample data
            this.loadSampleDrones();
        }
    }

    loadSampleDrones() {
        const sampleDrones = [
            { id: 1, name: "Drone-01", status: "available", battery_level: 85, current_lat: 30.3165, current_lng: 78.0322 },
            { id: 2, name: "Drone-02", status: "available", battery_level: 92, current_lat: 30.3255, current_lng: 78.0367 },
            { id: 3, name: "Drone-03", status: "busy", battery_level: 67, current_lat: 30.3204, current_lng: 78.0301 },
            { id: 4, name: "Drone-04", status: "available", battery_level: 78, current_lat: 30.3596, current_lng: 78.0815 },
            { id: 5, name: "Drone-05", status: "available", battery_level: 95, current_lat: 30.3177, current_lng: 78.0339 }
        ];

        sampleDrones.forEach(drone => {
            this.addDroneMarker(drone.id, drone.current_lat, drone.current_lng, drone);
        });
    }

    refreshDroneData() {
        // Clear existing drone markers
        Array.from(this.markers.keys())
            .filter(key => key.startsWith('drone-'))
            .forEach(key => this.removeMarker(key));
        
        // Reload drone data
        this.loadDrones();
    }
}

// Export for global access
window.MapManager = MapManager;
window.DashboardMapManager = DashboardMapManager;
