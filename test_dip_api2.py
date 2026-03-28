# 直接调用 DiP 生成并保存数据
import requests
import json
import numpy as np
import tempfile

# 调用 DiP API
print("=== 调用 DiP API ===")
response = requests.post(
    "http://127.0.0.1:5002/api/generate",
    json={"prompt": "wave hand"}
)

data = response.json()

if data.get("status") == "ok":
    # 保存 API 响应
    with open('api_wave_response.json', 'w') as f:
        json.dump(data['motion'], f)
    print("API 响应已保存到 api_wave_response.json")
    print("第一帧第一个关节:", data['motion'][0][0])
