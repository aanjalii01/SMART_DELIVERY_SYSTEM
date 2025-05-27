import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///swiftpath.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize extensions
db.init_app(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Please log in to access this page.'

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

with app.app_context():
    # Import models and routes
    import models
    import routes
    
    # Create all database tables
    db.create_all()
    
    # Create sample warehouses and drones if they don't exist
    from models import Warehouse, Drone
    
    if not Warehouse.query.first():
        warehouses = [
            Warehouse(name="Electronics Hub", location="Dehradun Central", lat=30.3165, lng=78.0322, products="Laptops,Smartphones,Tablets"),
            Warehouse(name="Medical Center", location="ISBT Dehradun", lat=30.3255, lng=78.0367, products="Medicines,First Aid,Health Supplements"),
            Warehouse(name="Food Court", location="Paltan Bazaar", lat=30.3204, lng=78.0301, products="Snacks,Beverages,Fast Food"),
            Warehouse(name="Books & Stationery", location="Rajpur Road", lat=30.3596, lng=78.0815, products="Books,Notebooks,Pens"),
            Warehouse(name="Grocery Store", location="Clock Tower", lat=30.3177, lng=78.0339, products="Groceries,Vegetables,Fruits")
        ]
        
        for warehouse in warehouses:
            db.session.add(warehouse)
        
        # Create sample drones
        drones = [
            Drone(name="Drone-01", status="available", battery_level=85, current_lat=30.3165, current_lng=78.0322),
            Drone(name="Drone-02", status="available", battery_level=92, current_lat=30.3255, current_lng=78.0367),
            Drone(name="Drone-03", status="busy", battery_level=67, current_lat=30.3204, current_lng=78.0301),
            Drone(name="Drone-04", status="available", battery_level=78, current_lat=30.3596, current_lng=78.0815),
            Drone(name="Drone-05", status="available", battery_level=95, current_lat=30.3177, current_lng=78.0339)
        ]
        
        for drone in drones:
            db.session.add(drone)
        
        db.session.commit()
        logging.info("Sample data created successfully")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
