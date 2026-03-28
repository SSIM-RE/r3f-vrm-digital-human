# DiP API 测试脚本
# 运行方式: python test_dip_api.py

import requests
import json

# 调用 DiP API
response = requests.post(
    "http://127.0.0.1:5002/api/generate",
    json={"prompt": "wave hand"}
)

data = response.json()

if data.get("status") == "ok":
    # 保存 motion 数据
    with open("dip_wave.json", "w") as f:
        json.dump(data["motion"], f)
    
    # 保存第一帧的骨骼位置
    first_frame = data["motion"][0]
    hml_names = data["hml_names"]
    
    print("=== DiP API 返回的 HML 骨骼名称 ===")
    for i, name in enumerate(hml_names):
        print(f"{i}: {name}")
    
    print("\n=== 第一帧骨骼位置 ===")
    for i, (name, pos) in enumerate(zip(hml_names, first_frame)):
        print(f"{i:2d} {name:20s}: [{pos[0]:8.4f}, {pos[1]:8.4f}, {pos[2]:8.4f}]")
    
    print("\n数据已保存到 dip_wave.json")
else:
    print("Error:", data.get("message"))
