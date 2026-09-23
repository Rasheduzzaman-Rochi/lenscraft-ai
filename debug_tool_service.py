import asyncio
from uuid import UUID
from backend.app.schemas.tools import SearchKnowledgeRequest
from backend.app.services.tool_service import ToolService

async def main():
    service = ToolService(UUID('00000000-0000-0000-0000-000000000001'))
    try:
        res = await service.search_knowledge(SearchKnowledgeRequest(question="What photography services do you offer for clothing brands?"))
        print(res)
    except Exception as e:
        import traceback
        traceback.print_exc()

asyncio.run(main())
