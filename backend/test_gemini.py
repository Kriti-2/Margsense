import os
import asyncio
from app.config import get_settings
from google import genai

async def list_models():
    # Load and apply proxy if configured in environment
    gemini_proxy = os.environ.get("GEMINI_PROXY", "")
    if gemini_proxy:
        os.environ["HTTPS_PROXY"] = gemini_proxy
        print(f"Running test using proxy: {gemini_proxy}")
        
    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    try:
        print("Listing models...")
        response = client.models.list()
        for m in response:
            print(m.name)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(list_models())
