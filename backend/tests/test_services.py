import pytest

def test_create_service_valid(client):
    payload = {
        "name": "Test Service",
        "owner": "Ohm",
        "environment": "dev",
        "model_name": "gpt-4o",
        "data_sensitivity": "internal"
    }
    response = client.post("/api/services/", json=payload)
    
    # Assert response status code is 201
    assert response.status_code == 201
    
    data = response.json()
    # Assert response JSON contains an "id" field that is an integer
    assert "id" in data
    assert isinstance(data["id"], int)
    
    # Assert response JSON "name" equals "Test Service"
    assert data["name"] == "Test Service"

def test_create_service_missing_field(client):
    payload = {
        "name": "Test Service"
    }
    response = client.post("/api/services/", json=payload)
    
    # Assert response status code is 422
    assert response.status_code == 422

def test_delete_service(client):
    # First POST to create a service
    payload = {
        "name": "Service To Delete",
        "owner": "Ohm",
        "environment": "dev",
        "model_name": "gpt-4o",
        "data_sensitivity": "internal"
    }
    create_response = client.post("/api/services/", json=payload)
    assert create_response.status_code == 201
    
    # Get the id from the response
    service_id = create_response.json()["id"]
    
    # Then DELETE to /api/services/{id}
    delete_response = client.delete(f"/api/services/{service_id}")
    assert delete_response.status_code == 200
    
    # Then GET /api/services/{id} and assert status code is 404
    get_response = client.get(f"/api/services/{service_id}")
    assert get_response.status_code == 404
