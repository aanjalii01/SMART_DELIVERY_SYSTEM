"""
Tests for Issue #17: Data contract validation and UI/Backend sync improvements.

Run with:
    pytest tests/test_fixes.py -v
"""

import json
import pytest
from app import create_app
from app.extensions import db
from app.models import Warehouse, Order, Drone, User
from werkzeug.security import generate_password_hash


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False,
        "SECRET_KEY": "test-secret",
    })
    with app.app_context():
        db.create_all()
        _seed_db()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth_client(client, app):
    """Return a logged-in customer test client."""
    with app.app_context():
        client.post("/login", data={"username": "testcustomer", "password": "password"})
    return client


def _seed_db():
    customer = User(
        username="testcustomer",
        email="customer@test.com",
        password_hash=generate_password_hash("password"),
        user_type="customer",
    )
    db.session.add(customer)

    # Warehouses with different product storage formats
    db.session.add(Warehouse(
        name="JSON Warehouse",
        location="Test City",
        lat=30.3165, lng=78.0322,
        products='["Laptops", "Smartphones", "Tablets"]',
    ))
    db.session.add(Warehouse(
        name="CSV Warehouse",
        location="Test City",
        lat=30.3255, lng=78.0367,
        products="Medicines,First Aid,Health Supplements",
    ))
    db.session.add(Warehouse(
        name="Empty Warehouse",
        location="Test City",
        lat=30.3204, lng=78.0301,
        products="",
    ))
    db.session.add(Warehouse(
        name="Null Warehouse",
        location="Test City",
        lat=30.3290, lng=78.0267,
        products=None,
    ))

    db.session.add(Drone(
        name="Drone-Test",
        status="available",
        battery_level=100,
        current_lat=30.3165,
        current_lng=78.0322,
    ))
    db.session.commit()


# ─── Fix 1: get_products_list() ──────────────────────────────────────────────

class TestGetProductsList:
    """Warehouse.get_products_list() must handle all product storage formats."""

    def test_json_array(self, app):
        with app.app_context():
            w = Warehouse.query.filter_by(name="JSON Warehouse").first()
            result = w.get_products_list()
            assert result == ["Laptops", "Smartphones", "Tablets"]

    def test_legacy_csv(self, app):
        with app.app_context():
            w = Warehouse.query.filter_by(name="CSV Warehouse").first()
            result = w.get_products_list()
            assert result == ["Medicines", "First Aid", "Health Supplements"]

    def test_empty_string(self, app):
        with app.app_context():
            w = Warehouse.query.filter_by(name="Empty Warehouse").first()
            assert w.get_products_list() == []

    def test_none_value(self, app):
        with app.app_context():
            w = Warehouse.query.filter_by(name="Null Warehouse").first()
            assert w.get_products_list() == []

    def test_malformed_json_falls_back_to_csv(self, app):
        with app.app_context():
            w = Warehouse(
                name="Malformed",
                location="X",
                lat=30.0, lng=78.0,
                products='[not valid json, fallback',
            )
            db.session.add(w)
            db.session.commit()
            result = w.get_products_list()
            # Should not raise; falls back to comma-split
            assert isinstance(result, list)

    def test_product_names_with_spaces_are_stripped(self, app):
        with app.app_context():
            w = Warehouse(
                name="SpaceyWarehouse",
                location="X",
                lat=30.0, lng=78.0,
                products=" Widget , Gadget , Doohickey ",
            )
            db.session.add(w)
            db.session.commit()
            assert w.get_products_list() == ["Widget", "Gadget", "Doohickey"]

    def test_json_with_non_list_root_falls_back(self, app):
        """JSON object root (not an array) should fall back to CSV parsing."""
        with app.app_context():
            w = Warehouse(
                name="JsonObject",
                location="X",
                lat=30.0, lng=78.0,
                products='{"item": "Laptop"}',
            )
            db.session.add(w)
            db.session.commit()
            result = w.get_products_list()
            assert isinstance(result, list)


# ─── Fix 2: /api/warehouses includes all fields ──────────────────────────────

class TestApiWarehousesEndpoint:
    """The /api/warehouses endpoint must return live DB data with products."""

    def test_returns_200(self, auth_client):
        response = auth_client.get("/api/warehouses")
        assert response.status_code == 200

    def test_returns_all_seeded_warehouses(self, auth_client):
        data = auth_client.get("/api/warehouses").get_json()
        names = [w["name"] for w in data]
        assert "JSON Warehouse" in names
        assert "CSV Warehouse" in names

    def test_response_includes_required_fields(self, auth_client):
        data = auth_client.get("/api/warehouses").get_json()
        for warehouse in data:
            assert "id" in warehouse
            assert "name" in warehouse
            assert "lat" in warehouse
            assert "lng" in warehouse
            assert "location" in warehouse
            assert "products" in warehouse
            assert isinstance(warehouse["products"], list)

    def test_json_warehouse_products_decoded(self, auth_client):
        data = auth_client.get("/api/warehouses").get_json()
        json_wh = next(w for w in data if w["name"] == "JSON Warehouse")
        assert json_wh["products"] == ["Laptops", "Smartphones", "Tablets"]

    def test_csv_warehouse_products_decoded(self, auth_client):
        data = auth_client.get("/api/warehouses").get_json()
        csv_wh = next(w for w in data if w["name"] == "CSV Warehouse")
        assert csv_wh["products"] == ["Medicines", "First Aid", "Health Supplements"]

    def test_requires_authentication(self, client):
        response = client.get("/api/warehouses")
        # Should redirect to login
        assert response.status_code in (302, 401)


# ─── Fix 3: Server-side order validation ─────────────────────────────────────

class TestPlaceOrderValidation:
    """place_order() must reject malformed payloads with 422 + flash messages."""

    def _valid_payload(self, app):
        with app.app_context():
            wh = Warehouse.query.filter_by(name="JSON Warehouse").first()
            return {
                "items": [f"{wh.id}:Laptops"],
                "total_weight": "1.5",
                "order_type": "normal",
                "delivery_lat": "30.3165",
                "delivery_lng": "78.0322",
                "delivery_address": "Test Address",
            }

    def test_valid_order_creates_successfully(self, auth_client, app):
        payload = self._valid_payload(app)
        response = auth_client.post("/place_order", data=payload, follow_redirects=True)
        assert response.status_code == 200
        assert b"Order placed successfully" in response.data

    def test_missing_items_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload.pop("items")
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_malformed_item_format_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["items"] = ["INVALID_NO_COLON"]
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_invalid_latitude_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["delivery_lat"] = "999"  # Out of range
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_invalid_longitude_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["delivery_lng"] = "-999"
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_non_numeric_coordinates_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["delivery_lat"] = "not_a_float"
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_zero_weight_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["total_weight"] = "0"
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_negative_weight_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["total_weight"] = "-2.0"
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_nonexistent_warehouse_id_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["items"] = ["99999:SomeProduct"]  # ID that doesn't exist
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422

    def test_non_integer_warehouse_id_rejected(self, auth_client, app):
        payload = self._valid_payload(app)
        payload["items"] = ["abc:SomeProduct"]
        response = auth_client.post("/place_order", data=payload)
        assert response.status_code == 422