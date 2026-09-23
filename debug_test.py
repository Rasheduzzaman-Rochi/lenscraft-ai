import asyncio
from uuid import UUID
from app.schemas.knowledge import KnowledgeSearchRequest

try:
    req = KnowledgeSearchRequest(
        company_id=UUID('00000000-0000-0000-0000-000000000001'),
        query="What photography services do you offer for clothing brands?",
        limit=5,
        max_context_characters=6000
    )
    print("Schema OK:", req)
except Exception as e:
    print("Schema error:", repr(e))
