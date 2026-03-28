import requests
import json

# 测试单动作生成
print("=== 测试单动作生成 ===")
response = requests.post(
    'http://localhost:5002/api/generate',
    json={'prompt': 'wave hand'},
    headers={'Content-Type': 'application/json'}
)
print(f"状态: {response.status_code}")
if response.status_code == 200:
    data = response.json()
    print(f"帧数: {data.get('frames')}")
    print(f"关节数: {data.get('joints')}")
else:
    print(f"错误: {response.text[:200]}")