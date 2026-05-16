from flask import render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db
from flask import current_app as app
from .models import User, Order, Drone, Warehouse, DeliveryRoute
import json
import heapq
import math
from datetime import datetime, timedelta
import logging

# Removed duplicate imports that were here (Blueprint, render_template etc already imported above)
# Removed duplicate: from .models import User, Order, Drone, Warehouse, DeliveryRoute
# Removed duplicate: from .extensions import db


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        full_name = request.form.get('full_name')
        phone = request.form.get('phone')
        user_type = request.form.get('user_type', 'customer')

        if User.query.filter_by(username=username).first():
            flash('Username already exists', 'error')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('Email already exists', 'error')
            return render_template('register.html')

        password_hash = generate_password_hash(password)
        user = User(
            username=username,
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            phone=phone,
            user_type=user_type
        )

        db.session.add(user)
        db.session.commit()

        flash('Registration successful! Please log in.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        user = User.query.filter_by(username=username).first()

        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            flash('Login successful!', 'success')

            if user.user_type == 'admin' or user.user_type == 'vendor':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('customer_dashboard'))
        else:
            flash('Invalid username or password', 'error')

    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('index'))

@app.route('/customer_dashboard')
@login_required
def customer_dashboard():
    if current_user.user_type not in ['customer']:
        flash('Access denied', 'error')
        return redirect(url_for('index'))

    recent_orders = Order.query.filter_by(customer_id=current_user.id).order_by(Order.created_at.desc()).limit(5).all()
    available_drones = Drone.query.filter_by(status='available').all()

    return render_template('customer_dashboard.html', orders=recent_orders, drones=available_drones)

@app.route('/admin_dashboard')
@login_required
def admin_dashboard():
    if current_user.user_type not in ['admin', 'vendor']:
        flash('Access denied', 'error')
        return redirect(url_for('index'))

    all_orders = Order.query.order_by(Order.created_at.desc()).all()
    all_drones = Drone.query.all()

    total_orders = Order.query.count()
    pending_orders = Order.query.filter_by(status='pending').count()
    active_drones = Drone.query.filter_by(status='available').count()

    stats = {
        'total_orders': total_orders,
        'pending_orders': pending_orders,
        'active_drones': active_drones,
        'total_drones': len(all_drones)
    }

    return render_template('admin_dashboard.html', orders=all_orders, drones=all_drones, stats=stats)


# ── Drone allocation constants ────────────────────────────────────────────────
BATTERY_PER_KM  = 2.0   # % consumed per km of flight
BATTERY_RESERVE = 10.0  # % kept back so drone never lands on 0%


def allocate_nearest_drone(pickup_lat, pickup_lng, route_distance_km):
    """
    Return the nearest available drone with enough battery for the route,
    or None if no eligible drone exists.

    Eligible = status == 'available'
               AND battery_level >= route_distance_km * BATTERY_PER_KM + BATTERY_RESERVE
               AND current_lat / current_lng are not None
    """
    required_battery = route_distance_km * BATTERY_PER_KM + BATTERY_RESERVE

    candidates = Drone.query.filter_by(status='available').all()

    eligible = [
        d for d in candidates
        if d.battery_level >= required_battery
        and d.current_lat is not None
        and d.current_lng is not None
    ]

    if not eligible:
        return None

    return min(
        eligible,
        key=lambda d: calculate_distance(
            d.current_lat, d.current_lng,
            pickup_lat, pickup_lng
        )
    )


