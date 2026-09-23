import asyncio
from unittest.mock import patch, MagicMock, AsyncMock

from backend.app.schemas.tools import SearchKnowledgeRequest
from backend.app.services.tool_service import ToolService
from backend.app.services.knowledge_service import KnowledgeService
from backend.app.repositories.knowledge_repository import KnowledgeRepository
from uuid import UUID

async def main():
    service = ToolService(company_id=UUID('00000000-0000-0000-0000-000000000001'))
    # mock embeddings
    service.knowledge.embeddings.configured = False
    
    # mock repository
    repo_mock = AsyncMock()
    repo_mock.search_documents.return_value = []
    service.knowledge.repository = repo_mock
    
    payload = SearchKnowledgeRequest(question="What photography services do you offer for clothing brands?")
    
    from backend.app.api.v1.routes.tools import execute_knowledge_search
    try:
        res = await execute_knowledge_search(payload, service)
        print("Success:", res)
    except Exception as e:
        print("Exception:", repr(e))

if __name__ == "__main__":
    asyncio.run(main())
