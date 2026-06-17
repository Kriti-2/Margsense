def test_officer_login(auth_client):
    response = auth_client.post(
        "/auth/login",
        json={"username": "officer", "password": "test-pass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert data["role"] == "officer"
    assert "access_token" in data


def test_officer_login_invalid(auth_client):
    response = auth_client.post(
        "/auth/login",
        json={"username": "officer", "password": "wrong"},
    )
    assert response.status_code == 401


def test_shift_planner_requires_auth(auth_client):
    response = auth_client.get("/shift-planner")
    assert response.status_code == 401


def test_shift_planner_with_token(auth_client, officer_token):
    response = auth_client.get(
        "/shift-planner",
        headers={"Authorization": f"Bearer {officer_token}"},
    )
    assert response.status_code == 200
    assert "assignments" in response.json()


def test_ingest_requires_auth(auth_client):
    response = auth_client.post(
        "/ingest/violation",
        json={
            "latitude": 12.9352,
            "longitude": 77.6245,
            "vehicle_type": "CAR",
            "violation_types": ["NO PARKING"],
        },
    )
    assert response.status_code == 401


def test_ingest_with_api_key(auth_client):
    response = auth_client.post(
        "/ingest/violation",
        json={
            "latitude": 12.9352,
            "longitude": 77.6245,
            "vehicle_type": "CAR",
            "violation_types": ["NO PARKING"],
        },
        headers={"X-API-Key": "test-ingest-key"},
    )
    assert response.status_code == 200
    assert "ingested" in response.json()


def test_public_analytics_no_auth(auth_client):
    response = auth_client.get("/analytics")
    assert response.status_code == 200


def test_health_exempt(auth_client):
    response = auth_client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
