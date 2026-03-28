# 对比同一个 wave 动作的 npy 和 API 数据
import requests
import json
import numpy as np

# 1. 调用 DiP API 获取 wave
print("=== 调用 DiP API ===")
response = requests.post(
    "http://127.0.0.1:5002/api/generate",
    json={"prompt": "wave hand"}
)

data = response.json()
if data.get("status") == "ok":
    api_motion = data["motion"]
    print("API 数据第一帧:", api_motion[0][0])
    
    # 保存 API 数据
    with open('wave_from_api.json', 'w') as f:
        json.dump(api_motion, f)
    print("已保存 API 数据到 wave_from_api.json")

# 2. 检查 vrm-bone-test 的 sitdown.npy 是否能用于 wave 测试
# 实际上我们应该让用户用 DiP 生成后保存原始 npy 文件

print("\n=== 请用 DiP 生成一次动作 ===")
print("然后我会检查服务端是否生成了 npy 文件")
