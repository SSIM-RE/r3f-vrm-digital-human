import json
import numpy as np

# 加载服务端保存的原始 npy
npy_data = np.load('D:/dip_output.npy')
print("=== npy 数据 ===")
print("形状:", npy_data.shape)
print("第一帧第一个关节:", npy_data[0][0])

# 转置为 (frames, joints, 3)
npy_t = np.transpose(npy_data, (2, 0, 1))
print("转置后形状:", npy_t.shape)
print("转置后第一帧第一个关节:", npy_t[0][0])

# 加载前端返回的数据
with open('api_wave_response.json') as f:
    api_data = json.load(f)

print("\n=== API 响应数据 ===")
print("第一帧第一个关节:", api_data[0][0])

print("\n=== 对比 ===")
print("npy:", npy_t[0][0])
print("API:", api_data[0][0])
print("差异:", npy_t[0][0] - np.array(api_data[0][0]))
