// Order Tracking Manager
class OrderTrackingManager {
    constructor(orderId, mapContainerId) {
        this.orderId = orderId;
        this.mapContainerId = mapContainerId;
        this.map = null;
        this.updateInterval = null;
        this.lastKnownPosition = null;
        
        this.init();
    }

    init() {
        this.initializeMap();
        this.startTracking();
        this.bindEvents();
    }

    initializeMap() {
        this.map = new MapManager(this.mapContainerId, {
            center: [30.3165, 78.0322],
            zoom: 13
        });
    }

    async startTracking() {
        try {
            // Initial load
            await this.updateOrderStatus();
            
            // Set up periodic updates every 5 seconds
            this.updateInterval = setInterval(() => {
                this.updateOrderStatus();
            }, 5000);
            
        } catch (error) {
            console.error('Error starting tracking:', error);
            this.showError('Failed to start order tracking');
        }
    }

    async updateOrderStatus() {
        try {
            const response = await fetch(`/api/order_status/${this.orderId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.updateUI(data);
            this.updateMap(data);
            
        } catch (error) {
            console.error('Error updating order status:', error);
            this.showError('Failed to update order status');
        }
    }

    updateUI(orderData) {
        // Update order status badge
        const statusBadge = document.getElementById('orderStatus');
        if (statusBadge) {
            statusBadge.textContent = this.formatStatus(orderData.status);
            statusBadge.className = `order-status ${orderData.status}`;
        }

        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = `${orderData.progress_percentage}%`;
            progressBar.setAttribute('aria-valuenow', orderData.progress_percentage);
        }

        // Update progress percentage text
        const progressText = document.getElementById('progressText');
        if (progressText) {
            progressText.textContent = `${Math.round(orderData.progress_percentage)}%`;
        }

        // Update estimated delivery time
        const deliveryTime = document.getElementById('estimatedDelivery');
        if (deliveryTime && orderData.estimated_delivery) {
            const estimatedTime = new Date(orderData.estimated_delivery);
            deliveryTime.textContent = this.formatDateTime(estimatedTime);
        }

        // Update drone battery level
        const batteryLevel = document.getElementById('droneBattery');
        if (batteryLevel) {
            batteryLevel.textContent = `${orderData.drone_battery}%`;
            
            // Update battery color
            const batteryBar = document.getElementById('batteryBar');
            if (batteryBar) {
                batteryBar.style.width = `${orderData.drone_battery}%`;
                batteryBar.className = `progress-bar bg-${this.getBatteryColor(orderData.drone_battery)}`;
            }
        }

        // Update status timeline
        this.updateStatusTimeline(orderData.status, orderData.progress_percentage);
    }

    updateMap(orderData) {
        if (!this.map) return;

        // Clear existing routes
        this.map.clearRoutes();

        // Draw the planned route
        if (orderData.route && orderData.route.length > 0) {
            const routeCoordinates = orderData.route.map(point => [point.lat, point.lng]);
            this.map.drawRoute(routeCoordinates, { 
                color: '#6c757d', 
                weight: 3, 
                opacity: 0.6,
                dashArray: '5, 5'
            });

            // Add waypoint markers
            orderData.route.forEach((point, index) => {
                if (point.id === 'delivery') {
                    this.map.addDeliveryMarker(point.lat, point.lng, { address: point.name });
                } else {
                    this.map.addWarehouseMarker(point.id, point.lat, point.lng, { name: point.name });
                }
            });
        }

        // Update drone position
        if (orderData.current_location) {
            const { lat, lng } = orderData.current_location;
            
            if (this.lastKnownPosition) {
                // Animate drone movement
                this.map.animateDroneMovement(
                    `order-${this.orderId}`,
                    [this.lastKnownPosition.lat, this.lastKnownPosition.lng],
                    [lat, lng],
                    2000
                );
            } else {
                // Add drone marker for the first time
                this.map.addDroneMarker(`order-${this.orderId}`, lat, lng, {
                    name: `Delivery Drone`,
                    status: 'busy',
                    battery_level: orderData.drone_battery
                });
            }
            
            this.lastKnownPosition = { lat, lng };
            
            // Draw current route (from drone to remaining waypoints)
            if (orderData.route && orderData.route.length > 0) {
                const currentRouteCoordinates = [[lat, lng], ...orderData.route.slice(-1).map(point => [point.lat, point.lng])];
                this.map.drawRoute(currentRouteCoordinates, { 
                    color: '#007bff', 
                    weight: 4, 
                    opacity: 0.8 
                });
            }
        }

        // Fit map to show all markers
        this.map.fitBounds();
    }

    updateStatusTimeline(currentStatus, progressPercentage) {
        const timeline = document.getElementById('statusTimeline');
        if (!timeline) return;

        const statuses = ['confirmed', 'in_transit', 'delivered'];
        const statusLabels = {
            'confirmed': 'Order Confirmed',
            'in_transit': 'In Transit',
            'delivered': 'Delivered'
        };

        let timelineHTML = '<div class="status-timeline">';
        
        statuses.forEach((status, index) => {
            const isActive = statuses.indexOf(currentStatus) >= index;
            const isCurrent = currentStatus === status;
            
            timelineHTML += `
                <div class="timeline-item ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}">
                    <div class="timeline-marker">
                        ${isActive ? '<i data-feather="check"></i>' : '<div class="timeline-dot"></div>'}
                    </div>
                    <div class="timeline-content">
                        <h6>${statusLabels[status]}</h6>
                        ${isCurrent ? `<small class="text-muted">${Math.round(progressPercentage)}% complete</small>` : ''}
                    </div>
                </div>
            `;
        });
        
        timelineHTML += '</div>';
        timeline.innerHTML = timelineHTML;
        
        // Re-render feather icons
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending',
            'confirmed': 'Confirmed',
            'in_transit': 'In Transit',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    formatDateTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    getBatteryColor(level) {
        if (level >= 60) return 'success';
        if (level >= 30) return 'warning';
        return 'danger';
    }

    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show" role="alert">
                    <i data-feather="alert-circle"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    bindEvents() {
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.updateOrderStatus();
                
                // Visual feedback
                const originalHTML = refreshBtn.innerHTML;
                refreshBtn.innerHTML = '<span class="spinner"></span>';
                refreshBtn.disabled = true;
                
                setTimeout(() => {
                    refreshBtn.innerHTML = originalHTML;
                    refreshBtn.disabled = false;
                    if (typeof feather !== 'undefined') {
                        feather.replace();
                    }
                }, 1000);
            });
        }

        // Auto-refresh toggle
        const autoRefreshToggle = document.getElementById('autoRefreshToggle');
        if (autoRefreshToggle) {
            autoRefreshToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.startTracking();
                } else {
                    this.stopTracking();
                }
            });
        }
    }

    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    destroy() {
        this.stopTracking();
        if (this.map) {
            this.map = null;
        }
    }
}

// Admin Order Management
class AdminOrderManager {
    constructor() {
        this.bindEvents();
    }

    bindEvents() {
        // Order approval buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('approve-order-btn')) {
                const orderId = e.target.dataset.orderId;
                this.approveOrder(orderId, e.target);
            }
            
            if (e.target.classList.contains('deny-order-btn')) {
                const orderId = e.target.dataset.orderId;
                this.denyOrder(orderId, e.target);
            }
        });

        // Drone refresh button
        const refreshDronesBtn = document.getElementById('refreshDronesBtn');
        if (refreshDronesBtn) {
            refreshDronesBtn.addEventListener('click', () => {
                this.refreshDroneData();
            });
        }
    }

    async approveOrder(orderId, button) {
        try {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="spinner"></span>';
            button.disabled = true;

            const response = await fetch(`/api/approve_order/${orderId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                // Update button to show success
                button.innerHTML = '<i data-feather="check"></i> Approved';
                button.classList.remove('btn-outline-success');
                button.classList.add('btn-success');
                
                // Update order status in the table
                const statusCell = button.closest('tr').querySelector('.order-status');
                if (statusCell) {
                    statusCell.textContent = 'Confirmed';
                    statusCell.className = 'order-status confirmed';
                }
                
                // Hide deny button
                const denyBtn = button.closest('tr').querySelector('.deny-order-btn');
                if (denyBtn) {
                    denyBtn.style.display = 'none';
                }
                
                this.showAlert('Order approved successfully!', 'success');
            } else {
                throw new Error(data.message || 'Failed to approve order');
            }

        } catch (error) {
            console.error('Error approving order:', error);
            button.innerHTML = originalHTML;
            button.disabled = false;
            this.showAlert('Failed to approve order. Please try again.', 'danger');
        }

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    async denyOrder(orderId, button) {
        if (!confirm('Are you sure you want to deny this order?')) {
            return;
        }

        try {
            const originalHTML = button.innerHTML;
            button.innerHTML = '<span class="spinner"></span>';
            button.disabled = true;

            const response = await fetch(`/api/deny_order/${orderId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (data.success) {
                // Update button to show denied
                button.innerHTML = '<i data-feather="x"></i> Denied';
                button.classList.remove('btn-outline-danger');
                button.classList.add('btn-danger');
                
                // Update order status in the table
                const statusCell = button.closest('tr').querySelector('.order-status');
                if (statusCell) {
                    statusCell.textContent = 'Cancelled';
                    statusCell.className = 'order-status cancelled';
                }
                
                // Hide approve button
                const approveBtn = button.closest('tr').querySelector('.approve-order-btn');
                if (approveBtn) {
                    approveBtn.style.display = 'none';
                }
                
                this.showAlert('Order denied successfully!', 'info');
            } else {
                throw new Error(data.message || 'Failed to deny order');
            }

        } catch (error) {
            console.error('Error denying order:', error);
            button.innerHTML = originalHTML;
            button.disabled = false;
            this.showAlert('Failed to deny order. Please try again.', 'danger');
        }

        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    refreshDroneData() {
        // This would typically reload drone data from the server
        // For now, we'll just provide visual feedback
        const refreshBtn = document.getElementById('refreshDronesBtn');
        if (refreshBtn) {
            const originalHTML = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<span class="spinner"></span> Refreshing...';
            refreshBtn.disabled = true;
            
            setTimeout(() => {
                refreshBtn.innerHTML = originalHTML;
                refreshBtn.disabled = false;
                this.showAlert('Drone data refreshed!', 'info');
                
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }, 2000);
        }
    }

    showAlert(message, type) {
        const alertContainer = document.getElementById('alertContainer') || this.createAlertContainer();
        
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.className = 'position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }
}

// Initialize tracking on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize order tracking if on tracking page
    const trackingContainer = document.getElementById('trackingMap');
    if (trackingContainer) {
        const orderId = trackingContainer.dataset.orderId;
        if (orderId) {
            window.orderTracker = new OrderTrackingManager(orderId, 'trackingMap');
        }
    }

    // Initialize admin order manager if on admin page
    if (document.querySelector('.approve-order-btn') || document.querySelector('.deny-order-btn')) {
        window.adminOrderManager = new AdminOrderManager();
    }
});

// Export for global access
window.OrderTrackingManager = OrderTrackingManager;
window.AdminOrderManager = AdminOrderManager;
