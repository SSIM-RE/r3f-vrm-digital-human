import json
import numpy as np

# 加载 API 响应
with open('api_wave_response.json') as f:
    api_data = json.load(f)

# 加载本地 tpose_all.json
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    tpose_data = json.load(f)

# 加载 sitdown.npy
npy_data = np.load('D:/projects/vrm-bone-test/sitdown.npy', allow_pickle=True)
data = npy_data.item()
motion = data['motion'][0]
motion_t = np.transpose(motion, (2, 0, 1))

print("=== pelvis Y 对比 ===")
print("API wave:", api_data[0][0][1])
print("tpose_all.json:", tpose_data[0][0][1])
print("sitdown.npy:", motion_t[0][0][1])

print("\n=== API wave 与 tpose_all 差异 ===")
diff = api_data[0][0][1] - tpose_data[0][0][1]
print("Y 差值:", diff)

print("\n=== 结论 ===")
print("API 数据 pelvis Y ≈ 1.37")
print("tpose_all.json pelvis Y ≈ 0.96")
print("sitdown.npy pelvis Y ≈ 0.98")
print("\nAPI 数据的 Y 值偏移了约 +0.4")
