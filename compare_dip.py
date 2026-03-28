# 对比 DiP API 返回数据和 npy 文件数据
import requests
import json

# 1. 调用 DiP API
print("=== 调用 DiP API ===")
response = requests.post(
    "http://127.0.0.1:5002/api/generate",
    json={"prompt": "wave hand"}
)
data = response.json()

if data.get("status") == "ok":
    motion = data["motion"]
    hml_names = data["hml_names"]
    
    print(f"API 返回帧数: {len(motion)}")
    print(f"关节数: {len(motion[0])}")
    print(f"关节名称: {hml_names}")
    print()
    
    print("=== API 第一帧前5个关节位置 ===")
    for i in range(5):
        print(f"{i} {hml_names[i]}: {motion[0][i]}")
    
    # 保存 API 数据
    with open("dip_api_wave.json", "w") as f:
        json.dump(motion, f)
    print("\nAPI 数据已保存到 dip_api_wave.json")

# 2. 加载 npy 文件
print("\n=== 加载 npy 文件 ===")
import numpy as np
import json as json_lib

# 加载 JSON 文件（不是 npy）
with open("D:/projects/vrm-bone-test/tpose_all.json", "r") as f:
    npy_data = json_lib.load(f)

print(f"npy 文件帧数: {len(npy_data)}")
print(f"npy 文件关节数: {len(npy_data[0])}")

print("\n=== npy 第一帧前5个关节位置 ===")
for i in range(5):
    print(f"{i}: {npy_data[0][i]}")

print("\n=== 对比 ===")
print("API 第一个关节:", motion[0][0])
print("npy 第一个关节:", npy_data[0][0])
