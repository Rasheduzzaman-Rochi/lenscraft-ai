import asyncio
from fastapi.testclient import TestClient
from backend.app.main import app

app.dependency_overrides.clear()
from backend.app.api.v1.routes.tools import get_authenticated_tool_service
from backend.app.services.tool_service import ToolService
from uuid import UUID

async def mock_dep():
    return ToolService(company_id=UUID('00000000-0000-0000-0000-000000000001'))

app.dependency_overrides[get_authenticated_tool_service] = mock_dep

client = TestClient(app)

def test_endpoint():
    response = client.post("/api/v1/tools/search-knowledge", json={"question": "What photography services do you offer for clothing brands?"})
    print(response.status_code)
    print(response.text)

test_endpoint()
