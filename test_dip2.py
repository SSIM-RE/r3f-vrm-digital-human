import requests
import json
import time

# 测试单动作生成
print("=== 测试单动作生成: wave hand ===")
start = time.time()
try:
    response = requests.post(
        'http://localhost:5002/api/generate',
        json={'prompt': 'wave hand'},
        headers={'Content-Type': 'application/json'},
        timeout=300
    )
    elapsed = time.time() - start
    print(f"状态: {response.status_code}, 耗时: {elapsed:.1f}秒")
    
    if response.status_code == 200:
        data = response.json()
        print(f"帧数: {data.get('frames')}")
        print(f"关节数: {data.get('joints')}")
        print(f"第一帧前3关节: {data.get('motion', [[]])[0][:3] if data.get('motion') else 'N/A'}")
    else:
        print(f"错误: {response.text[:500]}")
except Exception as e:
    print(f"请求失败: {e}")