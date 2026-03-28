import json
import numpy as np

# 加载 API 响应
with open('api_wave_response.json') as f:
    api_data = json.load(f)

# 加载 sitdown.npy (字典格式)
npy_data = np.load('D:/projects/vrm-bone-test/sitdown.npy', allow_pickle=True)
data = npy_data.item()
motion = data['motion']
# shape: (3, 22, 3, 120) -> 取第一维第一个样本
motion = motion[0]  # (22, 3, 120)
# 转置
motion_t = np.transpose(motion, (2, 0, 1))  # (120, 22, 3)

print("=== 对比 ===")
print("API 第一帧第一个关节:", api_data[0][0])
print("sitdown.npy 第一帧第一个关节:", motion_t[0][0])
print()
print("API pelvis Y:", api_data[0][0][1])
print("sitdown.npy pelvis Y:", motion_t[0][0][1])
