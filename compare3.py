import json
import numpy as np

with open('dip_api_wave.json') as f:
    api = json.load(f)

# 获取第一帧（作为参考 T-Pose）
first_frame = np.array(api[0])
print("=== API 数据第一帧（作为 T-Pose 参考）===")
for i in range(22):
    print(f"{i}: {api[0][i]}")

# 转换所有帧为 numpy 数组
api_array = np.array(api)

# 减去第一帧，获取相对运动
relative_motion = api_array - first_frame

print("\n=== 相对运动（减去第一帧）第一帧 ===")
for i in range(5):
    print(f"{i}: {relative_motion[0][i]}")

# 保存相对运动数据
with open('dip_api_relative.json', 'w') as f:
    json.dump(relative_motion.tolist(), f)

print("\n相对运动数据已保存到 dip_api_relative.json")