@app.route('/place_order', methods=['GET', 'POST'])
@login_required
def place_order():
    if current_user.user_type not in ['customer']:
        flash('Access denied', 'error')
        return redirect(url_for('index'))

    if request.method == 'POST':
        selected_items = request.form.getlist('items')
        total_weight = float(request.form.get('total_weight', 0))
        order_type = request.form.get('order_type', 'normal')
        delivery_lat = float(request.form.get('delivery_lat'))
        delivery_lng = float(request.form.get('delivery_lng'))
        delivery_address = request.form.get('delivery_address')

        items_data = []
        required_warehouses = set()

        for item in selected_items:
            warehouse_id, product_name = item.split(':')
            items_data.append({
                'warehouse_id': int(warehouse_id),
                'product': product_name,
                'quantity': 1
            })
            required_warehouses.add(int(warehouse_id))

        warehouse_locations = []
        for warehouse_id in required_warehouses:
            warehouse = Warehouse.query.get(warehouse_id)
            warehouse_locations.append({
                'id': warehouse.id,
                'lat': warehouse.lat,
                'lng': warehouse.lng,
                'name': warehouse.name
            })

        delivery_location = {
            'id': 'delivery',
            'lat': delivery_lat,
            'lng': delivery_lng,
            'name': 'Delivery Location'
        }

        optimized_route = calculate_optimized_route(warehouse_locations, delivery_location)

        # FIX 1: calculate total route distance so battery check is meaningful
        route_distance_km = sum(
            calculate_distance(
                optimized_route[i]['lat'],   optimized_route[i]['lng'],
                optimized_route[i+1]['lat'], optimized_route[i+1]['lng']
            )
            for i in range(len(optimized_route) - 1)
        ) if len(optimized_route) > 1 else 0

        # FIX 2: use warehouse_locations[0] for pickup coords (was undefined pickup_lat/lng)
        pickup_lat = warehouse_locations[0]['lat']
        pickup_lng = warehouse_locations[0]['lng']

        # FIX 3: nearest eligible drone instead of .first()
        available_drone = allocate_nearest_drone(
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            route_distance_km=route_distance_km,
        )

        if not available_drone:
            flash(
                'No drones available right now — all are busy or battery is too '
                'low for this route. Please try again shortly.',
                'error'
            )
            return redirect(url_for('place_order'))

        # FIX 4: set status='busy' BEFORE the commit so both changes are atomic.
        # Removed the duplicate available_drone.status = 'busy' that appeared after Order().
        available_drone.status = 'busy'

        order = Order(
            customer_id=current_user.id,
            drone_id=available_drone.id,
            items=json.dumps(items_data),
            total_weight=total_weight,
            order_type=order_type,
            pickup_locations=json.dumps(warehouse_locations),
            delivery_lat=delivery_lat,
            delivery_lng=delivery_lng,
            delivery_address=delivery_address,
            optimized_route=json.dumps(optimized_route),
            status='confirmed',
            confirmed_at=datetime.utcnow(),
            estimated_delivery_time=datetime.utcnow() + timedelta(minutes=30)
        )

        db.session.add(order)
        db.session.commit()  # drone.status='busy' + new order land in one transaction

        flash('Order placed successfully!', 'success')
        return redirect(url_for('track_order', order_id=order.id))

    # GET request — render the form
    warehouses = Warehouse.query.all()
    return render_template('place_order.html', warehouses=warehouses)


@app.route('/track_order/<int:order_id>')
@login_required
def track_order(order_id):
    order = Order.query.get_or_404(order_id)

    if current_user.user_type == 'customer' and order.customer_id != current_user.id:
        flash('Access denied', 'error')
        return redirect(url_for('customer_dashboard'))

    return render_template('track_order.html', order=order)

@app.route('/api/order_status/<int:order_id>')
@login_required
def api_order_status(order_id):
    order = Order.query.get_or_404(order_id)

    if current_user.user_type == 'customer' and order.customer_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    route = order.get_optimized_route_list()
    current_progress = simulate_drone_progress(order)

    response_data = {
        'order_id': order.id,
        'status': order.status,
        'current_location': {
            'lat': current_progress['lat'],
            'lng': current_progress['lng']
        },
        'route': route,
        'progress_percentage': current_progress['progress'],
        'estimated_delivery': order.estimated_delivery_time.isoformat() if order.estimated_delivery_time else None,
        'drone_battery': order.assigned_drone.battery_level if order.assigned_drone else 0
    }

    return jsonify(response_data)

@app.route('/api/drones')
@login_required
def api_drones():
    drones = Drone.query.all()
    drones_data = []

    for drone in drones:
        drone_data = {
            'id': drone.id,
            'name': drone.name,
            'status': drone.status,
            'battery_level': drone.battery_level,
            'current_lat': drone.current_lat,
            'current_lng': drone.current_lng
        }
        drones_data.append(drone_data)

    return jsonify(drones_data)

