import os
import requests

api_key = os.environ.get("GROQ_API_KEY", "")
if api_key:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    response = requests.get("https://api.groq.com/openai/v1/models", headers=headers)
    print(response.json())
else:
    print("No GROQ_API_KEY found")
