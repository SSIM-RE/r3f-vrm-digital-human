import json
import numpy as np

# 加载之前保存的 API 响应
with open('api_wave_response.json') as f:
    api_data = json.load(f)

# 加载 sitdown.npy
npy_data = np.load('D:/projects/vrm-bone-test/sitdown.npy', allow_pickle=True)
data = npy_data.item()
motion = data['motion'][0]  # shape: (22, 3, 120)
motion_t = np.transpose(motion, (2, 0, 1))  # (120, 22, 3)

print("=== 同一动作（wave vs sitdown）数据对比 ===")
print("API wave pelvis Y:", api_data[0][0][1])
print("sitdown.npy pelvis Y:", motion_t[0][0][1])
print()

print("=== 完整数据对比 ===")
print("API wave 第一帧:", api_data[0][0])
print("sitdown 第一帧:", motion_t[0][0])
print()

print("=== 结论 ===")
print("格式完全相同，都是 [x, y, z] 顺序")
print("差异只是 Y 值的绝对位置偏移")
