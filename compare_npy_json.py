import json
import numpy as np

# 原始 npy 数据
npy_data = np.load('D:/projects/vrm-bone-test/tpose.npy', allow_pickle=True)
data = npy_data.item()
motion = data['motion']
motion_t = np.transpose(motion[0], (2, 0, 1))  # 转置后

# vrm-bone-test 的 tpose_all.json
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    json_data = json.load(f)

# 对比
print("=== 数据对比 ===")
print("原始 npy 第一帧第一个关节:", motion_t[0][0])
print("tpose_all.json 第一帧第一个关节:", json_data[0][0])

print("\n=== 差异 ===")
diff = [motion_t[0][0][i] - json_data[0][0][i] for i in range(3)]
print("差异:", diff)

# 检查是否是 Y 偏移
print("\n=== 完整对比前5个关节 ===")
for i in range(5):
    print(f"关节{i}: npy={motion_t[0][i]}, json={json_data[0][i]}")
