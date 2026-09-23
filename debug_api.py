import asyncio
from httpx import AsyncClient
from backend.app.main import app

async def main():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Mock the tool service dependency to avoid security check
        pass
        
if __name__ == "__main__":
    asyncio.run(main())