@app.route('/api/approve_order/<int:order_id>', methods=['POST'])
@login_required
def api_approve_order(order_id):
    if current_user.user_type not in ['admin', 'vendor']:
        return jsonify({'error': 'Access denied'}), 403

    order = Order.query.get_or_404(order_id)
    order.status = 'confirmed'
    order.confirmed_at = datetime.utcnow()

    db.session.commit()

    return jsonify({'success': True, 'message': 'Order approved successfully'})

@app.route('/api/deny_order/<int:order_id>', methods=['POST'])
@login_required
def api_deny_order(order_id):
    if current_user.user_type not in ['admin', 'vendor']:
        return jsonify({'error': 'Access denied'}), 403

    order = Order.query.get_or_404(order_id)
    order.status = 'cancelled'

    if order.assigned_drone:
        order.assigned_drone.status = 'available'

    db.session.commit()

    return jsonify({'success': True, 'message': 'Order denied successfully'})


def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371

    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)

    a = (math.sin(dlat/2) * math.sin(dlat/2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng/2) * math.sin(dlng/2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    return R * c


def calculate_optimized_route(warehouses, delivery_location):
    """Calculate optimized route using nearest-neighbour heuristic"""
    all_locations = warehouses + [delivery_location]
    n = len(all_locations)

    distances = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                distances[i][j] = calculate_distance(
                    all_locations[i]['lat'], all_locations[i]['lng'],
                    all_locations[j]['lat'], all_locations[j]['lng']
                )

    visited = [False] * (n-1)
    route = []
    current = 0

    while len(route) < len(warehouses):
        route.append(all_locations[current])
        if current < len(warehouses):
            visited[current] = True

        min_dist = float('inf')
        next_location = -1

        for i in range(len(warehouses)):
            if not visited[i] and distances[current][i] < min_dist:
                min_dist = distances[current][i]
                next_location = i

        if next_location == -1:
            break
        current = next_location

    route.append(delivery_location)
    return route


def simulate_drone_progress(order):
    """Simulate drone progress based on order creation time"""
    if not order.confirmed_at:
        return {'lat': 0, 'lng': 0, 'progress': 0}

    elapsed_time = (datetime.utcnow() - order.confirmed_at).total_seconds()
    total_estimated_time = 30 * 60

    progress_percentage = min((elapsed_time / total_estimated_time) * 100, 100)

    route = order.get_optimized_route_list()
    if not route:
        return {'lat': 0, 'lng': 0, 'progress': 0}

    total_segments = len(route) - 1
    if total_segments == 0:
        return {'lat': route[0]['lat'], 'lng': route[0]['lng'], 'progress': progress_percentage}

    segment_progress = (progress_percentage / 100) * total_segments
    current_segment = min(int(segment_progress), total_segments - 1)
    segment_fraction = segment_progress - current_segment

    start_point = route[current_segment]
    end_point = route[current_segment + 1]

    current_lat = start_point['lat'] + (end_point['lat'] - start_point['lat']) * segment_fraction
    current_lng = start_point['lng'] + (end_point['lng'] - start_point['lng']) * segment_fraction

    if progress_percentage >= 100 and order.status != 'delivered':
        order.status = 'delivered'
        order.delivered_at = datetime.utcnow()
        if order.assigned_drone:
            order.assigned_drone.status = 'available'
        db.session.commit()
    elif progress_percentage > 0 and order.status == 'confirmed':
        order.status = 'in_transit'
        db.session.commit()

    return {
        'lat': current_lat,
        'lng': current_lng,
        'progress': progress_percentage
    }


@app.route('/api/algorithm_result/<int:order_id>')
@login_required
def algorithm_result(order_id):
    order = Order.query.get_or_404(order_id)

    if current_user.user_type == 'customer' and order.customer_id != current_user.id:
        return jsonify({'error': 'Access denied'}), 403

    drone_name = order.assigned_drone.name if order.assigned_drone else 'No drone assigned'
    route = order.get_optimized_route_list()

    return jsonify({
        'drone': drone_name,
        'route': [point['name'] for point in route]
    })


@app.route('/api/warehouses')
@login_required
def api_warehouses():
    warehouses = Warehouse.query.all()
    return jsonify([
        {
            'id': w.id,
            'name': w.name,
            'lat': w.lat,
            'lng': w.lng
        } for w in warehouses
    ])