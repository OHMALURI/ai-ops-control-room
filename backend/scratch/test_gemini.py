import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
model_name = os.getenv("GEMINI_JUDGE_MODEL", "gemini-2.5-flash")

print(f"Testing with API Key: {api_key[:5]}...{api_key[-5:] if api_key else 'None'}")
print(f"Model: {model_name}")

if not api_key:
    print("Error: GEMINI_API_KEY not set")
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel(model_name)

try:
    resp = model.generate_content("Reply with exactly two words: API OK")
    print(f"Success! Response: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
