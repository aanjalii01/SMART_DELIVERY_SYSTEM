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
        // Realistic Drone icon with drone emoji
        this.droneIcon = L.divIcon({
            html: `<div style="background: linear-gradient(45deg, #007bff, #0056b3); color: white; border-radius: 50%; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 8px rgba(0,0,0,0.3); position: relative;">
                      <span style="font-size: 18px;">🚁</span>
                      <div style="position: absolute; top: -8px; right: -8px; width: 12px; height: 12px; background: #28a745; border: 2px solid white; border-radius: 50%; animation: pulse 2s infinite;"></div>
                   </div>
                   <style>
                   @keyframes pulse {
                     0% { transform: scale(1); opacity: 1; }
                     50% { transform: scale(1.2); opacity: 0.7; }
                     100% { transform: scale(1); opacity: 1; }
                   }
                   </style>`,
            className: 'drone-marker',
            iconSize: [35, 35],
            iconAnchor: [17, 17]
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

    animateDroneMovement(droneId, fromCoords, toCoords, duration = 3000) {
        const marker = this.markers.get(`drone-${droneId}`);
        if (!marker) return;

        const startTime = Date.now();
        const [startLat, startLng] = fromCoords;
        const [endLat, endLng] = toCoords;

        // Create trail effect for Dijkstra path visualization
        const trailPoints = [];
        const trailPolyline = L.polyline([], {
            color: '#ffc107',
            weight: 3,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(this.map);

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Dijkstra-style stepped movement (simulating algorithm steps)
            let easedProgress;
            if (progress < 0.1) {
                // Initial calculation phase - drone pauses to calculate
                easedProgress = 0;
            } else if (progress < 0.3) {
                // Route optimization phase - slow initial movement
                easedProgress = (progress - 0.1) * 0.2 / 0.2;
            } else {
                // Optimized movement phase - smooth efficient flight
                const movementProgress = (progress - 0.3) / 0.7;
                easedProgress = 0.2 + 0.8 * (1 - Math.pow(1 - movementProgress, 2));
            }

            const currentLat = startLat + (endLat - startLat) * easedProgress;
            const currentLng = startLng + (endLng - startLng) * easedProgress;

            marker.setLatLng([currentLat, currentLng]);

            // Add to trail for path visualization showing Dijkstra route
            if (progress > 0.3) {
                trailPoints.push([currentLat, currentLng]);
                trailPolyline.setLatLngs(trailPoints);
            }

            // Add pulse effect during calculation phases to show algorithm working
            if (progress < 0.3) {
                const pulseIntensity = Math.sin(elapsed / 300) * 0.2 + 1;
                if (marker.getElement()) {
                    marker.getElement().style.transform = `scale(${pulseIntensity})`;
                }
            } else {
                if (marker.getElement()) {
                    marker.getElement().style.transform = 'scale(1)';
                }
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clean up trail after animation
                setTimeout(() => {
                    if (trailPolyline) {
                        this.map.removeLayer(trailPolyline);
                    }
                }, 3000);
            }
        };

        requestAnimationFrame(animate);
    }
}

// Delivery Location Map Manager
class DeliveryLocationMapManager extends MapManager {
    constructor(containerId) {
        super(containerId, {
            center: [30.3165, 78.0322], // Dehradun center
            zoom: 13
        });
        this.deliveryMarker = null;
        this.onLocationSelected = null;
    }

    init() {
        super.init();
        this.setupMapClickHandler();
        this.loadWarehouses();
        return this;
    }

    setupMapClickHandler() {
        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            this.setDeliveryLocation(lat, lng);
        });
    }

    setDeliveryLocation(lat, lng) {
        // Remove existing delivery marker
        if (this.deliveryMarker) {
            this.map.removeLayer(this.deliveryMarker);
        }

        // Add new delivery marker
        this.deliveryMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                html: `
                    <div class="drone-marker delivery-pin">
                        <div class="marker-icon">📍</div>
                        <div class="marker-pulse"></div>
                    </div>
                `,
                className: 'custom-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(this.map);

        this.deliveryMarker.bindPopup(`
            <div class="text-center">
                <strong>Delivery Location</strong><br>
                <small class="text-muted">Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}</small>
            </div>
        `).openPopup();

        // Update form fields
        document.getElementById('delivery_lat').value = lat;
        document.getElementById('delivery_lng').value = lng;

        // Show location preview
        const locationPreview = document.getElementById('locationPreview');
        const locationCoords = document.getElementById('locationCoords');
        
        if (locationPreview && locationCoords) {
            locationCoords.textContent = `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            locationPreview.classList.remove('d-none');
        }

        // Trigger callback if set
        if (this.onLocationSelected) {
            this.onLocationSelected(lat, lng);
        }
    }

    setCurrentLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    this.map.setView([lat, lng], 15);
                    this.setDeliveryLocation(lat, lng);
                },
                (error) => {
                    console.error('Error getting location:', error);
                    alert('Unable to get your current location. Please click on the map to set delivery location.');
                }
            );
        } else {
            alert('Geolocation is not supported by this browser. Please click on the map to set delivery location.');
        }
    }

    async loadWarehouses() {
        // Sample warehouses for Dehradun
        const warehouses = [
            { id: 1, name: 'Electronics Hub', lat: 30.3204, lng: 78.0361, type: 'electronics' },
            { id: 2, name: 'Medical Supplies', lat: 30.3089, lng: 78.0435, type: 'medical' },
            { id: 3, name: 'Fresh Foods', lat: 30.3290, lng: 78.0267, type: 'food' },
            { id: 4, name: 'Book Store', lat: 30.3134, lng: 78.0404, type: 'books' },
            { id: 5, name: 'Grocery Central', lat: 30.3076, lng: 78.0272, type: 'grocery' }
        ];

        warehouses.forEach(warehouse => {
            this.addWarehouseMarker(warehouse.id, warehouse.lat, warehouse.lng, {
                name: warehouse.name,
                type: warehouse.type
            });
        });
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
        // Enhanced warehouse network for better algorithm demonstration
        const warehouses = [
            { id: 1, name: "Electronics Hub", lat: 30.3165, lng: 78.0322, location: "Dehradun Central", products: "Laptops, Smartphones, Tablets" },
            { id: 2, name: "Medical Center", lat: 30.3255, lng: 78.0367, location: "ISBT Dehradun", products: "Medicines, First Aid, Health Supplements" },
            { id: 3, name: "Food Court", lat: 30.3204, lng: 78.0301, location: "Paltan Bazaar", products: "Snacks, Beverages, Fast Food" },
            { id: 4, name: "Books & Stationery", lat: 30.3596, lng: 78.0815, location: "Rajpur Road", products: "Books, Notebooks, Pens" },
            { id: 5, name: "Grocery Store", lat: 30.3177, lng: 78.0339, location: "Clock Tower", products: "Groceries, Vegetables, Fruits" },
            { id: 6, name: "Fashion Hub", lat: 30.3089, lng: 78.0435, location: "Ashley Hall", products: "Clothing, Accessories, Shoes" },
            { id: 7, name: "Sports Center", lat: 30.3290, lng: 78.0267, location: "Rispana", products: "Sports Equipment, Fitness Gear" },
            { id: 8, name: "Tech Plaza", lat: 30.3134, lng: 78.0404, location: "Gandhi Road", products: "Computer Parts, Gadgets" },
            { id: 9, name: "Home & Garden", lat: 30.3076, lng: 78.0272, location: "Karanpur", products: "Furniture, Garden Tools, Decor" },
            { id: 10, name: "Pharmacy Plus", lat: 30.3445, lng: 78.0661, location: "Sahastradhara Road", products: "Medicines, Cosmetics, Health Products" }
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
                    if (drone.current_lat && drone.current_lng) {
                        this.addDroneMarker(drone.id, drone.current_lat, drone.current_lng, drone);
                    }
                });
            } else {
                this.loadSampleDrones();
            }
        } catch (error) {
            console.error('Error loading drones:', error);
            this.loadSampleDrones();
        }
    }

    loadSampleDrones() {
        // Enhanced drone fleet for better greedy algorithm demonstration
        const sampleDrones = [
            { id: 1, name: "Swift-Alpha", status: "available", battery_level: 85, current_lat: 30.3165, current_lng: 78.0322 },
            { id: 2, name: "Swift-Beta", status: "available", battery_level: 92, current_lat: 30.3255, current_lng: 78.0367 },
            { id: 3, name: "Swift-Gamma", status: "busy", battery_level: 67, current_lat: 30.3204, current_lng: 78.0301 },
            { id: 4, name: "Swift-Delta", status: "available", battery_level: 78, current_lat: 30.3596, current_lng: 78.0815 },
            { id: 5, name: "Swift-Echo", status: "available", battery_level: 95, current_lat: 30.3177, current_lng: 78.0339 },
            { id: 6, name: "Swift-Foxtrot", status: "available", battery_level: 88, current_lat: 30.3089, current_lng: 78.0435 },
            { id: 7, name: "Swift-Golf", status: "busy", battery_level: 72, current_lat: 30.3290, current_lng: 78.0267 },
            { id: 8, name: "Swift-Hotel", status: "available", battery_level: 94, current_lat: 30.3134, current_lng: 78.0404 },
            { id: 9, name: "Swift-India", status: "maintenance", battery_level: 45, current_lat: 30.3076, current_lng: 78.0272 },
            { id: 10, name: "Swift-Juliet", status: "available", battery_level: 81, current_lat: 30.3445, current_lng: 78.0661 }
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
