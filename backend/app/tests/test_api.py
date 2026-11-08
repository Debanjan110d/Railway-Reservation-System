from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Custom PNR Hash Table" in data["dsa_features"][0]

def test_list_trains():
    response = client.get("/api/v1/trains/")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) >= 2

def test_dsa_metrics_endpoint():
    response = client.get("/api/v1/metrics/dsa")
    assert response.status_code == 200
    metrics = response.json()
    assert "hash_table" in metrics
    assert "bloom_filter" in metrics
    assert "load_factor" in metrics["hash_table"]
    assert "bit_array_size_m" in metrics["bloom_filter"]

def test_pnr_not_found_bloom_filter_fast_rejection():
    # Looking up a nonexistent PNR should trigger Bloom Filter fast rejection
    response = client.get("/api/v1/pnr/9999999999")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert detail["bloom_filter_pre_check"] is False
    assert "Fast-path rejection" in detail["dsa_optimization"]

def test_full_api_booking_and_chart_flow():
    # 1. Hold a booking
    hold_payload = {
        "train_run_id": 1,
        "quota": "SS",
        "passengers": [
            {"name": "Prof. Sharma", "age": 68, "gender": "M", "berth_preference": "LOWER"}
        ]
    }
    hold_res = client.post("/api/v1/bookings/hold", json=hold_payload)
    assert hold_res.status_code == 200
    booking_data = hold_res.json()
    pnr = booking_data["pnr"]
    assert booking_data["booking_status"] == "HELD"

    # 2. Complete payment
    pay_payload = {
        "pnr": pnr,
        "amount": 500.0,
        "simulate_success": True
    }
    pay_res = client.post("/api/v1/bookings/pay", json=pay_payload)
    assert pay_res.status_code == 200
    assert pay_res.json()["booking_status"] == "CONFIRMED"

    # 3. Lookup PNR (Bloom filter should be True, hash table hit)
    pnr_res = client.get(f"/api/v1/pnr/{pnr}")
    assert pnr_res.status_code == 200
    pnr_data = pnr_res.json()
    assert pnr_data["pnr"] == pnr
    assert pnr_data["dsa_audit"]["bloom_filter_pre_check"] is True
    assert pnr_data["dsa_audit"]["hash_table_hit"] is True

    # 4. Fetch sorted reservation chart
    chart_res = client.get("/api/v1/chart/1")
    assert chart_res.status_code == 200
    chart_data = chart_res.json()
    assert "Custom Academic Stable Merge Sort" in chart_data["sorting_algorithm_used"]
    assert len(chart_data["sorted_chart"]) > 0

    # Verify chart is strictly sorted by coach then berth number
    chart = chart_data["sorted_chart"]
    for i in range(len(chart) - 1):
        c1, b1 = chart[i]["coach_code"], chart[i]["berth_number"]
        c2, b2 = chart[i+1]["coach_code"], chart[i+1]["berth_number"]
        if c1 == c2:
            assert b1 <= b2, f"Berth sorting order violation: {b1} > {b2} in coach {c1}"

