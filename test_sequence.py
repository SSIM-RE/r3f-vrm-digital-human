import requests
import json

print("Testing /api/generate_sequence...")
response = requests.post(
    'http://localhost:5002/api/generate_sequence',
    json={'prompts': ['wave', 'nod']}
)
print(f"Status: {response.status_code}")
print(f"Response: {response.text[:500] if response.text else 'empty'}")