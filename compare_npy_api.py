import json

# 本地 npy 转换的数据
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    npy_data = json.load(f)

# DiP API 返回的数据
with open('dip_api_wave.json') as f:
    api_data = json.load(f)

print("=== 数据格式对比 ===")
print(f"npy 帧数: {len(npy_data)}, 关节数: {len(npy_data[0])}")
print(f"API 帧数: {len(api_data)}, 关节数: {len(api_data[0])}")

print("\n=== 关节名称对比 ===")
print("npy 关节名称: 无 (只保存了数据)")

# 检查服务端返回的关节名称
import requests
response = requests.post("http://127.0.0.1:5002/api/generate", json={"prompt": "test"})
data = response.json()
if data.get("status") == "ok":
    print("API 关节名称:", data["hml_names"])

print("\n=== 关节顺序对比 (第一帧前5个) ===")
print("npy[0]:", npy_data[0][0:5])
print("api[0]:", api_data[0][0:5])

print("\n=== wave 动作第一帧手臂位置对比 ===")
# 16-22 是手臂关节
print("npy rightUpperArm:", npy_data[0][16])
print("api rightUpperArm:", api_data[0][16])
