import asyncio
from backend.app.schemas.tools import SearchKnowledgeRequest
from backend.app.api.v1.routes.tools import execute_knowledge_search
from backend.app.services.tool_service import ToolService
from uuid import UUID

async def main():
    service = ToolService(UUID('00000000-0000-0000-0000-000000000001'))
    payload = SearchKnowledgeRequest(question="What photography services do you offer for clothing brands?")
    try:
        res = await execute_knowledge_search(payload, service)
        print("Success:", res)
    except Exception as e:
        print("Exception:", repr(e))

if __name__ == "__main__":
    asyncio.run(main())
