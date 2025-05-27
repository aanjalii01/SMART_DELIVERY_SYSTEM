from .extensions import db
from flask_login import UserMixin
from datetime import datetime
import json


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256))
    user_type = db.Column(db.String(20), default='customer')  # customer, admin, vendor
    full_name = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    orders = db.relationship('Order', backref='customer', lazy=True)

# rest of your models unchanged, only import db from extensions

# ... all other models ...
class Warehouse(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    products = db.Column(db.Text)  # JSON string of available products
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def get_products_list(self):
        if self.products:
            return self.products.split(',')
        return []

class Drone(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(20), default='available')  # available, busy, maintenance
    battery_level = db.Column(db.Integer, default=100)
    current_lat = db.Column(db.Float)
    current_lng = db.Column(db.Float)
    max_weight = db.Column(db.Float, default=5.0)  # kg
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    orders = db.relationship('Order', backref='assigned_drone', lazy=True)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    drone_id = db.Column(db.Integer, db.ForeignKey('drone.id'))
    
    # Order details
    items = db.Column(db.Text)  # JSON string of ordered items
    total_weight = db.Column(db.Float)
    order_type = db.Column(db.String(20), default='normal')  # normal, fast
    status = db.Column(db.String(20), default='pending')  # pending, confirmed, in_transit, delivered, cancelled
    
    # Location data
    pickup_locations = db.Column(db.Text)  # JSON string of warehouse locations to visit
    delivery_lat = db.Column(db.Float)
    delivery_lng = db.Column(db.Float)
    delivery_address = db.Column(db.Text)
    
    # Route and tracking
    optimized_route = db.Column(db.Text)  # JSON string of the calculated route
    current_location_lat = db.Column(db.Float)
    current_location_lng = db.Column(db.Float)
    estimated_delivery_time = db.Column(db.DateTime)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    confirmed_at = db.Column(db.DateTime)
    delivered_at = db.Column(db.DateTime)
    
    def get_items_list(self):
        if self.items:
            return json.loads(self.items)
        return []
    
    def get_pickup_locations_list(self):
        if self.pickup_locations:
            return json.loads(self.pickup_locations)
        return []
    
    def get_optimized_route_list(self):
        if self.optimized_route:
            return json.loads(self.optimized_route)
        return []

class DeliveryRoute(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    waypoint_order = db.Column(db.Integer)
    warehouse_id = db.Column(db.Integer, db.ForeignKey('warehouse.id'))
    lat = db.Column(db.Float)
    lng = db.Column(db.Float)
    estimated_arrival = db.Column(db.DateTime)
    actual_arrival = db.Column(db.DateTime)
    status = db.Column(db.String(20), default='pending')  # pending, reached, completed
    
    # Relationships
    order = db.relationship('Order', backref='route_waypoints')
    warehouse = db.relationship('Warehouse', backref='delivery_routes')
