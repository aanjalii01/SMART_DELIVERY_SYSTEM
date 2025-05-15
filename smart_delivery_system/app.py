from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import csv
import time
import threading

app = Flask(__name__)
app.secret_key = 'secret123'

# Load location data from CSV file
locations = []
with open('dehradun_locations.csv', newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        locations.append(row)

# Helper to get travel time and height between source and destination
def get_route_info(source, destination):
    # You can customize or add real routing logic here
    # For now, return some dummy time (minutes) and max height of source and destination
    source_data = next((loc for loc in locations if loc['location'] == source), None)
    dest_data = next((loc for loc in locations if loc['location'] == destination), None)
    if source_data and dest_data:
        # Let's say duration is fixed or difference of lat/lon times a factor
        duration = 10  # default duration 10 minutes for simplicity
        # Height: max height between source and destination
        height = max(int(source_data['height_m']), int(dest_data['height_m']))
        return duration, height
    return 10, 700

# In-memory "database" for users: username -> {password, role}
users = {
    'admin': {'password': 'adminpass', 'role': 'admin'},
    'customer1': {'password': 'custpass', 'role': 'customer'},
    'vendor1': {'password': 'vendpass', 'role': 'vendor'}
}

# Store live deliveries in-memory: delivery_id -> details
live_deliveries = {}

# Home redirects to login
@app.route('/')
def home():
    return redirect(url_for('login'))

# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = users.get(username)
        if user and user['password'] == password:
            session['username'] = username
            session['role'] = user['role']
            if user['role'] == 'admin':
                return redirect(url_for('admin'))
            elif user['role'] == 'customer':
                return redirect(url_for('customer'))
            elif user['role'] == 'vendor':
                return redirect(url_for('vendor'))
        else:
            error = 'Invalid username or password'
    return render_template('login.html', error=error)

# Register route
@app.route('/register', methods=['GET', 'POST'])
def register():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        role = request.form.get('role')  # customer/vendor allowed
        if not username or not password or not role:
            error = 'All fields are required'
        elif username in users:
            error = 'Username already exists'
        elif role not in ['customer', 'vendor']:
            error = 'Invalid role selected'
        else:
            users[username] = {'password': password, 'role': role}
            return redirect(url_for('login'))
    return render_template('register.html', error=error)

# Admin dashboard
@app.route('/admin')
def admin():
    if 'role' not in session or session['role'] != 'admin':
        return redirect(url_for('login'))
    return render_template('admin.html', users=users)

# Customer dashboard & order placement
@app.route('/customer')
def customer():
    if 'role' not in session or session['role'] != 'customer':
        return redirect(url_for('login'))
    # Provide unique locations for dropdown
    unique_locations = sorted(set(loc['location'] for loc in locations))
    return render_template('customer.html', locations=unique_locations)

# Vendor dashboard showing all live deliveries
@app.route('/vendor')
def vendor():
    if 'role' not in session or session['role'] != 'vendor':
        return redirect(url_for('login'))
    return render_template('vendor.html', deliveries=live_deliveries)

# Place order - called from customer form
@app.route('/place_order', methods=['POST'])
def place_order():
    if 'role' not in session or session['role'] != 'customer':
        return redirect(url_for('login'))
    source = request.form['source']
    destination = request.form['destination']
    product = request.form['product']
    order_type = request.form['order_type']

    duration, height = get_route_info(source, destination)
    delivery_id = len(live_deliveries) + 1
    live_deliveries[delivery_id] = {
        'source': source,
        'destination': destination,
        'time': duration,
        'height': height,
        'progress': 0,
        'status': 'In Transit',
        'order_type': order_type,
        'product': product
    }

    # Start delivery simulation in background thread
    threading.Thread(target=simulate_delivery, args=(delivery_id, duration), daemon=True).start()
    return redirect(url_for('customer'))

# Simulate delivery progress updates every few minutes (scaled down for demo)
def simulate_delivery(delivery_id, total_time):
    # interval = total_time // 5  # we won’t use this now, just fixed sleep for quick update
    for i in range(1, 6):
        time.sleep(2)  # 2 seconds per update for testing instead of minutes
        if delivery_id in live_deliveries:
            live_deliveries[delivery_id]['progress'] = i * 20
    if delivery_id in live_deliveries:
        live_deliveries[delivery_id]['status'] = 'Delivered'


# Delivery tracking page accessible by any logged-in user
@app.route('/track')
def track():
    if 'username' not in session:
        return redirect(url_for('login'))
    return render_template('track.html', deliveries=live_deliveries)

# Logout user
@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# API to get live delivery status by delivery ID
@app.route('/delivery-status/<int:order_id>')
def delivery_status(order_id):
    delivery = live_deliveries.get(order_id)
    if not delivery:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify({
        'source': delivery['source'],
        'destination': delivery['destination'],
        'progress': delivery['progress'],
        'status': delivery['status'],
        'time': delivery['time'],
        'height': delivery['height'],
        'order_type': delivery['order_type'],
        'product': delivery['product']
    })

if __name__ == '__main__':
    app.run(debug=True)
