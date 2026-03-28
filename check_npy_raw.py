import numpy as np

# 加载 DiP 生成的原始 npy 数据
npy_data = np.load('D:/projects/vrm-bone-test/tpose.npy', allow_pickle=True)

print("=== 原始 npy 数据格式 ===")
print(f"类型: {type(npy_data)}")
print(f"形状: {npy_data.shape}")

if npy_data.shape == ():
    # 字典格式
    print("是字典格式")
    data = npy_data.item()
    print("字典键:", list(data.keys()))
    motion = data['motion']
    print(f"motion 形状: {motion.shape}")
    print(f"motion 类型: {type(motion)}")
    
    # 转换为 (frames, joints, 3)
    if len(motion.shape) == 4:
        motion = motion[0]  # (joints, 3, frames)
    motion_t = np.transpose(motion, (2, 0, 1))
    print(f"转置后形状: {motion_t.shape}")
    
    # 第一帧第一个关节
    print(f"\n第一帧第一个关节: {motion_t[0][0]}")
else:
    print(f"数据形状: {npy_data.shape}")
