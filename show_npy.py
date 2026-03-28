import json

# 本地 npy 转换的数据
with open('D:/projects/vrm-bone-test/tpose_all.json') as f:
    npy_data = json.load(f)

print("=== 本地 npy 数据格式 ===")
print(f"帧数: {len(npy_data)}")
print(f"关节数: {len(npy_data[0])}")

print("\n=== 第一帧所有关节位置 ===")
joint_names = ['pelvis', 'right_up_leg', 'left_up_leg', 'spine1', 'right_leg', 'left_leg', 
               'spine2', 'right_foot', 'left_foot', 'spine3', 'right_toes', 'left_toes',
               'neck', 'right_collar', 'left_collar', 'head', 'right_shoulder', 'left_shoulder',
               'right_elbow', 'left_elbow', 'right_wrist', 'left_wrist']

for i, name in enumerate(joint_names):
    print(f"{i:2d} {name:20s}: {npy_data[0][i]}")

print("\n=== 翻转 Z 轴后的数据 ===")
for i, name in enumerate(joint_names):
    x, y, z = npy_data[0][i]
    print(f"{i:2d} {name:20s}: [{x}, {y}, {-z}]")
