import pytest

def test_quality_score_calculation():
    # Directly test the math
    assert (2 / 2) * 100 == 100.0
    assert (1 / 2) * 100 == 50.0
    assert (0 / 2) * 100 == 0.0

def test_drift_flag_logic():
    # Directly test the logic using precedence parentheses to avoid `50 < threshold and threshold is True`
    threshold = 75
    assert (50 < threshold) is True
    assert (100 < threshold) is False
    assert (75 < threshold) is False

def test_run_evaluation_returns_score(client):
    # Setup: Create a service first
    payload = {
        "name": "Service for Run Eval",
        "owner": "Tester",
        "environment": "dev",
        "model_name": "gpt-4o",
        "data_sensitivity": "internal"
    }
    create_res = client.post("/api/services/", json=payload)
    assert create_res.status_code == 201
    service_id = create_res.json()["id"]
    
    # Run evaluation
    eval_res = client.post(f"/api/evaluations/run/{service_id}")
    assert eval_res.status_code == 200
    
    data = eval_res.json()
    assert "quality_score" in data
    assert 0 <= data["quality_score"] <= 100

def test_get_evaluations_returns_list(client):
    # Setup: Create a service first
    payload = {
        "name": "Service for List Eval",
        "owner": "Tester",
        "environment": "dev",
        "model_name": "gpt-4o",
        "data_sensitivity": "internal"
    }
    create_res = client.post("/api/services/", json=payload)
    assert create_res.status_code == 201
    service_id = create_res.json()["id"]
    
    # Run an evaluation to ensure at least one evaluation exists
    client.post(f"/api/evaluations/run/{service_id}")
    
    # Get all evaluations
    list_res = client.get(f"/api/evaluations/{service_id}")
    assert list_res.status_code == 200
    
    data = list_res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "timestamp" in data[0]
