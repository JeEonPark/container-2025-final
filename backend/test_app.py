import pytest
from app import app


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


def test_hello_endpoint(client):
    """Test the /api/hello endpoint."""
    response = client.get("/api/hello")
    assert response.status_code == 200

    json_data = response.get_json()
    assert json_data is not None
    assert "message" in json_data
    assert json_data["message"] == "Hello from Flask!"


def test_hello_endpoint_content_type(client):
    """Test that the /api/hello endpoint returns JSON."""
    response = client.get("/api/hello")
    assert response.content_type == "application/json"


def test_nonexistent_endpoint(client):
    """Test that nonexistent endpoints return 404."""
    response = client.get("/api/nonexistent")
    assert response.status_code == 404
