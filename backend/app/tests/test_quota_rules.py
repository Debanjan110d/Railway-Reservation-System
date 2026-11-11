import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.reservation_service import ReservationService

client = TestClient(app)

def test_senior_citizen_quota_eligibility():
    # Valid senior citizen (age >= 60)
    valid_res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "SS",
        "passengers": [{"name": "Shri Mukherjee", "age": 65, "gender": "M", "berth_preference": "LOWER"}]
    })
    assert valid_res.status_code == 200
    assert valid_res.json()["quota"] == "SS"

    # Ineligible senior citizen (age < 60 for male)
    invalid_res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "SS",
        "passengers": [{"name": "Young Rahul", "age": 30, "gender": "M"}]
    })
    assert invalid_res.status_code == 400
    assert "Senior Citizen" in invalid_res.json()["detail"]

def test_ladies_quota_eligibility():
    # Valid female passenger
    valid_res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "LD",
        "passengers": [{"name": "Pooja Sharma", "age": 28, "gender": "F"}]
    })
    assert valid_res.status_code == 200
    assert valid_res.json()["quota"] == "LD"

    # Ineligible male adult passenger (> 12 yrs)
    invalid_res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "LD",
        "passengers": [{"name": "Rohit Verma", "age": 25, "gender": "M"}]
    })
    assert invalid_res.status_code == 400
    assert "Ladies Quota" in invalid_res.json()["detail"]

    # Child male <= 12 years accompanied under LD
    child_res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "LD",
        "passengers": [{"name": "Child Amit", "age": 8, "gender": "M"}]
    })
    assert child_res.status_code == 200

def test_tatkal_quota_and_fare_calculation():
    # Tatkal booking
    res = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "TQ",
        "passengers": [{"name": "Arjun Roy", "age": 35, "gender": "M"}]
    })
    assert res.status_code == 200
    data = res.json()
    assert data["quota"] == "TQ"
    assert "fare_breakdown" in data
    fare = data["fare_breakdown"]
    # Verify Tatkal surcharge applied based on allocated class rules (e.g. 2AC min 400, 3AC min 300)
    assert fare["base_fare"] > 0
    assert fare["tatkal_charge"] >= 300.0
    assert fare["total_fare"] == fare["base_fare"] + fare["tatkal_charge"]

def test_highest_age_limit_enforcement():
    # Age 100 is valid
    res_100 = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "GN",
        "passengers": [{"name": "Centenarian Das", "age": 100, "gender": "M"}]
    })
    assert res_100.status_code == 200

    # Age 101 must be rejected by Pydantic validation (422)
    res_101 = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "GN",
        "passengers": [{"name": "Over 100", "age": 101, "gender": "M"}]
    })
    assert res_101.status_code == 422

    # Age 0 must be rejected (422)
    res_0 = client.post("/api/v1/bookings/hold", json={
        "train_run_id": 1,
        "quota": "GN",
        "passengers": [{"name": "Zero Age", "age": 0, "gender": "M"}]
    })
    assert res_0.status_code == 422
