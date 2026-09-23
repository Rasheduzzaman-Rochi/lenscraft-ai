import asyncio
from httpx import AsyncClient
from backend.app.main import app

async def main():
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Send a request with NO company_id
        # We need to bypass `verify_retell_request_signature` or patch the dependencies again.
        pass
        
if __name__ == "__main__":
    asyncio.run(main())
