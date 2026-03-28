import sys
import requests
import json
import time
import threading

# 测试单动作生成
print("=== 测试单动作生成: wave hand ===")
print("开始请求...")

try:
    response = requests.post(
        'http://localhost:5002/api/generate',
        json={'prompt': 'wave hand'},
        timeout=600
    )
    print(f"状态: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"帧数: {data.get('frames')}")
        print(f"关节数: {data.get('joints')}")
        if data.get('motion'):
            print(f"第一帧前2关节: {data['motion'][0][:2]}")
    else:
        print(f"错误: {response.text[:500]}")
except Exception as e:
    print(f"请求失败: {type(e).__name__}: {e}")

print("完成")