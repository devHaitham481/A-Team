import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

API_KEY = os.environ.get("GOOGLE_API_KEY")

if not API_KEY:
    print("GOOGLE_API_KEY not set")
    exit(1)

client = genai.Client(api_key=API_KEY, http_options={"api_version": "v1alpha"})

print("Listing models...")
try:
    for m in client.models.list():
        if "gemini" in m.name:
            print(f"Name: {m.name}, Display: {m.display_name}")
            # Check supported generation methods if available in the object
            if hasattr(m, 'supported_generation_methods'):
                print(f"  Methods: {m.supported_generation_methods}")
except Exception as e:
    print(f"Error: {e}")
