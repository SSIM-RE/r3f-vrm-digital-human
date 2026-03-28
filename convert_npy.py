import json
import numpy as np

# 加载服务端保存的原始 npy (walks)
npy_data = np.load('D:/dip_output.npy')
print("=== npy 数据 (walks) ===")
print("形状:", npy_data.shape)  # (22, 3, 120)

# 转置为 (frames, joints, 3)
npy_t = np.transpose(npy_data, (2, 0, 1))
print("转置后形状:", npy_t.shape)

# 保存为 JSON
motion_list = npy_t.tolist()
with open('D:/projects/r3f-vrm-final-main/public/walks_from_npy.json', 'w') as f:
    json.dump(motion_list, f)

print("\n已保存到 public/walks_from_npy.json")
print("第一帧第一个关节:", motion_list[0][0])
