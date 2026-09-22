import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

client = TestClient(app)
response = client.post("/missing-route")
print("Response text:", repr(response.text))
print("Response json:", response.json())
