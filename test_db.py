import asyncio
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_endpoint():
    response = client.post("/api/v1/tools/search-knowledge-test", json={"question": "What photography services do you offer for clothing brands?"})
    print(response.status_code)
    print(response.text)

test_endpoint()
